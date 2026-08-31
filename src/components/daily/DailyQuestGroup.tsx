'use client';

import { useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';

import { GameButton } from '@/components/ui/GameButton';
import { replacementOptions } from '@/store/dailyActions';
import type { DailyCheckActivity, DayKey, Id } from '@/domain/types';
import { useTodayDaily } from '@/store/dailySelectors';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

import { AddProgressDialog } from './AddProgressDialog';
import { DailyCheckCard } from './DailyCheckCard';
import { DailyQuestCard } from './DailyQuestCard';
import { DailyQuestSettings, ReplaceQuestDialog } from './DailyQuestSettings';
import { TodayLogDialog } from './TodayLogDialog';

/**
 * The collapsible DAILY QUESTS group inside the Quest Log.
 *
 * Collapsed it is one row: the name, today's completion count, the reset
 * countdown and a chevron. Expanded it stacks the four cards — the Daily Check
 * first and always, then the three rotating quests — in a region that scrolls
 * on its own so the rest of the quest list stays reachable.
 */
export function DailyQuestGroup({
  today,
  countdown,
}: {
  today: DayKey;
  countdown: string;
}) {
  const daily = useTodayDaily(today);
  const targets = useAppStore((s) => s.dailyTargets);

  const completeQuest = useAppStore((s) => s.completeDailyQuest);
  const reopenQuest = useAppStore((s) => s.reopenDailyQuest);
  const completeCheck = useAppStore((s) => s.completeDailyCheck);
  const reopenCheck = useAppStore((s) => s.reopenDailyCheck);
  const setPinned = useAppStore((s) => s.setDailyQuestPinned);
  const slice = useDailySliceForOptions();

  // Starts collapsed: the group is a header row until you click it, which is
  // what keeps the rest of the Quest Log usable underneath.
  const [expanded, setExpanded] = useState(false);
  const [addProgress, setAddProgress] = useState<{ open: boolean; activity?: DailyCheckActivity }>({
    open: false,
  });
  const [logOpen, setLogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replacing, setReplacing] = useState<Id | null>(null);
  const [notice, setNotice] = useState('');

  const onComplete = () => {
    const result = completeCheck();
    setNotice(result.ok ? '' : result.error);
  };

  const onPin = (definitionId: Id, pinned: boolean) => {
    const result = setPinned(definitionId, pinned);
    setNotice(result.ok ? '' : result.error);
  };

  return (
    <section
      className={cn(
        'shrink-0 rounded-[3px] border transition-colors duration-200',
        expanded ? 'border-teal/45 bg-teal/[0.03]' : 'border-gold/30',
      )}
    >
      {/* ---------------- header ---------------- */}
      <h3>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="daily-quest-panel"
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-200 hover:bg-gold/[0.04]"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="panel-title !text-left">Daily Quests</span>
              <span
                className={cn(
                  'text-lg tabular-nums',
                  daily.completed >= daily.total && daily.total > 0
                    ? 'text-teal-bright'
                    : 'text-ivory',
                )}
              >
                {daily.completed} / {daily.total}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-ivory-faint">
              Resets in {countdown}
            </span>
          </span>

          <ChevronDown
            aria-hidden
            className={cn(
              'h-5 w-5 shrink-0 text-gold transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </button>
      </h3>

      {/* ---------------- expanded ---------------- */}
      {expanded && (
        <div id="daily-quest-panel" className="border-t border-gold/20 px-3 pb-3 pt-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-xs text-ivory-faint">
              Four a day. The Daily Check is permanent; the other three rotate.
            </p>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] border border-gold/30 px-2.5 py-1.5 text-xs uppercase tracking-wider2 text-ivory-dim transition-colors duration-200 hover:border-gold/60 hover:text-ivory"
            >
              <Settings2 aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              Settings
            </button>
          </div>

          {notice && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {notice}
            </p>
          )}

          {/* Scrolls independently so a long day never pushes the quest list
              off screen. */}
          <div className="max-h-[min(40rem,60vh)] space-y-2.5 overflow-y-auto scroll-thin pr-1">
            <DailyCheckCard
              status={daily.checkStatus}
              totals={daily.checkTotals}
              targets={targets}
              progress={daily.checkProgress}
              onAddProgress={(activity) => setAddProgress({ open: true, activity })}
              onEditEntry={() => setLogOpen(true)}
              onViewLog={() => setLogOpen(true)}
              onComplete={onComplete}
              onReopen={reopenCheck}
            />

            {daily.cards.map(({ instance, definition }) => (
              <DailyQuestCard
                key={instance.id}
                instance={instance}
                definition={definition}
                onToggle={() =>
                  instance.status === 'completed'
                    ? reopenQuest(instance.id)
                    : completeQuest(instance.id)
                }
                onReplace={() => setReplacing(instance.id)}
                onPin={() => onPin(definition.id, !definition.pinned)}
              />
            ))}

            {daily.cards.length === 0 && (
              <p className="rounded-[2px] border border-gold/25 px-3 py-4 text-center text-sm text-ivory-faint">
                No rotating quests are active. Turn some back on in Settings.
              </p>
            )}
          </div>

          <div className="mt-2.5 flex justify-end">
            <GameButton variant="ghost" size="sm" onClick={() => setLogOpen(true)}>
              View today&apos;s log
            </GameButton>
          </div>
        </div>
      )}

      <AddProgressDialog
        open={addProgress.open}
        initialActivity={addProgress.activity}
        onClose={() => setAddProgress({ open: false })}
      />

      <TodayLogDialog open={logOpen} check={daily.check} onClose={() => setLogOpen(false)} />

      <DailyQuestSettings
        open={settingsOpen}
        today={today}
        onClose={() => setSettingsOpen(false)}
      />

      <ReplaceQuestDialog
        open={replacing !== null}
        instanceId={replacing}
        options={replacing ? replacementOptions(slice, today, replacing) : []}
        onClose={() => setReplacing(null)}
      />
    </section>
  );
}

/** The slice shape `replacementOptions` expects. */
function useDailySliceForOptions() {
  const dailyDefinitions = useAppStore((s) => s.dailyDefinitions);
  const dailyInstances = useAppStore((s) => s.dailyInstances);
  const dailySelections = useAppStore((s) => s.dailySelections);
  const dailyChecks = useAppStore((s) => s.dailyChecks);
  const dailyTargets = useAppStore((s) => s.dailyTargets);
  const dailyHistory = useAppStore((s) => s.dailyHistory);
  const dailyActiveDate = useAppStore((s) => s.dailyActiveDate);

  return {
    dailyDefinitions,
    dailyInstances,
    dailySelections,
    dailyChecks,
    dailyTargets,
    dailyHistory,
    dailyActiveDate,
  };
}
