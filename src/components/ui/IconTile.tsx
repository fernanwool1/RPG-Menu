'use client';

import type { ReactNode } from 'react';

import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/cn';

export type TileState = 'idle' | 'selected' | 'active' | 'locked';

export interface IconTileProps {
  icon: string;
  title: string;
  caption?: ReactNode;
  state?: TileState;
  onClick?: () => void;
  className?: string;
  /** Circular treatment, as used by the skill-tree nodes. */
  round?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RING: Record<TileState, string> = {
  idle: 'border-gold/35 text-gold',
  // Gold ring: the thing you are currently inspecting.
  selected: 'border-gold-bright text-gold-bright shadow-glow-gold',
  // Teal ring: the thing that is currently live.
  active: 'border-teal text-teal-bright shadow-glow',
  locked: 'border-ivory-faint/25 text-ivory-faint/60',
};

const SIZES = {
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
};

/**
 * The circular / square icon medallion used by the skill tree and the ability
 * catalogue. Renders as a button when interactive and as a plain div when not,
 * so non-interactive tiles never land in the tab order.
 */
export function IconTile({
  icon,
  title,
  caption,
  state = 'idle',
  onClick,
  className,
  round = true,
  size = 'md',
}: IconTileProps) {
  const Icon = iconFor(icon);

  const medallion = (
    <span
      className={cn(
        'inline-flex items-center justify-center border bg-ink-950/70 transition-all duration-200',
        SIZES[size],
        round ? 'rounded-full' : 'rounded-[3px]',
        RING[state],
      )}
    >
      <Icon aria-hidden className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.4} />
    </span>
  );

  const content = (
    <>
      {medallion}
      <span className="mt-1.5 block text-center text-sm leading-tight text-ivory">
        {title}
      </span>
      {caption && <span className="mt-0.5 block text-center leading-tight">{caption}</span>}
    </>
  );

  if (!onClick) {
    return <div className={cn('flex flex-col items-center', className)}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={state === 'selected' ? 'true' : undefined}
      className={cn(
        'group flex flex-col items-center rounded-[3px] p-1 transition-colors duration-200',
        'hover:bg-gold/5',
        className,
      )}
    >
      {content}
    </button>
  );
}
