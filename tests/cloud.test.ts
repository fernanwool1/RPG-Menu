import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, SyncEngine, type CloudRecord, type CloudTransport, type SyncStatus } from '@/cloud/engine';
import { appDataSchema, snapshotSchema, type CloudSnapshot } from '@/cloud/schema';
import { emptyCloudSnapshot, legacySnapshot } from '@/cloud/snapshot';
import { useAppStore } from '@/store/useAppStore';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const fixture = emptyCloudSnapshot();
function named(name: string): CloudSnapshot {
  const value = structuredClone(fixture);
  value.initialized = true; value.data.profile.displayName = name;
  return value;
}
function harness() {
  let row: CloudRecord | null = { revision: 1, snapshot: named('Original') };
  const transport: CloudTransport = {
    read: vi.fn(async () => row),
    write: vi.fn(async (snapshot, revision) => {
      if ((row?.revision ?? 0) !== revision) throw new ConflictError();
      row = { revision: revision + 1, snapshot }; return row;
    }),
  };
  const apply = vi.fn(); const statuses: SyncStatus[] = [];
  const engine = new SyncEngine(transport, apply, (s) => statuses.push(s));
  return { engine, transport, apply, statuses, external: (snapshot: CloudSnapshot) => {
    row = { revision: (row?.revision ?? 0) + 1, snapshot };
  } };
}

describe('cloud boundary validation', () => {
  beforeEach(() => useAppStore.getState().startWithSampleData());
  it('accepts complete sample and empty saves', () => {
    expect(appDataSchema.safeParse(useAppStore.getState()).success).toBe(true);
    expect(snapshotSchema.safeParse(emptyCloudSnapshot()).success).toBe(true);
  });
  it('rejects malformed imports without replacing state', () => {
    const before = useAppStore.getState().profile;
    const exported = JSON.parse(useAppStore.getState().exportData());
    exported.data.nodes = null;
    expect(useAppStore.getState().importData(JSON.stringify(exported)).ok).toBe(false);
    expect(useAppStore.getState().profile).toBe(before);
  });
  it('strips unexpected action keys from an import', () => {
    const exported = JSON.parse(useAppStore.getState().exportData());
    exported.data.completeQuest = 'bad';
    expect(useAppStore.getState().importData(JSON.stringify(exported)).ok).toBe(true);
    expect(typeof useAppStore.getState().completeQuest).toBe('function');
  });
  it('rejects duplicate ledger ids and newer cloud schemas', () => {
    const data = JSON.parse(useAppStore.getState().exportData()).data;
    data.transactions.push(data.transactions[0]);
    expect(appDataSchema.safeParse(data).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...emptyCloudSnapshot(), schemaVersion: 3 }).success).toBe(false);
  });
  it('converts a legacy save without mutating its source', () => {
    const data = JSON.parse(useAppStore.getState().exportData()).data;
    const raw = JSON.stringify({ version: 2, state: { ...data, initialized: true } });
    const converted = legacySnapshot(raw);
    expect(converted.data.transactions).toEqual(data.transactions);
    expect(converted.initialized).toBe(true);
    expect(() => legacySnapshot('{"version":99,"state":{}}')).toThrow();
  });
});

