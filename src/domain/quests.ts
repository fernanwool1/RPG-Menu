import type { Quest, QuestDifficulty, QuestPriority, QuestStatus, QuestType } from './types';

export const QUEST_TYPE_LABEL: Record<QuestType, string> = {
  side: 'Side',
  standard: 'Standard',
  main: 'Main',
  boss: 'Boss',
  legendary: 'Legendary',
  daily: 'Daily',
  weekly: 'Weekly',
};

export const QUEST_STATUS_LABEL: Record<QuestStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  failed: 'Failed',
  archived: 'Archived',
};

export const QUEST_DIFFICULTY_LABEL: Record<QuestDifficulty, string> = {
  trivial: 'Trivial',
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  severe: 'Severe',
};

export const QUEST_PRIORITY_LABEL: Record<QuestPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

/** Suggested Character XP band per quest type. Advisory, never enforced. */
export const QUEST_XP_RANGE: Record<QuestType, { min: number; max: number }> = {
  side: { min: 25, max: 40 },
  standard: { min: 50, max: 75 },
  main: { min: 100, max: 200 },
  boss: { min: 250, max: 400 },
  legendary: { min: 500, max: 1000 },
  daily: { min: 25, max: 40 },
  weekly: { min: 50, max: 75 },
};

export function suggestedXpFor(type: QuestType): number {
  const band = QUEST_XP_RANGE[type];
  return Math.round((band.min + band.max) / 2);
}

export function isXpWithinSuggestedRange(type: QuestType, xp: number): boolean {
  const band = QUEST_XP_RANGE[type];
  return xp >= band.min && xp <= band.max;
}

/** Objective completion, 0..1. A quest with no objectives reads as 0. */
export function questProgress(quest: Quest): { done: number; total: number; fraction: number } {
  const total = quest.objectives.length;
  const done = quest.objectives.filter((o) => o.done).length;
  return { done, total, fraction: total === 0 ? 0 : done / total };
}

export function allObjectivesDone(quest: Quest): boolean {
  return quest.objectives.length > 0 && quest.objectives.every((o) => o.done);
}

export function totalAllocatedXp(quest: Quest): number {
  return quest.skillAllocations.reduce((sum, a) => sum + a.xp, 0);
}

/**
 * Skill allocations are carved OUT of the quest's Character XP, never added on
 * top. The remainder is banked as general character XP so the total paid out
 * is always exactly `characterXp`.
 */
export function splitQuestXp(quest: Quest): {
  allocations: Array<{ skillNodeId: string; xp: number }>;
  unallocated: number;
  total: number;
} {
  const capped: Array<{ skillNodeId: string; xp: number }> = [];
  let budget = Math.max(0, quest.characterXp);

  for (const allocation of quest.skillAllocations) {
    if (budget <= 0) break;
    const xp = Math.min(Math.max(0, allocation.xp), budget);
    if (xp > 0) {
      capped.push({ skillNodeId: allocation.skillNodeId, xp });
      budget -= xp;
    }
  }

  return {
    allocations: capped,
    unallocated: budget,
    total: Math.max(0, quest.characterXp),
  };
}

/** A quest pays out once and only once, guarded by xpAwardedAt. */
export function canAwardXp(quest: Quest): boolean {
  return quest.xpAwardedAt === null;
}

export type DeadlineState = 'none' | 'overdue' | 'today' | 'soon' | 'later';

export function deadlineState(quest: Quest, now: Date = new Date()): DeadlineState {
  if (!quest.deadline) return 'none';
  if (quest.status === 'completed' || quest.status === 'archived') return 'none';

  const due = new Date(quest.deadline);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due);
  startOfDue.setHours(0, 0, 0, 0);

  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (due.getTime() < now.getTime() && days < 0) return 'overdue';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 3) return 'soon';
  return 'later';
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return 'No deadline';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Sort: urgency first, then priority, then title. Used by the quest list. */
export function compareQuests(a: Quest, b: Quest): number {
  const statusWeight: Record<QuestStatus, number> = {
    active: 0,
    planned: 1,
    failed: 2,
    completed: 3,
    archived: 4,
  };
  const priorityWeight: Record<QuestPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  const byStatus = statusWeight[a.status] - statusWeight[b.status];
  if (byStatus !== 0) return byStatus;

  const byPriority = priorityWeight[a.priority] - priorityWeight[b.priority];
  if (byPriority !== 0) return byPriority;

  if (a.deadline && b.deadline) {
    const byDeadline = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (byDeadline !== 0) return byDeadline;
  } else if (a.deadline) {
    return -1;
  } else if (b.deadline) {
    return 1;
  }

  return a.title.localeCompare(b.title);
}
