'use client';

import { Check } from 'lucide-react';

import { GameButton } from '@/components/ui/GameButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ACTIVITY_FORMULA_LABEL,
  DAILY_QUEST_STATUS_LABEL,
  type DailyCheckTotals,
} from '@/domain/daily';
import type { DailyCheckActivity, DailyQuestStatus, DailyTarget } from '@/domain/types';
import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/cn';

/**
 * The permanent first Daily Quest.
 *
 * Deliberately taller than the three rotating cards: it holds three trackers
 * rather than a single checkbox. It shows Activity XP rather than a flat
 * reward, because the pages, calories and minutes have already been converted
 * individually - a completion bonus on top would pay for them twice.
 */

interface TrackerRow {
  activity: DailyCheckActivity;
  label: string;
  icon: string;
  value: number;
  target: number;
  unit: string;
  fraction: number;
}

export function DailyCheckCard({
  status,
  totals,
  targets,
  progress,
  onAddProgress,
  onEditEntry,
  onViewLog,
  onComplete,
  onReopen,
}: {
  status: DailyQuestStatus;
  totals: DailyCheckTotals | null;
  targets: DailyTarget;
  progress: { reading: number; calories: number; instrument: number; overall: number } | null;
  onAddProgress: (activity: DailyCheckActivity) => void;
  onEditEntry: () => void;
  onViewLog: () => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const completed = status === 'completed';
  const expired = status === 'expired';

  // The instrument row names whichever instrument has the most minutes today,
  // so it reads "Guitar 8 / 20 minutes" rather than a generic label.
  const topInstrument = totals
    ? Object.values(totals.byInstrument).sort((a, b) => b.minutes - a.minutes)[0]
    : undefined;

  const rows: TrackerRow[] = [
    {
      activity: 'reading',
      label: 'Reading',
      icon: 'book',
      value: totals?.reading ?? 0,
      target: targets.readingPages,
      unit: 'pages',
      fraction: progress?.reading ?? 0,
    },
    {
      activity: 'calories',
      label: 'Calories',
      icon: 'flame',
      value: totals?.calories ?? 0,
      target: targets.calories,
      unit: 'calories',
      fraction: progress?.calories ?? 0,
    },
    {
      activity: 'instrument',
      label: topInstrument?.name ?? 'Instrument',
      icon: 'guitar',
      value: totals?.instrumentMinutes ?? 0,
      target: targets.instrumentMinutes,
      unit: 'minutes',
      fraction: progress?.instrument ?? 0,
    },
  ];

  return (
    <article
      className={cn(
        'relative rounded-[3px] border p-4 transition-colors duration-200',
        completed
          ? 'border-teal/55 bg-teal/[0.06]'
          : expired
            ? 'border-ivory-faint/25 bg-ink-950/40 opacity-70'
            : 'border-gold/40 bg-ink-950/45',
      )}
    >
      <span aria-hidden className="pointer-events-none absolute left-[3px] top-[3px] h-3 w-3 border-l border-t border-gold/50" />
      <span aria-hidden className="pointer-events-none absolute right-[3px] top-[3px] h-3 w-3 border-r border-t border-gold/50" />
      <span aria-hidden className="pointer-events-none absolute bottom-[3px] left-[3px] h-3 w-3 border-b border-l border-gold/50" />
      <span aria-hidden className="pointer-events-none absolute bottom-[3px] right-[3px] h-3 w-3 border-b border-r border-gold/50" />

      <header className="flex items-start gap-3">
        <CompletionCircle done={completed} expired={expired} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h4 className="font-display text-xl uppercase tracking-wider2 text-gold-bright">
              Daily Check
            </h4>
            <StatusBadge bare tone="progress">
              Permanent
            </StatusBadge>
            <StatusBadge bare tone={completed ? 'done' : expired ? 'locked' : 'ready'}>
              {DAILY_QUEST_STATUS_LABEL[status]}
            </StatusBadge>
          </div>
          <p className="mt-0.5 text-sm text-ivory-dim">
            Pages, calories and instrument minutes.
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-base text-teal">Activity XP</div>
          <div className="text-xs text-ivory-faint">
            {totals ? `${totals.xp} XP today` : '0 XP today'}
          </div>
        </div>
      </header>

      <div className="divider-diamond my-3" />

      <dl className="space-y-3">
        {rows.map((row) => {
          const Icon = iconFor(row.icon);
          const met = row.target > 0 && row.value >= row.target;

          // The whole row is the affordance: clicking it opens Add progress on
          // that tracker, which saves three extra links of vertical space.
          const interactive = !completed && !expired;

          return (
            <div
              key={row.activity}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={
                interactive
                  ? `Add ${row.label} progress. ${row.value} of ${row.target} ${row.unit}. ${ACTIVITY_FORMULA_LABEL[row.activity]}.`
                  : undefined
              }
              onClick={interactive ? () => onAddProgress(row.activity) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onAddProgress(row.activity);
                      }
                    }
                  : undefined
              }
              className={cn(
                'rounded-[2px] px-1.5 py-1 transition-colors duration-200',
                interactive && 'cursor-pointer hover:bg-gold/[0.06]',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <dt className="flex min-w-0 items-center gap-2 text-base text-ivory">
                  <Icon
                    aria-hidden
                    className={cn('h-[1.15rem] w-[1.15rem] shrink-0', met ? 'text-teal' : 'text-gold')}
                    strokeWidth={1.4}
                  />
                  <span className="truncate">{row.label}</span>
                </dt>
                <dd
                  className={cn(
                    'shrink-0 tabular-nums text-base',
                    met ? 'text-teal' : 'text-ivory-dim',
                  )}
                >
                  {row.value} / {row.target} {row.unit}
                </dd>
              </div>

              <ProgressBar
                className="mt-1"
                size="sm"
                value={row.fraction}
                valueText={`${row.label}: ${row.value} of ${row.target} ${row.unit}`}
              />
            </div>
          );
        })}
      </dl>

      <p className="mt-2.5 text-xs leading-relaxed text-ivory-faint">
        No Quest XP of its own — each entry above already converts into XP.
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <GameButton
          variant="primary"
          onClick={() => onAddProgress('reading')}
          disabled={completed || expired}
        >
          Add progress
        </GameButton>
        <GameButton
          variant="secondary"
          onClick={onEditEntry}
          disabled={expired || (totals?.entryCount ?? 0) === 0}
        >
          Edit entry
        </GameButton>
        <GameButton variant="ghost" onClick={onViewLog}>
          View today&apos;s log
        </GameButton>

        {completed ? (
          <GameButton variant="ghost" onClick={onReopen} className="ml-auto">
            Reopen
          </GameButton>
        ) : (
          <GameButton
            variant="secondary"
            onClick={onComplete}
            disabled={expired || (totals?.entryCount ?? 0) === 0}
            className="ml-auto"
          >
            Complete Daily Check
          </GameButton>
        )}
      </div>

    </article>
  );
}

export function CompletionCircle({
  done,
  expired,
  onClick,
  label,
}: {
  done: boolean;
  expired?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  const circle = (
    <span
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
        done
          ? 'border-teal bg-teal/20 text-teal'
          : expired
            ? 'border-ivory-faint/40 text-ivory-faint'
            : 'border-gold/50 text-transparent',
        onClick && !done && !expired && 'hover:border-teal hover:text-teal/40',
      )}
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
    </span>
  );

  if (!onClick) return circle;

  return (
    <button
      type="button"
      onClick={onClick}
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={label}
      disabled={expired}
      className="shrink-0 rounded-full disabled:cursor-not-allowed"
    >
      {circle}
    </button>
  );
}
