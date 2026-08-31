import {
  dailyCheckXp,
  dailyDateKey,
  effectiveEntries,
  isEligibleOn,
  MAX_PINNED,
  ROTATING_SLOTS,
  selectRotatingQuests,
} from '@/domain/daily';
import { newId, nowIso } from '@/domain/ids';
import type {
  DailyCheck,
  DailyCheckActivity,
  DailyCheckEntry,
  DailyQuestDefinition,
  DailyQuestHistory,
  DailyQuestInstance,
  DailyQuestSelection,
  DailyTarget,
  DayKey,
  Id,
  XpTransaction,
} from '@/domain/types';

/**
 * Daily Quest state and the pure reducers that move it.
 *
 * These are written as plain functions over a slice rather than as Zustand
 * actions so the whole day-roll, XP and correction machinery can be tested in
 * Node without a store or a browser. `useAppStore` wires them up.
 */

export interface DailySlice {
  dailyDefinitions: DailyQuestDefinition[];
  dailyInstances: DailyQuestInstance[];
  dailySelections: DailyQuestSelection[];
  dailyChecks: DailyCheck[];
  dailyTargets: DailyTarget;
  dailyHistory: DailyQuestHistory[];
  /** Day key the slice was last rolled for; drives expiry on the next tick. */
  dailyActiveDate: DayKey | null;
}

export interface DailyContext {
  transactions: XpTransaction[];
  /** Domain ids the character is developing, used by the rotation preference. */
  activeDomainIds: Id[];
}

export type DailyPatch = Partial<DailySlice> & { transactions?: XpTransaction[] };

/* ------------------------------------------------------------------ */
/* Rolling the day over                                                */
/* ------------------------------------------------------------------ */

/**
 * Brings the slice up to date for `today`.
 *
 * Idempotent: calling it repeatedly on the same day changes nothing, which
 * matters because the UI calls it on mount, on focus and on a timer. That is
 * also what makes the daily selection survive a refresh - if today already has
 * a saved roll, it is reused rather than rerolled.
 */
export function rollDailyDay(
  slice: DailySlice,
  ctx: DailyContext,
  today: DayKey = dailyDateKey(),
): DailyPatch {
  const at = nowIso();
  const patch: DailyPatch = {};

  let instances = slice.dailyInstances;
  let checks = slice.dailyChecks;
  let history = slice.dailyHistory;
  let selections = slice.dailySelections;

  /* --- 1. Expire anything left open on an earlier day -------------- */
  const staleInstances = instances.filter(
    (i) => i.date < today && i.status !== 'completed' && i.status !== 'expired',
  );
  const staleChecks = checks.filter(
    (c) => c.date < today && c.status !== 'completed' && c.status !== 'expired',
  );

  if (staleInstances.length > 0 || staleChecks.length > 0) {
    const staleIds = new Set(staleInstances.map((i) => i.id));
    // Expiry is a status change and nothing more: no transaction is written,
    // so previously earned XP and the character level are untouched.
    instances = instances.map((i) =>
      staleIds.has(i.id) ? { ...i, status: 'expired' as const, expiredAt: at } : i,
    );

    const staleCheckIds = new Set(staleChecks.map((c) => c.id));
    checks = checks.map((c) =>
      staleCheckIds.has(c.id) ? { ...c, status: 'expired' as const, expiredAt: at } : c,
    );
  }

  /* --- 2. Close out every past day into history -------------------- */
  const openPastDays = new Set<DayKey>([
    ...instances.filter((i) => i.date < today).map((i) => i.date),
    ...checks.filter((c) => c.date < today).map((c) => c.date),
  ]);

  for (const date of openPastDays) {
    if (history.some((h) => h.date === date)) continue;
    history = [...history, summariseDay(date, instances, checks, slice.dailyDefinitions, ctx)];
  }

  /* --- 3. Make sure today exists ----------------------------------- */
  let check = checks.find((c) => c.date === today);
  if (!check) {
    check = {
      id: newId('dcheck'),
      date: today,
      status: 'not-started',
      entries: [],
      completedAt: null,
      expiredAt: null,
      createdAt: at,
    };
    checks = [...checks, check];
  }

  let selection = selections.find((s) => s.date === today);
  if (!selection) {
    const definitionIds = selectRotatingQuests({
      definitions: slice.dailyDefinitions,
      history,
      date: today,
      activeDomainIds: ctx.activeDomainIds,
    });

    const fresh: DailyQuestInstance[] = definitionIds.map((definitionId, index) => ({
      id: newId('dqi'),
      definitionId,
      date: today,
      slot: (index + 2) as 2 | 3 | 4,
      status: 'not-started',
      completedAt: null,
      expiredAt: null,
      xpAwardedAt: null,
      createdAt: at,
    }));

    instances = [...instances, ...fresh];
    selection = {
      date: today,
      instanceIds: fresh.map((i) => i.id),
      rolledAt: at,
      manuallyAdjusted: false,
    };
    selections = [...selections, selection];
  }

  patch.dailyInstances = instances;
  patch.dailyChecks = checks;
  patch.dailyHistory = history;
  patch.dailySelections = selections;
  patch.dailyActiveDate = today;
  return patch;
}

