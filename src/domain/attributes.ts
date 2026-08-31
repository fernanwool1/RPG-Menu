import { dayKey, daysBetween } from './ids';
import type {
  ActivityLog,
  AttributeBreakdownInput,
  AttributeKey,
  AttributeScore,
  Id,
  NodeProgress,
  Quest,
  SkillDomain,
} from './types';

/* ------------------------------------------------------------------ */
/* PROVISIONAL FORMULAS                                                */
/*                                                                     */
/* Attributes are entirely derived. They hold no XP of their own and   */
/* cannot be levelled by hand - that is the whole point of the model.  */
/*                                                                     */
/* Every attribute is the same three-part blend, matching the weights  */
/* shown on the Character reference screen:                            */
/*                                                                     */
/*     60%  Skills          how far the relevant domains have come     */
/*     30%  Quest history   relevant quests actually finished          */
/*     10%  Consistency     days active in the last 30                 */
/*                                                                     */
/* These weights are a first pass and are labelled provisional in the  */
/* UI. Change COMPONENT_WEIGHTS or any of the three component          */
/* functions below and every readout, the radar chart and the overall  */
/* rating follow automatically.                                        */
/* ------------------------------------------------------------------ */

export const COMPONENT_WEIGHTS = {
  skills: 0.6,
  quests: 0.3,
  consistency: 0.1,
} as const;

/** Completed relevant quests that count as a full quest-history score. */
const QUEST_SATURATION = 12;

/** Active days inside the 30-day window that count as full consistency. */
const CONSISTENCY_SATURATION = 20;

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  knowledge: 'Knowledge',
  creativity: 'Creativity',
  discipline: 'Discipline',
  endurance: 'Endurance',
  communication: 'Communication',
  adaptability: 'Adaptability',
};

export const ATTRIBUTE_DESCRIPTION: Record<AttributeKey, string> = {
  knowledge: 'Your capacity to understand, connect, and apply learned information.',
  creativity: 'Your capacity to originate and finish original work.',
  discipline: 'Your capacity to plan work, respect deadlines, and keep showing up.',
  endurance: 'Your sustained physical capacity and tolerance for effort.',
  communication: 'Your capacity to express, teach, and coordinate with others.',
  adaptability: 'Your breadth across domains and your recovery after setbacks.',
};

export const ATTRIBUTE_KEYS: AttributeKey[] = [
  'knowledge',
  'creativity',
  'discipline',
  'endurance',
  'communication',
  'adaptability',
];

export interface AttributeContext {
  domains: SkillDomain[];
  /** Derived domain level (0-10), keyed by domain id. */
  domainLevels: Record<Id, number>;
  /** Node progress keyed by node id, used for "newly learned" signals. */
  nodeProgress: Record<Id, NodeProgress>;
  /** Domain id for every node, used to route quest XP to an attribute. */
  domainIdByNodeId: Record<Id, Id>;
  quests: Quest[];
  activityLogs: ActivityLog[];
  now: Date;
}

function tierFor(value: number): string {
  if (value >= 90) return 'Exceptional';
  if (value >= 75) return 'Advanced';
  if (value >= 60) return 'Capable';
  if (value >= 40) return 'Developing';
  if (value >= 20) return 'Emerging';
  return 'Untested';
}

function pct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/* ------------------------------------------------------------------ */
/* Component 1: skills                                                 */
/* ------------------------------------------------------------------ */

/**
 * Weighted mean of domain levels, using each domain's declared attribute
 * weights. A domain at level 10 with weight 1 contributes a full 100.
 */
