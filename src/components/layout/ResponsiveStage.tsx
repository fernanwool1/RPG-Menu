'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { DESKTOP_MIN, TABLET_MIN, WIDE_MIN } from '@/lib/useBreakpoint';
import { cn } from '@/lib/cn';

/**
 * The multi-panel stage.
 *
 * One set of panels, four arrangements. The panels themselves are identical in
 * every mode - there is no second implementation and no duplicated state.
 *
 *   >= 1280px  every panel at its full reference width
 *   >= 1024px  up to three panels; a four-panel page drops its first navigator
 *              into the breadcrumb so the remaining columns stay usable
 *   >= 768px   two panels: the one you picked from, and what you picked
 *   <  768px   one panel at a time, as a drill-down:
 *              list -> selection -> details, with a back button
 *
 * On mobile the stage also remembers where each level was scrolled to, so
 * going back returns you to the row you tapped rather than to the top.
 */

export interface StagePane {
  id: string;
  /** Breadcrumb and mobile header label. */
  label: string;
  node: ReactNode;
  /** Flex basis on the full desktop layout. */
  className?: string;
}

function useVisiblePaneCount(total: number): { count: number; ready: boolean; mobile: boolean } {
  // Server-render the full layout, then narrow once the real width is known.
  const [state, setState] = useState({ count: total, ready: false, mobile: false });

  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${WIDE_MIN}px)`);
    const desktop = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);
    const tablet = window.matchMedia(`(min-width: ${TABLET_MIN}px)`);

    const apply = () => {
      const count = wide.matches
        ? total
        : desktop.matches
          ? Math.min(3, total)
          : tablet.matches
            ? Math.min(2, total)
            : 1;
      setState({ count, ready: true, mobile: !tablet.matches });
    };

    apply();
    [wide, desktop, tablet].forEach((q) => q.addEventListener('change', apply));
    return () => [wide, desktop, tablet].forEach((q) => q.removeEventListener('change', apply));
  }, [total]);

  return state;
}

export interface ResponsiveStageProps {
  panes: StagePane[];
  /** Index of the pane the user is focused on, for the narrow layouts. */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  className?: string;
}

export function ResponsiveStage({
  panes,
  activeIndex,
  onActiveIndexChange,
  className,
}: ResponsiveStageProps) {
  const { count, ready, mobile } = useVisiblePaneCount(panes.length);
  const showingAll = count >= panes.length;

  // Window of panes to render, anchored so the active pane is always in it.
  const clampedIndex = Math.min(Math.max(0, activeIndex), panes.length - 1);
  const start = showingAll ? 0 : Math.min(clampedIndex, panes.length - count);
  const visible = showingAll ? panes : panes.slice(start, start + count);

  /* ---------------- scroll restoration (mobile drill-down) --------- */

  const hostRef = useRef<HTMLDivElement>(null);
  const scrollByPane = useRef(new Map<string, number>());
  const activePaneId = panes[clampedIndex]?.id;

  // On mobile the document scrolls, not the panel, so the position to
  // remember is the window's. Going back therefore returns you to the row you
  // tapped rather than to the top of the list.
  useEffect(() => {
    if (!mobile || !activePaneId) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scrollByPane.current.set(activePaneId, window.scrollY);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [mobile, activePaneId]);

  useLayoutEffect(() => {
    if (!mobile || !activePaneId) return;

    // Drilling *into* a level starts at the top; coming back restores.
    const saved = scrollByPane.current.get(activePaneId) ?? 0;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: saved, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [mobile, activePaneId]);

  /* ---------------- mobile: one level, with a back button ---------- */

  if (ready && mobile) {
    const pane = panes[clampedIndex];
    const parent = clampedIndex > 0 ? panes[clampedIndex - 1] : null;

    return (
      <div ref={hostRef} className={cn('flex min-h-0 flex-1 flex-col', className)}>
        {parent && (
          <div className="mb-2.5 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onActiveIndexChange(clampedIndex - 1)}
              className="tap-target inline-flex items-center gap-1 rounded-[2px] border border-gold/30 px-2.5 text-sm text-ivory-dim transition-colors duration-200"
            >
              <ChevronLeft aria-hidden className="h-5 w-5" />
              <span className="max-w-[9rem] truncate">{parent.label}</span>
            </button>

            <span className="min-w-0 flex-1 truncate text-right text-sm text-ivory-faint">
              {pane.label}
            </span>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">{pane.node}</div>
      </div>
    );
  }

  /* ---------------- tablet and desktop ----------------------------- */

  return (
    <div ref={hostRef} className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {ready && !showingAll && (
        <nav
          aria-label="Panel breadcrumb"
          className="mb-2 flex shrink-0 items-center gap-1 overflow-x-auto scroll-thin px-1"
        >
          <button
            type="button"
            onClick={() => onActiveIndexChange(Math.max(0, clampedIndex - 1))}
            disabled={clampedIndex === 0}
            className="tap-target inline-flex shrink-0 items-center gap-1 rounded-[2px] border border-gold/30 px-2.5 text-xs uppercase tracking-wider2 text-ivory-dim transition-colors duration-200 hover:bg-gold/5 disabled:opacity-30"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Back
          </button>

          <ol className="flex min-w-0 items-center gap-1">
            {panes.map((pane, index) => (
              <li key={pane.id} className="flex shrink-0 items-center gap-1">
                {index > 0 && <ChevronRight aria-hidden className="h-3 w-3 text-gold/40" />}
                <button
                  type="button"
                  onClick={() => onActiveIndexChange(index)}
                  aria-current={index === clampedIndex ? 'step' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-[2px] px-1.5 py-1 text-xs uppercase tracking-wider2 transition-colors duration-200',
                    index === clampedIndex
                      ? 'text-teal-bright'
                      : 'text-ivory-faint hover:text-ivory-dim',
                  )}
                >
                  {pane.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex min-h-0 flex-1 gap-2.5 sm:gap-3">
        {visible.map((pane) => (
          <div
            key={pane.id}
            className={cn('flex min-h-0 min-w-0 flex-col', showingAll ? pane.className : 'flex-1')}
          >
            {pane.node}
          </div>
        ))}
      </div>
    </div>
  );
}
