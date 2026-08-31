import { z } from 'zod';

const str = z.string();
const id = str.min(1);
const num = z.number().finite();
const nonneg = num.nonnegative();
const bool = z.boolean();
const date = str.refine((s) => Number.isFinite(Date.parse(s)), 'Invalid date');
const day = str.regex(/^\d{4}-\d{2}-\d{2}$/);
const base = { id, createdAt: date, updatedAt: date };
const named = { ...base, name: str, icon: str, order: num };
const dailyStatus = z.enum(['not-started', 'in-progress', 'completed', 'expired']);
const questType = z.enum(['side', 'standard', 'main', 'boss', 'legendary', 'daily', 'weekly']);
const mission = z.object({ id, order: num, title: str, description: str, date: day, startTime: str,
  endTime: str, location: str, locationUnconfirmed: bool.optional(), xp: nonneg,
  status: z.enum(['locked', 'available', 'in-progress', 'completed', 'failed']),
  startedAt: date.nullable(), completedAt: date.nullable(), failedAt: date.nullable(),
  xpAwardedAt: date.nullable(), notes: str });
const entry = z.object({ id, dailyCheckId: id, activity: z.enum(['reading', 'calories', 'instrument']),
  amount: nonneg, xpAwarded: nonneg, skillNodeId: id, instrumentName: str.optional(), occurredAt: date,
  correctsEntryId: id.optional(), correctedByEntryId: id.optional(), note: str.optional() });

