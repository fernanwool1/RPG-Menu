'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Registry icon name, drawn before the label. */
  icon?: string;
  block?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  // The teal-glow call to action from the references. One per panel at most.
  primary:
    'border-teal/60 bg-teal/10 text-teal-bright hover:border-teal hover:bg-teal/20 hover:shadow-glow active:bg-teal/25',
  secondary:
    'border-gold/40 bg-transparent text-ivory hover:border-gold/80 hover:bg-gold/10 hover:shadow-glow-gold',
  ghost:
    'border-transparent bg-transparent text-ivory-dim hover:border-gold/30 hover:bg-gold/5 hover:text-ivory',
  danger:
    'border-danger-dim bg-transparent text-danger hover:border-danger hover:bg-danger/10',
};

/**
 * Heights grew with the type scale so labels never crowd their border.
 *
 * Below 768px every size is floored at the 44px touch minimum, including the
 * compact `sm` variant used for dense desktop action rows.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 max-md:h-[var(--tap-min)] px-3 max-md:px-4 text-xs max-md:text-sm tracking-wider2 gap-1.5',
  md: 'h-11 max-md:h-[var(--tap-min)] px-4 text-sm tracking-wider2 gap-2',
  lg: 'h-13 px-6 text-base tracking-wider3 gap-2.5',
};

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(function GameButton(
  { variant = 'secondary', size = 'md', icon, block, className, children, type, ...rest },
  ref,
) {
  const Icon = icon ? iconFor(icon) : null;

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center rounded-[2px] border font-medium uppercase',
        'transition-[color,background-color,border-color,box-shadow] duration-200 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
      {children}
    </button>
  );
});

/**
 * Square icon-only button. Always takes a label, which becomes both the
 * accessible name and the native tooltip.
 */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
}

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 max-md:h-[var(--tap-min)] max-md:w-[var(--tap-min)]',
  md: 'h-10 w-10 max-md:h-[var(--tap-min)] max-md:w-[var(--tap-min)]',
  lg: 'h-12 w-12',
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  active,
  className,
  type,
  ...rest
}: IconButtonProps) {
  const Icon = iconFor(icon);
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center rounded-[2px] border transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        ICON_SIZES[size],
        active && 'border-teal/60 text-teal-bright',
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.5} />
    </button>
  );
}
