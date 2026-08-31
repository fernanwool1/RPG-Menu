import { describe, expect, it } from 'vitest';

import {
  dailyCheckProgress,
  dailyCheckTotals,
  dailyCheckXp,
  dailyDateKey,
  dailyStreak,
  effectiveEntries,
  formatResetCountdown,
  isEligibleOn,
  MAX_PINNED,
  msUntilReset,
  nextResetAt,
  recentDayKeys,
  RESET_HOUR,
  RESET_MINUTE,
  selectRotatingQuests,
  shiftDayKey,
  weekdayOf,
} from '@/domain/daily';
import { buildDailyQuestDefinitions, buildDailyTargets } from '@/domain/seed/dailyQuests';
import type { DailyCheck, DailyQuestDefinition, DailyQuestHistory } from '@/domain/types';

const at = new Date().toISOString();
const definitions = buildDailyQuestDefinitions(at);

/* ------------------------------------------------------------------ */
/* The 11:59 PM reset                                                  */
/* ------------------------------------------------------------------ */

describe('the daily clock', () => {
  it('resets at 11:59 PM local, not at midnight', () => {
    expect(RESET_HOUR).toBe(23);
    expect(RESET_MINUTE).toBe(59);
  });

  it('keeps 11:58 PM on the same day', () => {
    const late = new Date(2026, 7, 26, 23, 58, 0);
    expect(dailyDateKey(late)).toBe('2026-08-26');
  });

  it('rolls to the next day at 11:59 PM exactly', () => {
    const reset = new Date(2026, 7, 26, 23, 59, 0);
    expect(dailyDateKey(reset)).toBe('2026-08-27');
  });

  it('keeps the small hours on the day they belong to', () => {
    const earlyHours = new Date(2026, 7, 27, 0, 30, 0);
    expect(dailyDateKey(earlyHours)).toBe('2026-08-27');
  });

  it('rolls the month and the year correctly', () => {
    expect(dailyDateKey(new Date(2026, 7, 31, 23, 59, 0))).toBe('2026-09-01');
    expect(dailyDateKey(new Date(2026, 11, 31, 23, 59, 0))).toBe('2027-01-01');
  });

  it('counts down to the next reset', () => {
    const noon = new Date(2026, 7, 26, 12, 0, 0);
    const reset = nextResetAt(noon);
    expect(reset.getHours()).toBe(23);
    expect(reset.getMinutes()).toBe(59);
    expect(reset.getDate()).toBe(26);

    // 12:00 -> 23:59 is 11h 59m.
    expect(formatResetCountdown(msUntilReset(noon))).toBe('11h 59m');
  });

  it('formats short countdowns without an hours part', () => {
    expect(formatResetCountdown(42 * 60_000)).toBe('42m');
    expect(formatResetCountdown(30_000)).toBe('< 1m');
    expect(formatResetCountdown(6 * 3_600_000 + 42 * 60_000)).toBe('6h 42m');
  });

  it('walks day keys forwards and backwards across boundaries', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(recentDayKeys('2026-08-26', 7)).toHaveLength(7);
    expect(recentDayKeys('2026-08-26', 7).at(-1)).toBe('2026-08-26');
    expect(recentDayKeys('2026-08-26', 7)[0]).toBe('2026-08-20');
  });
});

/* ------------------------------------------------------------------ */
/* Daily Check XP                                                      */
/* ------------------------------------------------------------------ */

