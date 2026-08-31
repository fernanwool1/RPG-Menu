import { cn } from '@/lib/cn';
import type { AbilityStatus, QuestStatus, SkillNodeStatus } from '@/domain/types';

/**
 * Status is carried by BOTH colour and wording, never colour alone. The tiers
 * below are shared across skill nodes, abilities and quests so that "further
 * along" always reads the same way across the whole app.
 */
type Tone = 'locked' | 'progress' | 'ready' | 'done' | 'peak' | 'failed';

const TONES: Record<Tone, string> = {
  locked: 'border-ivory-faint/30 text-ivory-faint',
  progress: 'border-gold/40 text-gold',
  ready: 'border-teal/50 text-teal-bright',
  done: 'border-teal/40 text-teal',
  peak: 'border-gold-bright/60 text-gold-bright',
  failed: 'border-danger-dim text-danger',
};

const NODE_TONE: Record<SkillNodeStatus, Tone> = {
  undiscovered: 'locked',
  unlocked: 'progress',
  learning: 'progress',
  proficient: 'ready',
  advanced: 'done',
  mastered: 'peak',
};

const ABILITY_TONE: Record<AbilityStatus, Tone> = {
  locked: 'locked',
  developing: 'progress',
  eligible: 'ready',
  unlocked: 'done',
  advanced: 'done',
  mastered: 'peak',
};

const QUEST_TONE: Record<QuestStatus, Tone> = {
  planned: 'locked',
  active: 'ready',
  completed: 'done',
  failed: 'failed',
  archived: 'locked',
};

export interface StatusBadgeProps {
  children: string;
  tone?: Tone;
  className?: string;
  /** Renders as bare uppercase text rather than a bordered chip. */
  bare?: boolean;
}

export function StatusBadge({ children, tone = 'progress', className, bare }: StatusBadgeProps) {
  if (bare) {
    return (
      <span className={cn('label-caps', TONES[tone].split(' ').pop(), className)}>{children}</span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[2px] border px-1.5 py-0.5 label-caps',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const nodeTone = (s: SkillNodeStatus) => NODE_TONE[s];
export const abilityTone = (s: AbilityStatus) => ABILITY_TONE[s];
export const questTone = (s: QuestStatus) => QUEST_TONE[s];