function summariseDay(
  date: DayKey,
  instances: DailyQuestInstance[],
  checks: DailyCheck[],
  definitions: DailyQuestDefinition[],
  ctx: DailyContext,
): DailyQuestHistory {
  const dayInstances = instances.filter((i) => i.date === date);
  const check = checks.find((c) => c.date === date);

  const completedInstances = dayInstances.filter((i) => i.status === 'completed');
  const checkCompleted = check?.status === 'completed';

  const definitionXp = new Map(definitions.map((d) => [d.id, d.characterXp]));
  const questXp = completedInstances.reduce(
    (sum, i) => sum + (definitionXp.get(i.definitionId) ?? 0),
    0,
  );
  const checkXp = check
    ? effectiveEntries(check).reduce((sum, e) => sum + e.xpAwarded, 0)
    : 0;

  return {
    date,
    // Slot 1 is the Daily Check, so a full day is four completions.
    completed: completedInstances.length + (checkCompleted ? 1 : 0),
    total: dayInstances.length + (check ? 1 : 0),
    dailyCheckCompleted: checkCompleted,
    completedDefinitionIds: completedInstances.map((i) => i.definitionId),
    expiredDefinitionIds: dayInstances
      .filter((i) => i.status === 'expired')
      .map((i) => i.definitionId),
    xpEarned: questXp + checkXp,
  };
}

/**
 * Today's summary, computed live rather than stored.
 *
 * History rows only exist for days that have closed, so the UI reads today
 * through this and past days through `dailyHistory`.
 */
export function summariseToday(
  slice: DailySlice,
  today: DayKey,
  ctx: DailyContext = { transactions: [], activeDomainIds: [] },
): DailyQuestHistory {
  return summariseDay(today, slice.dailyInstances, slice.dailyChecks, slice.dailyDefinitions, ctx);
}

/* ------------------------------------------------------------------ */
/* Completing a rotating Daily Quest                                   */
/* ------------------------------------------------------------------ */

/**
 * Pays the definition's Character XP, once.
 *
 * Skill XP is only added when the definition explicitly opts in via
 * `awardsSkillXp`. Left off - which is the seeded default - a rotating quest
 * can never convert an activity that the Daily Check already converted.
 */
