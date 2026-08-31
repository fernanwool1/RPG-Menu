import { beforeEach, describe, expect, it } from 'vitest';

import { dailyCheckTotals, dailyDateKey, effectiveEntries, shiftDayKey } from '@/domain/daily';
import { levelProgressFromXp, lifetimeXpFromLedger } from '@/domain/progression';
import { useAppStore } from '@/store/useAppStore';

/**
 * The Daily Quest system driven through the real store actions.
 *
 * With no `window`, persistence falls back to its in-memory adapter, so these
 * exercise the actual reducers rather than a stand-in.
 */

const today = () => dailyDateKey();
const lifetime = () => lifetimeXpFromLedger(useAppStore.getState().transactions);
const check = () => useAppStore.getState().dailyChecks.find((c) => c.date === today())!;
const todaysInstances = () =>
  useAppStore.getState().dailyInstances.filter((i) => i.date === today());

beforeEach(() => {
  useAppStore.getState().startWithSampleData();
  useAppStore.getState().rollDailyDay();
});

/* ------------------------------------------------------------------ */
/* The day roll                                                        */
/* ------------------------------------------------------------------ */

describe('rolling the day', () => {
  it('creates a Daily Check plus exactly three rotating quests', () => {
    expect(check()).toBeTruthy();
    expect(todaysInstances()).toHaveLength(3);
    // Four quests a day: the Daily Check in slot 1, three rotating in 2-4.
    expect(todaysInstances().map((i) => i.slot).sort()).toEqual([2, 3, 4]);
  });

  it('is idempotent, so a refresh never rerolls the day', () => {
    const first = todaysInstances().map((i) => i.definitionId);
    const checkId = check().id;

    useAppStore.getState().rollDailyDay();
    useAppStore.getState().rollDailyDay();

    expect(todaysInstances().map((i) => i.definitionId)).toEqual(first);
    expect(check().id).toBe(checkId);
    expect(todaysInstances()).toHaveLength(3);
  });

  it('saves the selection for the day', () => {
    const selection = useAppStore.getState().dailySelections.find((s) => s.date === today());
    expect(selection).toBeTruthy();
    expect(selection!.instanceIds).toHaveLength(3);
    expect(selection!.manuallyAdjusted).toBe(false);
  });

  it('never repeats a definition within the day', () => {
    const ids = todaysInstances().map((i) => i.definitionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ------------------------------------------------------------------ */
/* Completing rotating quests                                          */
/* ------------------------------------------------------------------ */

describe('completing a rotating Daily Quest', () => {
  it('pays the definition XP once', () => {
    const instance = todaysInstances()[0];
    const definition = useAppStore
      .getState()
      .dailyDefinitions.find((d) => d.id === instance.definitionId)!;

    const before = lifetime();
    useAppStore.getState().completeDailyQuest(instance.id);

    expect(lifetime() - before).toBe(definition.characterXp);
    expect(todaysInstances().find((i) => i.id === instance.id)?.status).toBe('completed');
  });

  it('cannot pay twice, even after reopening', () => {
    const instance = todaysInstances()[0];

    useAppStore.getState().completeDailyQuest(instance.id);
    const afterFirst = lifetime();

    useAppStore.getState().reopenDailyQuest(instance.id);
    useAppStore.getState().completeDailyQuest(instance.id);

    expect(lifetime()).toBe(afterFirst);
  });

  it('awards no skill XP unless the definition opts in', () => {
    const instance = todaysInstances()[0];
    useAppStore.getState().completeDailyQuest(instance.id);

    const written = useAppStore
      .getState()
      .transactions.filter((t) => t.sourceId === instance.id);

    expect(written).toHaveLength(1);
    // Flat Character XP only: no node, so nothing can be double-counted
    // against an activity tracked in the Daily Check.
    expect(written[0].skillNodeId).toBeNull();
  });

  it('awards skill XP only once explicitly configured', () => {
    const instance = todaysInstances()[0];
    useAppStore.getState().updateDailyQuestDefinition(instance.definitionId, {
      linkedSkillNodeId: 'nod_cycling',
      awardsSkillXp: true,
      skillXp: 5,
    });

    useAppStore.getState().completeDailyQuest(instance.id);
    const written = useAppStore
      .getState()
      .transactions.filter((t) => t.sourceId === instance.id);

    expect(written).toHaveLength(2);
    expect(written.some((t) => t.skillNodeId === 'nod_cycling' && t.amount === 5)).toBe(true);
  });

  it('does not convert calories a second time through the workout quest', () => {
    // Calories go through the Daily Check, once.
    useAppStore.getState().addDailyCheckEntry({
      activity: 'calories',
      amount: 400,
      skillNodeId: 'nod_cycling',
    });
    const cyclingAfterCheck = useAppStore
      .getState()
      .transactions.filter((t) => t.skillNodeId === 'nod_cycling')
      .reduce((s, t) => s + t.amount, 0);

    // Completing the workout quest pays its flat 10 XP and touches no node.
    const instance = todaysInstances()[0];
    useAppStore.getState().completeDailyQuest(instance.id);

    const cyclingAfterQuest = useAppStore
      .getState()
      .transactions.filter((t) => t.skillNodeId === 'nod_cycling')
      .reduce((s, t) => s + t.amount, 0);

    expect(cyclingAfterQuest).toBe(cyclingAfterCheck);
  });
});

/* ------------------------------------------------------------------ */
/* Replacing                                                           */
/* ------------------------------------------------------------------ */

describe('replacing a rotating quest', () => {
  it('swaps an incomplete quest for a different one', () => {
    const instance = todaysInstances()[0];
    const before = instance.definitionId;

    const result = useAppStore.getState().replaceDailyQuest(instance.id);
    expect(result.ok).toBe(true);

    const after = todaysInstances().find((i) => i.id === instance.id)!;
    expect(after.definitionId).not.toBe(before);
    expect(after.status).toBe('not-started');
    expect(after.xpAwardedAt).toBeNull();
    expect(todaysInstances()).toHaveLength(3);
  });

  it('refuses to replace a completed quest', () => {
    const instance = todaysInstances()[0];
    useAppStore.getState().completeDailyQuest(instance.id);

    const result = useAppStore.getState().replaceDailyQuest(instance.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Completed quests cannot be replaced');
  });

  it('never swaps in something already on the board', () => {
    const instance = todaysInstances()[0];
    const others = todaysInstances()
      .filter((i) => i.id !== instance.id)
      .map((i) => i.definitionId);

    useAppStore.getState().replaceDailyQuest(instance.id);
    const after = todaysInstances().find((i) => i.id === instance.id)!;
    expect(others).not.toContain(after.definitionId);
  });

  it('rejects an explicit choice that is already in the list', () => {
    const [first, second] = todaysInstances();
    const result = useAppStore.getState().replaceDailyQuest(first.id, second.definitionId);
    expect(result.ok).toBe(false);
  });

  it('marks the day as manually adjusted', () => {
    useAppStore.getState().replaceDailyQuest(todaysInstances()[0].id);
    const selection = useAppStore.getState().dailySelections.find((s) => s.date === today())!;
    expect(selection.manuallyAdjusted).toBe(true);
  });

  it('survives a re-roll: the swap is not undone', () => {
    const instance = todaysInstances()[0];
    useAppStore.getState().replaceDailyQuest(instance.id);
    const swapped = todaysInstances().find((i) => i.id === instance.id)!.definitionId;

    useAppStore.getState().rollDailyDay();
    expect(todaysInstances().find((i) => i.id === instance.id)?.definitionId).toBe(swapped);
  });
});

/* ------------------------------------------------------------------ */
/* Daily Check entries                                                 */
/* ------------------------------------------------------------------ */

describe('Daily Check entries', () => {
  it('adds to the running total instead of replacing it', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 12,
      skillNodeId: 'nod_english-reading',
    });
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 8,
      skillNodeId: 'nod_english-reading',
    });

    expect(dailyCheckTotals(check()).reading).toBe(20);
  });

  it('writes one immutable transaction per entry, carrying the full context', () => {
    const before = lifetime();
    const result = useAppStore.getState().addDailyCheckEntry({
      activity: 'calories',
      amount: 386,
      skillNodeId: 'nod_cycling',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.xp).toBe(38);
    expect(lifetime() - before).toBe(38);

    const entryId = effectiveEntries(check()).at(-1)!.id;
    const tx = useAppStore
      .getState()
      .transactions.find((t) => t.sourceType === 'daily-check' && t.sourceId === entryId)!;

    expect(tx).toBeTruthy();
    expect(tx.amount).toBe(38);
    expect(tx.skillNodeId).toBe('nod_cycling');
    expect(tx.createdAt).toBeTruthy();
    // The Daily Check id is recorded on the transaction.
    expect(tx.note).toContain(check().id);
  });

  it('routes instrument minutes to the chosen instrument node', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'instrument',
      amount: 20,
      skillNodeId: 'nod_piano',
      instrumentName: 'Piano',
    });

    const totals = dailyCheckTotals(check());
    expect(totals.byInstrument.nod_piano.minutes).toBe(20);
    expect(
      useAppStore
        .getState()
        .transactions.some((t) => t.sourceType === 'daily-check' && t.skillNodeId === 'nod_piano'),
    ).toBe(true);
  });

  it('rejects fractions, zero and negatives', () => {
    for (const amount of [0, -5]) {
      const result = useAppStore
        .getState()
        .addDailyCheckEntry({ activity: 'reading', amount, skillNodeId: 'nod_english-reading' });
      expect(result.ok).toBe(false);
    }

    // A fraction is floored to a whole number rather than refused outright.
    const fractional = useAppStore
      .getState()
      .addDailyCheckEntry({ activity: 'reading', amount: 7.9, skillNodeId: 'nod_english-reading' });
    expect(fractional.ok).toBe(true);
    expect(dailyCheckTotals(check()).reading).toBe(7);
  });

  it('never awards the same entry twice', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 10,
      skillNodeId: 'nod_english-reading',
    });

    const entryId = effectiveEntries(check()).at(-1)!.id;
    const written = useAppStore
      .getState()
      .transactions.filter((t) => t.sourceId === entryId);
    expect(written).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Corrections                                                         */
