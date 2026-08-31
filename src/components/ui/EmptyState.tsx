import type { ReactNode } from 'react';

import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Every list, panel and detail slot has one of these. An empty region should
 * always say what it is and what to do about it - never just sit blank.
 */
export function EmptyState({ icon = 'sparkles', title, body, action, className, compact }: EmptyStateProps) {
  const Icon = iconFor(icon);

  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center text-center',
        compact ? 'gap-1.5 p-4' : 'gap-2.5 p-8',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-gold/25 text-gold/60',
          compact ? 'h-8 w-8' : 'h-11 w-11',
        )}
      >
        <Icon aria-hidden className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.3} />
      </span>
      <h3 className={cn('font-display tracking-wider2 text-ivory', compact ? 'text-sm' : 'text-base')}>
        {title}
      </h3>
      {body && (
        <p className="max-w-xs text-sm leading-relaxed text-ivory-faint">{body}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Skeleton shown while the persisted store is rehydrating on first paint. */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-pulse-soft rounded-full border border-teal/60" />
        <span className="label-caps text-ivory-faint">{label}</span>
      </div>
    </div>
  );
}