function skillComponent(
  key: AttributeKey,
  ctx: AttributeContext,
): { score: number; contributors: Array<{ domain: SkillDomain; level: number; weight: number }> } {
  const contributors = ctx.domains
    .filter((d) => !d.archived && (d.attributeWeights[key] ?? 0) > 0)
    .map((domain) => ({
      domain,
      level: ctx.domainLevels[domain.id] ?? 0,
      weight: domain.attributeWeights[key] ?? 0,
    }));

  const weightTotal = contributors.reduce((sum, c) => sum + c.weight, 0);
  if (weightTotal === 0) return { score: 0, contributors };

  const weighted = contributors.reduce((sum, c) => sum + c.level * c.weight, 0);
  return { score: pct((weighted / (weightTotal * 10)) * 100), contributors };
}

/* ------------------------------------------------------------------ */
/* Component 2: quest history                                          */
/* ------------------------------------------------------------------ */

/**
 * Counts completed quests whose skill allocations land in a domain that feeds
 * this attribute. Quests with no allocations count toward Discipline only,
 * since finishing them is evidence of follow-through rather than of a subject.
 */
function questComponent(
  key: AttributeKey,
  ctx: AttributeContext,
): { score: number; count: number } {
  const relevantDomainIds = new Set(
    ctx.domains.filter((d) => (d.attributeWeights[key] ?? 0) > 0).map((d) => d.id),
  );

  const completed = ctx.quests.filter((q) => q.status === 'completed');

  const count = completed.filter((quest) => {
    if (quest.skillAllocations.length === 0) return key === 'discipline';
    return quest.skillAllocations.some((allocation) => {
      const domainId = ctx.domainIdByNodeId[allocation.skillNodeId];
      return domainId ? relevantDomainIds.has(domainId) : false;
    });
  }).length;

  return { score: pct((count / QUEST_SATURATION) * 100), count };
}

/* ------------------------------------------------------------------ */
/* Component 3: consistency                                            */
/* ------------------------------------------------------------------ */

function consistencyComponent(ctx: AttributeContext): { score: number; activeDays: number } {
  const nowIso = ctx.now.toISOString();
  const days = new Set<string>();

  for (const log of ctx.activityLogs) {
    if (log.reversedAt) continue;
    const age = daysBetween(log.occurredAt, nowIso);
    if (age >= 0 && age <= 30) days.add(dayKey(log.occurredAt));
  }

  const activeDays = days.size;
  return { score: pct((activeDays / CONSISTENCY_SATURATION) * 100), activeDays };
}

/* ------------------------------------------------------------------ */
/* Attribute-specific adjustments                                      */
/* ------------------------------------------------------------------ */

/**
 * Discipline additionally rewards deadlines actually respected: quests
 * completed on or before their deadline, net of failures.
 */
function deadlineRespectRate(ctx: AttributeContext): { rate: number; kept: number; missed: number } {
  const withDeadlines = ctx.quests.filter((q) => q.deadline && q.completedAt);
  const kept = withDeadlines.filter(
    (q) => new Date(q.completedAt as string).getTime() <= new Date(q.deadline as string).getTime(),
  ).length;
  const missed = withDeadlines.length - kept;
  const rate = withDeadlines.length === 0 ? 0 : kept / withDeadlines.length;
  return { rate, kept, missed };
}

/**
 * Adaptability rewards breadth (how many domains are genuinely moving), fresh
 * starts (nodes newly opened) and recovery - completing quests after failing
 * others. A failure never subtracts; recovering from one adds.
 */
