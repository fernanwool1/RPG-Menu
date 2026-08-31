/**
 * Domain models.
 *
 * These types are deliberately free of React, Zustand and storage concerns so
 * that the same models can back a localStorage store today and a Firebase /
 * Postgres collection later. See README "Architecture".
 */

export type Id = string;
export type IsoDate = string; // ISO-8601, always UTC

/** Every persisted record carries stable identity + timestamps. */
export interface BaseRecord {
  id: Id;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/* ------------------------------------------------------------------ */
/* Character                                                           */
/* ------------------------------------------------------------------ */

export type RankName =
  | 'Initiate'
  | 'Apprentice'
  | 'Scholar'
  | 'Adept'
  | 'Vanguard'
  | 'Master'
  | 'Grandmaster'
  | 'Legend';

export type AttributeKey =
  | 'knowledge'
  | 'creativity'
  | 'discipline'
  | 'endurance'
  | 'communication'
  | 'adaptability';

export interface CharacterProfile extends BaseRecord {
  displayName: string;
  semesterLabel: string;
  /** Longest run of consecutive days with at least one logged activity. */
  bestStreak: number;
  currentStreak: number;
  lastActivityDate: IsoDate | null;
}

/* ------------------------------------------------------------------ */
/* XP ledger                                                           */
/* ------------------------------------------------------------------ */

export type XpSourceType =
  | 'quest'
  | 'activity'
  | 'manual'
  | 'reversal'
  | 'seed'
  /** A Daily Check tracker entry: pages, calories or instrument minutes. */
  | 'daily-check'
  /** A rotating Daily Quest completion. */
  | 'daily-quest'
  /** The delta written when a Daily Check entry is corrected. */
  | 'correction'
  /** A single mission inside a Main Quest campaign. */
  | 'campaign-mission';

/**
 * The single source of truth for all progression.
 *
 * Character XP  = sum(amount) over all transactions.
 * Skill node XP = sum(amount) over transactions with that skillNodeId.
 *
 * A transaction is therefore counted exactly once for the character and once
 * for its node - XP is never multiplied as it rolls upward. Branch and domain
 * levels are derived from node levels and award nothing extra.
 *
 * Records are append-only. To undo, append a compensating transaction with a
 * negative amount and reversesTxId set; never edit or delete history.
 */
export interface XpTransaction {
  id: Id;
  createdAt: IsoDate;
  sourceType: XpSourceType;
  sourceId: Id | null;
  skillNodeId: Id | null;
  amount: number;
  note?: string;
  reversesTxId?: Id;
}

/* ------------------------------------------------------------------ */
/* Skills: Domain -> Branch -> Node                                    */
/* ------------------------------------------------------------------ */

export type SkillNodeStatus =
  | 'undiscovered'
  | 'unlocked'
  | 'learning'
  | 'proficient'
  | 'advanced'
  | 'mastered';

export interface SkillDomain extends BaseRecord {
  name: string;
  icon: string;
  order: number;
  archived: boolean;
  /** Attribute weights used by the derived character attributes. */
  attributeWeights: Partial<Record<AttributeKey, number>>;
}

export interface SkillBranch extends BaseRecord {
  domainId: Id;
  name: string;
  icon: string;
  order: number;
  archived: boolean;
}

export interface SkillNode extends BaseRecord {
  branchId: Id;
  name: string;
  icon: string;
  order: number;
  archived: boolean;
  /** Ids of nodes this node hangs from, used to draw the tree. */
  parentIds: Id[];
  /** Author-declared starting XP; runtime XP comes from the ledger. */
  seedXp: number;
  /** Marks the node the user is actively pushing on. Purely presentational. */
  focus: boolean;
  evidence: string[];
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Activities                                                          */
/* ------------------------------------------------------------------ */

export type ActivityUnit = 'page' | 'minute' | 'calorie' | 'piece' | 'session';

/**
 * How an activity template turns a user-entered amount into XP.
 *
 * - rate  : xp = floor(amount / unitsPerXp) * xpPerBlock
 *           "1 XP per 10 complete calories" -> unitsPerXp 10, xpPerBlock 1
 * - fixed : xp = fixedXp * count. Output-only work (Creative Arts).
 * - range : the user picks any integer in [minXp, maxXp], times count.
 */
export type ActivityFormula =
  | { kind: 'rate'; unitsPerXp: number; xpPerBlock: number }
  | { kind: 'fixed'; fixedXp: number }
  | { kind: 'range'; minXp: number; maxXp: number };

export interface ActivityTemplate extends BaseRecord {
  name: string;
  description: string;
  unit: ActivityUnit;
  formula: ActivityFormula;
  /** Node the XP defaults to. Null means the user must choose one. */
  defaultNodeId: Id | null;
  /** Restrict the node picker to this domain. Null means any node. */
  restrictToDomainId: Id | null;
  /**
   * Output-only work earns XP only once finished; an unfinished piece is
   * worth nothing. Surfaces a required "finished" confirmation in the form.
   */
  requiresFinished: boolean;
  archived: boolean;
  builtIn: boolean;
}

export interface ActivityLog extends BaseRecord {
  templateId: Id;
  skillNodeId: Id;
  /** Raw user input: pages, minutes, calories, pieces. */
  amount: number;
  xpAwarded: number;
  occurredAt: IsoDate;
  note?: string;
  /** Set when a compensating transaction has retired this log. */
  reversedAt: IsoDate | null;
}

/* ------------------------------------------------------------------ */
/* Quests                                                              */
/* ------------------------------------------------------------------ */

export type QuestType =
  | 'side'
  | 'standard'
  | 'main'
  | 'boss'
  | 'legendary'
  | 'daily'
  | 'weekly';

export type QuestStatus = 'planned' | 'active' | 'completed' | 'failed' | 'archived';

export type QuestDifficulty = 'trivial' | 'easy' | 'moderate' | 'hard' | 'severe';
export type QuestPriority = 'low' | 'normal' | 'high' | 'critical';
export type QuestRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface QuestObjective {
  id: Id;
  label: string;
  done: boolean;
  order: number;
}

export type QuestRewardKind = 'inventory-item' | 'note' | 'unlock-hint';

export interface QuestReward {
  id: Id;
  kind: QuestRewardKind;
  label: string;
  /** For inventory-item: fields used to mint the item on completion. */
  itemCategory?: string;
  itemLocationId?: Id;
  itemEstimatedValue?: number;
}

/** XP routed to a specific skill node when the quest completes. */
export interface QuestSkillAllocation {
  skillNodeId: Id;
  xp: number;
}

export interface QuestAttachment {
  id: Id;
  label: string;
  url: string;
}

export interface Quest extends BaseRecord {
  title: string;
  description: string;
  type: QuestType;
  category: string;
  status: QuestStatus;
  objectives: QuestObjective[];
  skillAllocations: QuestSkillAllocation[];
  deadline: IsoDate | null;
  difficulty: QuestDifficulty;
  priority: QuestPriority;
  recurrence: QuestRecurrence;
  /** Character XP granted on completion. Allocations are carved out of this. */
  characterXp: number;
  rewards: QuestReward[];
  notes?: string;
  attachments: QuestAttachment[];
  completedAt: IsoDate | null;
  failedAt: IsoDate | null;
  /**
   * Set the moment XP is granted. Guarantees a quest can never pay out twice,
   * even if it is re-opened and completed again.
   */
  xpAwardedAt: IsoDate | null;
  /** Set when the quest was minted by "Start proof quest". */
  abilityId: Id | null;
}

/* ------------------------------------------------------------------ */
/* Abilities                                                           */
/* ------------------------------------------------------------------ */

export type AbilityStatus =
  | 'locked'
  | 'developing'
  | 'eligible'
  | 'unlocked'
  | 'advanced'
  | 'mastered';

export type AbilityRequirementTarget = 'node' | 'branch' | 'domain';

export interface AbilityRequirement {
  id: Id;
  target: AbilityRequirementTarget;
  targetId: Id;
  /** Cached for display when the target has been archived. */
  label: string;
  minLevel: number;
}

export type AbilityEvidenceKind = 'inventory-item' | 'url' | 'file' | 'quest' | 'note';

export interface AbilityEvidence {
  id: Id;
  kind: AbilityEvidenceKind;
  label: string;
  /** For url / file: the link or filename. Never file contents. */
  reference?: string;
  refId?: Id;
  createdAt: IsoDate;
}

export interface AbilityPath extends BaseRecord {
  name: string;
  icon: string;
  order: number;
}

export interface Ability extends BaseRecord {
  pathId: Id;
  name: string;
  description: string;
  icon: string;
  order: number;
  requirements: AbilityRequirement[];
  proofDescription: string;
  /** Minimum pieces of evidence that satisfy proof without a proof quest. */
  proofMinEvidence: number;
  proofQuestId: Id | null;
  evidence: AbilityEvidence[];
  /**
   * Only ever advanced | mastered. Manual promotion after repeated evidence;
   * everything below that is derived, never stored.
   */
  manualPromotion: 'advanced' | 'mastered' | null;
  archived: boolean;
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export type ItemCondition = 'new' | 'good' | 'worn' | 'damaged' | 'unknown';

export interface InventoryLocation extends BaseRecord {
  name: string;
  icon: string;
  order: number;
  /** Virtual locations (All Assets) aggregate rather than hold. */
  virtual: boolean;
}

export interface InventoryItem extends BaseRecord {
  name: string;
  category: string;
  locationId: Id;
  carried: boolean;
  condition: ItemCondition;
  estimatedValue: number;
  purchaseDate: IsoDate | null;
  lastCheckedAt: IsoDate | null;
  notes?: string;
  /** Relative path or data URL. Generic local placeholder by default. */
  image: string | null;
  /**
   * Serials, policy numbers and similar. Never rendered unless the user
   * explicitly reveals them.
   */
  sensitiveIdentifier?: string;
  archived: boolean;
}

export interface FinancialSnapshot {
  cash: number;
  bank: number;
  currency: string;
  updatedAt: IsoDate;
}

/* ------------------------------------------------------------------ */
/* Derived view models (never persisted)                               */
/* ------------------------------------------------------------------ */

export interface LevelProgress {
  level: number;
  rank: RankName;
  lifetimeXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0..1 */
  fraction: number;
  atCap: boolean;
}

export interface NodeProgress {
  nodeId: Id;
  level: number;
  status: SkillNodeStatus;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  fraction: number;
  atCap: boolean;
}

export interface AttributeBreakdownInput {
  label: string;
  detail: string;
  /** Points this input contributed to the final 0-100 score. */
  contribution: number;
}

export interface AttributeScore {
  key: AttributeKey;
  label: string;
  value: number;
  tier: string;
  description: string;
  inputs: AttributeBreakdownInput[];
}

/* ------------------------------------------------------------------ */
/* Daily Quests                                                        */
/*                                                                     */
/* Definitions and instances are stored separately and deliberately:   */
/* a DailyQuestDefinition is the reusable rule ("Plan the Day", worth  */
/* 10 XP, Organization, pinned), while a DailyQuestInstance is that    */
/* quest on one particular date, with its own status and payout guard. */
/* Editing a definition therefore never rewrites yesterday's history.  */
/* ------------------------------------------------------------------ */

export type DailyQuestCategory =
  | 'academic'
  | 'technical'
  | 'business'
  | 'music'
  | 'physical'
  | 'personal-care'
  | 'organization'
  | 'financial'
  | 'social';

/** 0 = Sunday, matching Date.prototype.getDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DailyQuestStatus = 'not-started' | 'in-progress' | 'completed' | 'expired';

/** A local calendar day, YYYY-MM-DD. Daily state is keyed by this. */
export type DayKey = string;

export interface DailyQuestDefinition extends BaseRecord {
  name: string;
  description: string;
  category: DailyQuestCategory;
  icon: string;
  /** Character XP on completion. Seeded at 10, editable. */
  characterXp: number;
  /** Inactive quests are excluded from rotation entirely. */
  active: boolean;
  /** Pinned quests are placed before any random pick. At most three. */
  pinned: boolean;
  /** Empty means every day; otherwise only these weekdays are eligible. */
  weekdays: Weekday[];
  /**
   * Optional link to a skill node. It awards NO skill XP unless
   * awardsSkillXp is explicitly turned on - that is what stops a quest like
   * "Complete the Planned Workout" from converting the same calories the
   * Daily Check already converted.
   */
  linkedSkillNodeId: Id | null;
  awardsSkillXp: boolean;
  skillXp: number;
  order: number;
}

export interface DailyQuestInstance {
  id: Id;
  definitionId: Id;
  date: DayKey;
  /** Slot 1 is always the Daily Check, so rotating quests occupy 2-4. */
  slot: 2 | 3 | 4;
  status: DailyQuestStatus;
  completedAt: IsoDate | null;
  expiredAt: IsoDate | null;
  /** Set the moment XP is paid. Guarantees a single payout, ever. */
  xpAwardedAt: IsoDate | null;
  createdAt: IsoDate;
}

/**
 * The saved roll for one day.
 *
 * Persisting this is what stops a page refresh from rerolling the day.
 */
export interface DailyQuestSelection {
  date: DayKey;
  /** Instance ids for slots 2-4, in slot order. */
  instanceIds: Id[];
  rolledAt: IsoDate;
  /** True once the user has manually replaced at least one slot. */
  manuallyAdjusted: boolean;
}

export type DailyCheckActivity = 'reading' | 'calories' | 'instrument';

/**
 * One submission against a Daily Check tracker.
 *
 * Entries are immutable. Correcting one appends a new entry carrying the
 * revised amount and pointing back at the original, and the ledger receives a
 * delta rather than an edit - XP history is never silently rewritten.
 */
export interface DailyCheckEntry {
  id: Id;
  dailyCheckId: Id;
  activity: DailyCheckActivity;
  /** Pages, calories or minutes. Whole numbers only. */
  amount: number;
  xpAwarded: number;
  skillNodeId: Id;
  /** Display name of the instrument at the time, for the log. */
  instrumentName?: string;
  occurredAt: IsoDate;
  /** Set on a correction, pointing at the entry it supersedes. */
  correctsEntryId?: Id;
  /** Set on the superseded entry, pointing at its replacement. */
  correctedByEntryId?: Id;
  note?: string;
}

export interface DailyCheck {
  id: Id;
  date: DayKey;
  status: DailyQuestStatus;
  entries: DailyCheckEntry[];
  completedAt: IsoDate | null;
  expiredAt: IsoDate | null;
  createdAt: IsoDate;
}

/** Configurable daily goals, plus the node choices to remember between days. */
export interface DailyTarget {
  readingPages: number;
  calories: number;
  instrumentMinutes: number;
  defaultReadingNodeId: Id | null;
  defaultCaloriesNodeId: Id | null;
  defaultInstrumentNodeId: Id | null;
}

/** One closed-out day, written when the day rolls over. */
export interface DailyQuestHistory {
  date: DayKey;
  completed: number;
  total: number;
  dailyCheckCompleted: boolean;
  completedDefinitionIds: Id[];
  expiredDefinitionIds: Id[];
  xpEarned: number;
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/*                                                                     */
/* A campaign is a Main Quest made of ordered missions grouped into    */
/* chapters. It is deliberately NOT a Quest: quests complete in one    */
/* step and pay one XP total, while a campaign pays per mission and    */
/* gates each mission on the one before it. Keeping the two apart      */
/* leaves quest XP, objectives and completion rules exactly as they    */
/* were.                                                               */
/* ------------------------------------------------------------------ */

export type MissionStatus =
  /** Gated behind an earlier mission. No actions are offered. */
  | 'locked'
  /** Unlocked and ready to begin. */
  | 'available'
  /** The user has started it but not finished it. */
  | 'in-progress'
  /** Finished, and its XP is in the ledger. Terminal unless retried. */
  | 'completed'
  /** Missed. Awards nothing, removes nothing, and can be retried. */
  | 'failed';

export type CampaignStatus = 'active' | 'completed';

export interface CampaignMission {
  id: Id;
  /** 1-based position across the WHOLE campaign, not within its chapter. */
  order: number;
  title: string;
  description: string;
  /** Local calendar day the session is scheduled for (YYYY-MM-DD). */
  date: DayKey;
  /** Wall-clock strings as printed on the schedule, e.g. "6:30 AM". */
  startTime: string;
  endTime: string;
  location: string;
  /**
   * The schedule listed a room that still has to be confirmed with a Crew
   * Captain. Surfaced as a warning rather than silently trusted.
   */
  locationUnconfirmed?: boolean;
  /** Character XP paid once, on completion. */
  xp: number;
  status: MissionStatus;
  startedAt: IsoDate | null;
  completedAt: IsoDate | null;
  failedAt: IsoDate | null;
  /** Set the moment XP is paid, so a retry can never pay twice. */
  xpAwardedAt: IsoDate | null;
  /** The user's own notes. Never cleared by completing or retrying. */
  notes: string;
}

export interface CampaignChapter {
  id: Id;
  order: number;
  title: string;
  description: string;
  missions: CampaignMission[];
}

export interface Campaign extends BaseRecord {
  title: string;
  description: string;
  /** Always 'main' today; kept explicit so the card can label itself. */
  type: QuestType;
  category: string;
  status: CampaignStatus;
  /** First and last scheduled day, as calendar keys. */
  startDate: DayKey;
  endDate: DayKey;
  chapters: CampaignChapter[];
  completedAt: IsoDate | null;
}
