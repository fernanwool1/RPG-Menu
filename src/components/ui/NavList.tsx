'use client';

import type { ReactNode } from 'react';

import { GameIcon } from '@/components/ui/GameIcon';
import { ICON_CYAN, ICON_GOLD } from '@/lib/gameIcons';
import { iconFor } from '@/lib/icons';
import { useIsMobile } from '@/lib/useBreakpoint';
import { cn } from '@/lib/cn';

/**
 * The left-hand navigator rows shared by Skills (domains, branches),
 * Abilities (paths) and Inventory (locations).
 *
 * Selection is marked three ways - a teal left rule, a teal border and
 * aria-current - so it never depends on the glow alone.
 */

export function NavList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label={label}>
      {children}
    </ul>
  );
}

export interface NavListItemProps {
  icon?: string;
  /**
   * Path to emblem artwork. When given it replaces the bordered line-icon
   * square: the artwork carries its own ornament and does not want a second
   * frame around it.
   */
  emblem?: string;
  label: string;
  /** Right-aligned value, e.g. a level or a count. */
  meta?: ReactNode;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
  disabled?: boolean;
}

export function NavListItem({
  icon,
  emblem,
  label,
  meta,
  selected,
  onSelect,
  className,
  disabled,
}: NavListItemProps) {
  const Icon = icon ? iconFor(icon) : null;
  const isMobile = useIsMobile();

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'group relative flex w-full items-center gap-2.5 rounded-[2px] border px-2.5 py-2 text-left',
          'transition-[background-color,border-color,color] duration-200',
          'disabled:cursor-not-allowed disabled:opacity-40',
          selected
            ? 'border-teal/55 bg-teal/[0.07] text-ivory'
            : 'border-gold/25 text-ivory-dim hover:border-gold/50 hover:bg-gold/5 hover:text-ivory',
          className,
        )}
      >
        {selected && (
          <span aria-hidden className="absolute inset-y-1 left-0 w-[2px] bg-teal shadow-glow" />
        )}

        {emblem ? (
          <GameIcon
            src={emblem}
            // 28px in a desktop sidebar row, 38px on a mobile card.
            size={isMobile ? 38 : 28}
            color={selected ? ICON_CYAN : ICON_GOLD}
          />
        ) : (
          Icon && (
            <span
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border transition-colors duration-200',
                selected ? 'border-teal/50 text-teal' : 'border-gold/30 text-gold',
              )}
            >
              <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.4} />
            </span>
          )
        )}

        <span className="min-w-0 flex-1 text-base leading-tight">{label}</span>

        {meta !== undefined && (
          <span
            className={cn(
              'shrink-0 text-base tabular-nums',
              selected ? 'text-teal' : 'text-gold',
            )}
          >
            {meta}
          </span>
        )}
      </button>
    </li>
  );
}

/** The `›` connector drawn between the navigator columns on Skills. */
export function ColumnChevron() {
  return (
    <div aria-hidden className="hidden shrink-0 items-center self-center px-0.5 xl:flex">
      <svg width="12" height="26" viewBox="0 0 12 26" fill="none">
        <path
          d="M2 2 L10 13 L2 24"
          stroke="var(--gold)"
          strokeWidth="1"
          opacity="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
