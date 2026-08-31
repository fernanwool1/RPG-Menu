import { computeActivityXp } from '../activities';
import { splitQuestXp } from '../quests';
import type {
  Ability,
  ActivityLog,
  Campaign,
  DailyQuestDefinition,
  DailyTarget,
  ActivityTemplate,
  CharacterProfile,
  FinancialSnapshot,
  InventoryItem,
  InventoryLocation,
  Quest,
  SkillBranch,
  SkillDomain,
  SkillNode,
  XpTransaction,
  AbilityPath,
} from '../types';
import { buildAbilitySeed } from './abilities';
import { buildCampaignSeed } from './campaigns';
import { buildDailyQuestDefinitions, buildDailyTargets } from './dailyQuests';
import { buildActivityTemplateSeed, templateId } from './activities';
import { buildInventorySeed } from './inventory';
import { buildQuestSeed } from './quests';
import { buildSkillSeed, nodeId } from './skills';

export interface SeedBundle {
  profile: CharacterProfile;
  domains: SkillDomain[];
  branches: SkillBranch[];
  nodes: SkillNode[];
  templates: ActivityTemplate[];
  activityLogs: ActivityLog[];
  quests: Quest[];
  campaigns: Campaign[];
  paths: AbilityPath[];
  abilities: Ability[];
  locations: InventoryLocation[];
  items: InventoryItem[];
  finances: FinancialSnapshot;
  transactions: XpTransaction[];
  dailyDefinitions: DailyQuestDefinition[];
  dailyTargets: DailyTarget;
}

/**
 * Lifetime XP the sample character should open at.
 *
 * 6,120 XP puts the character at Level 12 (Scholar) with 620 / 1,000 toward
 * Level 13, matching the LEVEL 12 in the reference header. The baseline
 * transaction is sized so that this total holds no matter how much XP the
 * other seeded records happen to contribute.
 */
const TARGET_LIFETIME_XP = 6120;

/* ------------------------------------------------------------------ */
/* Sample activity history                                             */
/*                                                                     */
/* Spread across the last three weeks so the Consistency component of  */
/* the character attributes has something real to read, and so the     */
/* activity feed is not empty on first run.                            */
/* ------------------------------------------------------------------ */

const ACTIVITY_HISTORY: Array<[template: string, node: string, amount: number, daysAgo: number]> = [
  ['instrument-practice', 'guitar', 45, 0],
  ['focused-coding', 'app-development', 90, 0],
  ['reading', 'english-reading', 22, 1],
  ['instrument-practice', 'guitar', 30, 1],
  ['cycling', 'cycling', 40, 2],
  ['calories-burned', 'cycling', 380, 2],
  ['focused-coding', 'nextjs', 120, 2],
  ['technical-reading', 'operating-systems', 18, 3],
  ['instrument-practice', 'piano', 25, 3],
  ['ear-training', 'interval-recognition', 15, 4],
  ['language-practice', 'mandarin-speaking', 20, 4],
  ['finished-drawing', 'sketching', 1, 5],
  ['focused-coding', 'react', 75, 5],
  ['business-reading', 'market-analysis', 30, 6],
  ['cycling', 'cycling', 55, 7],
  ['instrument-practice', 'guitar', 60, 7],
  ['coding-exercise', 'data-structures', 3, 8],
  ['service-time', 'tutoring', 90, 9],
  ['finished-poem', 'poetry', 1, 10],
  ['reading', 'spanish-reading', 34, 11],
  ['detailed-interface-design', 'ui-design', 1, 12],
  ['instrument-practice', 'guitar', 40, 13],
  ['calories-burned', 'running', 420, 14],
  ['technical-reading', 'databases', 26, 16],
  ['selected-photograph', 'photo-composition', 4, 18],
  ['language-practice', 'english-speaking', 45, 20],
];

function daysAgoIso(base: Date, days: number, hour = 19): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/* Bundles                                                             */
/* ------------------------------------------------------------------ */