describe('Daily Check XP formulas', () => {
  it('reading is 1 XP per page', () => {
    expect(dailyCheckXp('reading', 12)).toBe(12);
    expect(dailyCheckXp('reading', 0)).toBe(0);
  });

  it('calories are floor(calories / 10)', () => {
    // The worked example from the specification.
    expect(dailyCheckXp('calories', 386)).toBe(38);
    expect(dailyCheckXp('calories', 400)).toBe(40);
    expect(dailyCheckXp('calories', 9)).toBe(0);
    expect(dailyCheckXp('calories', 95)).toBe(9);
  });

  it('instrument practice is 1 XP per minute', () => {
    expect(dailyCheckXp('instrument', 20)).toBe(20);
  });

  it('floors fractions and never returns negative XP', () => {
    expect(dailyCheckXp('reading', 12.9)).toBe(12);
    expect(dailyCheckXp('reading', -5)).toBe(0);
    expect(dailyCheckXp('calories', Number.NaN)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Totals, corrections and targets                                     */
/* ------------------------------------------------------------------ */

function makeCheck(entries: DailyCheck['entries']): DailyCheck {
  return {
    id: 'dcheck_1',
    date: '2026-08-26',
    status: 'in-progress',
    entries,
    completedAt: null,
    expiredAt: null,
    createdAt: at,
  };
}

const entry = (over: Partial<DailyCheck['entries'][number]>): DailyCheck['entries'][number] => ({
  id: 'dce_1',
  dailyCheckId: 'dcheck_1',
  activity: 'reading',
  amount: 10,
  xpAwarded: 10,
  skillNodeId: 'nod_english-reading',
  occurredAt: at,
  ...over,
});

describe('Daily Check totals', () => {
  it('accumulates repeated submissions rather than replacing them', () => {
    const check = makeCheck([
      entry({ id: 'a', amount: 12, xpAwarded: 12 }),
      entry({ id: 'b', amount: 8, xpAwarded: 8 }),
    ]);

    const totals = dailyCheckTotals(check);
    expect(totals.reading).toBe(20);
    expect(totals.xp).toBe(20);
  });

  it('splits instrument minutes per instrument', () => {
    const check = makeCheck([
      entry({
        id: 'a',
        activity: 'instrument',
        amount: 8,
        xpAwarded: 8,
        skillNodeId: 'nod_guitar',
        instrumentName: 'Guitar',
      }),
      entry({
        id: 'b',
        activity: 'instrument',
        amount: 15,
        xpAwarded: 15,
        skillNodeId: 'nod_piano',
        instrumentName: 'Piano',
      }),
    ]);

    const totals = dailyCheckTotals(check);
    expect(totals.instrumentMinutes).toBe(23);
    expect(totals.byInstrument.nod_guitar.minutes).toBe(8);
    expect(totals.byInstrument.nod_piano.name).toBe('Piano');
  });

  it('reads only the tail of a correction chain', () => {
    const check = makeCheck([
      entry({ id: 'a', amount: 100, xpAwarded: 100, correctedByEntryId: 'b' }),
      entry({ id: 'b', amount: 10, xpAwarded: 10, correctsEntryId: 'a' }),
    ]);

    expect(effectiveEntries(check)).toHaveLength(1);
    expect(dailyCheckTotals(check).reading).toBe(10);
    // The superseded row is still on the record, which is the point.
    expect(check.entries).toHaveLength(2);
  });

  it('measures progress against the configured targets', () => {
    const targets = buildDailyTargets();
    expect(targets.readingPages).toBe(20);
    expect(targets.calories).toBe(400);
    expect(targets.instrumentMinutes).toBe(20);

    const check = makeCheck([
      entry({ id: 'a', amount: 12, xpAwarded: 12 }),
      entry({ id: 'b', activity: 'calories', amount: 340, xpAwarded: 34, skillNodeId: 'nod_cycling' }),
      entry({ id: 'c', activity: 'instrument', amount: 8, xpAwarded: 8, skillNodeId: 'nod_guitar' }),
    ]);

    const progress = dailyCheckProgress(dailyCheckTotals(check), targets);
    expect(progress.reading).toBeCloseTo(12 / 20);
    expect(progress.calories).toBeCloseTo(340 / 400);
    expect(progress.instrument).toBeCloseTo(8 / 20);
    expect(progress.allTargetsMet).toBe(false);
  });

  it('caps progress at 100% when a target is beaten', () => {
    const check = makeCheck([entry({ id: 'a', amount: 60, xpAwarded: 60 })]);
    expect(dailyCheckProgress(dailyCheckTotals(check), buildDailyTargets()).reading).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* The rotating pool                                                   */
/* ------------------------------------------------------------------ */

describe('the rotating Daily Quest pool', () => {
  it('holds exactly 19 quests, all binary and all worth 10 XP', () => {
    expect(definitions).toHaveLength(19);
    for (const definition of definitions) {
      expect(definition.characterXp).toBe(10);
      // Binary: no tracker, and no skill XP unless explicitly configured.
      expect(definition.awardsSkillXp).toBe(false);
      expect(definition.skillXp).toBe(0);
      expect(definition.linkedSkillNodeId).toBeNull();
    }
  });

  it('covers every suggested category', () => {
    const categories = new Set(definitions.map((d) => d.category));
    for (const expected of [
      'academic',
      'technical',
      'business',
      'music',
      'physical',
      'personal-care',
      'organization',
      'financial',
      'social',
    ]) {
      expect(categories.has(expected as never)).toBe(true);
    }
  });

  it('seeds no more than the pin limit', () => {
    expect(definitions.filter((d) => d.pinned).length).toBeLessThanOrEqual(MAX_PINNED);
  });
});

describe('rotation', () => {
  const base = { definitions, history: [] as DailyQuestHistory[], activeDomainIds: [] as string[] };

  it('picks exactly three quests', () => {
    expect(selectRotatingQuests({ ...base, date: '2026-08-26' })).toHaveLength(3);
  });

  it('is deterministic for a given day, so a refresh cannot reroll it', () => {
    const a = selectRotatingQuests({ ...base, date: '2026-08-26' });
    const b = selectRotatingQuests({ ...base, date: '2026-08-26' });
    expect(a).toEqual(b);
  });

  it('produces a different set on a different day', () => {
    const days = ['2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29'].map((date) =>
      selectRotatingQuests({ ...base, date }).join(','),
    );
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('never repeats a quest inside one day', () => {
    const picked = selectRotatingQuests({ ...base, date: '2026-08-26' });
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('places pinned quests first', () => {
    const pinned = definitions.filter((d) => d.pinned).map((d) => d.id);
    const picked = selectRotatingQuests({ ...base, date: '2026-08-26' });
    for (const id of pinned) expect(picked).toContain(id);
  });

  it('excludes inactive quests', () => {
    const deactivated = definitions.map((d) => ({ ...d, active: d.pinned }));
    const picked = selectRotatingQuests({ ...base, definitions: deactivated, date: '2026-08-26' });
    for (const id of picked) {
      expect(deactivated.find((d) => d.id === id)?.active).toBe(true);
    }
  });

  it('honours weekday schedules', () => {
    // 2026-08-26 is a Wednesday (weekday 3).
    expect(weekdayOf('2026-08-26')).toBe(3);

    const mondayOnly: DailyQuestDefinition = {
      ...definitions[5],
      id: 'dqd_monday-only',
      weekdays: [1],
      pinned: false,
    };
    expect(isEligibleOn(mondayOnly, '2026-08-26')).toBe(false);
    expect(isEligibleOn(mondayOnly, '2026-08-24')).toBe(true);

    const picked = selectRotatingQuests({
      ...base,
      definitions: [...definitions, mondayOnly],
      date: '2026-08-26',
    });
    expect(picked).not.toContain('dqd_monday-only');
  });

  it('steps around quests completed yesterday when alternatives exist', () => {
    const yesterdayPicks = selectRotatingQuests({ ...base, date: '2026-08-25' });
    const history: DailyQuestHistory[] = [
      {
        date: '2026-08-25',
        completed: 4,
        total: 4,
        dailyCheckCompleted: true,
        completedDefinitionIds: yesterdayPicks,
        expiredDefinitionIds: [],
        xpEarned: 30,
      },
    ];

    const unpinned = definitions.map((d) => ({ ...d, pinned: false }));
    const today = selectRotatingQuests({
      ...base,
      definitions: unpinned,
      history,
      date: '2026-08-26',
    });

    for (const id of today) expect(yesterdayPicks).not.toContain(id);
  });

  it('still fills the day when almost everything is ineligible', () => {
    const onlyTwo = definitions.map((d, i) => ({ ...d, active: i < 2, pinned: false }));
    const picked = selectRotatingQuests({ ...base, definitions: onlyTwo, date: '2026-08-26' });
    expect(picked).toHaveLength(2);
  });

  it('honours the exclude list, which is how a single slot is replaced', () => {
    const picked = selectRotatingQuests({ ...base, date: '2026-08-26' });
    const replacement = selectRotatingQuests({
      ...base,
      date: '2026-08-26',
      exclude: picked,
      slots: 1,
    });
    expect(replacement).toHaveLength(1);
    expect(picked).not.toContain(replacement[0]);
  });
});

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

describe('streaks', () => {
  const fullDay = (date: string): DailyQuestHistory => ({
    date,
    completed: 4,
    total: 4,
    dailyCheckCompleted: true,
    completedDefinitionIds: [],
    expiredDefinitionIds: [],
    xpEarned: 40,
  });

  const partialDay = (date: string): DailyQuestHistory => ({ ...fullDay(date), completed: 2 });

  it('counts consecutive complete days', () => {
    const history = ['2026-08-24', '2026-08-25', '2026-08-26'].map(fullDay);
    expect(dailyStreak(history, '2026-08-26')).toBe(3);
  });

  it('does not break on an unfinished today', () => {
    const history = [fullDay('2026-08-24'), fullDay('2026-08-25'), partialDay('2026-08-26')];
    expect(dailyStreak(history, '2026-08-26')).toBe(2);
  });

  it('stops at a missed day', () => {
    const history = [fullDay('2026-08-23'), partialDay('2026-08-24'), fullDay('2026-08-25')];
    expect(dailyStreak(history, '2026-08-26')).toBe(1);
  });

  it('is zero with no history', () => {
    expect(dailyStreak([], '2026-08-26')).toBe(0);
  });
});
