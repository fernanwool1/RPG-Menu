import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The chassis every screen is built from.
 *
 * All five reference screens are the same object at different widths: a thin
 * gold hairline, ornamental corner brackets, a near-black translucent fill and
 * a small-caps serif title. Nothing about the ornament is per-page.
 */

/**
 * Corner ornament as four absolutely positioned L-shapes.
 *
 * Deliberately not one stretched SVG: a non-uniform scale would thicken the
 * hairline on the long edge of a wide panel.
 */
export function Corners({ tone = 'gold' }: { tone?: 'gold' | 'teal' }) {
  const color = tone === 'teal' ? 'border-teal/70' : 'border-gold/50';
  const base = 'pointer-events-none absolute h-3 w-3';
  return (
    <>
      <span aria-hidden className={cn(base, color, 'left-[3px] top-[3px] border-l border-t')} />
      <span aria-hidden className={cn(base, color, 'right-[3px] top-[3px] border-r border-t')} />
      <span aria-hidden className={cn(base, color, 'bottom-[3px] left-[3px] border-b border-l')} />
      <span aria-hidden className={cn(base, color, 'bottom-[3px] right-[3px] border-b border-r')} />
    </>
  );
}

export interface GamePanelProps {
  title?: string;
  /** Rendered at the right of the title row. */
  action?: ReactNode;
  /** Sits directly under the title, above the divider. */
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: 'gold' | 'teal';
  /** Drops the corner ornament for panels nested inside another panel. */
  plain?: boolean;
  /** Heading level, so panel titles form a real document outline. */
  as?: 'h2' | 'h3';
}

export function GamePanel({
  title,
  action,
  subtitle,
  children,
  className,
  bodyClassName,
  tone = 'gold',
  plain = false,
  as: Heading = 'h2',
}: GamePanelProps) {
  return (
    <section
      data-panel=""
      className={cn(
        'relative flex min-h-0 flex-col rounded-[3px] border shadow-panel backdrop-blur-[2px]',
        tone === 'teal' ? 'border-teal/45' : 'border-gold/30',
        'bg-[var(--panel-fill)]',
        className,
      )}
    >
      {!plain && <Corners tone={tone} />}

      {title && (
        <header className="shrink-0 px-4 pb-2 pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <Heading className="panel-title flex-1 text-center">{title}</Heading>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {subtitle && (
            <div className="mt-1 text-center text-xs text-ivory-dim">{subtitle}</div>
          )}
          <div className="divider-diamond mt-2.5" />
        </header>
      )}

      <div
        data-panel-body=""
        className={cn('min-h-0 flex-1', bodyClassName ?? 'overflow-y-auto scroll-thin p-3')}
      >
        {children}
      </div>
    </section>
  );
}

/** Hairline rule with the centred diamond used throughout the references. */
export function PanelDivider({ className }: { className?: string }) {
  return <div className={cn('divider-diamond my-3', className)} aria-hidden="true" />;
}