function baseProfile(at: string, sample: boolean): CharacterProfile {
  return {
    id: 'chr_primary',
    displayName: sample ? 'Sample Character' : 'New Character',
    semesterLabel: 'Semester I',
    bestStreak: sample ? 9 : 0,
    currentStreak: sample ? 3 : 0,
    lastActivityDate: sample ? at : null,
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * "Start empty" - the full structure with none of the history.
 *
 * The skill hierarchy, activity rules, ability catalogue and inventory
 * locations are scaffolding rather than content, so they are kept; every
 * skill node starts at zero XP and the ledger starts genuinely empty.
 */
export function buildEmptyBundle(at: string): SeedBundle {
  const skills = buildSkillSeed(at);
  const abilities = buildAbilitySeed(at);
  const inventory = buildInventorySeed(at);

  return {
    profile: baseProfile(at, false),
    domains: skills.domains,
    branches: skills.branches,
    nodes: skills.nodes.map((n) => ({ ...n, seedXp: 0, focus: false, evidence: [] })),
    templates: buildActivityTemplateSeed(at),
    activityLogs: [],
    quests: [],
    // The NSOP campaign is a real, dated commitment rather than sample data,
    // so it is present in an empty start too. Its ids are stable, so seeding
    // it again over an existing save adds nothing.
    campaigns: buildCampaignSeed(at),
    paths: abilities.paths,
    abilities: abilities.abilities.map((a) => ({ ...a, evidence: [] })),
    locations: inventory.locations,
    items: [],
    finances: { cash: 0, bank: 0, currency: 'USD', updatedAt: at },
    transactions: [],
    // The Daily Quest catalogue is scaffolding, like the skill hierarchy: an
    // empty start keeps the rules and drops only the history.
    dailyDefinitions: buildDailyQuestDefinitions(at),
    dailyTargets: buildDailyTargets(),
  };
}

/** "Start with sample data" - the state shown across the reference screens. */
export function buildSampleBundle(at: string): SeedBundle {
  const base = new Date(at);
  const skills = buildSkillSeed(at);
  const abilitySeed = buildAbilitySeed(at);
  const inventory = buildInventorySeed(at);
  const templates = buildActivityTemplateSeed(at);
  const quests = buildQuestSeed(at);

  const transactions: XpTransaction[] = [];
  const activityLogs: ActivityLog[] = [];

  /* --- Completed quests actually paid out ------------------------- */
  for (const quest of quests) {
    if (quest.status !== 'completed' || !quest.xpAwardedAt) continue;
    const split = splitQuestXp(quest);

    for (const allocation of split.allocations) {
      transactions.push({
        id: `xtx_q_${quest.id}_${allocation.skillNodeId}`,
        createdAt: quest.xpAwardedAt,
        sourceType: 'quest',
        sourceId: quest.id,
        skillNodeId: allocation.skillNodeId,
        amount: allocation.xp,
        note: quest.title,
      });
    }

    if (split.unallocated > 0) {
      transactions.push({
        id: `xtx_q_${quest.id}_general`,
        createdAt: quest.xpAwardedAt,
        sourceType: 'quest',
        sourceId: quest.id,
        skillNodeId: null,
        amount: split.unallocated,
        note: `${quest.title} (unallocated)`,
      });
    }
  }

  /* --- Logged activities ------------------------------------------ */
  ACTIVITY_HISTORY.forEach(([templateSlug, nodeSlug, amount, daysAgo], index) => {
    const template = templates.find((t) => t.id === templateId(templateSlug));
    if (!template) return;

    const occurredAt = daysAgoIso(base, daysAgo);
    const xp = computeActivityXp(
      template.formula,
      amount,
      template.formula.kind === 'range' ? template.formula.minXp + 3 : undefined,
    );
    const logId = `alg_seed_${index}`;

    activityLogs.push({
      id: logId,
      templateId: template.id,
      skillNodeId: nodeId(nodeSlug),
      amount,
      xpAwarded: xp,
      occurredAt,
      reversedAt: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });

    transactions.push({
      id: `xtx_a_${logId}`,
      createdAt: occurredAt,
      sourceType: 'activity',
      sourceId: logId,
      skillNodeId: nodeId(nodeSlug),
      amount: xp,
      note: template.name,
    });
  });

  /* --- Baseline ---------------------------------------------------- */
  /*
   * Progress that predates the ledger. Sized so lifetime XP lands exactly on
   * TARGET_LIFETIME_XP once everything else above is counted, which keeps the
   * sample character at the reference level however the sample history is
   * retuned. Skill nodes carry the same idea in their seedXp field.
   */
  const earned = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const baseline = Math.max(0, TARGET_LIFETIME_XP - earned);

  transactions.unshift({
    id: 'xtx_baseline',
    createdAt: at,
    sourceType: 'seed',
    sourceId: null,
    skillNodeId: null,
    amount: baseline,
    note: 'Progress carried in before the ledger began',
  });

  transactions.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return {
    profile: baseProfile(at, true),
    domains: skills.domains,
    branches: skills.branches,
    nodes: skills.nodes,
    templates,
    activityLogs,
    quests,
    campaigns: buildCampaignSeed(at),
    paths: abilitySeed.paths,
    abilities: abilitySeed.abilities,
    locations: inventory.locations,
    items: inventory.items,
    finances: inventory.finances,
    transactions,
    dailyDefinitions: buildDailyQuestDefinitions(at),
    dailyTargets: buildDailyTargets(),
  };
}

export {
  buildAbilitySeed,
  buildActivityTemplateSeed,
  buildCampaignSeed,
  buildDailyQuestDefinitions,
  buildDailyTargets,
  buildInventorySeed,
  buildQuestSeed,
  buildSkillSeed,
};
