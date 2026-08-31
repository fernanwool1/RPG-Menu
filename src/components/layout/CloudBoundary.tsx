'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { cloudEnabled } from '@/cloud/config';
import { setCloudWritable } from '@/cloud/access';
import { cloudTransport, getCloudClient } from '@/cloud/client';
import { SyncEngine, type SyncStatus } from '@/cloud/engine';
import { snapshotSchema, type CloudSnapshot } from '@/cloud/schema';
import { emptyCloudSnapshot, legacySnapshot } from '@/cloud/snapshot';
import { useAppStore } from '@/store/useAppStore';
import { readRawSnapshot, SCHEMA_VERSION } from '@/store/persistence';
import { ensureCampaigns } from '@/domain/seed/campaigns';
import { nowIso } from '@/domain/ids';
import { GameButton } from '@/components/ui/GameButton';
import { AuthError, AuthShell, AuthStatus } from '@/components/auth/AuthShell';
import { SignInFlow } from '@/components/auth/SignInFlow';
import { maskEmail } from '@/cloud/authErrors';

function download(snapshot: CloudSnapshot) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `menu-recovery-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Every non-app account screen uses the same chassis as sign-in, so moving
 * from "check your email" to "connecting your progress" feels like one flow
 * rather than three different products.
 */
function AccountCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AuthShell title={title} subtitle={subtitle}>
      <div className="space-y-4">{children}</div>
    </AuthShell>
  );
}

export function CloudBoundary({ children }: { children: ReactNode }) {
  if (!cloudEnabled) return <>{children}</>;
  return <CloudAccount>{children}</CloudAccount>;
}

function CloudAccount({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [setupError, setSetupError] = useState('');
  useEffect(() => {
    try {
      const client = getCloudClient();
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setChecking(false);
      });
      return () => data.subscription.unsubscribe();
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Cloud configuration is invalid.');
      setChecking(false);
    }
  }, []);
  if (setupError) {
    return (
      <AccountCard
        title="Cloud setup needed"
        subtitle="This build is pointed at a cloud project, but the connection details are missing."
      >
        <AuthError>{setupError}</AuthError>
        <p className="text-base leading-relaxed text-ivory-dim">
          Your existing browser data is untouched. Follow CLOUD_SETUP.md to connect this app, then
          restart it.
        </p>
      </AccountCard>
    );
  }

  if (checking) {
    return (
      <AccountCard title="Opening your account" subtitle="One moment while we restore your session.">
        <AuthStatus tone="teal">Checking sign-in…</AuthStatus>
      </AccountCard>
    );
  }
  if (!user) return <SignInFlow />;
  return <ConnectedAccount key={user.id} user={user}>{children}</ConnectedAccount>;
}

function ConnectedAccount({ user, children }: { user: User; children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>({ phase: 'loading', message: 'Loading cloud data…', revision: 0 });
  const [loaded, setLoaded] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [localAvailable, setLocalAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const engineRef = useRef<SyncEngine | null>(null);
  const initialized = useAppStore((s) => s.initialized);

  useEffect(() => {
    let applying = false;
    setCloudWritable(false);
    setLocalAvailable(Boolean(readRawSnapshot()));
    const engine = new SyncEngine(cloudTransport(user.id), (snapshot) => {
      applying = true;
      const value = snapshot ?? emptyCloudSnapshot();
      useAppStore.setState({ ...value.data,
        // Same top-up the local `merge` does: a cloud save from before a
        // campaign existed gains it, one that already has it keeps its
        // progress untouched.
        campaigns: ensureCampaigns(value.data.campaigns, nowIso()),
        initialized: value.initialized,
        hiddenFinancials: { cash: true, bank: true, total: true } });
      applying = false;
      setHasSave(snapshot !== null);
      setLoaded(true);
    }, (next) => {
      setCloudWritable((next.phase === 'ready' || next.phase === 'saving') && !engine.recovery);
      setStatus(next);
      if (next.revision > 0) setHasSave(true);
    });
    engineRef.current = engine;
    const unsubscribe = useAppStore.subscribe((state) => {
      if (applying) return;
      try {
        engine.changed(snapshotSchema.parse({ schemaVersion: SCHEMA_VERSION, initialized: state.initialized, data: state }));
      } catch {
        setCloudWritable(false);
        engine.rejectInvalidChange();
      }
    });
    const connection = () => engine.connection(navigator.onLine);
    const refresh = () => { void engine.refresh(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (engine.hasUnsavedChanges) { event.preventDefault(); event.returnValue = ''; }
    };
    connection();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('focus', refresh);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      engine.dispose(); engineRef.current = null; unsubscribe(); setCloudWritable(false);
      window.clearInterval(timer);
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
      window.removeEventListener('focus', refresh); window.removeEventListener('beforeunload', beforeUnload);
      useAppStore.setState({ ...emptyCloudSnapshot().data, initialized: false });
    };
  }, [user.id]);

  const signOut = async () => {
    if (engineRef.current?.hasUnsavedChanges) { setMessage('Resolve the pending save or recovery copy before signing out.'); return; }
    setCloudWritable(false);
    const { error } = await getCloudClient().auth.signOut({ scope: 'local' });
    if (error) { setMessage(error.message); void engineRef.current?.refresh(); }
  };
  const recovery = engineRef.current?.recovery;
  const blocked = !loaded || !['ready', 'saving'].includes(status.phase) || Boolean(recovery);
  const loadLocal = () => {
    try {
      const raw = readRawSnapshot();
      if (!raw) throw new Error('No local save was found.');
      const snapshot = legacySnapshot(raw);
      useAppStore.setState({ ...snapshot.data, initialized: true });
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Local save could not be read.'); }
  };

  if (blocked) return <AccountCard
    title={status.phase === 'offline' ? 'You’re offline' : recovery ? 'Check your latest save' : 'Connecting your progress'}
    subtitle={status.phase === 'offline'
      ? 'Menu needs a connection to open your saved character.'
      : recovery ? undefined : 'Your quests, skills and progress are on their way.'}>
    <AuthStatus>{status.message}</AuthStatus>
    {message && <AuthError>{message}</AuthError>}
    <GameButton block variant="primary" onClick={() => { void engineRef.current?.refresh(); }}>Reload cloud data</GameButton>
    {recovery && <>
      <GameButton block onClick={() => download(recovery)}>Download unconfirmed changes</GameButton>
      {status.phase === 'ready' && <GameButton block onClick={() => engineRef.current?.acknowledgeRecovery()}>Continue with cloud data</GameButton>}
    </>}
    <GameButton block disabled={Boolean(recovery) || status.phase === 'saving'} onClick={() => { void signOut(); }}>Sign out</GameButton>
  </AccountCard>;

  if (!initialized) return <AccountCard
    title="Choose your starting point"
    subtitle={<>Signed in as <span className="whitespace-nowrap text-ivory">{maskEmail(user.email ?? '')}</span>. These choices save your character online to this account.</>}>
    {!hasSave && localAvailable && <div className="space-y-3 border border-gold/30 p-4">
      <p className="text-sm text-ivory-dim">Transfer this browser’s existing profile, quests, XP, notes, inventory, financial amounts and any sensitive identifiers to your Supabase account. The local original stays untouched.</p>
      <GameButton block variant="primary" onClick={loadLocal}>Upload existing local progress</GameButton>
    </div>}
    <GameButton block onClick={() => useAppStore.getState().startEmpty()}>Start empty online</GameButton>
    <GameButton block onClick={() => useAppStore.getState().startWithSampleData()}>Use sample data online</GameButton>
    {message && <AuthError>{message}</AuthError>}
    <GameButton block onClick={() => { void signOut(); }}>Sign out</GameButton>
  </AccountCard>;

  return <div className="cloud-shell">
    <div className="cloud-status">
      <span role="status" className="min-w-0 truncate text-sm text-teal" title={status.message}>{status.phase === 'saving' ? 'Saving online…' : 'Saved online'}</span>
      <span className="min-w-0 flex-1 truncate text-right text-sm text-ivory-dim" title={user.email}>{user.email}</span>
      <button className="min-h-11 shrink-0 px-2 text-sm text-gold hover:text-gold-bright" disabled={status.phase === 'saving'} onClick={() => { void signOut(); }}>Sign out</button>
    </div>
    {message && <div role="alert" className="fixed inset-x-0 top-12 z-[70] border border-danger bg-ink-950 p-3 text-danger">{message}
      <button className="ml-3 underline" onClick={() => setMessage('')}>Dismiss</button></div>}
    {children}
  </div>;
}
