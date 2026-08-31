import { describe, expect, it } from 'vitest';

import {
  MAX_CHARACTER_LEVEL,
  branchLevelFromNodes,
  cumulativeNodeXpForLevel,
  cumulativeXpForLevel,
  domainLevelFromBranches,
  levelProgressFromXp,
  lifetimeXpFromLedger,
  nodeProgressFromXp,
  nodeXpFromLedger,
  rankForLevel,
  statusForNodeLevel,
  xpToAdvanceFrom,
} from '@/domain/progression';
import type { XpTransaction } from '@/domain/types';

const tx = (amount: number, skillNodeId: string | null = null): XpTransaction => ({
  id: `tx_${Math.random()}`,
  createdAt: new Date().toISOString(),
  sourceType: 'manual',
  sourceId: null,
  skillNodeId,
  amount,
});

describe('character XP curve', () => {
  it('charges the documented cost per band', () => {
    expect(xpToAdvanceFrom(1)).toBe(300);
    expect(xpToAdvanceFrom(5)).toBe(300);
    expect(xpToAdvanceFrom(6)).toBe(600);
    expect(xpToAdvanceFrom(10)).toBe(600);
    expect(xpToAdvanceFrom(11)).toBe(1000);
    expect(xpToAdvanceFrom(30)).toBe(1000);
    expect(xpToAdvanceFrom(31)).toBe(2000);
    expect(xpToAdvanceFrom(99)).toBe(2000);
    expect(xpToAdvanceFrom(100)).toBe(Number.POSITIVE_INFINITY);
  });

  it('accumulates to the expected band boundaries', () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(6)).toBe(1500); // 5 x 300
    expect(cumulativeXpForLevel(11)).toBe(4500); // + 5 x 600
    expect(cumulativeXpForLevel(31)).toBe(24500); // + 20 x 1,000
    expect(cumulativeXpForLevel(100)).toBe(162500); // + 69 x 2,000
  });

  it('lands a level exactly on its threshold', () => {
    expect(levelProgressFromXp(0).level).toBe(1);
    expect(levelProgressFromXp(299).level).toBe(1);
    expect(levelProgressFromXp(300).level).toBe(2);
    expect(levelProgressFromXp(1500).level).toBe(6);
    expect(levelProgressFromXp(4500).level).toBe(11);
  });

  it('reports progress within the current level', () => {
    const progress = levelProgressFromXp(6120);
    expect(progress.level).toBe(12);
    expect(progress.rank).toBe('Scholar');
    expect(progress.xpIntoLevel).toBe(620);
    expect(progress.xpForNextLevel).toBe(1000);
    expect(progress.fraction).toBeCloseTo(0.62);
  });

  it('caps at level 100 and never overflows', () => {
    const capped = levelProgressFromXp(9_999_999);
    expect(capped.level).toBe(MAX_CHARACTER_LEVEL);
    expect(capped.atCap).toBe(true);
    expect(capped.fraction).toBe(1);
  });

  it('clamps a negative total at zero rather than going below level 1', () => {
    const progress = levelProgressFromXp(-500);
    expect(progress.level).toBe(1);
    expect(progress.lifetimeXp).toBe(0);
  });
});

describe('ranks', () => {
  it('maps every band', () => {
    expect(rankForLevel(1)).toBe('Initiate');
    expect(rankForLevel(5)).toBe('Initiate');
    expect(rankForLevel(6)).toBe('Apprentice');
    expect(rankForLevel(11)).toBe('Scholar');
    expect(rankForLevel(21)).toBe('Adept');
    expect(rankForLevel(31)).toBe('Vanguard');
    expect(rankForLevel(51)).toBe('Master');
    expect(rankForLevel(76)).toBe('Grandmaster');
    expect(rankForLevel(100)).toBe('Legend');
  });
});

describe('skill node levels', () => {
  it('treats zero XP as undiscovered, not level 1', () => {
    const progress = nodeProgressFromXp('n', 0);
    expect(progress.level).toBe(0);
    expect(progress.status).toBe('undiscovered');
  });

  it('matches the reference: level 7 needs 600 XP to advance', () => {
    // 1,650 XP is exactly level 7; +240 reproduces the Skills reference panel.
    expect(cumulativeNodeXpForLevel(7)).toBe(1650);
    const progress = nodeProgressFromXp('python', 1650 + 240);
    expect(progress.level).toBe(7);
    expect(progress.xpIntoLevel).toBe(240);
    expect(progress.xpForNextLevel).toBe(600);
    expect(progress.status).toBe('advanced');
  });

  it('maps levels to the documented statuses', () => {
    expect(statusForNodeLevel(0)).toBe('undiscovered');
    expect(statusForNodeLevel(1)).toBe('unlocked');
    expect(statusForNodeLevel(4)).toBe('learning');
    expect(statusForNodeLevel(6)).toBe('proficient');
    expect(statusForNodeLevel(8)).toBe('advanced');
    expect(statusForNodeLevel(10)).toBe('mastered');
  });

  it('caps at level 10', () => {
    const progress = nodeProgressFromXp('n', 999_999);
    expect(progress.level).toBe(10);
    expect(progress.atCap).toBe(true);
  });
});

describe('ledger roll-ups', () => {
  it('never multiplies XP: the character total is the plain sum', () => {
    // One 30 XP activity on Guitar gives Guitar 30 and the character 30.
    const ledger = [tx(30, 'guitar')];
    expect(lifetimeXpFromLedger(ledger)).toBe(30);
    expect(nodeXpFromLedger(ledger).guitar).toBe(30);
  });

  it('keeps node totals separate from unallocated character XP', () => {
    const ledger = [tx(100, 'python'), tx(50, 'sql'), tx(25, null)];
    expect(lifetimeXpFromLedger(ledger)).toBe(175);
    const byNode = nodeXpFromLedger(ledger);
    expect(byNode.python).toBe(100);
    expect(byNode.sql).toBe(50);
    expect(Object.keys(byNode)).toHaveLength(2);
  });

  it('lets a compensating transaction walk a total back down', () => {
    const ledger = [tx(100, 'python'), tx(-100, 'python')];
    expect(lifetimeXpFromLedger(ledger)).toBe(0);
    expect(nodeXpFromLedger(ledger).python).toBe(0);
  });
});

describe('derived branch and domain levels', () => {
  it('requires two nodes to corroborate a branch level', () => {
    // One mastered node in a shallow branch does not make the branch mastered.
    expect(branchLevelFromNodes([9, 7, 5, 5, 5, 7, 2])).toBe(7);
    expect(branchLevelFromNodes([9, 2, 2])).toBe(2);
  });

  it('falls back to the single node when there is nothing to corroborate', () => {
    expect(branchLevelFromNodes([6])).toBe(6);
    expect(branchLevelFromNodes([])).toBe(0);
  });

  it('ignores undiscovered nodes', () => {
    expect(branchLevelFromNodes([6, 6, 0, 0])).toBe(6);
  });

  it('averages branches into a domain level', () => {
    // The Computer Science branches from the seed: 7, 6, 5, 5, 6, 4 -> 5.5 -> 6
    expect(domainLevelFromBranches([7, 6, 5, 5, 6, 4])).toBe(6);
    expect(domainLevelFromBranches([7, 7, 7, 6])).toBe(7);
    expect(domainLevelFromBranches([5, 5, 4, 5])).toBe(5);
    expect(domainLevelFromBranches([])).toBe(0);
  });
});
