'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { GameButton } from '@/components/ui/GameButton';
import {
  CODE_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  describeAuthError,
  formatCooldown,
  isCompleteCode,
  isProbablyEmail,
  maskEmail,
  normalizeCode,
  type AuthFailure,
} from '@/cloud/authErrors';
import { getCloudClient } from '@/cloud/client';

import { AuthError, AuthShell, AuthStatus } from './AuthShell';

/**
 * Email-code sign-in, in two deliberate screens.
 *
 * This is a refactor of the single combined form that shipped before: the
 * Supabase calls (`signInWithOtp`, `verifyOtp`) and the session handling are
 * unchanged, and `CloudBoundary` still owns the auth subscription. What changed
 * is that asking for an address and entering a code are now separate steps,
 * failures are explained rather than relayed verbatim, and resending is
 * rate-limited in the UI as well as on the server.
 *
 * There is no password, no social provider, no bypass: the only way in is a
 * code Supabase actually delivered.
 */

type Phase = 'email' | 'code';

/** Counts down to zero and stops. Cleared on unmount. */
function useCooldown(): [number, (seconds: number) => void] {
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [remaining]);

  const start = useCallback((seconds: number) => {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);

  return [remaining, start];
}

export function SignInFlow() {
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<false | 'sending' | 'verifying'>(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [notice, setNotice] = useState('');
  const [cooldown, startCooldown] = useCooldown();

  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Move focus with the step, so the keyboard lands where the work is.
  useEffect(() => {
    const target = phase === 'email' ? emailRef.current : codeRef.current;
    // A frame, so the field exists before we reach for it.
    const frame = requestAnimationFrame(() => target?.focus());
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const sendCode = useCallback(
    async (address: string, { resend = false } = {}) => {
      setFailure(null);
      setBusy('sending');
      try {
        const { error } = await getCloudClient().auth.signInWithOtp({
          email: address,
          // Both new and returning people use the same door; a first
          // verification creates the account.
          options: { shouldCreateUser: true },
        });
        if (error) throw error;

        setPhase('code');
        setNotice(resend ? 'A new code is on its way.' : '');
        startCooldown(RESEND_COOLDOWN_SECONDS);
        return true;
      } catch (error) {
        const described = describeAuthError(error, 'request');
        setFailure(described);
        // Honour the server's own backoff when it names one.
        if (described.retryAfter) startCooldown(described.retryAfter);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [startCooldown],
  );

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!isProbablyEmail(address)) {
      setFailure({ kind: 'bad-email', message: 'Enter an email address so we know where to send your code.' });
      emailRef.current?.focus();
      return;
    }
    await sendCode(address);
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = normalizeCode(code);
    if (!isCompleteCode(value)) {
      setFailure({ kind: 'bad-code', message: `Enter the ${CODE_LENGTH}-digit code from your email.` });
      codeRef.current?.focus();
      return;
    }

    setFailure(null);
    setNotice('');
    setBusy('verifying');
    try {
      const { error } = await getCloudClient().auth.verifyOtp({
        email: email.trim(),
        token: value,
        type: 'email',
      });
      if (error) throw error;
      // Success is not rendered here: CloudBoundary's auth subscription picks
      // up the session and swaps this screen for the sync step. Leaving the
      // button in its busy state avoids a flash of "signed in" before the
      // download starts.
      setNotice('Signed in. Opening your progress…');
    } catch (error) {
      setFailure(describeAuthError(error, 'verify'));
      setCode('');
      setBusy(false);
      /*
       * The field is still `disabled` at this instant, and a disabled element
       * cannot take focus. Wait for React to commit the re-enabled input, then
       * put the caret back so a keyboard user is not stranded after an error.
       */
      requestAnimationFrame(() => codeRef.current?.focus());
    }
  };

  const changeEmail = () => {
    setPhase('email');
    setCode('');
    setFailure(null);
    setNotice('');
  };

  /* ---------------- step one: the address ---------------- */

  if (phase === 'email') {
    return (
      <AuthShell
        title="Continue your journey."
        subtitle={<>Your quests, skills, and progress—across your devices.</>}
        footer={
          <p className="text-sm leading-relaxed text-ivory-faint">
            We send a one-time code instead of a password. Nothing on this device is uploaded
            until you choose to.
          </p>
        }
      >
        <form onSubmit={submitEmail} noValidate className="space-y-4">
          <div>
            <label htmlFor="signin-email" className="field-label">
              Email address
            </label>
            <input
              ref={emailRef}
              id="signin-email"
              className="field"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              disabled={busy !== false}
              aria-invalid={failure?.kind === 'bad-email' ? true : undefined}
              aria-describedby={failure ? 'signin-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                if (failure) setFailure(null);
              }}
            />
          </div>

          {failure && <AuthError id="signin-error">{failure.message}</AuthError>}

          <GameButton type="submit" variant="primary" size="lg" block disabled={busy !== false}>
            {busy === 'sending' ? 'Sending code…' : 'Send sign-in code'}
          </GameButton>

          {busy === 'sending' && <AuthStatus>Contacting the sign-in service…</AuthStatus>}
        </form>
      </AuthShell>
    );
  }

  /* ---------------- step two: the code ---------------- */

  const canResend = cooldown <= 0 && busy === false;

  return (
    <AuthShell
      title="Check your email."
      subtitle={
        <>
          We sent a {CODE_LENGTH}-digit code to{' '}
          <span className="whitespace-nowrap text-ivory">{maskEmail(email)}</span>.
        </>
      }
      footer={
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-ivory-faint">Didn&apos;t get it?</span>
            <GameButton
              size="sm"
              disabled={!canResend}
              onClick={() => {
                void sendCode(email.trim(), { resend: true });
              }}
            >
              {cooldown > 0 ? `Resend in ${formatCooldown(cooldown)}` : 'Resend code'}
            </GameButton>
          </div>
          <p className="text-sm leading-relaxed text-ivory-faint">
            Codes expire quickly. Enter it on this device — opening the email on another one
            does not sign you in here.
          </p>
        </div>
      }
    >
      <form onSubmit={submitCode} noValidate className="space-y-4">
        <div>
          <label htmlFor="signin-code" className="field-label">
            {CODE_LENGTH}-digit code
          </label>
          <input
            ref={codeRef}
            id="signin-code"
            className="field text-center font-display text-3xl tracking-[0.4em]"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d*"
            maxLength={CODE_LENGTH}
            placeholder="——————"
            value={code}
            disabled={busy === 'verifying'}
            aria-invalid={failure?.kind === 'bad-code' ? true : undefined}
            aria-describedby={failure ? 'signin-error' : 'signin-code-hint'}
            onChange={(event) => {
              setCode(normalizeCode(event.target.value));
              if (failure) setFailure(null);
            }}
          />
          <p id="signin-code-hint" className="mt-1.5 text-sm text-ivory-faint">
            From the email we just sent.
          </p>
        </div>

        {failure && <AuthError id="signin-error">{failure.message}</AuthError>}

        {notice && !failure && <AuthStatus tone="teal">{notice}</AuthStatus>}

        <GameButton
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={busy !== false || !isCompleteCode(code)}
        >
          {busy === 'verifying' ? 'Signing in…' : 'Verify and sign in'}
        </GameButton>

        <GameButton variant="ghost" block disabled={busy !== false} onClick={changeEmail}>
          Use a different email
        </GameButton>
      </form>
    </AuthShell>
  );
}
