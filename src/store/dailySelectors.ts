'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  dailyCheckProgress,
  dailyCheckStatus,
  dailyCheckTotals,
  dailyDateKey,
  dailyStreak,
  formatResetCountdown,
  msUntilReset,
  recentDayKeys,
} from '@/domain/daily';
import type {
  DailyCheck,
  DailyQuestDefinition,
  DailyQuestHistory,
  DailyQuestInstance,
  DayKey,
} from '@/domain/types';

import { summariseToday } from './dailyActions';
import { useAppStore } from './useAppStore';

/**
 * The daily clock.
 *
 * Keeps the countdown honest and rolls the day over while the app is left
 * open, so a tab sitting on the Quests page at 11:59 PM picks up the new day
 * without a refresh. The roll itself is idempotent, so ticking costs nothing
 * on any tick that is not a rollover.
 */
export function useDailyClock(): { today: DayKey; countdown: string; msLeft: number } {
  const roll = useAppStore((s) => s.rollDailyDay);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    roll();

    // Fifteen seconds is well inside the one-minute resolution the countdown
    // is displayed at, and catches the 23:59 boundary promptly.
    const timer = window.setInterval(() => {
      setNow(new Date());
      roll();
    }, 15_000);

    const onFocus = () => {
      setNow(new Date());
      roll();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [roll]);

  const msLeft = msUntilReset(now);
  return { today: dailyDateKey(now), countdown: formatResetCountdown(msLeft), msLeft };
}

export interface TodayQuestCard {
  instance: DailyQuestInstance;
  definition: DailyQuestDefinition;
}

export interface TodayDaily {
  today: DayKey;
  check: DailyCheck | null;
  checkStatus: ReturnType<typeof dailyCheckStatus>;
  checkTotals: ReturnType<typeof dailyCheckTotals> | null;
  checkProgress: ReturnType<typeof dailyCheckProgress> | null;
  cards: TodayQuestCard[];
  completed: number;
  total: number;
}

/** Everything the Daily Quest group needs for today, derived on read. */
export function useTodayDaily(today: DayKey): TodayDaily {
  const instances = useAppStore((s) => s.dailyInstances);
  const definitions = useAppStore((s) => s.dailyDefinitions);
  const checks = useAppStore((s) => s.dailyChecks);
  const targets = useAppStore((s) => s.dailyTargets);

  return useMemo(() => {
    const check = checks.find((c) => c.date === today) ?? null;
    const totals = check ? dailyCheckTotals(check) : null;

    const cards = instances
      .filter((i) => i.date === today)
      .sort((a, b) => a.slot - b.slot)
      .map((instance) => ({
        instance,
        definition: definitions.find((d) => d.id === instance.definitionId),
      }))
      .filter((c): c is TodayQuestCard => Boolean(c.definition));

    const checkStatus = check ? dailyCheckStatus(check) : 'not-started';
    const completed =
      cards.filter((c) => c.instance.status === 'completed').length +
      (checkStatus === 'completed' ? 1 : 0);

    return {
      today,
      check,
      checkStatus,
      checkTotals: totals,
      checkProgress: totals ? dailyCheckProgress(totals, targets) : null,
      cards,
      completed,
      // Slot 1 is the Daily Check, so a normal day totals four.
      total: cards.length + (check ? 1 : 0),
    };
  }, [instances, definitions, checks, targets, today]);
}

/** Consecutive fully-completed days, today included once it is finished. */
export function useDailyStreak(today: DayKey): number {
  const history = useAppStore((s) => s.dailyHistory);
  const slice = useDailySlice();

  return useMemo(() => {
    // History only holds closed days, so today is folded in live.
    const withToday = [...history.filter((h) => h.date !== today), summariseToday(slice, today)];
    return dailyStreak(withToday, today);
  }, [history, slice, today]);
}

/** The last seven days, oldest first, for the completion strip. */
export function useSevenDayHistory(today: DayKey): Array<{ date: DayKey; record: DailyQuestHistory }> {
  const history = useAppStore((s) => s.dailyHistory);
  const slice = useDailySlice();

  return useMemo(() => {
    const byDate = new Map(history.map((h) => [h.date, h]));
    byDate.set(today, summariseToday(slice, today));

    return recentDayKeys(today, 7).map((date) => ({
      date,
      record:
        byDate.get(date) ?? {
          date,
          completed: 0,
          total: 0,
          dailyCheckCompleted: false,
          completedDefinitionIds: [],
          expiredDefinitionIds: [],
          xpEarned: 0,
        },
    }));
  }, [history, slice, today]);
}

/** The raw slice, for the pure helpers that expect it. */
function useDailySlice() {
  const dailyDefinitions = useAppStore((s) => s.dailyDefinitions);
  const dailyInstances = useAppStore((s) => s.dailyInstances);
  const dailySelections = useAppStore((s) => s.dailySelections);
  const dailyChecks = useAppStore((s) => s.dailyChecks);
  const dailyTargets = useAppStore((s) => s.dailyTargets);
  const dailyHistory = useAppStore((s) => s.dailyHistory);
  const dailyActiveDate = useAppStore((s) => s.dailyActiveDate);

  return useMemo(
    () => ({
      dailyDefinitions,
      dailyInstances,
      dailySelections,
      dailyChecks,
      dailyTargets,
      dailyHistory,
      dailyActiveDate,
    }),
    [
      dailyDefinitions,
      dailyInstances,
      dailySelections,
      dailyChecks,
      dailyTargets,
      dailyHistory,
      dailyActiveDate,
    ],
  );
}

/** Instruments available to the Daily Check: every node under Performance. */
export function useInstruments() {
  const nodes = useAppStore((s) => s.nodes);
  return useMemo(
    () =>
      nodes
        .filter((n) => !n.archived && n.branchId === 'brn_instrumental-practice')
        .sort((a, b) => a.order - b.order),
    [nodes],
  );
}

/**
 * Nodes the reading tracker can feed: language and knowledge branches, which
 * is where pages read actually belong.
 */
export function useReadingNodes() {
  const nodes = useAppStore((s) => s.nodes);
  const branches = useAppStore((s) => s.branches);

  return useMemo(() => {
    const preferred = new Set([
      'dom_languages-communication',
      'dom_computer-science',
      'dom_business-administration',
      'dom_music',
    ]);
    const branchToDomain = new Map(branches.map((b) => [b.id, b.domainId]));

    return nodes
      .filter((n) => !n.archived)
      .sort((a, b) => {
        const aPreferred = preferred.has(branchToDomain.get(a.branchId) ?? '') ? 0 : 1;
        const bPreferred = preferred.has(branchToDomain.get(b.branchId) ?? '') ? 0 : 1;
        return aPreferred - bPreferred || a.name.localeCompare(b.name);
      });
  }, [nodes, branches]);
}

/** Nodes the calories tracker can feed: Physical Development only. */
export function usePhysicalNodes() {
  const nodes = useAppStore((s) => s.nodes);
  const branches = useAppStore((s) => s.branches);

  return useMemo(() => {
    const physicalBranches = new Set(
      branches.filter((b) => b.domainId === 'dom_physical-development').map((b) => b.id),
    );
    const physical = nodes.filter((n) => !n.archived && physicalBranches.has(n.branchId));
    // Never present an empty picker if the domain has been archived away.
    return physical.length > 0 ? physical : nodes.filter((n) => !n.archived);
  }, [nodes, branches]);
}