/* ------------------------------------------------------------------ */

describe('correcting an entry', () => {
  it('appends a delta rather than rewriting the original', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 100,
      skillNodeId: 'nod_english-reading',
    });

    const original = effectiveEntries(check()).at(-1)!;
    const afterEntry = lifetime();
    const txCount = useAppStore.getState().transactions.length;

    const result = useAppStore.getState().correctDailyCheckEntry(original.id, 10);
    expect(result.ok).toBe(true);

    // Total lands on the corrected value.
    expect(lifetime()).toBe(afterEntry - 90);
    expect(dailyCheckTotals(check()).reading).toBe(10);

    // History grew; the original transaction is untouched.
    expect(useAppStore.getState().transactions.length).toBe(txCount + 1);
    const originalTx = useAppStore.getState().transactions.find((t) => t.sourceId === original.id)!;
    expect(originalTx.amount).toBe(100);

    const correction = useAppStore
      .getState()
      .transactions.find((t) => t.sourceType === 'correction')!;
    expect(correction.amount).toBe(-90);

    // Both rows survive on the check itself.
    expect(check().entries).toHaveLength(2);
    expect(check().entries.find((e) => e.id === original.id)?.correctedByEntryId).toBeTruthy();
  });

  it('corrects upward too', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'calories',
      amount: 100,
      skillNodeId: 'nod_cycling',
    });
    const original = effectiveEntries(check()).at(-1)!;
    const afterEntry = lifetime();

    useAppStore.getState().correctDailyCheckEntry(original.id, 400);
    expect(lifetime()).toBe(afterEntry + 30); // 40 XP - 10 XP
  });

  it('refuses to correct an already-corrected entry', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 50,
      skillNodeId: 'nod_english-reading',
    });
    const original = effectiveEntries(check()).at(-1)!;
    useAppStore.getState().correctDailyCheckEntry(original.id, 20);

    const result = useAppStore.getState().correctDailyCheckEntry(original.id, 30);
    expect(result.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Completing the Daily Check                                          */
/* ------------------------------------------------------------------ */

describe('completing the Daily Check', () => {
  it('adds no flat Quest XP of its own', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 20,
      skillNodeId: 'nod_english-reading',
    });

    const before = lifetime();
    const result = useAppStore.getState().completeDailyCheck();

    expect(result.ok).toBe(true);
    // The pages already paid. A completion bonus would pay for them twice.
    expect(lifetime()).toBe(before);
    expect(check().status).toBe('completed');
  });

  it('will not complete an empty check', () => {
    const result = useAppStore.getState().completeDailyCheck();
    expect(result.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Expiry, history and settings                                        */
/* ------------------------------------------------------------------ */

describe('expiry', () => {
  it('expires yesterday without removing any XP or levels', () => {
    // Log something, then age the whole day by a day.
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 30,
      skillNodeId: 'nod_english-reading',
    });

    const xpBefore = lifetime();
    const levelBefore = levelProgressFromXp(xpBefore).level;
    const yesterday = shiftDayKey(today(), -1);

    useAppStore.setState((s) => ({
      dailyInstances: s.dailyInstances.map((i) => ({ ...i, date: yesterday })),
      dailyChecks: s.dailyChecks.map((c) => ({ ...c, date: yesterday })),
      dailySelections: s.dailySelections.map((sel) => ({ ...sel, date: yesterday })),
    }));

    useAppStore.getState().rollDailyDay();

    // Yesterday expired...
    const expired = useAppStore.getState().dailyInstances.filter((i) => i.date === yesterday);
    expect(expired.every((i) => i.status === 'expired')).toBe(true);

    // ...and took nothing with it.
    expect(lifetime()).toBe(xpBefore);
    expect(levelProgressFromXp(lifetime()).level).toBe(levelBefore);

    // Today was rolled fresh.
    expect(todaysInstances()).toHaveLength(3);
    expect(check().status).toBe('not-started');
  });

  it('files the closed day into history', () => {
    const instance = todaysInstances()[0];
    useAppStore.getState().completeDailyQuest(instance.id);

    const yesterday = shiftDayKey(today(), -1);
    useAppStore.setState((s) => ({
      dailyInstances: s.dailyInstances.map((i) => ({ ...i, date: yesterday })),
      dailyChecks: s.dailyChecks.map((c) => ({ ...c, date: yesterday })),
      dailySelections: s.dailySelections.map((sel) => ({ ...sel, date: yesterday })),
    }));
    useAppStore.getState().rollDailyDay();

    const record = useAppStore.getState().dailyHistory.find((h) => h.date === yesterday);
    expect(record).toBeTruthy();
    expect(record!.total).toBe(4);
    expect(record!.completed).toBe(1);
    expect(record!.completedDefinitionIds).toContain(instance.definitionId);
  });
});

describe('settings', () => {
  it('enforces the pin limit of three', () => {
    const definitions = useAppStore.getState().dailyDefinitions;
    for (const d of definitions) useAppStore.getState().setDailyQuestPinned(d.id, false);

    const [a, b, c, d] = definitions;
    expect(useAppStore.getState().setDailyQuestPinned(a.id, true).ok).toBe(true);
    expect(useAppStore.getState().setDailyQuestPinned(b.id, true).ok).toBe(true);
    expect(useAppStore.getState().setDailyQuestPinned(c.id, true).ok).toBe(true);

    const fourth = useAppStore.getState().setDailyQuestPinned(d.id, true);
    expect(fourth.ok).toBe(false);
    expect(useAppStore.getState().dailyDefinitions.filter((x) => x.pinned)).toHaveLength(3);
  });

  it('edits the XP value of a definition', () => {
    const id = useAppStore.getState().dailyDefinitions[0].id;
    useAppStore.getState().updateDailyQuestDefinition(id, { characterXp: 25 });
    expect(useAppStore.getState().dailyDefinitions.find((d) => d.id === id)?.characterXp).toBe(25);
  });

  it('edits the daily targets', () => {
    useAppStore.getState().setDailyTargets({ readingPages: 40, calories: 600 });
    expect(useAppStore.getState().dailyTargets.readingPages).toBe(40);
    expect(useAppStore.getState().dailyTargets.calories).toBe(600);
    // Untouched fields survive.
    expect(useAppStore.getState().dailyTargets.instrumentMinutes).toBe(20);
  });

  it('adds a new instrument as a real skill node under Performance', () => {
    const id = useAppStore.getState().addInstrument('Charango');
    expect(id).toBeTruthy();

    const node = useAppStore.getState().nodes.find((n) => n.id === id)!;
    expect(node.name).toBe('Charango');
    expect(node.branchId).toBe('brn_instrumental-practice');

    // Adding the same instrument twice returns the existing node.
    expect(useAppStore.getState().addInstrument('charango')).toBe(id);
  });

  it('ships the eight seeded instruments under Performance', () => {
    const performance = useAppStore
      .getState()
      .nodes.filter((n) => n.branchId === 'brn_instrumental-practice')
      .map((n) => n.name);

    for (const instrument of [
      'Guitar',
      'Piano',
      'Zampoña',
      'Kalimba',
      'Violin',
      'Ukulele',
      'Pipa',
      'Harp',
    ]) {
      expect(performance).toContain(instrument);
    }
  });
});

describe('export and import', () => {
  it('round-trips the daily state', () => {
    useAppStore.getState().addDailyCheckEntry({
      activity: 'reading',
      amount: 15,
      skillNodeId: 'nod_english-reading',
    });
    useAppStore.getState().completeDailyQuest(todaysInstances()[0].id);

    const snapshot = {
      instances: todaysInstances().map((i) => i.definitionId),
      readingTotal: dailyCheckTotals(check()).reading,
      xp: lifetime(),
    };

    const exported = useAppStore.getState().exportData();
    useAppStore.getState().startEmpty();
    expect(useAppStore.getState().dailyInstances).toHaveLength(0);

    expect(useAppStore.getState().importData(exported).ok).toBe(true);

    expect(todaysInstances().map((i) => i.definitionId)).toEqual(snapshot.instances);
    expect(dailyCheckTotals(check()).reading).toBe(snapshot.readingTotal);
    expect(lifetime()).toBe(snapshot.xp);
  });
});
