import { describe, expect, it } from 'vitest';

import { evaluateAbility, isProofSatisfied, type LevelLookup } from '@/domain/abilities';
import { computeAssetTotals } from '@/domain/inventory';
import { canAwardXp, questProgress, splitQuestXp } from '@/domain/quests';
import { buildSampleBundle } from '@/domain/seed';
import { abilityId } from '@/domain/seed/abilities';
import { branchLevelFromNodes, domainLevelFromBranches, levelProgressFromXp, lifetimeXpFromLedger, nodeProgressFromXp } from '@/domain/progression';
import type { Ability, Quest } from '@/domain/types';

const at = new Date().toISOString();
const bundle = buildSampleBundle(at);

/** Rebuilds the same derived levels the UI shows, from the seeded data. */
function levelsFromBundle(): LevelLookup {
  const nodeXp = new Map<string, number>();
  for (const node of bundle.nodes) nodeXp.set(node.id, node.seedXp);
  for (const tx of bundle.transactions) {
    if (!tx.skillNodeId) continue;
    nodeXp.set(tx.skillNodeId, (nodeXp.get(tx.skillNodeId) ?? 0) + tx.amount);
  }

  const nodeLevel = new Map<string, number>();
  for (const [id, xp] of nodeXp) nodeLevel.set(id, nodeProgressFromXp(id, xp).level);

  const branchLevel = new Map<string, number>();
  for (const branch of bundle.branches) {
    const levels = bundle.nodes
      .filter((n) => n.branchId === branch.id && !n.archived)
      .map((n) => nodeLevel.get(n.id) ?? 0);
    branchLevel.set(branch.id, branchLevelFromNodes(levels));
  }

  const domainLevel = new Map<string, number>();
  for (const domain of bundle.domains) {
    const levels = bundle.branches
      .filter((b) => b.domainId === domain.id && !b.archived)
      .map((b) => branchLevel.get(b.id) ?? 0);
    domainLevel.set(domain.id, domainLevelFromBranches(levels));
  }

  return {
    node: (id) => nodeLevel.get(id) ?? 0,
    branch: (id) => branchLevel.get(id) ?? 0,
    domain: (id) => domainLevel.get(id) ?? 0,
  };
}

const levels = levelsFromBundle();

describe('quest XP distribution', () => {
  const quest = (over: Partial<Quest> = {}): Quest => ({
    id: 'q1',
    title: 'Test',
    description: '',
    type: 'main',
    category: 'Test',
    status: 'active',
    objectives: [],
    skillAllocations: [],
    deadline: null,
    difficulty: 'moderate',
    priority: 'normal',
    recurrence: 'none',
    characterXp: 100,
    rewards: [],
    attachments: [],
    completedAt: null,
    failedAt: null,
    xpAwardedAt: null,
    abilityId: null,
    createdAt: at,
    updatedAt: at,
    ...over,
  });

  it('carves skill XP out of the quest total, never adds it on top', () => {
    const split = splitQuestXp(
      quest({
        characterXp: 100,
        skillAllocations: [
          { skillNodeId: 'a', xp: 60 },
          { skillNodeId: 'b', xp: 30 },
        ],
      }),
    );

    const paidOut = split.allocations.reduce((s, a) => s + a.xp, 0) + split.unallocated;
    expect(paidOut).toBe(100);
    expect(split.unallocated).toBe(10);
  });

  it('caps over-allocation at the quest total', () => {
    const split = splitQuestXp(
      quest({
        characterXp: 100,
        skillAllocations: [
          { skillNodeId: 'a', xp: 80 },
          { skillNodeId: 'b', xp: 80 },
        ],
      }),
    );

    const paidOut = split.allocations.reduce((s, a) => s + a.xp, 0) + split.unallocated;
    expect(paidOut).toBe(100);
    expect(split.allocations[1].xp).toBe(20);
  });

  it('pays out once: xpAwardedAt closes the gate', () => {
    expect(canAwardXp(quest())).toBe(true);
    expect(canAwardXp(quest({ xpAwardedAt: at }))).toBe(false);
  });

  it('tracks objective progress', () => {
    const p = questProgress(
      quest({
        objectives: [
          { id: 'o1', label: 'a', done: true, order: 0 },
          { id: 'o2', label: 'b', done: false, order: 1 },
        ],
      }),
    );
    expect(p).toEqual({ done: 1, total: 2, fraction: 0.5 });
  });
});

