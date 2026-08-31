import type {
  LevelProgress,
  NodeProgress,
  RankName,
  SkillNodeStatus,
  XpTransaction,
} from './types';

/* ------------------------------------------------------------------ */
/* Character levels                                                    */
/* ------------------------------------------------------------------ */

export const MAX_CHARACTER_LEVEL = 100;

/**
 * XP required to advance FROM `level` to `level + 1`.
 *
 *   levels 1-5    300 XP each
 *   levels 6-10   600 XP each
 *   levels 11-30  1,000 XP each
 *   levels 31-100 2,000 XP each
 *
 * Level 100 is the cap and requires nothing further.
 */
export function xpToAdvanceFrom(level: number): number {
  if (level >= MAX_CHARACTER_LEVEL) return Number.POSITIVE_INFINITY;
  if (level <= 5) return 300;
  if (level <= 10) return 600;
  if (level <= 30) return 1000;
  return 2000;
}

/** Total lifetime XP needed to sit exactly at the start of `level`. */
export function cumulativeXpForLevel(level: number): number {
  const target = Math.min(Math.max(level, 1), MAX_CHARACTER_LEVEL);
  let total = 0;
  for (let l = 1; l < target; l += 1) total += xpToAdvanceFrom(l);
  return total;
}

const RANK_BANDS: Array<{ min: number; max: number; name: RankName }> = [
  { min: 1, max: 5, name: 'Initiate' },
  { min: 6, max: 10, name: 'Apprentice' },
  { min: 11, max: 20, name: 'Scholar' },
  { min: 21, max: 30, name: 'Adept' },
  { min: 31, max: 50, name: 'Vanguard' },
  { min: 51, max: 75, name: 'Master' },
  { min: 76, max: 99, name: 'Grandmaster' },
  { min: 100, max: 100, name: 'Legend' },
];

export function rankForLevel(level: number): RankName {
  const band = RANK_BANDS.find((b) => level >= b.min && level <= b.max);
  return band ? band.name : 'Initiate';
}

export function rankBands(): ReadonlyArray<{ min: number; max: number; name: RankName }> {
  return RANK_BANDS;
}

/**
 * Turns a lifetime XP total into level, rank and progress toward the next
 * level. Lifetime XP is clamped at zero: a compensating transaction can walk
 * a total back down, but the character can never go negative.
 */
export function levelProgressFromXp(lifetimeXpRaw: number): LevelProgress {
  const lifetimeXp = Math.max(0, Math.floor(lifetimeXpRaw));
  let level = 1;
  let remaining = lifetimeXp;

  while (level < MAX_CHARACTER_LEVEL) {
    const need = xpToAdvanceFrom(level);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }

  const atCap = level >= MAX_CHARACTER_LEVEL;
  const xpForNextLevel = atCap ? 0 : xpToAdvanceFrom(level);

  return {
    level,
    rank: rankForLevel(level),
    lifetimeXp,
    xpIntoLevel: atCap ? 0 : remaining,
    xpForNextLevel,
    fraction: atCap ? 1 : xpForNextLevel === 0 ? 0 : remaining / xpForNextLevel,
    atCap,
  };
}

/* ------------------------------------------------------------------ */
/* Skill node levels (1-10)                                            */
/* ------------------------------------------------------------------ */

export const MAX_NODE_LEVEL = 10;

/**
 * XP required to advance a single skill node FROM `level` to `level + 1`.
 *
 * Tuned so that a node sitting at level 7 needs 600 XP to reach 8, matching
 * the progression shown on the Skills reference screen.
 */
const NODE_STEP: Record<number, number> = {
  1: 100,
  2: 150,
  3: 200,
  4: 300,
  5: 400,
  6: 500,
  7: 600,
  8: 800,
  9: 1000,
};

export function nodeXpToAdvanceFrom(level: number): number {
  if (level >= MAX_NODE_LEVEL) return Number.POSITIVE_INFINITY;
  return NODE_STEP[level] ?? 100;
}

