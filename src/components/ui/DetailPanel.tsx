import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The right-hand inspector shared by all four working screens: a centred
 * serif name, a sub-line, hairline-separated fact rows, and actions pinned to
 * the bottom of the panel.
 */

export function DetailHeading({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-center', className)}>
      <h3 className="font-display text-xl uppercase tracking-wider3 text-gold-bright">{title}</h3>
      {subtitle && <div className="mt-1 text-base text-teal">{subtitle}</div>}
    </div>
  );
}

export function StatRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-[3px] text-base', className)}>
      <dt className="shrink-0 text-ivory-faint">{label}</dt>
      <dd className="min-w-0 text-right text-ivory">{value}</dd>
    </div>
  );
}

export function StatList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-gold/10', className)}>{children}</dl>;
}

/** Small-caps gold section heading used inside the inspector. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h4 className={cn('label-caps text-center tracking-wider3 text-gold', className)}>{children}</h4>
  );
}

/** Actions pinned to the bottom of the inspector, as in every reference. */
export function DetailActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-auto flex flex-col gap-2 pt-3', className)}>{children}</div>;
}