/** Full runtime validation at both import and network boundaries; unknown keys are stripped. */
export const appDataSchema = z.object({
  profile: z.object({ ...base, displayName: str, semesterLabel: str, bestStreak: nonneg,
    currentStreak: nonneg, lastActivityDate: date.nullable() }),
  domains: z.array(z.object({ ...named, archived: bool, attributeWeights: z.object({
    knowledge: num.optional(), creativity: num.optional(), discipline: num.optional(),
    endurance: num.optional(), communication: num.optional(), adaptability: num.optional(),
  }) })),
  branches: z.array(z.object({ ...named, archived: bool, domainId: id })),
  nodes: z.array(z.object({ ...named, archived: bool, branchId: id, parentIds: z.array(id),
    seedXp: nonneg, focus: bool, evidence: z.array(str), notes: str.optional() })),
  templates: z.array(z.object({ ...base, name: str, description: str,
    unit: z.enum(['page', 'minute', 'calorie', 'piece', 'session']),
    formula: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('rate'), unitsPerXp: num.positive(), xpPerBlock: nonneg }),
      z.object({ kind: z.literal('fixed'), fixedXp: nonneg }),
      z.object({ kind: z.literal('range'), minXp: nonneg, maxXp: nonneg }),
    ]), defaultNodeId: id.nullable(), restrictToDomainId: id.nullable(), requiresFinished: bool,
    archived: bool, builtIn: bool })),
  activityLogs: z.array(z.object({ ...base, templateId: id, skillNodeId: id, amount: nonneg,
    xpAwarded: nonneg, occurredAt: date, note: str.optional(), reversedAt: date.nullable() })),
  quests: z.array(z.object({ ...base, title: str, description: str,
    type: questType, category: str,
    status: z.enum(['planned', 'active', 'completed', 'failed', 'archived']),
    objectives: z.array(z.object({ id, label: str, done: bool, order: num })),
    skillAllocations: z.array(z.object({ skillNodeId: id, xp: nonneg })), deadline: date.nullable(),
    difficulty: z.enum(['trivial', 'easy', 'moderate', 'hard', 'severe']),
    priority: z.enum(['low', 'normal', 'high', 'critical']), recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']),
    characterXp: nonneg, rewards: z.array(z.object({ id, kind: z.enum(['inventory-item', 'note', 'unlock-hint']),
      label: str, itemCategory: str.optional(), itemLocationId: id.optional(), itemEstimatedValue: nonneg.optional() })),
    notes: str.optional(), attachments: z.array(z.object({ id, label: str, url: str })),
    completedAt: date.nullable(), failedAt: date.nullable(), xpAwardedAt: date.nullable(), abilityId: id.nullable() })),
  campaigns: z.array(z.object({ ...base, title: str, description: str, type: questType, category: str,
    status: z.enum(['active', 'completed']), startDate: day, endDate: day,
    chapters: z.array(z.object({ id, order: num, title: str, description: str,
      missions: z.array(mission) })), completedAt: date.nullable() })).default([]),
  paths: z.array(z.object(named)),
  abilities: z.array(z.object({ ...named, pathId: id, description: str,
    requirements: z.array(z.object({ id, target: z.enum(['node', 'branch', 'domain']), targetId: id,
      label: str, minLevel: nonneg })), proofDescription: str, proofMinEvidence: nonneg, proofQuestId: id.nullable(),
    evidence: z.array(z.object({ id, kind: z.enum(['inventory-item', 'url', 'file', 'quest', 'note']),
      label: str, reference: str.optional(), refId: id.optional(), createdAt: date })),
    manualPromotion: z.enum(['advanced', 'mastered']).nullable(), archived: bool })),
  locations: z.array(z.object({ ...named, virtual: bool })),
  items: z.array(z.object({ ...base, name: str, category: str, locationId: id, carried: bool,
    condition: z.enum(['new', 'good', 'worn', 'damaged', 'unknown']), estimatedValue: nonneg,
    purchaseDate: date.nullable(), lastCheckedAt: date.nullable(), notes: str.optional(),
    image: str.nullable(), sensitiveIdentifier: str.optional(), archived: bool })),
  finances: z.object({ cash: num, bank: num, currency: str.length(3), updatedAt: date }),
  transactions: z.array(z.object({ id, createdAt: date,
    sourceType: z.enum(['quest', 'activity', 'manual', 'reversal', 'seed', 'daily-check', 'daily-quest', 'correction', 'campaign-mission']),
    sourceId: id.nullable(), skillNodeId: id.nullable(), amount: num, note: str.optional(), reversesTxId: id.optional() })),
  dailyDefinitions: z.array(z.object({ ...named, description: str,
    category: z.enum(['academic', 'technical', 'business', 'music', 'physical', 'personal-care', 'organization', 'financial', 'social']),
    characterXp: nonneg, active: bool, pinned: bool, weekdays: z.array(z.union([
      z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])),
    linkedSkillNodeId: id.nullable(), awardsSkillXp: bool, skillXp: nonneg })),
  dailyInstances: z.array(z.object({ id, definitionId: id, date: day,
    slot: z.union([z.literal(2), z.literal(3), z.literal(4)]), status: dailyStatus,
    completedAt: date.nullable(), expiredAt: date.nullable(), xpAwardedAt: date.nullable(), createdAt: date })),
  dailySelections: z.array(z.object({ date: day, instanceIds: z.array(id), rolledAt: date, manuallyAdjusted: bool })),
  dailyChecks: z.array(z.object({ id, date: day, status: dailyStatus, entries: z.array(entry),
    completedAt: date.nullable(), expiredAt: date.nullable(), createdAt: date })),
  dailyTargets: z.object({ readingPages: nonneg, calories: nonneg, instrumentMinutes: nonneg,
    defaultReadingNodeId: id.nullable(), defaultCaloriesNodeId: id.nullable(), defaultInstrumentNodeId: id.nullable() }),
  dailyHistory: z.array(z.object({ date: day, completed: nonneg, total: nonneg, dailyCheckCompleted: bool,
    completedDefinitionIds: z.array(id), expiredDefinitionIds: z.array(id), xpEarned: num })),
  dailyActiveDate: day.nullable(),
}).superRefine((data, ctx) => {
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue;
    const seen = new Set<string>();
    for (const record of value) {
      const identity = 'id' in record ? record.id : 'date' in record ? record.date : undefined;
      if (identity && seen.has(identity)) ctx.addIssue({ code: 'custom', path: [key], message: 'Duplicate identity' });
      if (identity) seen.add(identity);
    }
  }
});

export const snapshotSchema = z.object({ schemaVersion: z.literal(3), initialized: bool, data: appDataSchema });
export type CloudSnapshot = z.infer<typeof snapshotSchema>;
