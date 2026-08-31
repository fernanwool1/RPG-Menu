'use client';

import { Flame } from 'lucide-react';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionLabel } from '@/components/ui/DetailPanel';
import { formatDayKey, formatResetClock } from '@/domain/daily';
import type { DayKey } from '@/domain/types';
import { useDailyStreak, useSevenDayHistory, useTodayDaily } from '@/store/dailySelectors';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

/**
 * The Daily Progress block on the right of the Quests page: what is done
 * today, how the Daily Check is tracking, the streak, when the day resets and
 * the last seven days at a glance.
 */
export function DailyProgressSummary({
  today,
  countdown,
}: {
  today: DayKey;
  countdown: string;
}) {
  const daily = useTodayDaily(today);
  const targets = useAppStore((s) => s.dailyTargets);
  const streak = useDailyStreak(today);
  const week = useSevenDayHistory(today);

  const totals = daily.checkTotals;
  const progress = daily.checkProgress;

  return (
    <section>
      <SectionLabel className="mb-2">Daily progress</SectionLabel>

      <div className="rounded-[2px] border border-gold/25 bg-ink-950/40 px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-ivory-dim">Completed today</span>
          <span
            className={cn(
              'font-display text-2xl tabular-nums',
              daily.completed >= daily.total && daily.total > 0 ? 'text-teal' : 'text-ivory',
            )}
          >
            {daily.completed} / {daily.total}
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={daily.total === 0 ? 0 : daily.completed / daily.total}
          valueText={`${daily.completed} of ${daily.total} Daily Quests completed`}
        />
      </div>

      {/* --- Daily Check trackers --- */}
      <div className="mt-2 space-y-2 rounded-[2px] border border-gold/25 bg-ink-950/40 px-3.5 py-3">
        <div className="text-sm text-ivory-dim">Daily Check</div>

        <TrackerLine
          label="Reading"
          value={totals?.reading ?? 0}
          target={targets.readingPages}
          unit="pages"
          fraction={progress?.reading ?? 0}
        />
        <TrackerLine
          label="Calories"
          value={totals?.calories ?? 0}
          target={targets.calories}
          unit="cal"
          fraction={progress?.calories ?? 0}
        />
        <TrackerLine
          label="Practice"
          value={totals?.instrumentMinutes ?? 0}
          target={targets.instrumentMinutes}
          unit="min"
          fraction={progress?.instrument ?? 0}
        />

        <div className="flex items-baseline justify-between gap-2 border-t border-gold/15 pt-2">
          <span className="text-xs text-ivory-faint">Earned from trackers</span>
          <span className="text-sm text-teal">+{totals?.xp ?? 0} XP</span>
        </div>
      </div>

      {/* --- Streak and reset --- */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-[2px] border border-gold/25 bg-ink-950/40 px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Flame
              aria-hidden
              className={cn('h-[1.15rem] w-[1.15rem]', streak > 0 ? 'text-teal' : 'text-ivory-faint')}
              strokeWidth={1.5}
            />
            <span
              className={cn('font-display text-2xl', streak > 0 ? 'text-teal' : 'text-ivory-faint')}
            >
              {streak}
            </span>
          </div>
          <div className="mt-0.5 text-xs uppercase tracking-wider2 text-ivory-faint">
            Day streak
          </div>
        </div>

        <div className="rounded-[2px] border border-gold/25 bg-ink-950/40 px-3 py-2.5 text-center">
          <div className="font-display text-lg text-gold-bright">{countdown}</div>
          <div className="mt-0.5 text-xs uppercase tracking-wider2 text-ivory-faint">
            Resets {formatResetClock()}
          </div>
        </div>
      </div>

      {/* --- Seven-day history --- */}
      <div className="mt-2 rounded-[2px] border border-gold/25 bg-ink-950/40 px-3.5 py-3">
        <div className="mb-2 text-sm text-ivory-dim">Last seven days</div>
        <ol className="flex items-end justify-between gap-1.5">
          {week.map(({ date, record }) => {
            const fraction = record.total === 0 ? 0 : record.completed / record.total;
            const full = record.total > 0 && record.completed >= record.total;
            const isToday = date === today;

            return (
              <li key={date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="flex h-14 w-full items-end overflow-hidden rounded-[2px] border border-gold/20 bg-ink-950"
                  role="img"
                  aria-label={`${formatDayKey(date)}: ${record.completed} of ${record.total || 4} completed`}
                  title={`${formatDayKey(date)} — ${record.completed}/${record.total || 4}`}
                >
                  <div
                    className={cn(
                      'w-full transition-[height] duration-[250ms]',
                      full ? 'bg-teal' : fraction > 0 ? 'bg-teal/45' : 'bg-transparent',
                    )}
                    style={{ height: `${Math.max(fraction * 100, fraction > 0 ? 12 : 0)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'truncate text-xs',
                    isToday ? 'text-teal' : 'text-ivory-faint',
                  )}
                >
                  {formatDayKey(date).split(' ')[1]}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs leading-relaxed text-ivory-faint">
          Unfinished quests expire at {formatResetClock()} without touching XP or your level.
        </p>
      </div>
    </section>
  );
}

function TrackerLine({
  label,
  value,
  target,
  unit,
  fraction,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  fraction: number;
}) {
  const met = target > 0 && value >= target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-ivory-faint">{label}</span>
        <span className={cn('text-xs tabular-nums', met ? 'text-teal' : 'text-ivory-dim')}>
          {value} / {target} {unit}
        </span>
      </div>
      <ProgressBar
        className="mt-1"
        size="sm"
        value={fraction}
        valueText={`${label}: ${value} of ${target} ${unit}`}
      />
    </div>
  );
}
