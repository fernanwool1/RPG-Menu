'use client';

import { useEffect, useState } from 'react';

/**
 * The one place breakpoints are decided.
 *
 *   mobile   < 768px    drill-down navigation, bottom tab bar
 *   tablet   768-1023   two panels side by side, top navigation
 *   desktop  >= 1024    the approved multi-panel composition
 *
 * Measured with matchMedia rather than user-agent sniffing, so a narrow
 * desktop window behaves exactly like a phone - which is also how it is
 * tested.
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export const MOBILE_MAX = 767;
export const TABLET_MIN = 768;
export const DESKTOP_MIN = 1024;
/** Above this every panel fits at its full reference width. */
export const WIDE_MIN = 1280;

function read(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`).matches) return 'desktop';
  if (window.matchMedia(`(min-width: ${TABLET_MIN}px)`).matches) return 'tablet';
  return 'mobile';
}

export function useBreakpoint(): { breakpoint: Breakpoint; ready: boolean } {
  // Server-renders as desktop, then corrects on mount. `ready` lets callers
  // avoid committing to a layout before the real width is known.
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const queries = [
      window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`),
      window.matchMedia(`(min-width: ${TABLET_MIN}px)`),
      window.matchMedia(`(min-width: ${WIDE_MIN}px)`),
    ];

    const apply = () => {
      setBreakpoint(read());
      setReady(true);
    };

    apply();
    queries.forEach((q) => q.addEventListener('change', apply));
    return () => queries.forEach((q) => q.removeEventListener('change', apply));
  }, []);

  return { breakpoint, ready };
}

export function useIsMobile(): boolean {
  return useBreakpoint().breakpoint === 'mobile';
}