describe('ability gating', () => {
  const get = (slug: string): Ability => {
    const ability = bundle.abilities.find((a) => a.id === abilityId(slug));
    if (!ability) throw new Error(`missing ability ${slug}`);
    return ability;
  };

  const evaluate = (slug: string) => evaluateAbility(get(slug), levels, bundle.quests);

  it('is Eligible when every requirement is met but proof is outstanding', () => {
    const result = evaluate('full-stack-builder');
    expect(result.metCount).toBe(result.totalCount);
    expect(result.proofSatisfied).toBe(false);
    expect(result.status).toBe('eligible');
  });

  it('is Unlocked when requirements and proof are both satisfied', () => {
    expect(evaluate('data-pipeline-architect').status).toBe('unlocked');
  });

  it('is Developing when only some requirements are met', () => {
    const result = evaluate('mobile-app-creator');
    expect(result.metCount).toBeGreaterThan(0);
    expect(result.metCount).toBeLessThan(result.totalCount);
    expect(result.status).toBe('developing');
  });

  it('is Locked when nothing is met', () => {
    const result = evaluate('applied-ai-developer');
    expect(result.metCount).toBe(0);
    expect(result.status).toBe('locked');
  });

  it('re-evaluates the moment a skill level changes', () => {
    const ability = get('mobile-app-creator');
    const raised: LevelLookup = { ...levels, node: () => 10, branch: () => 10, domain: () => 10 };
    expect(evaluateAbility(ability, raised, bundle.quests).status).toBe('eligible');
  });

  it('accepts a completed proof quest as proof', () => {
    const ability = get('full-stack-builder');
    const proofQuest: Quest = {
      ...bundle.quests[0],
      id: 'proof-1',
      status: 'completed',
    };
    const linked: Ability = { ...ability, proofQuestId: 'proof-1' };
    expect(isProofSatisfied(linked, [proofQuest])).toBe(true);
    expect(evaluateAbility(linked, levels, [proofQuest]).status).toBe('unlocked');
  });

  it('does not accept an unfinished proof quest', () => {
    const ability = get('full-stack-builder');
    const proofQuest: Quest = { ...bundle.quests[0], id: 'proof-2', status: 'active' };
    const linked: Ability = { ...ability, proofQuestId: 'proof-2' };
    expect(evaluateAbility(linked, levels, [proofQuest]).status).toBe('eligible');
  });

  it('counts only genuinely unlocked abilities toward a path tally', () => {
    const tally = (pathSlug: string) => {
      const inPath = bundle.abilities.filter((a) => a.pathId === `pth_${pathSlug}`);
      const unlocked = inPath.filter(
        (a) => evaluateAbility(a, levels, bundle.quests).countsAsUnlocked,
      ).length;
      return `${unlocked}/${inPath.length}`;
    };

    // These are the tallies shown on the Abilities reference screen.
    expect(tally('computer-science')).toBe('3/6');
    expect(tally('business')).toBe('4/6');
    expect(tally('music')).toBe('2/6');
    expect(tally('creative')).toBe('3/6');
    expect(tally('communication')).toBe('4/6');
    expect(tally('physical')).toBe('1/4');
  });
});

describe('the sample bundle reproduces the reference screens', () => {
  it('opens at Level 12, Scholar', () => {
    const progress = levelProgressFromXp(lifetimeXpFromLedger(bundle.transactions));
    expect(progress.level).toBe(12);
    expect(progress.rank).toBe('Scholar');
  });

  it('derives the domain levels shown on the Skills screen', () => {
    expect(levels.domain('dom_computer-science')).toBe(6);
    expect(levels.domain('dom_music')).toBe(7);
    expect(levels.domain('dom_business-administration')).toBe(7);
    expect(levels.domain('dom_languages-communication')).toBe(7);
    expect(levels.domain('dom_creative-arts')).toBe(6);
    expect(levels.domain('dom_physical-development')).toBe(5);
    expect(levels.domain('dom_leadership-service')).toBe(7);
  });

  it('derives Programming as Branch Level 7', () => {
    expect(levels.branch('brn_programming')).toBe(7);
  });

  it('matches the inventory cards and location counts', () => {
    const totals = computeAssetTotals(bundle.finances, bundle.items);
    expect(totals.cash).toBe(120);
    expect(totals.bank).toBe(2840);
    expect(totals.itemCount).toBe(27);
    expect(totals.total).toBe(totals.cash + totals.bank + totals.itemValue);

    const inLocation = (slug: string) =>
      bundle.items.filter((i) => i.locationId === `loc_${slug}` && !i.archived).length;
    expect(inLocation('on-person')).toBe(3);
    expect(inLocation('bag')).toBe(8);
    expect(inLocation('home')).toBe(12);
    expect(inLocation('storage')).toBe(4);
  });

  it('never double-counts XP when rolling up to the character', () => {
    // Character lifetime XP equals the plain sum of the ledger; node totals are
    // a projection of the same rows, not a second accrual.
    const ledgerSum = bundle.transactions.reduce((s, t) => s + t.amount, 0);
    expect(lifetimeXpFromLedger(bundle.transactions)).toBe(ledgerSum);
  });

  it('leaves every completed sample quest already paid, so it cannot pay again', () => {
    const completed = bundle.quests.filter((q) => q.status === 'completed');
    expect(completed.length).toBeGreaterThan(0);
    for (const quest of completed) expect(canAwardXp(quest)).toBe(false);
  });
});

describe('an empty start really is empty', () => {
  it('has no XP, no quests and nothing owned', async () => {
    const { buildEmptyBundle } = await import('@/domain/seed');
    const empty = buildEmptyBundle(at);

    expect(empty.transactions).toHaveLength(0);
    expect(empty.quests).toHaveLength(0);
    expect(empty.items).toHaveLength(0);
    expect(empty.activityLogs).toHaveLength(0);
    expect(levelProgressFromXp(lifetimeXpFromLedger(empty.transactions)).level).toBe(1);
    expect(empty.nodes.every((n) => n.seedXp === 0)).toBe(true);

    // The scaffolding is kept so there is something to build on.
    expect(empty.domains.length).toBeGreaterThan(0);
    expect(empty.templates.length).toBeGreaterThan(0);
    expect(empty.abilities.length).toBeGreaterThan(0);
  });
});
