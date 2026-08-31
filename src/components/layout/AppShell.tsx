'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { LoadingState } from '@/components/ui/EmptyState';
import { getStorageHealth, subscribeToStorageHealth, type StorageHealth } from '@/store/persistence';
import { useBreakpoint } from '@/lib/useBreakpoint';

import { BackgroundLayer } from './BackgroundLayer';
import { MobileBottomNav, MobileTopBar } from './MobileChrome';
import { OnboardingGate } from './OnboardingGate';
import { StorageRecovery } from './StorageRecovery';
import { TopNavigation } from './TopNavigation';

/**
 * The frame every route renders inside.
 *
 * Below 768px the desktop header is swapped for a compact top bar and a bottom
 * tab bar, and the stage scrolls the page rather than fitting a fixed viewport.
 * At 768px and up the approved desktop chrome is used unchanged.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [health, setHealth] = useState<StorageHealth>({ state: 'empty' });
  const { breakpoint } = useBreakpoint();
  const isMobile = breakpoint === 'mobile';

  useEffect(() => {
    setHealth(getStorageHealth());
    const unsubscribe = subscribeToStorageHealth(setHealth);
    setHydrated(true);
    return unsubscribe;
  }, []);

  if (isMobile) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <BackgroundLayer />
        <MobileTopBar />

        {/*
         * The mobile stage scrolls the document instead of trapping the layout
         * in a fixed-height flex column: it keeps the address bar behaviour
         * native and the software keyboard from squashing the page.
         */}
        <main
          className="mobile-scroll flex min-h-0 flex-1 flex-col px-3.5"
          style={{
            paddingTop: 'calc(var(--mobile-topbar-h) + var(--safe-top) + 0.75rem)',
          }}
        >
          {!hydrated ? <LoadingState label="Opening the menu" /> : children}
        </main>

        <MobileBottomNav />

        {hydrated && <StorageRecovery health={health} />}
        {hydrated && health.state !== 'corrupt' && <OnboardingGate />}
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh min-h-0 flex-col">
      <BackgroundLayer />
      <TopNavigation />

      <main className="flex min-h-0 flex-1 flex-col p-2.5 sm:p-3 lg:p-4">
        {!hydrated ? <LoadingState label="Opening the menu" /> : children}
      </main>

      {hydrated && <StorageRecovery health={health} />}
      {hydrated && health.state !== 'corrupt' && <OnboardingGate />}
    </div>
  );
}