export function completeDailyQuest(
  slice: DailySlice,
  transactions: XpTransaction[],
  instanceId: Id,
): DailyPatch {
  const instance = slice.dailyInstances.find((i) => i.id === instanceId);
  if (!instance || instance.status === 'expired') return {};

  const definition = slice.dailyDefinitions.find((d) => d.id === instance.definitionId);
  if (!definition) return {};

  const at = nowIso();
  const alreadyPaid = instance.xpAwardedAt !== null;

  const instances = slice.dailyInstances.map((i) =>
    i.id === instanceId
      ? {
          ...i,
          status: 'completed' as const,
          completedAt: at,
          xpAwardedAt: i.xpAwardedAt ?? at,
        }
      : i,
  );

  if (alreadyPaid) return { dailyInstances: instances };

  const written: XpTransaction[] = [...transactions];

  if (definition.characterXp > 0) {
    written.push({
      id: newId('xtx'),
      createdAt: at,
      sourceType: 'daily-quest',
      sourceId: instance.id,
      // No node: this is flat Character XP.
      skillNodeId: null,
      amount: definition.characterXp,
      note: definition.name,
    });
  }

  if (definition.awardsSkillXp && definition.linkedSkillNodeId && definition.skillXp > 0) {
    written.push({
      id: newId('xtx'),
      createdAt: at,
      sourceType: 'daily-quest',
      sourceId: instance.id,
      skillNodeId: definition.linkedSkillNodeId,
      amount: definition.skillXp,
      note: `${definition.name} (skill)`,
    });
  }

  return { dailyInstances: instances, transactions: written };
}