describe('online sync engine', () => {
  it('loads remote state without writing it back', async () => {
    const h = harness(); await h.engine.refresh();
    expect(h.apply).toHaveBeenCalledOnce();
    expect(h.transport.write).not.toHaveBeenCalled();
    expect(h.statuses.at(-1)?.phase).toBe('ready');
  });
  it('batches synchronous changes and ignores unchanged snapshots', async () => {
    const h = harness(); await h.engine.refresh();
    h.engine.changed(named('A')); h.engine.changed(named('B')); await tick();
    expect(h.transport.write).toHaveBeenCalledTimes(1);
    expect(h.statuses.at(-1)?.revision).toBe(2);
    h.engine.changed(named('B')); await tick();
    expect(h.transport.write).toHaveBeenCalledTimes(1);
  });
  it('queues edits during a save using the acknowledged revision', async () => {
    const h = harness(); await h.engine.refresh();
    const pending = deferred<CloudRecord>();
    h.transport.write = vi.fn().mockImplementationOnce(() => pending.promise)
      .mockImplementationOnce(async (snapshot, revision) => ({ snapshot, revision: revision + 1 }));
    h.engine.changed(named('A')); await tick(); h.engine.changed(named('B'));
    pending.resolve({ revision: 2, snapshot: named('A') }); await tick();
    expect(h.transport.write).toHaveBeenLastCalledWith(named('B'), 2, expect.any(String));
    expect(h.statuses.at(-1)?.revision).toBe(3);
  });
  it('rejects stale edits and preserves a recovery copy, never blindly retries', async () => {
    const h = harness(); await h.engine.refresh(); h.external(named('Other device'));
    h.engine.changed(named('My edit')); await tick();
    expect(h.statuses.at(-1)?.phase).toBe('error');
    expect(h.engine.recovery?.data.profile.displayName).toBe('My edit');
    await h.engine.refresh();
    expect(h.apply).toHaveBeenLastCalledWith(named('Other device'));
    expect(h.transport.write).toHaveBeenCalledTimes(1);
    expect(h.engine.recovery).not.toBeNull();
    h.engine.acknowledgeRecovery(); await tick(); expect(h.engine.recovery).toBeNull();
  });
  it('does not replay an ambiguous save that actually committed', async () => {
    const h = harness(); await h.engine.refresh();
    h.transport.write = vi.fn(async (snapshot) => { h.external(snapshot); throw new Error('response lost'); });
    h.engine.changed(named('Committed')); await tick(); await h.engine.refresh();
    expect(h.apply).toHaveBeenLastCalledWith(named('Committed'));
    expect(h.transport.write).toHaveBeenCalledTimes(1);
  });
  it('blocks offline writes and refreshes when reconnected', async () => {
    const h = harness(); await h.engine.refresh(); h.engine.connection(false);
    h.engine.changed(named('Offline edit')); await tick();
    expect(h.transport.write).not.toHaveBeenCalled();
    h.external(named('Remote')); h.engine.connection(true); await tick();
    expect(h.apply).toHaveBeenLastCalledWith(named('Remote'));
  });
  it('ignores old reads that resolve during a write', async () => {
    const h = harness(); await h.engine.refresh();
    const read = deferred<CloudRecord>(); const write = deferred<CloudRecord>();
    h.transport.read = () => read.promise; h.transport.write = () => write.promise;
    const refreshing = h.engine.refresh(); h.engine.changed(named('New')); await tick();
    read.resolve({ revision: 1, snapshot: named('Old') }); await refreshing;
    expect(h.apply).toHaveBeenCalledTimes(1);
    write.resolve({ revision: 2, snapshot: named('New') }); await tick();
  });
  it('restores the unchanged cloud copy when disconnecting before a queued save starts', async () => {
    const h = harness(); await h.engine.refresh();
    h.engine.changed(named('Unsent')); h.engine.connection(false); await tick();
    expect(h.transport.write).not.toHaveBeenCalled();
    h.engine.connection(true); await tick();
    expect(h.apply).toHaveBeenLastCalledWith(named('Original'));
    expect(h.apply).toHaveBeenCalledTimes(2);
    expect(h.engine.recovery?.data.profile.displayName).toBe('Unsent');
  });
  it('disposes safely when switching accounts', async () => {
    const h = harness(); const read = deferred<CloudRecord>(); h.transport.read = () => read.promise;
    const refreshing = h.engine.refresh(); h.engine.dispose();
    read.resolve({ revision: 1, snapshot: named('Previous account') }); await refreshing;
    expect(h.apply).not.toHaveBeenCalled();
  });
  it('reports loading failures without replacing the current state', async () => {
    const h = harness(); h.transport.read = async () => { throw new Error('Network'); };
    await h.engine.refresh(); expect(h.apply).not.toHaveBeenCalled();
    expect(h.statuses.at(-1)?.phase).toBe('error');
  });
});
