'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { guardActions } from '@/cloud/access';
import { appDataSchema } from '@/cloud/schema';

import { computeActivityXp } from '@/domain/activities';
import { dailyCheckXp, dailyDateKey } from '@/domain/daily';
import { newId, nowIso } from '@/domain/ids';
import { splitQuestXp } from '@/domain/quests';
import { buildEmptyBundle, buildSampleBundle, type SeedBundle } from '@/domain/seed';
import { buildDailyQuestDefinitions, buildDailyTargets } from '@/domain/seed/dailyQuests';
import type {
  Ability,
  AbilityEvidence,
  DailyCheck,
  DailyQuestDefinition,
  DailyQuestHistory,
  DailyQuestInstance,
  DailyQuestSelection,
  DailyTarget,
  DayKey,
  ActivityLog,
  ActivityTemplate,
  CharacterProfile,
  FinancialSnapshot,
  Id,
  InventoryItem,
  InventoryLocation,
  Quest,
  QuestObjective,
  SkillBranch,
  SkillDomain,
  SkillNode,
  XpTransaction,
  AbilityPath,
} from '@/domain/types';

import * as daily from './dailyActions';
import type { AddEntryInput, DailyContext, DailySlice } from './dailyActions';
import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  createPersistenceAdapter,
  runMigrations,
} from './persistence';

/* ------------------------------------------------------------------ */
/* State shape                                                         */
/* ------------------------------------------------------------------ */

export interface AppData {
  profile: CharacterProfile;
  domains: SkillDomain[];
  branches: SkillBranch[];
  nodes: SkillNode[];
  templates: ActivityTemplate[];
  activityLogs: ActivityLog[];
  quests: Quest[];
  paths: AbilityPath[];
  abilities: Ability[];
  locations: InventoryLocation[];
  items: InventoryItem[];
  finances: FinancialSnapshot;
  transactions: XpTransaction[];

  /* Daily Quests. Definitions are the reusable rules; instances are one
     particular day's copy of them. See store/dailyActions.ts. */
  dailyDefinitions: DailyQuestDefinition[];
  dailyInstances: DailyQuestInstance[];
  dailySelections: DailyQuestSelection[];
  dailyChecks: DailyCheck[];
  dailyTargets: DailyTarget;
  dailyHistory: DailyQuestHistory[];
  dailyActiveDate: DayKey | null;
}

export interface AppState extends AppData {
  /** False until the user picks sample or empty on first launch. */
  initialized: boolean;
  /** Per-card money masking on the Inventory page. */
  hiddenFinancials: { cash: boolean; bank: boolean; total: boolean };

  /* lifecycle */
  startWithSampleData: () => void;
  startEmpty: () => void;
  resetAll: () => void;
  exportData: () => string;
  importData: (json: string) => { ok: true } | { ok: false; error: string };

  /* character */
  updateProfile: (patch: Partial<CharacterProfile>) => void;

  /* quests */
  createQuest: (quest: Omit<Quest, BaseFields>) => Id;
  updateQuest: (id: Id, patch: Partial<Quest>) => void;
  deleteQuest: (id: Id) => void;
  archiveQuest: (id: Id) => void;
  duplicateQuest: (id: Id) => Id | null;
  toggleObjective: (questId: Id, objectiveId: Id) => void;
  moveObjective: (questId: Id, objectiveId: Id, direction: -1 | 1) => void;
  completeQuest: (id: Id) => void;
  failQuest: (id: Id) => void;
  reopenQuest: (id: Id) => void;

  /* skills */
  addDomain: (input: { name: string; icon: string }) => Id;
  updateDomain: (id: Id, patch: Partial<SkillDomain>) => void;
  archiveDomain: (id: Id) => void;
  moveDomain: (id: Id, direction: -1 | 1) => void;
  addBranch: (domainId: Id, input: { name: string; icon: string }) => Id;
  updateBranch: (id: Id, patch: Partial<SkillBranch>) => void;
  archiveBranch: (id: Id) => void;
  moveBranch: (id: Id, direction: -1 | 1) => void;
  addNode: (branchId: Id, input: { name: string; icon: string; parentIds: Id[] }) => Id;
  updateNode: (id: Id, patch: Partial<SkillNode>) => void;
  archiveNode: (id: Id) => void;
  moveNode: (id: Id, direction: -1 | 1) => void;
  toggleNodeFocus: (id: Id) => void;

