import { cn } from '@/lib/cn';

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label?: string;
  /** Announced to assistive tech, e.g. "240 of 600 XP". */
  valueText?: string;
  tone?: 'teal' | 'gold';
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Progress readouts never rely on the glow alone: the track has a visible
 * border and the numbers are always written out beside it.
 */
export function ProgressBar({
  value,
  label,
  valueText,
  tone = 'teal',
  size = 'md',
  className,
}: ProgressBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="label-caps text-gold">{label}</span>
          {valueText && <span className="text-xs text-ivory-dim">{valueText}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={valueText ?? `${pct}%`}
        aria-label={label}
        className={cn(
          'w-full overflow-hidden rounded-[1px] border border-gold/25 bg-ink-950/80',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className={cn(
            'h-full transition-[width] duration-[250ms] ease-out',
            tone === 'teal'
              ? 'bg-gradient-to-r from-teal-dim to-teal shadow-glow'
              : 'bg-gradient-to-r from-gold-dim to-gold',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
