import { beforeEach, describe, expect, it } from 'vitest';

import { levelProgressFromXp, lifetimeXpFromLedger } from '@/domain/progression';
import { SCHEMA_VERSION } from '@/store/persistence';
import { useAppStore } from '@/store/useAppStore';

/**
 * Store-level tests.
 *
 * The store runs headless here: with no `window`, the persistence layer falls
 * back to its in-memory adapter, so these exercise the real actions without a
 * browser.
 */

const reset = () => {
  useAppStore.getState().startWithSampleData();
};

const lifetime = () => lifetimeXpFromLedger(useAppStore.getState().transactions);

describe('quest completion', () => {
  beforeEach(reset);

  it('awards the quest total once, split across its allocations', () => {
    const quest = useAppStore.getState().quests.find((q) => q.status === 'active' && q.characterXp > 0);
    if (!quest) throw new Error('no active sample quest');

    const before = lifetime();
    useAppStore.getState().completeQuest(quest.id);
    const after = lifetime();

    expect(after - before).toBe(quest.characterXp);

    const written = useAppStore
      .getState()
      .transactions.filter((t) => t.sourceId === quest.id);
    expect(written.reduce((s, t) => s + t.amount, 0)).toBe(quest.characterXp);
  });

  it('never pays twice, even after reopening', () => {
    const quest = useAppStore.getState().quests.find((q) => q.status === 'active' && q.characterXp > 0);
    if (!quest) throw new Error('no active sample quest');

    useAppStore.getState().completeQuest(quest.id);
    const afterFirst = lifetime();

    useAppStore.getState().reopenQuest(quest.id);
    useAppStore.getState().completeQuest(quest.id);

    expect(lifetime()).toBe(afterFirst);
  });

  it('mints reward items into the inventory on completion', () => {
    const quest = useAppStore
      .getState()
      .quests.find((q) => q.rewards.some((r) => r.kind === 'inventory-item'));

    if (quest) {
      const before = useAppStore.getState().items.length;
      useAppStore.getState().completeQuest(quest.id);
      const expected = quest.rewards.filter((r) => r.kind === 'inventory-item').length;
      expect(useAppStore.getState().items.length).toBe(before + expected);
    }
  });
});

describe('failing a quest', () => {
  beforeEach(reset);

  it('removes no XP and writes no transaction', () => {
    const quest = useAppStore.getState().quests.find((q) => q.status === 'active');
    if (!quest) throw new Error('no active sample quest');

    const beforeXp = lifetime();
    const beforeLevel = levelProgressFromXp(beforeXp).level;
    const beforeTxCount = useAppStore.getState().transactions.length;

    useAppStore.getState().failQuest(quest.id);

    expect(lifetime()).toBe(beforeXp);
    expect(levelProgressFromXp(lifetime()).level).toBe(beforeLevel);
    expect(useAppStore.getState().transactions).toHaveLength(beforeTxCount);
    expect(useAppStore.getState().quests.find((q) => q.id === quest.id)?.status).toBe('failed');
  });
});

