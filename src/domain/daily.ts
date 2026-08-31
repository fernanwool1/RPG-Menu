import type {
  DailyCheck,
  DailyCheckActivity,
  DailyCheckEntry,
  DailyQuestCategory,
  DailyQuestDefinition,
  DailyQuestHistory,
  DailyQuestStatus,
  DayKey,
  Id,
  Weekday,
} from './types';

/* ------------------------------------------------------------------ */
/* The daily clock                                                     */
/*                                                                     */
/* Daily Quests reset at 11:59 PM local time. The day therefore runs   */
/* from one 23:59 to the next, and everything below works from the     */
/* browser's own clock - no UTC, no fixed offset, no server.           */
/* ------------------------------------------------------------------ */

export const RESET_HOUR = 23;
export const RESET_MINUTE = 59;

function toDayKey(d: Date): DayKey {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * The day key the given moment belongs to.
 *
 * At and after 23:59 the next day has already begun, so 23:59:30 on the 4th
 * belongs to the 5th. That single rule is what makes the reset time mean
 * something other than midnight.
 */
export function dailyDateKey(now: Date = new Date()): DayKey {
  const afterReset =
    now.getHours() > RESET_HOUR ||
    (now.getHours() === RESET_HOUR && now.getMinutes() >= RESET_MINUTE);

  if (!afterReset) return toDayKey(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDayKey(tomorrow);
}

/** The next 23:59 local, which is when the current day expires. */
export function nextResetAt(now: Date = new Date()): Date {
  const reset = new Date(now);
  reset.setHours(RESET_HOUR, RESET_MINUTE, 0, 0);
  if (reset.getTime() <= now.getTime()) reset.setDate(reset.getDate() + 1);
  return reset;
}

export function msUntilReset(now: Date = new Date()): number {
  return Math.max(0, nextResetAt(now).getTime() - now.getTime());
}

/** "6h 42m", or "42m", or "< 1m" in the last minute. */
export function formatResetCountdown(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '< 1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatResetClock(): string {
  return `${RESET_HOUR}:${`${RESET_MINUTE}`.padStart(2, '0')}`;
}

export function weekdayOf(date: DayKey): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() as Weekday;
}

/** Day key n days before the given one. */
export function shiftDayKey(date: DayKey, deltaDays: number): DayKey {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(y, m - 1, d);
  shifted.setDate(shifted.getDate() + deltaDays);
  return toDayKey(shifted);
}

export function formatDayKey(date: DayKey): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

/* ------------------------------------------------------------------ */
/* Daily Check XP                                                      */
/* ------------------------------------------------------------------ */

/**
 * XP for one tracker submission.
 *
 *   reading     1 XP per page
 *   calories    floor(calories / 10)  ->  386 calories = 38 XP
 *   instrument  1 XP per minute
 *
 * Amounts are whole numbers; anything else is floored before conversion.
 */
export function dailyCheckXp(activity: DailyCheckActivity, amount: number): number {
  const whole = Number.isFinite(amount) ? Math.floor(Math.max(0, amount)) : 0;
  switch (activity) {
    case 'reading':
      return whole;
    case 'calories':
      return Math.floor(whole / 10);
    case 'instrument':
      return whole;
    default:
      return 0;
  }
}

export const ACTIVITY_LABEL: Record<DailyCheckActivity, string> = {
  reading: 'Reading',
  calories: 'Calories',
  instrument: 'Instrument',
};

export const ACTIVITY_UNIT: Record<DailyCheckActivity, string> = {
  reading: 'pages',
  calories: 'calories',
  instrument: 'minutes',
};

export const ACTIVITY_FORMULA_LABEL: Record<DailyCheckActivity, string> = {
  reading: '1 XP per page',
  calories: '1 XP per 10 calories',
  instrument: '1 XP per minute',
};

/**
 * The entries that currently count.
 *
 * A corrected entry is superseded by its replacement, so totals read from the
 * tail of each correction chain. The superseded rows stay in the record -
 * they are what makes the log auditable.
 */
export function effectiveEntries(check: DailyCheck): DailyCheckEntry[] {
  return check.entries.filter((e) => !e.correctedByEntryId);
}

export interface DailyCheckTotals {
  reading: number;
  calories: number;
  instrumentMinutes: number;
  /** Minutes per instrument, keyed by node id. */
  byInstrument: Record<Id, { name: string; minutes: number }>;
  xp: number;
  entryCount: number;
}

export function dailyCheckTotals(check: DailyCheck): DailyCheckTotals {
  const totals: DailyCheckTotals = {
    reading: 0,
    calories: 0,
    instrumentMinutes: 0,
    byInstrument: {},
    xp: 0,
    entryCount: 0,
  };

  for (const entry of effectiveEntries(check)) {
    totals.entryCount += 1;
    totals.xp += entry.xpAwarded;

    if (entry.activity === 'reading') totals.reading += entry.amount;
    else if (entry.activity === 'calories') totals.calories += entry.amount;
    else {
      totals.instrumentMinutes += entry.amount;
      const current = totals.byInstrument[entry.skillNodeId];
      totals.byInstrument[entry.skillNodeId] = {
        name: entry.instrumentName ?? current?.name ?? 'Instrument',
        minutes: (current?.minutes ?? 0) + entry.amount,
      };
    }
  }

  return totals;
}

/** Progress against the configured targets, each clamped to 0..1. */
export function dailyCheckProgress(
  totals: DailyCheckTotals,
  targets: { readingPages: number; calories: number; instrumentMinutes: number },
) {
  const ratio = (value: number, target: number) =>
    target <= 0 ? (value > 0 ? 1 : 0) : Math.min(1, value / target);

  const reading = ratio(totals.reading, targets.readingPages);
  const calories = ratio(totals.calories, targets.calories);
  const instrument = ratio(totals.instrumentMinutes, targets.instrumentMinutes);

  return {
    reading,
    calories,
    instrument,
    /** Mean of the three, used for the card's progress preview. */
    overall: (reading + calories + instrument) / 3,
    allTargetsMet: reading >= 1 && calories >= 1 && instrument >= 1,
  };
}

export function dailyCheckStatus(check: DailyCheck): DailyQuestStatus {
  if (check.status === 'completed' || check.status === 'expired') return check.status;
  return effectiveEntries(check).length > 0 ? 'in-progress' : 'not-started';
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const CATEGORY_LABEL: Record<DailyQuestCategory, string> = {
  academic: 'Academic',
  technical: 'Technical',
  business: 'Business',
  music: 'Music',
  physical: 'Physical',
  'personal-care': 'Personal Care',
  organization: 'Organization',
  financial: 'Financial',
  social: 'Social',
};

export const CATEGORY_ICON: Record<DailyQuestCategory, string> = {
  academic: 'graduation',
  technical: 'code',
  business: 'briefcase',
  music: 'music',
  physical: 'dumbbell',
  'personal-care': 'heart',
  organization: 'layers',
  financial: 'coins',
  social: 'users',
};

/** Which skill domain each category leans on, for the rotation preference. */
export const CATEGORY_DOMAIN: Record<DailyQuestCategory, Id | null> = {
  academic: 'dom_languages-communication',
  technical: 'dom_computer-science',
  business: 'dom_business-administration',
  music: 'dom_music',
  physical: 'dom_physical-development',
  'personal-care': 'dom_physical-development',
  organization: null,
  financial: 'dom_business-administration',
  social: 'dom_leadership-service',
};

export const DAILY_QUEST_STATUS_LABEL: Record<DailyQuestStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
  expired: 'Expired',
};

export const MAX_PINNED = 3;
export const ROTATING_SLOTS = 3;

/* ------------------------------------------------------------------ */
/* Rotation                                                            */
/* ------------------------------------------------------------------ */

/** Deterministic PRNG, so the same day always rolls the same way. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface RotationInput {
  definitions: DailyQuestDefinition[];
  history: DailyQuestHistory[];
  date: DayKey;
  /** Domain ids the character is actually developing, for rule 4. */
  activeDomainIds: Id[];
  /** Definition ids already placed, e.g. when refilling one replaced slot. */
  exclude?: Id[];
  slots?: number;
}