  /* activities */
  logActivity: (input: {
    templateId: Id;
    skillNodeId: Id;
    amount: number;
    chosenXp?: number;
    occurredAt?: string;
    note?: string;
    finished: boolean;
  }) => { ok: true; xp: number } | { ok: false; error: string };
  reverseActivityLog: (logId: Id, reason?: string) => void;
  saveTemplate: (template: ActivityTemplate) => void;
  archiveTemplate: (id: Id) => void;

  /* abilities */
  attachEvidence: (abilityId: Id, evidence: Omit<AbilityEvidence, 'id' | 'createdAt'>) => void;
  removeEvidence: (abilityId: Id, evidenceId: Id) => void;
  startProofQuest: (abilityId: Id) => Id | null;
  setAbilityPromotion: (abilityId: Id, promotion: 'advanced' | 'mastered' | null) => void;

  /* inventory */
  setFinances: (patch: Partial<Pick<FinancialSnapshot, 'cash' | 'bank' | 'currency'>>) => void;
  toggleFinancialPrivacy: (card: 'cash' | 'bank' | 'total') => void;
  setAllFinancialPrivacy: (hidden: boolean) => void;
  addItem: (input: Partial<InventoryItem> & { name: string; locationId: Id }) => Id;
  updateItem: (id: Id, patch: Partial<InventoryItem>) => void;
  moveItem: (id: Id, locationId: Id) => void;
  toggleCarried: (id: Id) => void;
  archiveItem: (id: Id) => void;
  addLocation: (input: { name: string; icon: string }) => Id;

  /* daily quests */
  rollDailyDay: () => void;
  completeDailyQuest: (instanceId: Id) => void;
  reopenDailyQuest: (instanceId: Id) => void;
  replaceDailyQuest: (
    instanceId: Id,
    definitionId?: Id,
  ) => { ok: true } | { ok: false; error: string };
  addDailyCheckEntry: (input: AddEntryInput) => { ok: true; xp: number } | { ok: false; error: string };
  correctDailyCheckEntry: (
    entryId: Id,
    newAmount: number,
  ) => { ok: true } | { ok: false; error: string };
  completeDailyCheck: () => { ok: true } | { ok: false; error: string };
  reopenDailyCheck: () => void;
  setDailyQuestPinned: (
    definitionId: Id,
    pinned: boolean,
  ) => { ok: true } | { ok: false; error: string };
  updateDailyQuestDefinition: (definitionId: Id, patch: Partial<DailyQuestDefinition>) => void;
  setDailyTargets: (patch: Partial<DailyTarget>) => void;
  addInstrument: (name: string) => Id | null;
}

type BaseFields = 'id' | 'createdAt' | 'updatedAt';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function bundleToData(bundle: SeedBundle): AppData {
  return {
    profile: bundle.profile,
    domains: bundle.domains,
    branches: bundle.branches,
    nodes: bundle.nodes,
    templates: bundle.templates,
    activityLogs: bundle.activityLogs,
    quests: bundle.quests,
    paths: bundle.paths,
    abilities: bundle.abilities,
    locations: bundle.locations,
    items: bundle.items,
    finances: bundle.finances,
    transactions: bundle.transactions,
    dailyDefinitions: bundle.dailyDefinitions,
    dailyInstances: [],
    dailySelections: [],
    dailyChecks: [],
    dailyTargets: bundle.dailyTargets,
    dailyHistory: [],
    dailyActiveDate: null,
  };
}

/** Reads the daily slice out of the full state, for the pure reducers. */
function sliceOf(s: AppState): DailySlice {
  return {
    dailyDefinitions: s.dailyDefinitions,
    dailyInstances: s.dailyInstances,
    dailySelections: s.dailySelections,
    dailyChecks: s.dailyChecks,
    dailyTargets: s.dailyTargets,
    dailyHistory: s.dailyHistory,
    dailyActiveDate: s.dailyActiveDate,
  };
}

/**
 * The rotation prefers quests tied to a domain that is actually moving, so it
 * needs to know which domains those are.
 */
function contextOf(s: AppState): DailyContext {
  const branchToDomain = new Map(s.branches.map((b) => [b.id, b.domainId]));
  const active = new Set<Id>();

  for (const tx of s.transactions) {
    if (!tx.skillNodeId) continue;
    const node = s.nodes.find((n) => n.id === tx.skillNodeId);
    const domainId = node ? branchToDomain.get(node.branchId) : undefined;
    if (domainId) active.add(domainId);
  }

  // A fresh character has no ledger yet; fall back to every live domain so the
  // preference rule simply has no opinion rather than excluding everything.
  if (active.size === 0) {
    for (const d of s.domains) if (!d.archived) active.add(d.id);
  }

  return { transactions: s.transactions, activeDomainIds: [...active] };
}