describe('logging an activity', () => {
  beforeEach(reset);

  it('gives the node and the character the same amount, from one transaction', () => {
    const before = lifetime();
    const result = useAppStore.getState().logActivity({
      templateId: 'atp_reading',
      skillNodeId: 'nod_english-reading',
      amount: 34,
      finished: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xp).toBe(34);
    expect(lifetime() - before).toBe(34);

    const written = useAppStore
      .getState()
      .transactions.filter((t) => t.sourceType === 'activity' && t.amount === 34 && t.skillNodeId === 'nod_english-reading');
    expect(written.length).toBeGreaterThan(0);
  });

  it('refuses unfinished creative work', () => {
    const before = lifetime();
    const result = useAppStore.getState().logActivity({
      templateId: 'atp_finished-poem',
      skillNodeId: 'nod_poetry',
      amount: 1,
      finished: false,
    });

    expect(result.ok).toBe(false);
    expect(lifetime()).toBe(before);
  });

  it('reverses with a compensating transaction rather than a deletion', () => {
    const result = useAppStore.getState().logActivity({
      templateId: 'atp_cycling',
      skillNodeId: 'nod_cycling',
      amount: 40,
      finished: false,
    });
    expect(result.ok).toBe(true);

    const afterLog = lifetime();
    const log = useAppStore.getState().activityLogs.at(-1);
    if (!log) throw new Error('no log written');

    const txCountBefore = useAppStore.getState().transactions.length;
    useAppStore.getState().reverseActivityLog(log.id, 'test reversal');

    expect(lifetime()).toBe(afterLog - 40);
    // History grows; nothing is removed.
    expect(useAppStore.getState().transactions.length).toBe(txCountBefore + 1);
    expect(useAppStore.getState().activityLogs.find((l) => l.id === log.id)?.reversedAt).toBeTruthy();
  });
});

describe('abilities', () => {
  beforeEach(reset);

  it('creates and links a proof quest', () => {
    const questId = useAppStore.getState().startProofQuest('abl_full-stack-builder');
    expect(questId).toBeTruthy();

    const ability = useAppStore.getState().abilities.find((a) => a.id === 'abl_full-stack-builder');
    expect(ability?.proofQuestId).toBe(questId);

    const quest = useAppStore.getState().quests.find((q) => q.id === questId);
    expect(quest?.abilityId).toBe('abl_full-stack-builder');
    expect(quest?.status).toBe('active');
    expect(quest?.xpAwardedAt).toBeNull();
  });

  it('does not create a second proof quest for the same ability', () => {
    const first = useAppStore.getState().startProofQuest('abl_full-stack-builder');
    const second = useAppStore.getState().startProofQuest('abl_full-stack-builder');
    expect(second).toBe(first);
  });

  it('attaches and removes evidence', () => {
    useAppStore.getState().attachEvidence('abl_full-stack-builder', {
      kind: 'note',
      label: 'Deployed and running',
    });

    const withEvidence = useAppStore
      .getState()
      .abilities.find((a) => a.id === 'abl_full-stack-builder');
    expect(withEvidence?.evidence).toHaveLength(1);

    useAppStore
      .getState()
      .removeEvidence('abl_full-stack-builder', withEvidence!.evidence[0].id);
    expect(
      useAppStore.getState().abilities.find((a) => a.id === 'abl_full-stack-builder')?.evidence,
    ).toHaveLength(0);
  });
});

describe('inventory', () => {
  beforeEach(reset);

  it('edits cash and bank', () => {
    useAppStore.getState().setFinances({ cash: 500, bank: 9000 });
    expect(useAppStore.getState().finances.cash).toBe(500);
    expect(useAppStore.getState().finances.bank).toBe(9000);
  });

  it('moves an item between locations without losing it', () => {
    useAppStore.getState().moveItem('itm_laptop', 'loc_home');
    expect(useAppStore.getState().items.find((i) => i.id === 'itm_laptop')?.locationId).toBe(
      'loc_home',
    );
  });

  it('archives rather than deletes', () => {
    const before = useAppStore.getState().items.length;
    useAppStore.getState().archiveItem('itm_wallet');
    expect(useAppStore.getState().items).toHaveLength(before);
    expect(useAppStore.getState().items.find((i) => i.id === 'itm_wallet')?.archived).toBe(true);
  });
});

describe('export and import', () => {
  beforeEach(reset);

  it('round-trips the entire state, ledger included', () => {
    // Make the state distinctive first, so a round-trip cannot pass by luck.
    useAppStore.getState().setFinances({ cash: 4321 });
    useAppStore.getState().logActivity({
      templateId: 'atp_reading',
      skillNodeId: 'nod_english-reading',
      amount: 7,
      finished: false,
    });

    const snapshot = {
      xp: lifetime(),
      quests: useAppStore.getState().quests.length,
      nodes: useAppStore.getState().nodes.length,
      txs: useAppStore.getState().transactions.length,
      cash: useAppStore.getState().finances.cash,
    };

    const exported = useAppStore.getState().exportData();
    expect(() => JSON.parse(exported)).not.toThrow();

    // Wipe, then restore from the file.
    useAppStore.getState().startEmpty();
    expect(lifetime()).toBe(0);

    const result = useAppStore.getState().importData(exported);
    expect(result.ok).toBe(true);

    expect(lifetime()).toBe(snapshot.xp);
    expect(useAppStore.getState().quests).toHaveLength(snapshot.quests);
    expect(useAppStore.getState().nodes).toHaveLength(snapshot.nodes);
    expect(useAppStore.getState().transactions).toHaveLength(snapshot.txs);
    expect(useAppStore.getState().finances.cash).toBe(snapshot.cash);
  });

  it('carries the current schema version', () => {
    const parsed = JSON.parse(useAppStore.getState().exportData());
    // Asserted against the constant, so bumping the schema does not require
    // editing this test - only adding a migration.
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.data).toBeTruthy();
  });

  it('rejects junk instead of half-loading it', () => {
    const before = lifetime();

    expect(useAppStore.getState().importData('not json at all')).toEqual({
      ok: false,
      error: 'That file is not valid JSON.',
    });
    expect(useAppStore.getState().importData('{"nope":true}').ok).toBe(false);
    expect(useAppStore.getState().importData('{"schemaVersion":1,"data":{}}').ok).toBe(false);

    // State is untouched by every failed import.
    expect(lifetime()).toBe(before);
  });

  it('refuses a file from a newer schema', () => {
    const result = useAppStore
      .getState()
      .importData(JSON.stringify({ schemaVersion: 99, data: { profile: {} } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('newer version');
  });
});

describe('starting empty', () => {
  it('clears progress but keeps the scaffolding', () => {
    useAppStore.getState().startWithSampleData();
    expect(lifetime()).toBeGreaterThan(0);

    useAppStore.getState().startEmpty();
    expect(lifetime()).toBe(0);
    expect(levelProgressFromXp(lifetime()).level).toBe(1);
    expect(useAppStore.getState().quests).toHaveLength(0);
    expect(useAppStore.getState().items).toHaveLength(0);
    expect(useAppStore.getState().domains.length).toBeGreaterThan(0);
    expect(useAppStore.getState().templates.length).toBeGreaterThan(0);
  });
});