function adaptabilitySignals(ctx: AttributeContext): {
  breadth: number;
  activeDomains: number;
  freshNodes: number;
  recoveries: number;
} {
  const activeDomains = ctx.domains.filter(
    (d) => !d.archived && (ctx.domainLevels[d.id] ?? 0) > 0,
  ).length;
  const totalDomains = Math.max(1, ctx.domains.filter((d) => !d.archived).length);

  const freshNodes = Object.values(ctx.nodeProgress).filter(
    (p) => p.level >= 1 && p.level <= 2,
  ).length;

  const failed = ctx.quests.filter((q) => q.status === 'failed');
  const recoveries = failed.length === 0
    ? 0
    : ctx.quests.filter((q) => {
        if (q.status !== 'completed' || !q.completedAt) return false;
        return failed.some(
          (f) => f.failedAt && new Date(q.completedAt as string) > new Date(f.failedAt),
        );
      }).length;

  return {
    breadth: pct((activeDomains / totalDomains) * 100),
    activeDomains,
    freshNodes,
    recoveries,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function computeAttribute(key: AttributeKey, ctx: AttributeContext): AttributeScore {
  const skills = skillComponent(key, ctx);
  const quests = questComponent(key, ctx);
  const consistency = consistencyComponent(ctx);

  let skillScore = skills.score;
  let questScore = quests.score;

  const inputs: AttributeBreakdownInput[] = [];

  // Attribute-specific shaping, applied before the blend so the published
  // weights stay honest.
  if (key === 'discipline') {
    const { rate, kept, missed } = deadlineRespectRate(ctx);
    questScore = pct(questScore * 0.6 + rate * 100 * 0.4);
    inputs.push({
      label: 'Deadlines respected',
      detail: `${kept} kept, ${missed} missed`,
      contribution: Math.round(rate * 100 * 0.4 * COMPONENT_WEIGHTS.quests),
    });
  }

  if (key === 'adaptability') {
    const { breadth, activeDomains, freshNodes, recoveries } = adaptabilitySignals(ctx);
    skillScore = pct(skillScore * 0.65 + breadth * 0.35);
    questScore = pct(questScore + Math.min(30, recoveries * 10));
    inputs.push({
      label: 'Domain breadth',
      detail: `${activeDomains} domains in motion`,
      contribution: Math.round(breadth * 0.35 * COMPONENT_WEIGHTS.skills),
    });
    inputs.push({
      label: 'Newly opened nodes',
      detail: `${freshNodes} at level 1-2`,
      contribution: 0,
    });
    if (recoveries > 0) {
      inputs.push({
        label: 'Recovery after failure',
        detail: `${recoveries} quests finished after a setback`,
        contribution: Math.round(Math.min(30, recoveries * 10) * COMPONENT_WEIGHTS.quests),
      });
    }
  }

  const value = Math.round(
    skillScore * COMPONENT_WEIGHTS.skills +
      questScore * COMPONENT_WEIGHTS.quests +
      consistency.score * COMPONENT_WEIGHTS.consistency,
  );

  const topDomains = [...skills.contributors]
    .sort((a, b) => b.level * b.weight - a.level * a.weight)
    .slice(0, 3)
    .map((c) => `${c.domain.name} L${c.level}`)
    .join(', ');

  inputs.unshift(
    {
      label: `Skills (${Math.round(COMPONENT_WEIGHTS.skills * 100)}%)`,
      detail: topDomains || 'No contributing domains yet',
      contribution: Math.round(skillScore * COMPONENT_WEIGHTS.skills),
    },
    {
      label: `Quest history (${Math.round(COMPONENT_WEIGHTS.quests * 100)}%)`,
      detail: `${quests.count} relevant quests completed`,
      contribution: Math.round(questScore * COMPONENT_WEIGHTS.quests),
    },
    {
      label: `Consistency (${Math.round(COMPONENT_WEIGHTS.consistency * 100)}%)`,
      detail: `${consistency.activeDays} active days in the last 30`,
      contribution: Math.round(consistency.score * COMPONENT_WEIGHTS.consistency),
    },
  );

  return {
    key,
    label: ATTRIBUTE_LABEL[key],
    value: pct(value),
    tier: tierFor(value),
    description: ATTRIBUTE_DESCRIPTION[key],
    inputs,
  };
}

export function computeAllAttributes(ctx: AttributeContext): AttributeScore[] {
  return ATTRIBUTE_KEYS.map((key) => computeAttribute(key, ctx));
}

/** Overall rating is the plain mean of the six attributes. */
export function overallRating(scores: AttributeScore[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, s) => sum + s.value, 0) / scores.length);
}
