'use client';

import { Pin } from 'lucide-react';

import { GameButton } from '@/components/ui/GameButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CATEGORY_LABEL, DAILY_QUEST_STATUS_LABEL } from '@/domain/daily';
import type { DailyQuestDefinition, DailyQuestInstance } from '@/domain/types';
import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/cn';

/**
 * One rotating Daily Quest.
 *
 * Binary by design: a completion circle and a flat Character XP reward, with
 * no numerical tracker anywhere on it. Trackers live only on the Daily Check,
 * which is what keeps one piece of effort from being converted twice.
 */
export function DailyQuestCard({
  instance,
  definition,
  onToggle,
  onReplace,
  onPin,
}: {
  instance: DailyQuestInstance;
  definition: DailyQuestDefinition;
  onToggle: () => void;
  onReplace: () => void;
  onPin: () => void;
}) {
  const completed = instance.status === 'completed';
  const expired = instance.status === 'expired';
  const Icon = iconFor(definition.icon);

  return (
    <article
      className={cn(
        'relative rounded-[3px] border p-3.5 transition-colors duration-200',
        completed
          ? 'border-teal/50 bg-teal/[0.05]'
          : expired
            ? 'border-ivory-faint/25 bg-ink-950/40 opacity-70'
            : 'border-gold/30 bg-ink-950/40 hover:border-gold/55',
      )}
    >
      <div className="flex items-start gap-3">
        <CompletionButton
          done={completed}
          expired={expired}
          onClick={onToggle}
          label={completed ? `Reopen ${definition.name}` : `Complete ${definition.name}`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Icon aria-hidden className="h-[1.15rem] w-[1.15rem] shrink-0 text-gold" strokeWidth={1.4} />
            <h4
              className={cn(
                'text-lg leading-tight',
                completed ? 'text-ivory-dim line-through' : 'text-ivory',
              )}
            >
              {definition.name}
            </h4>

            {definition.pinned && (
              <span
                className="inline-flex items-center gap-1 text-xs text-teal"
                title="Pinned — appears every day"
              >
                <Pin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.6} />
                Pinned
              </span>
            )}
          </div>

          <p className="mt-1 text-sm leading-relaxed text-ivory-dim">{definition.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge bare tone="progress">
              {CATEGORY_LABEL[definition.category]}
            </StatusBadge>
            <StatusBadge
              bare
              tone={completed ? 'done' : expired ? 'locked' : 'ready'}
            >
              {DAILY_QUEST_STATUS_LABEL[instance.status]}
            </StatusBadge>
            {definition.weekdays.length > 0 && (
              <span className="text-xs text-ivory-faint">Scheduled days only</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-lg text-teal">{definition.characterXp} XP</div>
          <div className="text-xs text-ivory-faint">Character</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GameButton variant={completed ? 'ghost' : 'primary'} size="sm" onClick={onToggle} disabled={expired}>
          {completed ? 'Reopen' : 'Complete'}
        </GameButton>

        <GameButton
          variant="ghost"
          size="sm"
          onClick={onReplace}
          disabled={completed || expired}
          title={completed ? 'Completed quests cannot be replaced' : undefined}
        >
          Replace
        </GameButton>

        <GameButton variant="ghost" size="sm" onClick={onPin} className="ml-auto">
          {definition.pinned ? 'Unpin' : 'Pin'}
        </GameButton>
      </div>

      {completed && (
        <p className="mt-2 text-xs text-ivory-faint">
          Completed quests cannot be replaced.
        </p>
      )}
    </article>
  );
}

function CompletionButton({
  done,
  expired,
  onClick,
  label,
}: {
  done: boolean;
  expired: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={expired}
      className={cn(
        'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
        'transition-colors duration-200 disabled:cursor-not-allowed',
        done
          ? 'border-teal bg-teal/20 text-teal'
          : expired
            ? 'border-ivory-faint/40 text-ivory-faint'
            : 'border-gold/50 text-transparent hover:border-teal hover:text-teal/40',
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
