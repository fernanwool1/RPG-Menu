import type {
  Ability,
  AbilityRequirement,
  AbilityStatus,
  Id,
  Quest,
} from './types';

export const ABILITY_STATUS_LABEL: Record<AbilityStatus, string> = {
  locked: 'Locked',
  developing: 'Developing',
  eligible: 'Eligible',
  unlocked: 'Unlocked',
  advanced: 'Advanced',
  mastered: 'Mastered',
};

/** Levels the ability engine needs, resolved by the caller from the store. */
export interface LevelLookup {
  node: (id: Id) => number;
  branch: (id: Id) => number;
  domain: (id: Id) => number;
}

export interface RequirementEvaluation {
  requirement: AbilityRequirement;
  currentLevel: number;
  met: boolean;
}

export interface AbilityEvaluation {
  status: AbilityStatus;
  requirements: RequirementEvaluation[];
  metCount: number;
  totalCount: number;
  proofSatisfied: boolean;
  /** True once the ability counts toward a path's unlocked tally. */
  countsAsUnlocked: boolean;
}

export function evaluateRequirement(
  requirement: AbilityRequirement,
  levels: LevelLookup,
): RequirementEvaluation {
  const currentLevel =
    requirement.target === 'node'
      ? levels.node(requirement.targetId)
      : requirement.target === 'branch'
        ? levels.branch(requirement.targetId)
        : levels.domain(requirement.targetId);

  return {
    requirement,
    currentLevel,
    met: currentLevel >= requirement.minLevel,
  };
}

/**
 * Proof is satisfied by either route:
 *   - a linked proof quest that has been completed, or
 *   - at least `proofMinEvidence` attached pieces of evidence.
 */
export function isProofSatisfied(ability: Ability, quests: Quest[]): boolean {
  if (ability.proofQuestId) {
    const quest = quests.find((q) => q.id === ability.proofQuestId);
    if (quest && quest.status === 'completed') return true;
  }
  const needed = Math.max(1, ability.proofMinEvidence);
  return ability.evidence.length >= needed;
}

/**
 * Ability status.
 *
 *   locked      no skill requirement met yet
 *   developing  some requirements met
 *   eligible    every skill requirement met, proof outstanding
 *   unlocked    requirements + proof both satisfied
 *   advanced /
 *   mastered    manual promotion, only once genuinely unlocked
 *
 * Abilities never hold XP or a numeric level - this is the whole model.
 */
export function evaluateAbility(
  ability: Ability,
  levels: LevelLookup,
  quests: Quest[],
): AbilityEvaluation {
  const requirements = ability.requirements.map((r) => evaluateRequirement(r, levels));
  const totalCount = requirements.length;
  const metCount = requirements.filter((r) => r.met).length;
  const allMet = totalCount > 0 ? metCount === totalCount : true;
  const proofSatisfied = isProofSatisfied(ability, quests);

  let status: AbilityStatus;
  if (!allMet) {
    status = metCount === 0 ? 'locked' : 'developing';
  } else if (!proofSatisfied) {
    status = 'eligible';
  } else {
    status = 'unlocked';
  }

  // A manual promotion only stands while the ability is genuinely unlocked.
  if (status === 'unlocked' && ability.manualPromotion) {
    status = ability.manualPromotion;
  }

  return {
    status,
    requirements,
    metCount,
    totalCount,
    proofSatisfied,
    countsAsUnlocked:
      status === 'unlocked' || status === 'advanced' || status === 'mastered',
  };
}

/** Path tally counts only truly unlocked abilities, per the spec. */
export function countUnlocked(evaluations: AbilityEvaluation[]): number {
  return evaluations.filter((e) => e.countsAsUnlocked).length;
}

export function canPromote(evaluation: AbilityEvaluation): boolean {
  return evaluation.countsAsUnlocked;
}

export const ABILITY_STATUS_ORDER: AbilityStatus[] = [
  'mastered',
  'advanced',
  'unlocked',
  'eligible',
  'developing',
  'locked',
];