/** True when the definition is allowed to appear on this date at all. */
export function isEligibleOn(definition: DailyQuestDefinition, date: DayKey): boolean {
  if (!definition.active) return false;
  if (definition.weekdays.length === 0) return true;
  return definition.weekdays.includes(weekdayOf(date));
}

/**
 * Picks the rotating quests for a day.
 *
 * Applied in the order the specification lays out:
 *   1. drop inactive quests (and any whose weekday schedule excludes today)
 *   2. place pinned quests first
 *   3. avoid quests completed yesterday, while alternatives exist
 *   4. prefer quests tied to a domain the character is developing
 *   5. spread the picks across different categories
 *   6. fill anything left over at random
 *
 * The randomness is seeded from the date, so this is a pure function: the same
 * day and the same settings always produce the same three quests. The result
 * is persisted as well, which is what survives a refresh after a manual swap.
 */
export function selectRotatingQuests(input: RotationInput): Id[] {
  const { definitions, history, date, activeDomainIds, exclude = [] } = input;
  const slots = input.slots ?? ROTATING_SLOTS;

  const excluded = new Set(exclude);
  const eligible = definitions.filter((d) => isEligibleOn(d, date) && !excluded.has(d.id));
  if (eligible.length === 0) return [];

  const random = mulberry32(hashString(`${date}|${eligible.length}|${exclude.join(',')}`));
  const shuffle = <T,>(items: T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const chosen: Id[] = [];
  const usedCategories = new Set<DailyQuestCategory>();

  const take = (definition: DailyQuestDefinition) => {
    chosen.push(definition.id);
    usedCategories.add(definition.category);
  };

  // 2. Pinned quests come first, capped at the pin limit.
  const pinned = eligible.filter((d) => d.pinned).slice(0, MAX_PINNED);
  for (const definition of pinned) {
    if (chosen.length >= slots) break;
    take(definition);
  }

  const remaining = eligible.filter((d) => !chosen.includes(d.id));

  // 3. Quests completed yesterday step aside, but only while there is enough
  //    left to fill the day. A pinned quest is never held back this way.
  const yesterday = history.find((h) => h.date === shiftDayKey(date, -1));
  const recentlyCompleted = new Set(yesterday?.completedDefinitionIds ?? []);

  const fresh = remaining.filter((d) => !recentlyCompleted.has(d.id));
  const pool = fresh.length >= slots - chosen.length ? fresh : remaining;

  // 4 + 5. Prefer an unused category, then a developing domain, then anything.
  const activeDomains = new Set(activeDomainIds);
  const scored = shuffle(pool).sort((a, b) => {
    const domainScore = (d: DailyQuestDefinition) => {
      const domain = CATEGORY_DOMAIN[d.category];
      return domain && activeDomains.has(domain) ? 0 : 1;
    };
    return domainScore(a) - domainScore(b);
  });

  for (const definition of scored) {
    if (chosen.length >= slots) break;
    if (usedCategories.has(definition.category)) continue;
    take(definition);
  }

  // 6. Fill whatever is left, category repeats now allowed.
  for (const definition of scored) {
    if (chosen.length >= slots) break;
    if (chosen.includes(definition.id)) continue;
    take(definition);
  }

  return chosen.slice(0, slots);
}

/* ------------------------------------------------------------------ */
/* Streaks and history                                                 */
/* ------------------------------------------------------------------ */

/**
 * Consecutive days ending today (or yesterday, if today is still open) on
 * which every Daily Quest was completed.
 *
 * Today counts only once it is actually finished, so an unfinished today never
 * breaks a streak that is still live.
 */
export function dailyStreak(history: DailyQuestHistory[], todayKey: DayKey): number {
  const byDate = new Map(history.map((h) => [h.date, h]));
  const isFullDay = (h: DailyQuestHistory | undefined) =>
    Boolean(h && h.total > 0 && h.completed >= h.total);

  let streak = 0;
  let cursor = todayKey;

  // A today that is not yet complete is skipped rather than counted as a miss.
  if (!isFullDay(byDate.get(cursor))) cursor = shiftDayKey(cursor, -1);

  while (isFullDay(byDate.get(cursor))) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  return streak;
}

/** The last `days` day keys ending at `todayKey`, oldest first. */
export function recentDayKeys(todayKey: DayKey, days = 7): DayKey[] {
  return Array.from({ length: days }, (_, i) => shiftDayKey(todayKey, -(days - 1 - i)));
}
