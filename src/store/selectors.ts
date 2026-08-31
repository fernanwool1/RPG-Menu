'use client';

import { useMemo } from 'react';

import { evaluateAbility, type AbilityEvaluation, type LevelLookup } from '@/domain/abilities';
import { computeAllAttributes, overallRating, type AttributeContext } from '@/domain/attributes';
import { computeAssetTotals } from '@/domain/inventory';
import {
  branchLevelFromNodes,
  domainLevelFromBranches,
  levelProgressFromXp,
  lifetimeXpFromLedger,
  nodeProgressFromXp,
  nodeXpFromLedger,
} from '@/domain/progression';
import type { Id, LevelProgress, NodeProgress } from '@/domain/types';

import { useAppStore } from './useAppStore';

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/*                                                                     */
/* Everything below is derived on read. Nothing here is persisted, so   */
/* the ledger stays the only source of truth and there is no cached     */
/* total that can drift out of step with it.                            */
/* ------------------------------------------------------------------ */

/**
 * A node's XP is its declared baseline plus everything the ledger has
 * credited to it since. The baseline represents progress made before this
 * system existed; "Start empty" sets every baseline to zero.
 */
export function useNodeProgressMap(): Record<Id, NodeProgress> {
  const nodes = useAppStore((s) => s.nodes);
  const transactions = useAppStore((s) => s.transactions);

  return useMemo(() => {
    const ledger = nodeXpFromLedger(transactions);
    const map: Record<Id, NodeProgress> = {};
    for (const node of nodes) {
      map[node.id] = nodeProgressFromXp(node.id, node.seedXp + (ledger[node.id] ?? 0));
    }
    return map;
  }, [nodes, transactions]);
}

export function useCharacterProgress(): LevelProgress {
  const transactions = useAppStore((s) => s.transactions);
  return useMemo(() => levelProgressFromXp(lifetimeXpFromLedger(transactions)), [transactions]);
}

export interface BranchLevels {
  byBranch: Record<Id, number>;
  byDomain: Record<Id, number>;
}

export function useDerivedLevels(): BranchLevels {
  const branches = useAppStore((s) => s.branches);
  const domains = useAppStore((s) => s.domains);
  const nodes = useAppStore((s) => s.nodes);
  const nodeProgress = useNodeProgressMap();

  return useMemo(() => {
    const byBranch: Record<Id, number> = {};
    for (const branch of branches) {
      const levels = nodes
        .filter((n) => n.branchId === branch.id && !n.archived)
        .map((n) => nodeProgress[n.id]?.level ?? 0);
      byBranch[branch.id] = branchLevelFromNodes(levels);
    }

    const byDomain: Record<Id, number> = {};
    for (const domain of domains) {
      const levels = branches
        .filter((b) => b.domainId === domain.id && !b.archived)
        .map((b) => byBranch[b.id] ?? 0);
      byDomain[domain.id] = domainLevelFromBranches(levels);
    }

    return { byBranch, byDomain };
  }, [branches, domains, nodes, nodeProgress]);
}

/** Resolves a node id to the domain that ultimately contains it. */
export function useDomainIdByNodeId(): Record<Id, Id> {
  const nodes = useAppStore((s) => s.nodes);
  const branches = useAppStore((s) => s.branches);

  return useMemo(() => {
    const branchToDomain: Record<Id, Id> = {};
    for (const branch of branches) branchToDomain[branch.id] = branch.domainId;

    const map: Record<Id, Id> = {};
    for (const node of nodes) {
      const domainId = branchToDomain[node.branchId];
      if (domainId) map[node.id] = domainId;
    }
    return map;
  }, [nodes, branches]);
}

/* ------------------------------------------------------------------ */
/* Abilities                                                           */
/* ------------------------------------------------------------------ */

export function useLevelLookup(): LevelLookup {
  const nodeProgress = useNodeProgressMap();
  const { byBranch, byDomain } = useDerivedLevels();

  return useMemo(
    () => ({
      node: (id: Id) => nodeProgress[id]?.level ?? 0,
      branch: (id: Id) => byBranch[id] ?? 0,
      domain: (id: Id) => byDomain[id] ?? 0,
    }),
    [nodeProgress, byBranch, byDomain],
  );
}

export function useAbilityEvaluations(): Record<Id, AbilityEvaluation> {
  const abilities = useAppStore((s) => s.abilities);
  const quests = useAppStore((s) => s.quests);
  const levels = useLevelLookup();

  return useMemo(() => {
    const map: Record<Id, AbilityEvaluation> = {};
    for (const ability of abilities) {
      map[ability.id] = evaluateAbility(ability, levels, quests);
    }
    return map;
  }, [abilities, levels, quests]);
}

/* ------------------------------------------------------------------ */
/* Character attributes                                                */
/* ------------------------------------------------------------------ */

export function useAttributeScores() {
  const domains = useAppStore((s) => s.domains);
  const quests = useAppStore((s) => s.quests);
  const activityLogs = useAppStore((s) => s.activityLogs);
  const nodeProgress = useNodeProgressMap();
  const { byDomain } = useDerivedLevels();
  const domainIdByNodeId = useDomainIdByNodeId();

  return useMemo(() => {
    const ctx: AttributeContext = {
      domains,
      domainLevels: byDomain,
      nodeProgress,
      domainIdByNodeId,
      quests,
      activityLogs,
      now: new Date(),
    };
    const scores = computeAllAttributes(ctx);
    return { scores, overall: overallRating(scores) };
    // `now` intentionally re-reads on every recompute; the inputs below are
    // what actually change the result.
  }, [domains, byDomain, nodeProgress, domainIdByNodeId, quests, activityLogs]);
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export function useAssetTotals() {
  const finances = useAppStore((s) => s.finances);
  const items = useAppStore((s) => s.items);
  return useMemo(() => computeAssetTotals(finances, items), [finances, items]);
}

/* ------------------------------------------------------------------ */
/* Convenience lookups                                                 */
/* ------------------------------------------------------------------ */

export function useNodeName(): (id: Id) => string {
  const nodes = useAppStore((s) => s.nodes);
  return useMemo(() => {
    const map = new Map(nodes.map((n) => [n.id, n.name]));
    return (id: Id) => map.get(id) ?? 'Unknown node';
  }, [nodes]);
}

export function useActiveDomains() {
  const domains = useAppStore((s) => s.domains);
  return useMemo(
    () => domains.filter((d) => !d.archived).sort((a, b) => a.order - b.order),
    [domains],
  );
}

export function useBranchesForDomain(domainId: Id | null) {
  const branches = useAppStore((s) => s.branches);
  return useMemo(
    () =>
      branches
        .filter((b) => !b.archived && b.domainId === domainId)
        .sort((a, b) => a.order - b.order),
    [branches, domainId],
  );
}

export function useNodesForBranch(branchId: Id | null) {
  const nodes = useAppStore((s) => s.nodes);
  return useMemo(
    () =>
      nodes.filter((n) => !n.archived && n.branchId === branchId).sort((a, b) => a.order - b.order),
    [nodes, branchId],
  );
}
