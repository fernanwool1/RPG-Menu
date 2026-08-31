import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION, runMigrations } from '@/store/persistence';

/**
 * The v1 -> v2 upgrade path.
 *
 * A user who already had saved progress before the Daily Quest system existed
 * must lose nothing when they load the new build. These assertions are the
 * contract for that.
 */

const v1Save = () => ({
  initialized: true,
  profile: { id: 'chr_primary', displayName: 'Existing Character' },
  quests: [{ id: 'qst_a', title: 'Old quest', status: 'active' }],
  transactions: [
    { id: 'xtx_a', amount: 500, sourceType: 'quest', sourceId: 'qst_a', skillNodeId: null },
    { id: 'xtx_b', amount: 120, sourceType: 'activity', sourceId: 'alg_a', skillNodeId: 'nod_guitar' },
  ],
  branches: [
    { id: 'brn_instrumental-practice', name: 'Instrumental Practice', domainId: 'dom_music' },
    { id: 'brn_programming', name: 'Programming', domainId: 'dom_computer-science' },
  ],
  nodes: [
    { id: 'nod_guitar', branchId: 'brn_instrumental-practice', name: 'Guitar', seedXp: 2250 },
    { id: 'nod_piano', branchId: 'brn_instrumental-practice', name: 'Piano', seedXp: 1650 },
  ],
  items: [{ id: 'itm_laptop', name: 'Laptop' }],
});

describe('migrating a save from before the Daily Quest system', () => {
  it('keeps every existing record untouched', () => {
    const migrated = runMigrations(v1Save(), 1) as Record<string, unknown>;

    expect(migrated.initialized).toBe(true);
    expect(migrated.quests).toHaveLength(1);
    expect(migrated.items).toHaveLength(1);
    expect(migrated.profile).toEqual({ id: 'chr_primary', displayName: 'Existing Character' });

    // The ledger is the thing that must never be disturbed.
    const transactions = migrated.transactions as Array<{ amount: number }>;
    expect(transactions).toHaveLength(2);
    expect(transactions.reduce((s, t) => s + t.amount, 0)).toBe(620);
  });

  it('renames the Music branch to Performance without changing its id', () => {
    const migrated = runMigrations(v1Save(), 1) as Record<string, unknown>;
    const branches = migrated.branches as Array<{ id: string; name: string }>;

    const performance = branches.find((b) => b.id === 'brn_instrumental-practice');
    expect(performance?.name).toBe('Performance');
    // Other branches are left alone.
    expect(branches.find((b) => b.id === 'brn_programming')?.name).toBe('Programming');
  });

  it('adds the missing instruments at zero XP, so no level shifts', () => {
    const migrated = runMigrations(v1Save(), 1) as Record<string, unknown>;
    const nodes = migrated.nodes as Array<{ id: string; name: string; seedXp: number }>;

    for (const id of ['nod_zampona', 'nod_kalimba', 'nod_violin', 'nod_ukulele', 'nod_harp']) {
      const node = nodes.find((n) => n.id === id);
      expect(node).toBeTruthy();
      expect(node!.seedXp).toBe(0);
    }

    // Existing instruments keep their XP exactly.
    expect(nodes.find((n) => n.id === 'nod_guitar')?.seedXp).toBe(2250);
    expect(nodes.find((n) => n.id === 'nod_piano')?.seedXp).toBe(1650);
  });

  it('is idempotent - running it twice adds nothing further', () => {
    const once = runMigrations(v1Save(), 1) as Record<string, unknown>;
    const twice = runMigrations(once, 1) as Record<string, unknown>;

    expect((twice.nodes as unknown[]).length).toBe((once.nodes as unknown[]).length);
  });

  it('creates the empty daily collections', () => {
    const migrated = runMigrations(v1Save(), 1) as Record<string, unknown>;
    expect(migrated.dailyInstances).toEqual([]);
    expect(migrated.dailySelections).toEqual([]);
    expect(migrated.dailyChecks).toEqual([]);
    expect(migrated.dailyHistory).toEqual([]);
    expect(migrated.dailyActiveDate).toBeNull();
  });

  it('leaves a current-version save alone', () => {
    const current = { quests: [{ id: 'q' }] };
    expect(runMigrations(current, SCHEMA_VERSION)).toBe(current);
  });
});
