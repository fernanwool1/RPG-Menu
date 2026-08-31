/**
 * Turns Supabase auth failures into copy a person can act on, and holds the
 * small formatting rules the sign-in screen needs.
 *
 * Kept free of React and of the Supabase client so it can be tested directly:
 * every branch here is reachable from `tests/auth.test.ts` without a network
 * or a configured project.
 */

export type AuthStep = 'request' | 'verify';

export type AuthFailureKind =
  /** The code was wrong, or it has already expired. */
  | 'bad-code'
  /** The address itself was rejected before anything was sent. */
  | 'bad-email'
  /** Supabase is asking us to wait before sending another code. */
  | 'rate-limited'
  /** The request never reached Supabase. */
  | 'offline'
  /** The project is reachable but refused: sign-ups off, project paused, etc. */
  | 'rejected'
  | 'unknown';

export interface AuthFailure {
  kind: AuthFailureKind;
  /** One sentence, addressed to the person, never raw provider text. */
  message: string;
  /** Seconds Supabase asked us to wait, when it said so. */
  retryAfter?: number;
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/**
 * Supabase words its throttle as "you can only request this after 46 seconds".
 * Pulling the number out lets the resend button show a real countdown instead
 * of a generic "try again later".
 */
export function parseRetryAfter(message: string): number | undefined {
  const match = /after (\d+) seconds?/i.exec(message);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export function describeAuthError(error: unknown, step: AuthStep): AuthFailure {
  const raw = (error ?? {}) as SupabaseLikeError;
  const message = String(raw.message ?? '');
  const code = String(raw.code ?? '');
  const name = String(raw.name ?? '');
  const lower = message.toLowerCase();

  // A fetch that never completed. Supabase surfaces this as a retryable fetch
  // error; a bare `fetch` rejection arrives as a TypeError.
  if (
    name === 'AuthRetryableFetchError' ||
    name === 'TypeError' ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('load failed')
  ) {
    return {
      kind: 'offline',
      message: 'Could not reach the sign-in service. Check your connection and try again.',
    };
  }

  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || raw.status === 429 || lower.includes('rate limit') || lower.includes('you can only request this after')) {
    const retryAfter = parseRetryAfter(message);
    return {
      kind: 'rate-limited',
      retryAfter,
      message: retryAfter
        ? `Too many attempts. You can request another code in ${retryAfter} seconds.`
        : 'Too many attempts. Wait a moment before requesting another code.',
    };
  }

  if (step === 'verify') {
    if (
      code === 'otp_expired' ||
      code === 'otp_disabled' ||
      lower.includes('expired') ||
      lower.includes('invalid') ||
      lower.includes('token')
    ) {
      return {
        kind: 'bad-code',
        message: 'That code is not valid, or it has expired. Request a new one and try again.',
      };
    }
  }

  if (
    code === 'validation_failed' ||
    lower.includes('invalid email') ||
    lower.includes('unable to validate email')
  ) {
    return { kind: 'bad-email', message: 'That email address does not look right. Check it and try again.' };
  }

  if (code === 'signup_disabled' || lower.includes('signups not allowed')) {
    return {
      kind: 'rejected',
      message: 'This project is not accepting new accounts. Ask the project owner to enable email sign-in.',
    };
  }

  if (lower.includes('email logins are disabled') || lower.includes('email provider')) {
    return {
      kind: 'rejected',
      message: 'Email sign-in is turned off for this project. Enable the email provider in Supabase.',
    };
  }

  return {
    kind: 'unknown',
    message:
      step === 'verify'
        ? 'That code could not be confirmed. Request a new one and try again.'
        : 'The code could not be sent. Try again in a moment.',
  };
}

/* ------------------------------------------------------------------ */
/* Field handling                                                      */
/* ------------------------------------------------------------------ */

/**
 * Deliberately permissive. The authoritative check is Supabase actually
 * delivering the code; this only catches obvious typos before we make someone
 * wait on a round trip.
 */
export function isProbablyEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 320) return false;
  if (/\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed);
}

export const CODE_LENGTH = 6;

/** Strips everything a person might paste around the digits. */
export function normalizeCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function isCompleteCode(value: string): boolean {
  return normalizeCode(value).length === CODE_LENGTH;
}

/**
 * Shows enough of the address to confirm it is the right one, without
 * reprinting it in full on a screen someone may be sharing.
 *
 *   ferna...@gmail.com  ->  fe•••••o@gmail.com
 */
export function maskEmail(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return trimmed;

  const name = trimmed.slice(0, at);
  const domain = trimmed.slice(at);

  if (name.length <= 2) return `${name[0]}${'•'.repeat(Math.max(1, name.length - 1))}${domain}`;
  if (name.length <= 4) return `${name[0]}${'•'.repeat(name.length - 1)}${domain}`;

  return `${name.slice(0, 2)}${'•'.repeat(Math.min(6, name.length - 3))}${name.slice(-1)}${domain}`;
}

/** Seconds to wait before a resend is offered again. */
export const RESEND_COOLDOWN_SECONDS = 45;

export function formatCooldown(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