export function cumulativeNodeXpForLevel(level: number): number {
  const target = Math.min(Math.max(level, 1), MAX_NODE_LEVEL);
  let total = 0;
  for (let l = 1; l < target; l += 1) total += nodeXpToAdvanceFrom(l);
  return total;
}

export const NODE_LEVEL_MEANING: Record<number, string> = {
  0: 'Undiscovered',
  1: 'First exposure',
  2: 'Fundamentals',
  3: 'Guided practice',
  4: 'Independent beginner',
  5: 'Consistently competent',
  6: 'Strong practical experience',
  7: 'Advanced',
  8: 'Highly proficient',
  9: 'Expert',
  10: 'Exceptional mastery',
};

/**
 * A node with no XP at all has not been started - it is Undiscovered and sits
 * at level 0. Any XP at all puts it at level 1 (First exposure).
 */
export function statusForNodeLevel(level: number): SkillNodeStatus {
  if (level <= 0) return 'undiscovered';
  if (level === 1) return 'unlocked';
  if (level <= 4) return 'learning';
  if (level <= 6) return 'proficient';
  if (level <= 8) return 'advanced';
  return 'mastered';
}

export const NODE_STATUS_LABEL: Record<SkillNodeStatus, string> = {
  undiscovered: 'Undiscovered',
  unlocked: 'Unlocked',
  learning: 'Learning',
  proficient: 'Proficient',
  advanced: 'Advanced',
  mastered: 'Mastered',
};

export function nodeProgressFromXp(nodeId: string, totalXpRaw: number): NodeProgress {
  const totalXp = Math.max(0, Math.floor(totalXpRaw));

  if (totalXp <= 0) {
    return {
      nodeId,
      level: 0,
      status: 'undiscovered',
      totalXp: 0,
      xpIntoLevel: 0,
      xpForNextLevel: nodeXpToAdvanceFrom(1),
      fraction: 0,
      atCap: false,
    };
  }

  let level = 1;
  let remaining = totalXp;
  while (level < MAX_NODE_LEVEL) {
    const need = nodeXpToAdvanceFrom(level);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }

  const atCap = level >= MAX_NODE_LEVEL;
  const xpForNextLevel = atCap ? 0 : nodeXpToAdvanceFrom(level);

  return {
    nodeId,
    level,
    status: statusForNodeLevel(level),
    totalXp,
    xpIntoLevel: atCap ? 0 : remaining,
    xpForNextLevel,
    fraction: atCap ? 1 : xpForNextLevel === 0 ? 0 : remaining / xpForNextLevel,
    atCap,
  };
}

/* ------------------------------------------------------------------ */
/* Ledger roll-ups                                                     */
/* ------------------------------------------------------------------ */

/** Character XP is the plain sum of the ledger - never multiplied. */
export function lifetimeXpFromLedger(transactions: XpTransaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/** XP per skill node, keyed by node id. Transactions with no node are skipped. */
export function nodeXpFromLedger(transactions: XpTransaction[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (!tx.skillNodeId) continue;
    totals[tx.skillNodeId] = (totals[tx.skillNodeId] ?? 0) + tx.amount;
  }
  return totals;
}

/**
 * Branch level is the highest level reached by at least TWO of its nodes.
 *
 * Depth has to be corroborated: one mastered node inside an otherwise shallow
 * branch means you are strong at that one thing, not that the whole branch is
 * mastered. A branch with a single node falls back to that node's level, since
 * there is nothing to corroborate against.
 */
export function branchLevelFromNodes(nodeLevels: number[]): number {
  const active = nodeLevels.filter((l) => l > 0);
  if (active.length === 0) return 0;
  if (active.length === 1) return active[0];

  const sorted = [...active].sort((a, b) => b - a);
  return sorted[1];
}

/**
 * Domain level is the rounded mean of its branch levels: breadth across a
 * domain, not a single spike.
 */
export function domainLevelFromBranches(branchLevels: number[]): number {
  const active = branchLevels.filter((l) => l > 0);
  if (active.length === 0) return 0;
  const mean = active.reduce((a, b) => a + b, 0) / active.length;
  return Math.round(mean);
}
