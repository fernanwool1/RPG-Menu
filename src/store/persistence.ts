import type { StateStorage } from 'zustand/middleware';
import { cloudEnabled } from '@/cloud/config';

/**
 * Persistence boundary.
 *
 * Everything the app knows about *where* state lives is in this file. The
 * store talks to a PersistenceAdapter and nothing else, so replacing
 * localStorage with Firebase means writing one new adapter and changing the
 * single export at the bottom - no component and no domain function changes.
 *
 * See README "Replacing local persistence".
 */

export const STORAGE_KEY = 'rpg-menu-state';

/**
 * Bump when the persisted shape changes, and add a matching step to
 * MIGRATIONS. Never reuse a version number.
 *
 *   1  initial release
 *   2  Daily Quest system: daily definitions, instances, selections, checks,
 *      targets and history; the Music "Performance" branch and its extra
 *      instrument nodes
 */
export const SCHEMA_VERSION = 2;

export interface PersistenceAdapter extends StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Corruption handling                                                 */
/* ------------------------------------------------------------------ */

export type StorageHealth =
  | { state: 'ok' }
  | { state: 'empty' }
  | { state: 'unavailable'; reason: string }
  | { state: 'corrupt'; reason: string; raw: string };

let health: StorageHealth = { state: 'empty' };
const listeners = new Set<(h: StorageHealth) => void>();

export function getStorageHealth(): StorageHealth {
  return health;
}

export function setStorageHealth(next: StorageHealth): void {
  health = next;
  listeners.forEach((l) => l(next));
}

export function subscribeToStorageHealth(listener: (h: StorageHealth) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Keeps a copy of unreadable data so the user can export it before resetting. */
export function readRawSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* localStorage adapter                                                */
/* ------------------------------------------------------------------ */

/**
 * A localStorage adapter that refuses to throw.
 *
 * Private browsing, a full quota and disabled site data all surface as a
 * health status the UI can explain, rather than as a crash on first paint.
 */
export function createLocalStorageAdapter(): PersistenceAdapter {
  return {
    getItem: (name) => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = window.localStorage.getItem(name);
        if (raw === null) {
          setStorageHealth({ state: 'empty' });
          return null;
        }
        // Parsed here so malformed data is caught before it reaches the store.
        JSON.parse(raw);
        setStorageHealth({ state: 'ok' });
        return raw;
      } catch (error) {
        const raw = readRawSnapshot();
        if (raw) {
          setStorageHealth({
            state: 'corrupt',
            reason: error instanceof Error ? error.message : 'Unreadable saved data',
            raw,
          });
        } else {
          setStorageHealth({
            state: 'unavailable',
            reason: error instanceof Error ? error.message : 'Local storage unavailable',
          });
        }
        return null;
      }
    },

    setItem: (name, value) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(name, value);
        if (health.state !== 'ok') setStorageHealth({ state: 'ok' });
      } catch (error) {
        setStorageHealth({
          state: 'unavailable',
          reason:
            error instanceof Error
              ? `Could not save: ${error.message}`
              : 'Could not save to local storage',
        });
      }
    },

    removeItem: (name) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.removeItem(name);
        setStorageHealth({ state: 'empty' });
      } catch {
        /* nothing useful to do */
      }
    },
  };
}

/**
 * An in-memory adapter, used for SSR and available for tests.
 *
 * Next renders these pages on the server first, where there is no
 * localStorage; without this the persist middleware would warn on every load.
 */
export function createMemoryAdapter(): PersistenceAdapter {
  const map = new Map<string, string>();
  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Migrations                                                          */
/* ------------------------------------------------------------------ */

type Migration = (state: unknown) => unknown;

/**
 * Keyed by the version being migrated FROM. To add version 3, write
 * MIGRATIONS[2] and bump SCHEMA_VERSION.
 */
const MIGRATIONS: Record<number, Migration> = {
  /**
   * 1 -> 2: introduce the Daily Quest system.
   *
   * Additive only. Saved progress, the XP ledger and every existing record are
   * left exactly as they were; this fills in the new collections and brings the
   * Music branch up to date so the Daily Check has instruments to route to.
   */
  1: (state) => {
    const s = (state ?? {}) as Record<string, unknown>;

    const branches = Array.isArray(s.branches) ? [...(s.branches as MigratableRecord[])] : [];
    const nodes = Array.isArray(s.nodes) ? [...(s.nodes as MigratableRecord[])] : [];

    // The branch keeps its id; only the display name moves to "Performance".
    const performance = branches.find((b) => b.id === 'brn_instrumental-practice');
    if (performance) performance.name = 'Performance';

    // Add any instrument the Daily Check offers that this save predates.
    const NEW_INSTRUMENTS: Array<[id: string, name: string, icon: string]> = [
      ['nod_zampona', 'Zampoña', 'music'],
      ['nod_kalimba', 'Kalimba', 'music'],
      ['nod_violin', 'Violin', 'music'],
      ['nod_ukulele', 'Ukulele', 'guitar'],
      ['nod_harp', 'Harp', 'music'],
    ];

    const at = new Date().toISOString();
    let order = nodes.filter((n) => n.branchId === 'brn_instrumental-practice').length;

    for (const [id, name, icon] of NEW_INSTRUMENTS) {
      if (nodes.some((n) => n.id === id)) continue;
      nodes.push({
        id,
        branchId: 'brn_instrumental-practice',
        name,
        icon,
        order: order++,
        archived: false,
        parentIds: [],
        // Zero XP keeps them Undiscovered, so no level anywhere shifts.
        seedXp: 0,
        focus: false,
        evidence: [],
        createdAt: at,
        updatedAt: at,
      });
    }

    return {
      ...s,
      branches,
      nodes,
      // Left undefined here on purpose: the store merges its own seeded
      // definitions and targets for any key a migrated save is missing.
      dailyInstances: s.dailyInstances ?? [],
      dailySelections: s.dailySelections ?? [],
      dailyChecks: s.dailyChecks ?? [],
      dailyHistory: s.dailyHistory ?? [],
      dailyActiveDate: s.dailyActiveDate ?? null,
    };
  },
};

type MigratableRecord = Record<string, unknown> & { id?: string; branchId?: string; name?: string };

export function runMigrations(persisted: unknown, fromVersion: number): unknown {
  let state = persisted;
  for (let v = fromVersion; v < SCHEMA_VERSION; v += 1) {
    const migrate = MIGRATIONS[v];
    if (migrate) state = migrate(state);
  }
  return state;
}

/**
 * The adapter the app actually uses.
 *
 * To move to Firebase: implement PersistenceAdapter against Firestore and
 * return it here. Zustand's persist middleware accepts an async adapter, so
 * getItem may return a Promise.
 */
export function createPersistenceAdapter(): PersistenceAdapter {
  // Cloud sessions never overwrite the legacy browser save, nor leave another
  // account's character in localStorage after sign-out.
  return cloudEnabled || typeof window === 'undefined' ? createMemoryAdapter() : createLocalStorageAdapter();
}