/** Applies a reducer result, ignoring an error shape. */
function applied(patch: unknown): Partial<AppState> {
  if (!patch || typeof patch !== 'object' || 'error' in (patch as object)) return {};
  return patch as Partial<AppState>;
}

function reorder<T extends { id: Id; order: number }>(
  list: T[],
  id: Id,
  direction: -1 | 1,
  scope: (item: T) => boolean = () => true,
): T[] {
  const siblings = list.filter(scope).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((s) => s.id === id);
  if (index === -1) return list;
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return list;

  const a = siblings[index];
  const b = siblings[target];
  return list.map((item) => {
    if (item.id === a.id) return { ...item, order: b.order, updatedAt: nowIso() };
    if (item.id === b.id) return { ...item, order: a.order, updatedAt: nowIso() };
    return item;
  });
}

const EMPTY_PRIVACY = { cash: false, bank: false, total: false };

/** Music > Performance. Instruments added at runtime land here. */
const PERFORMANCE_BRANCH_ID = 'brn_instrumental-practice';

function dailyCheckXpFor(input: AddEntryInput): number {
  return dailyCheckXp(input.activity, Math.floor(input.amount));
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const initialData = bundleToData(buildEmptyBundle(nowIso()));

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => guardActions({
      ...initialData,
      initialized: false,
      hiddenFinancials: EMPTY_PRIVACY,

      /* ---------------- lifecycle ---------------- */

      startWithSampleData: () =>
        set({ ...bundleToData(buildSampleBundle(nowIso())), initialized: true }),

      startEmpty: () => set({ ...bundleToData(buildEmptyBundle(nowIso())), initialized: true }),

      resetAll: () =>
        set({
          ...bundleToData(buildEmptyBundle(nowIso())),
          initialized: false,
          hiddenFinancials: EMPTY_PRIVACY,
        }),

      exportData: () => {
        const s = get();
        const payload = {
          schemaVersion: SCHEMA_VERSION,
          exportedAt: nowIso(),
          data: {
            profile: s.profile,
            domains: s.domains,
            branches: s.branches,
            nodes: s.nodes,
            templates: s.templates,
            activityLogs: s.activityLogs,
            quests: s.quests,
            paths: s.paths,
            abilities: s.abilities,
            locations: s.locations,
            items: s.items,
            finances: s.finances,
            transactions: s.transactions,
            dailyDefinitions: s.dailyDefinitions,
            dailyInstances: s.dailyInstances,
            dailySelections: s.dailySelections,
            dailyChecks: s.dailyChecks,
            dailyTargets: s.dailyTargets,
            dailyHistory: s.dailyHistory,
            dailyActiveDate: s.dailyActiveDate,
          },
        };
        return JSON.stringify(payload, null, 2);
      },

      importData: (json) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          return { ok: false, error: 'That file is not valid JSON.' };
        }

        const envelope = parsed as { schemaVersion?: number; data?: Partial<AppData> };
        if (!envelope || typeof envelope !== 'object' || !envelope.data) {
          return { ok: false, error: 'No data block found. Expected a file exported from this app.' };
        }

        const version = typeof envelope.schemaVersion === 'number' ? envelope.schemaVersion : 1;
        if (version > SCHEMA_VERSION) {
          return {
            ok: false,
            error: `That file was written by a newer version (schema ${version}). Update the app first.`,
          };
        }

        const migrated = runMigrations(envelope.data, version) as Partial<AppData>;

        const required: Array<keyof AppData> = ['profile', 'domains', 'branches', 'nodes', 'transactions'];
        const missing = required.filter((key) => migrated[key] === undefined);
        if (missing.length > 0) {
          return { ok: false, error: `Import is missing: ${missing.join(', ')}.` };
        }

        const fallback = bundleToData(buildEmptyBundle(nowIso()));
        const validated = appDataSchema.safeParse({ ...fallback, ...migrated });
        if (!validated.success) {
          const issue = validated.error.issues[0];
          return { ok: false, error: `Invalid save at ${issue.path.join('.')}: ${issue.message}. Nothing was replaced.` };
        }
        set({
          ...validated.data,
          initialized: true,
        });
        return { ok: true };
      },

      /* ---------------- character ---------------- */

      updateProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch, updatedAt: nowIso() } })),

      /* ---------------- quests ---------------- */

      createQuest: (quest) => {
        const id = newId('qst');
        const at = nowIso();
        set((s) => ({
          quests: [...s.quests, { ...quest, id, createdAt: at, updatedAt: at } as Quest],
        }));
        return id;
      },

      updateQuest: (id, patch) =>
        set((s) => ({
          quests: s.quests.map((q) => (q.id === id ? { ...q, ...patch, updatedAt: nowIso() } : q)),
        })),

      deleteQuest: (id) =>
        set((s) => ({
          quests: s.quests.filter((q) => q.id !== id),
          // The ledger is append-only: XP a deleted quest paid out is history
          // and stays. Only the quest record itself goes.
          abilities: s.abilities.map((a) =>
            a.proofQuestId === id ? { ...a, proofQuestId: null, updatedAt: nowIso() } : a,
          ),
        })),

      archiveQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id ? { ...q, status: 'archived', updatedAt: nowIso() } : q,
          ),
        })),

      duplicateQuest: (id) => {
        const source = get().quests.find((q) => q.id === id);
        if (!source) return null;

        const newQuestId = newId('qst');
        const at = nowIso();
        const copy: Quest = {
          ...source,
          id: newQuestId,
          title: `${source.title} (copy)`,
          status: 'planned',
          objectives: source.objectives.map((o) => ({
            ...o,
            id: newId('obj'),
            done: false,
          })),
          rewards: source.rewards.map((r) => ({ ...r, id: newId('rwd') })),
          attachments: source.attachments.map((a) => ({ ...a, id: newId('att') })),
          completedAt: null,
          failedAt: null,
          // A duplicate has never been paid out, whatever the original did.
          xpAwardedAt: null,
          abilityId: null,
          createdAt: at,
          updatedAt: at,
        };

        set((s) => ({ quests: [...s.quests, copy] }));
        return newQuestId;
      },

      toggleObjective: (questId, objectiveId) =>
        set((s) => ({
          quests: s.quests.map((q) => {
            if (q.id !== questId) return q;
            const objectives = q.objectives.map((o) =>
              o.id === objectiveId ? { ...o, done: !o.done } : o,
            );
            // Ticking the first objective on a planned quest starts it.
            const started = q.status === 'planned' && objectives.some((o) => o.done);
            return {
              ...q,
              objectives,
              status: started ? ('active' as const) : q.status,
              updatedAt: nowIso(),
            };
          }),
        })),

      moveObjective: (questId, objectiveId, direction) =>
        set((s) => ({
          quests: s.quests.map((q) => {
            if (q.id !== questId) return q;
            const sorted = [...q.objectives].sort((a, b) => a.order - b.order);
            const index = sorted.findIndex((o) => o.id === objectiveId);
            const target = index + direction;
            if (index === -1 || target < 0 || target >= sorted.length) return q;
            const next = [...sorted];
            const [moved] = next.splice(index, 1);
            next.splice(target, 0, moved);
            return {
              ...q,
              objectives: next.map((o, i): QuestObjective => ({ ...o, order: i })),
              updatedAt: nowIso(),
            };
          }),
        })),

      /**
       * Completing a quest: award XP once, distribute the configured skill XP
       * out of that same total, mint any reward objects, and stamp
       * xpAwardedAt so a re-open + re-complete can never pay twice.
       */
      completeQuest: (id) =>
        set((s) => {
          const quest = s.quests.find((q) => q.id === id);
          if (!quest) return {};

          const at = nowIso();
          const alreadyPaid = quest.xpAwardedAt !== null;

          const updatedQuest: Quest = {
            ...quest,
            status: 'completed',
            completedAt: at,
            failedAt: null,
            objectives: quest.objectives.map((o) => ({ ...o, done: true })),
            xpAwardedAt: quest.xpAwardedAt ?? at,
            updatedAt: at,
          };

          const quests = s.quests.map((q) => (q.id === id ? updatedQuest : q));

          if (alreadyPaid) return { quests };

          const split = splitQuestXp(quest);
          const transactions: XpTransaction[] = [...s.transactions];

          for (const allocation of split.allocations) {
            transactions.push({
              id: newId('xtx'),
              createdAt: at,
              sourceType: 'quest',
              sourceId: quest.id,
              skillNodeId: allocation.skillNodeId,
              amount: allocation.xp,
              note: quest.title,
            });
          }

          if (split.unallocated > 0) {
            transactions.push({
              id: newId('xtx'),
              createdAt: at,
              sourceType: 'quest',
              sourceId: quest.id,
              skillNodeId: null,
              amount: split.unallocated,
              note: `${quest.title} (unallocated)`,
            });
          }

          // Reward objects become real inventory items.
          const newItems: InventoryItem[] = [];
          const defaultLocation = s.locations.find((l) => !l.virtual);
          for (const reward of quest.rewards) {
            if (reward.kind !== 'inventory-item') continue;
            newItems.push({
              id: newId('itm'),
              name: reward.label,
              category: reward.itemCategory ?? 'Quest reward',
              locationId: reward.itemLocationId ?? defaultLocation?.id ?? '',
              carried: false,
              condition: 'new',
              estimatedValue: reward.itemEstimatedValue ?? 0,
              purchaseDate: null,
              lastCheckedAt: at,
              notes: `Awarded by "${quest.title}".`,
              image: 'generic',
              archived: false,
              createdAt: at,
              updatedAt: at,
            });
          }

          return {
            quests,
            transactions,
            items: newItems.length > 0 ? [...s.items, ...newItems] : s.items,
          };
        }),

      /**
       * Failing a quest ends the run, not the progress. No XP is removed and
       * no transaction is written - lifetime XP and level are untouchable.
       */
      failQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id
              ? { ...q, status: 'failed', failedAt: nowIso(), updatedAt: nowIso() }
              : q,
          ),
        })),

      reopenQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id
              ? { ...q, status: 'active', completedAt: null, failedAt: null, updatedAt: nowIso() }
              : q,
          ),
        })),

      /* ---------------- skills ---------------- */

      addDomain: ({ name, icon }) => {
        const id = newId('dom');
        const at = nowIso();
        set((s) => ({
          domains: [
            ...s.domains,
            {
              id,
              name,
              icon,
              order: s.domains.length,
              archived: false,
              attributeWeights: { knowledge: 0.5 },
              createdAt: at,
              updatedAt: at,
            },
          ],
        }));
        return id;
      },

      updateDomain: (id, patch) =>
        set((s) => ({
          domains: s.domains.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d)),
        })),

      archiveDomain: (id) =>
        set((s) => ({
          domains: s.domains.map((d) => (d.id === id ? { ...d, archived: true, updatedAt: nowIso() } : d)),
        })),

      moveDomain: (id, direction) => set((s) => ({ domains: reorder(s.domains, id, direction) })),

      addBranch: (domainId, { name, icon }) => {
        const id = newId('brn');
        const at = nowIso();
        set((s) => ({
          branches: [
            ...s.branches,
            {
              id,
              domainId,
              name,
              icon,
              order: s.branches.filter((b) => b.domainId === domainId).length,
              archived: false,
              createdAt: at,
              updatedAt: at,
            },
          ],
        }));
        return id;
      },

      updateBranch: (id, patch) =>
        set((s) => ({
          branches: s.branches.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: nowIso() } : b)),
        })),

      archiveBranch: (id) =>
        set((s) => ({
          branches: s.branches.map((b) => (b.id === id ? { ...b, archived: true, updatedAt: nowIso() } : b)),
        })),

      moveBranch: (id, direction) =>
        set((s) => {
          const branch = s.branches.find((b) => b.id === id);
          if (!branch) return {};
          return {
            branches: reorder(s.branches, id, direction, (b) => b.domainId === branch.domainId),
          };
        }),

      addNode: (branchId, { name, icon, parentIds }) => {
        const id = newId('nod');
        const at = nowIso();
        set((s) => ({
          nodes: [
            ...s.nodes,
            {
              id,
              branchId,
              name,
              icon,
              order: s.nodes.filter((n) => n.branchId === branchId).length,
              archived: false,
              parentIds,
              seedXp: 0,
              focus: false,
              evidence: [],
              createdAt: at,
              updatedAt: at,
            },
          ],
        }));
        return id;
      },

      updateNode: (id, patch) =>
        set((s) => ({
          nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n)),
        })),

      archiveNode: (id) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id
              ? { ...n, archived: true, focus: false, updatedAt: nowIso() }
              : // Drop the archived node from any child's parent list so the
                // tree never draws an edge to something that is gone.
                { ...n, parentIds: n.parentIds.filter((p) => p !== id) },
          ),
        })),

      moveNode: (id, direction) =>
        set((s) => {
          const node = s.nodes.find((n) => n.id === id);
          if (!node) return {};
          return { nodes: reorder(s.nodes, id, direction, (n) => n.branchId === node.branchId) };
        }),

      toggleNodeFocus: (id) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id ? { ...n, focus: !n.focus, updatedAt: nowIso() } : n,
          ),
        })),

      /* ---------------- activities ---------------- */

      logActivity: ({ templateId, skillNodeId, amount, chosenXp, occurredAt, note, finished }) => {
        const state = get();
        const template = state.templates.find((t) => t.id === templateId);
        if (!template) return { ok: false, error: 'That activity rule no longer exists.' };
        if (!state.nodes.some((n) => n.id === skillNodeId)) {
          return { ok: false, error: 'Choose a skill node to receive the XP.' };
        }
        if (template.requiresFinished && !finished) {
          return { ok: false, error: 'Unfinished work earns no XP. Mark the piece finished first.' };
        }

        const xp = computeActivityXp(template.formula, amount, chosenXp);
        if (xp <= 0) {
          return { ok: false, error: 'That amount does not reach a full XP block yet.' };
        }

        const at = occurredAt ?? nowIso();
        const created = nowIso();
        const logId = newId('alg');

        const log: ActivityLog = {
          id: logId,
          templateId,
          skillNodeId,
          amount,
          xpAwarded: xp,
          occurredAt: at,
          note,
          reversedAt: null,
          createdAt: created,
          updatedAt: created,
        };

        // One transaction. The node gets `xp`, the character gets the same
        // `xp` from the same record - never twice, never multiplied.
        const tx: XpTransaction = {
          id: newId('xtx'),
          createdAt: at,
          sourceType: 'activity',
          sourceId: logId,
          skillNodeId,
          amount: xp,
          note: note ?? template.name,
        };

        set((s) => ({
          activityLogs: [...s.activityLogs, log],
          transactions: [...s.transactions, tx],
          profile: { ...s.profile, lastActivityDate: at, updatedAt: created },
        }));

        return { ok: true, xp };
      },

      /**
       * Reversal writes a compensating negative transaction rather than
       * deleting the original. History stays readable and auditable.
       */
      reverseActivityLog: (logId, reason) =>
        set((s) => {
          const log = s.activityLogs.find((l) => l.id === logId);
          if (!log || log.reversedAt) return {};

          const original = s.transactions.find(
            (t) => t.sourceType === 'activity' && t.sourceId === logId,
          );
          if (!original) return {};

          const at = nowIso();
          return {
            activityLogs: s.activityLogs.map((l) =>
              l.id === logId ? { ...l, reversedAt: at, updatedAt: at } : l,
            ),
            transactions: [
              ...s.transactions,
              {
                id: newId('xtx'),
                createdAt: at,
                sourceType: 'reversal',
                sourceId: logId,
                skillNodeId: original.skillNodeId,
                amount: -original.amount,
                note: reason ?? `Reversal of ${original.note ?? 'a logged activity'}`,
                reversesTxId: original.id,
              },
            ],
          };
        }),

      saveTemplate: (template) =>
        set((s) => ({
          templates: s.templates.some((t) => t.id === template.id)
            ? s.templates.map((t) =>
                t.id === template.id ? { ...template, updatedAt: nowIso() } : t,
              )
            : [...s.templates, template],
        })),

      archiveTemplate: (id) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, archived: true, updatedAt: nowIso() } : t,
          ),
        })),

      /* ---------------- abilities ---------------- */

      attachEvidence: (abilityId, evidence) =>
        set((s) => ({
          abilities: s.abilities.map((a) =>
            a.id === abilityId
              ? {
                  ...a,
                  evidence: [
                    ...a.evidence,
                    { ...evidence, id: newId('evd'), createdAt: nowIso() },
                  ],
                  updatedAt: nowIso(),
                }
              : a,
          ),
        })),

      removeEvidence: (abilityId, evidenceId) =>
        set((s) => ({
          abilities: s.abilities.map((a) =>
            a.id === abilityId
              ? {
                  ...a,
                  evidence: a.evidence.filter((e) => e.id !== evidenceId),
                  updatedAt: nowIso(),
                }
              : a,
          ),
        })),

      /** Mints a quest from the ability definition and links the two. */
      startProofQuest: (abilityId) => {
        const state = get();
        const ability = state.abilities.find((a) => a.id === abilityId);
        if (!ability) return null;

        const existing = ability.proofQuestId
          ? state.quests.find((q) => q.id === ability.proofQuestId)
          : undefined;
        if (existing && existing.status !== 'archived') return existing.id;

        const path = state.paths.find((p) => p.id === ability.pathId);
        const at = nowIso();
        const questId = newId('qst');

        const quest: Quest = {
          id: questId,
          title: ability.proofDescription,
          description: `Proof quest for the ${ability.name} ability. ${ability.description}`,
          type: 'main',
          category: path?.name ?? 'Abilities',
          status: 'active',
          objectives: [
            { id: newId('obj'), label: 'Plan the work', done: false, order: 0 },
            { id: newId('obj'), label: ability.proofDescription, done: false, order: 1 },
            { id: newId('obj'), label: 'Capture the evidence', done: false, order: 2 },
          ],
          skillAllocations: [],
          deadline: null,
          difficulty: 'hard',
          priority: 'high',
          recurrence: 'none',
          characterXp: 150,
          rewards: [{ id: newId('rwd'), kind: 'unlock-hint', label: `Unlocks ${ability.name}` }],
          notes: '',
          attachments: [],
          completedAt: null,
          failedAt: null,
          xpAwardedAt: null,
          abilityId,
          createdAt: at,
          updatedAt: at,
        };

        set((s) => ({
          quests: [...s.quests, quest],
          abilities: s.abilities.map((a) =>
            a.id === abilityId ? { ...a, proofQuestId: questId, updatedAt: at } : a,
          ),
        }));

        return questId;
      },

      setAbilityPromotion: (abilityId, promotion) =>
        set((s) => ({
          abilities: s.abilities.map((a) =>
            a.id === abilityId ? { ...a, manualPromotion: promotion, updatedAt: nowIso() } : a,
          ),
        })),

      /* ---------------- inventory ---------------- */

      setFinances: (patch) =>
        set((s) => ({ finances: { ...s.finances, ...patch, updatedAt: nowIso() } })),

      toggleFinancialPrivacy: (card) =>
        set((s) => ({
          hiddenFinancials: { ...s.hiddenFinancials, [card]: !s.hiddenFinancials[card] },
        })),

      setAllFinancialPrivacy: (hidden) =>
        set({ hiddenFinancials: { cash: hidden, bank: hidden, total: hidden } }),

      addItem: (input) => {
        const id = newId('itm');
        const at = nowIso();
        set((s) => ({
          items: [
            ...s.items,
            {
              category: 'Everyday',
              carried: false,
              condition: 'good',
              estimatedValue: 0,
              purchaseDate: null,
              lastCheckedAt: at,
              image: 'generic',
              archived: false,
              ...input,
              id,
              createdAt: at,
              updatedAt: at,
            } as InventoryItem,
          ],
        }));
        return id;
      },

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: nowIso() } : i)),
        })),

      moveItem: (id, locationId) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, locationId, updatedAt: nowIso() } : i,
          ),
        })),

      toggleCarried: (id) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, carried: !i.carried, updatedAt: nowIso() } : i,
          ),
        })),

      archiveItem: (id) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, archived: true, carried: false, updatedAt: nowIso() } : i,
          ),
        })),

      addLocation: ({ name, icon }) => {
        const id = newId('loc');
        const at = nowIso();
        set((s) => ({
          locations: [
            ...s.locations,
            { id, name, icon, order: s.locations.length, virtual: false, createdAt: at, updatedAt: at },
          ],
        }));
        return id;
      },

      /* ---------------- daily quests ---------------- */

      /**
       * Brings the day up to date: expires anything left open, files closed
       * days into history, and rolls today if it has not been rolled yet.
       * Idempotent, so the UI can call it on mount, on focus and on a timer.
       */
      rollDailyDay: () =>
        set((s) => applied(daily.rollDailyDay(sliceOf(s), contextOf(s), dailyDateKey()))),

      completeDailyQuest: (instanceId) =>
        set((s) => applied(daily.completeDailyQuest(sliceOf(s), s.transactions, instanceId))),

      reopenDailyQuest: (instanceId) =>
        set((s) => applied(daily.reopenDailyQuest(sliceOf(s), instanceId))),

      replaceDailyQuest: (instanceId, definitionId) => {
        const state = get();
        const result = daily.replaceDailyQuest(
          sliceOf(state),
          contextOf(state),
          instanceId,
          dailyDateKey(),
          definitionId,
        );
        if ('error' in result) return { ok: false, error: result.error };
        set(applied(result));
        return { ok: true };
      },

      addDailyCheckEntry: (input) => {
        const state = get();
        const result = daily.addDailyCheckEntry(
          sliceOf(state),
          state.transactions,
          dailyDateKey(),
          input,
        );
        if ('error' in result) return { ok: false, error: result.error };

        set(applied(result));
        return { ok: true, xp: dailyCheckXpFor(input) };
      },

      correctDailyCheckEntry: (entryId, newAmount) => {
        const state = get();
        const result = daily.correctDailyCheckEntry(
          sliceOf(state),
          state.transactions,
          entryId,
          newAmount,
        );
        if ('error' in result) return { ok: false, error: result.error };
        set(applied(result));
        return { ok: true };
      },

      completeDailyCheck: () => {
        const state = get();
        const result = daily.completeDailyCheck(sliceOf(state), dailyDateKey());
        if ('error' in result) return { ok: false, error: result.error };
        set(applied(result));
        return { ok: true };
      },

      reopenDailyCheck: () =>
        set((s) => applied(daily.reopenDailyCheck(sliceOf(s), dailyDateKey()))),

      setDailyQuestPinned: (definitionId, pinned) => {
        const state = get();
        const result = daily.setDefinitionPinned(sliceOf(state), definitionId, pinned);
        if ('error' in result) return { ok: false, error: result.error };
        set(applied(result));
        return { ok: true };
      },

      updateDailyQuestDefinition: (definitionId, patch) =>
        set((s) => applied(daily.updateDefinition(sliceOf(s), definitionId, patch))),

      setDailyTargets: (patch) =>
        set((s) => applied(daily.setDailyTargets(sliceOf(s), patch))),

      /**
       * Adds an instrument as a real skill node under Music > Performance, so
       * practice minutes route somewhere that already levels and shows up on
       * the Skills page like any other node.
       */
      addInstrument: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return null;

        const state = get();
        const branch = state.branches.find((b) => b.id === PERFORMANCE_BRANCH_ID);
        if (!branch) return null;

        const existing = state.nodes.find(
          (n) => n.branchId === branch.id && n.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) return existing.id;

        return get().addNode(branch.id, { name: trimmed, icon: 'music', parentIds: [] });
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => createPersistenceAdapter()),
      migrate: (persisted, from) => runMigrations(persisted, from) as AppState,
      /**
       * A save written before the Daily Quest system has no definitions and no
       * targets. Seed those in on load rather than in the migration, so the
       * catalogue also self-heals if a definition is ever added in a later
       * release.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        const at = nowIso();

        const seededDefinitions = buildDailyQuestDefinitions(at);
        const savedDefinitions = saved.dailyDefinitions ?? [];
        const savedIds = new Set(savedDefinitions.map((d) => d.id));
        const missing = seededDefinitions.filter((d) => !savedIds.has(d.id));

        return {
          ...current,
          ...saved,
          dailyDefinitions:
            savedDefinitions.length === 0
              ? seededDefinitions
              : [...savedDefinitions, ...missing],
          dailyTargets: saved.dailyTargets ?? buildDailyTargets(),
          dailyInstances: saved.dailyInstances ?? [],
          dailySelections: saved.dailySelections ?? [],
          dailyChecks: saved.dailyChecks ?? [],
          dailyHistory: saved.dailyHistory ?? [],
          dailyActiveDate: saved.dailyActiveDate ?? null,
        } as AppState;
      },
      // Actions are recreated on every load; only data is written to storage.
      partialize: (s) => ({
        initialized: s.initialized,
        hiddenFinancials: s.hiddenFinancials,
        profile: s.profile,
        domains: s.domains,
        branches: s.branches,
        nodes: s.nodes,
        templates: s.templates,
        activityLogs: s.activityLogs,
        quests: s.quests,
        paths: s.paths,
        abilities: s.abilities,
        locations: s.locations,
        items: s.items,
        finances: s.finances,
        transactions: s.transactions,
        dailyDefinitions: s.dailyDefinitions,
        dailyInstances: s.dailyInstances,
        dailySelections: s.dailySelections,
        dailyChecks: s.dailyChecks,
        dailyTargets: s.dailyTargets,
        dailyHistory: s.dailyHistory,
        dailyActiveDate: s.dailyActiveDate,
      }) as unknown as AppState,
    },
  ),
);