/** Reopening leaves the payout guard intact, so it can never pay twice. */
export function reopenDailyQuest(slice: DailySlice, instanceId: Id): DailyPatch {
  return {
    dailyInstances: slice.dailyInstances.map((i) =>
      i.id === instanceId && i.status === 'completed'
        ? { ...i, status: 'not-started' as const, completedAt: null }
        : i,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Replacing a slot                                                    */
/* ------------------------------------------------------------------ */

/**
 * Swaps an incomplete rotating quest for another eligible one.
 *
 * A completed quest is never replaceable - that is what stops a finished
 * quest being swapped away after it has already paid out.
 */
export function replaceDailyQuest(
  slice: DailySlice,
  ctx: DailyContext,
  instanceId: Id,
  today: DayKey,
  /** Optional explicit choice; otherwise the rotation picks one. */
  definitionId?: Id,
): DailyPatch | { error: string } {
  const instance = slice.dailyInstances.find((i) => i.id === instanceId);
  if (!instance) return { error: 'That Daily Quest no longer exists.' };
  if (instance.status === 'completed') {
    return { error: 'Completed quests cannot be replaced.' };
  }
  if (instance.date !== today) {
    return { error: 'Only today’s quests can be replaced.' };
  }

  const selection = slice.dailySelections.find((s) => s.date === today);
  if (!selection) return { error: 'Today has not been rolled yet.' };

  const siblingDefinitionIds = slice.dailyInstances
    .filter((i) => i.date === today && i.id !== instanceId)
    .map((i) => i.definitionId);

  let nextDefinitionId = definitionId;

  if (nextDefinitionId) {
    const definition = slice.dailyDefinitions.find((d) => d.id === nextDefinitionId);
    if (!definition || !isEligibleOn(definition, today)) {
      return { error: 'That quest is not available today.' };
    }
    if (siblingDefinitionIds.includes(nextDefinitionId)) {
      return { error: 'That quest is already in today’s list.' };
    }
  } else {
    const [picked] = selectRotatingQuests({
      definitions: slice.dailyDefinitions,
      history: slice.dailyHistory,
      date: today,
      activeDomainIds: ctx.activeDomainIds,
      // Never offer something already on the board, nor the one being swapped.
      exclude: [...siblingDefinitionIds, instance.definitionId],
      slots: 1,
    });
    if (!picked) return { error: 'No other Daily Quest is available today.' };
    nextDefinitionId = picked;
  }

  const at = nowIso();
  return {
    dailyInstances: slice.dailyInstances.map((i) =>
      i.id === instanceId
        ? {
            ...i,
            definitionId: nextDefinitionId as Id,
            status: 'not-started' as const,
            completedAt: null,
            // A fresh quest in the slot has never been paid.
            xpAwardedAt: null,
            createdAt: at,
          }
        : i,
    ),
    dailySelections: slice.dailySelections.map((s) =>
      s.date === today ? { ...s, manuallyAdjusted: true } : s,
    ),
  };
}

/** Definitions the user could swap in right now. */
export function replacementOptions(
  slice: DailySlice,
  today: DayKey,
  instanceId: Id,
): DailyQuestDefinition[] {
  const onBoard = new Set(
    slice.dailyInstances
      .filter((i) => i.date === today && i.id !== instanceId)
      .map((i) => i.definitionId),
  );

  return slice.dailyDefinitions
    .filter((d) => isEligibleOn(d, today) && !onBoard.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Daily Check entries                                                 */
/* ------------------------------------------------------------------ */

export interface AddEntryInput {
  activity: DailyCheckActivity;
  amount: number;
  skillNodeId: Id;
  instrumentName?: string;
  note?: string;
}

/**
 * Appends one tracker submission and its transaction.
 *
 * Submissions accumulate: saving 12 pages and later 8 more leaves the day at
 * 20, never at 8. Each entry writes exactly one immutable transaction carrying
 * the activity, the amount, the calculated XP, the node, the timestamp and the
 * Daily Check id, and an entry is only ever written once.
 */
export function addDailyCheckEntry(
  slice: DailySlice,
  transactions: XpTransaction[],
  today: DayKey,
  input: AddEntryInput,
): DailyPatch | { error: string } {
  const check = slice.dailyChecks.find((c) => c.date === today);
  if (!check) return { error: 'Today’s Daily Check has not been created yet.' };
  if (check.status === 'expired') return { error: 'This Daily Check has expired.' };

  const amount = Math.floor(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter a whole number greater than zero.' };
  }
  if (!input.skillNodeId) {
    return { error: 'Choose the skill node this should count toward.' };
  }

  const xp = dailyCheckXp(input.activity, amount);
  const at = nowIso();
  const entryId = newId('dce');

  const entry: DailyCheckEntry = {
    id: entryId,
    dailyCheckId: check.id,
    activity: input.activity,
    amount,
    xpAwarded: xp,
    skillNodeId: input.skillNodeId,
    instrumentName: input.instrumentName,
    occurredAt: at,
    note: input.note,
  };

  const checks = slice.dailyChecks.map((c) =>
    c.id === check.id
      ? {
          ...c,
          entries: [...c.entries, entry],
          status: c.status === 'completed' ? c.status : ('in-progress' as const),
        }
      : c,
  );

  const written = [...transactions];
  // Guard: one transaction per entry id, forever.
  const alreadyWritten = transactions.some(
    (t) => t.sourceType === 'daily-check' && t.sourceId === entryId,
  );

  if (xp > 0 && !alreadyWritten) {
    written.push({
      id: newId('xtx'),
      createdAt: at,
      sourceType: 'daily-check',
      sourceId: entryId,
      skillNodeId: input.skillNodeId,
      amount: xp,
      note: `${check.id} · ${input.activity} · ${amount}`,
    });
  }

  return { dailyChecks: checks, transactions: written };
}

/**
 * Corrects an earlier entry.
 *
 * The original row is kept and marked superseded; a new entry carries the
 * revised amount, and the ledger receives the difference as a `correction`
 * transaction. Nothing already written is edited or removed, so the XP history
 * still explains itself after the fact.
 */
export function correctDailyCheckEntry(
  slice: DailySlice,
  transactions: XpTransaction[],
  entryId: Id,
  newAmount: number,
): DailyPatch | { error: string } {
  const check = slice.dailyChecks.find((c) => c.entries.some((e) => e.id === entryId));
  if (!check) return { error: 'That entry no longer exists.' };

  const original = check.entries.find((e) => e.id === entryId);
  if (!original) return { error: 'That entry no longer exists.' };
  if (original.correctedByEntryId) {
    return { error: 'That entry has already been corrected. Correct the newer one instead.' };
  }

  const amount = Math.floor(Number(newAmount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter a whole number greater than zero.' };
  }
  if (amount === original.amount) return { error: 'That is the same amount as before.' };

  const at = nowIso();
  const correctionId = newId('dce');
  const xp = dailyCheckXp(original.activity, amount);
  const delta = xp - original.xpAwarded;

  const correction: DailyCheckEntry = {
    id: correctionId,
    dailyCheckId: check.id,
    activity: original.activity,
    amount,
    xpAwarded: xp,
    skillNodeId: original.skillNodeId,
    instrumentName: original.instrumentName,
    occurredAt: at,
    correctsEntryId: original.id,
    note: original.note,
  };

  const checks = slice.dailyChecks.map((c) =>
    c.id === check.id
      ? {
          ...c,
          entries: [
            ...c.entries.map((e) =>
              e.id === entryId ? { ...e, correctedByEntryId: correctionId } : e,
            ),
            correction,
          ],
        }
      : c,
  );

  const written = [...transactions];
  if (delta !== 0) {
    written.push({
      id: newId('xtx'),
      createdAt: at,
      sourceType: 'correction',
      sourceId: correctionId,
      skillNodeId: original.skillNodeId,
      amount: delta,
      note: `Correction: ${original.activity} ${original.amount} → ${amount}`,
    });
  }

  return { dailyChecks: checks, transactions: written };
}

/**
 * Marks the Daily Check done.
 *
 * It awards no Quest XP of its own: the pages, calories and minutes have
 * already been converted entry by entry, and adding a flat reward on top would
 * pay for the same work twice.
 */
export function completeDailyCheck(slice: DailySlice, today: DayKey): DailyPatch | { error: string } {
  const check = slice.dailyChecks.find((c) => c.date === today);
  if (!check) return { error: 'Today’s Daily Check has not been created yet.' };
  if (check.status === 'completed') return {};
  if (effectiveEntries(check).length === 0) {
    return { error: 'Record at least one entry before completing the Daily Check.' };
  }

  const at = nowIso();
  return {
    dailyChecks: slice.dailyChecks.map((c) =>
      c.id === check.id ? { ...c, status: 'completed' as const, completedAt: at } : c,
    ),
  };
}

export function reopenDailyCheck(slice: DailySlice, today: DayKey): DailyPatch {
  return {
    dailyChecks: slice.dailyChecks.map((c) =>
      c.date === today && c.status === 'completed'
        ? { ...c, status: 'in-progress' as const, completedAt: null }
        : c,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Definition settings                                                 */
/* ------------------------------------------------------------------ */

export function setDefinitionPinned(
  slice: DailySlice,
  definitionId: Id,
  pinned: boolean,
): DailyPatch | { error: string } {
  if (pinned) {
    const pinnedCount = slice.dailyDefinitions.filter(
      (d) => d.pinned && d.id !== definitionId,
    ).length;
    if (pinnedCount >= MAX_PINNED) {
      return { error: `You can pin at most ${MAX_PINNED} Daily Quests. Unpin one first.` };
    }
  }

  return {
    dailyDefinitions: slice.dailyDefinitions.map((d) =>
      d.id === definitionId ? { ...d, pinned, updatedAt: nowIso() } : d,
    ),
  };
}

export function updateDefinition(
  slice: DailySlice,
  definitionId: Id,
  patch: Partial<DailyQuestDefinition>,
): DailyPatch {
  return {
    dailyDefinitions: slice.dailyDefinitions.map((d) =>
      d.id === definitionId ? { ...d, ...patch, updatedAt: nowIso() } : d,
    ),
  };
}

export function setDailyTargets(slice: DailySlice, patch: Partial<DailyTarget>): DailyPatch {
  return { dailyTargets: { ...slice.dailyTargets, ...patch } };
}

export { ROTATING_SLOTS };
