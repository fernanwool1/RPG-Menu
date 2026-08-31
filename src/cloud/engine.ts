import type { CloudSnapshot } from './schema';

export interface CloudRecord { revision: number; snapshot: CloudSnapshot; }
export interface CloudTransport {
  read(): Promise<CloudRecord | null>;
  write(snapshot: CloudSnapshot, revision: number, commitId: string): Promise<CloudRecord>;
}
export type SyncPhase = 'loading' | 'ready' | 'saving' | 'error' | 'offline';
export interface SyncStatus { phase: SyncPhase; message: string; revision: number; }
export class ConflictError extends Error {}

/** One versioned document keeps quest state and its XP payout in the same atomic commit.
 * Never merges stale ledgers or blindly retries a non-idempotent user action. */
export class SyncEngine {
  private revision = 0;
  private current = '';
  private pending: CloudSnapshot | null = null;
  private busy = false;
  private reading = false;
  private disposed = false;
  private failed = false;
  private connected = true;
  recovery: CloudSnapshot | null = null;

  constructor(private transport: CloudTransport,
    private apply: (snapshot: CloudSnapshot | null) => void,
    private status: (status: SyncStatus) => void) {}

  private emit(phase: SyncPhase, message: string) {
    if (!this.disposed) this.status({ phase, message, revision: this.revision });
  }
  get hasUnsavedChanges() { return this.busy || this.pending !== null || this.recovery !== null; }

  async refresh() {
    if (this.disposed || this.busy || this.pending || this.reading || !this.connected) return;
    this.reading = true;
    try {
      const row = await this.transport.read();
      if (this.disposed || this.pending || this.busy || !this.connected) return;
      // A stale in-flight read must never roll back a later acknowledged save.
      if (row && row.revision < this.revision) return;
      const serialized = row ? JSON.stringify(row.snapshot) : '';
      if (serialized !== this.current || this.failed || this.recovery || this.revision === 0) {
        this.current = serialized;
        this.revision = row?.revision ?? 0;
        this.apply(row?.snapshot ?? null);
      }
      this.failed = false;
      this.emit('ready', this.recovery
        ? 'Cloud data reloaded. The unconfirmed edit was not reapplied. Download its recovery copy before continuing.'
        : 'Saved online · checks other devices every 5 seconds');
    } catch (error) {
      this.failed = true;
      this.emit('error', `Cannot reach your saved data. ${error instanceof Error ? error.message : 'Try again.'}`);
    } finally { this.reading = false; }
  }

  changed(snapshot: CloudSnapshot) {
    if (this.disposed || this.failed || !this.connected) return;
    if (JSON.stringify(snapshot) === this.current && !this.pending) return;
    this.pending = snapshot;
    this.emit('saving', 'Saving online…');
    // Batch synchronous actions (e.g. log progress + remember the chosen skill).
    queueMicrotask(() => { void this.flush(); });
  }

  private async flush() {
    if (this.busy || this.disposed || !this.pending || !this.connected || this.failed) return;
    this.busy = true;
    const snapshot = this.pending;
    this.pending = null;
    try {
      const row = await this.transport.write(snapshot, this.revision, crypto.randomUUID());
      if (this.disposed) return;
      this.revision = row.revision;
      this.current = JSON.stringify(row.snapshot);
      if (!this.pending && !this.failed) this.emit(this.connected ? 'ready' : 'offline', this.connected
        ? 'Saved online · checks other devices every 5 seconds' : 'Offline. Reconnect to continue.');
    } catch (error) {
      if (this.disposed) return;
      this.recovery = this.pending ?? snapshot;
      this.pending = null;
      this.failed = true;
      this.emit('error', error instanceof ConflictError
        ? 'Another device saved first. Your edit was not saved. Reload cloud data, then repeat the edit if needed.'
        : 'Save could not be confirmed. Keep this page open, reconnect, and reload cloud data before trying again.');
    } finally {
      this.busy = false;
      if (this.pending && !this.failed) void this.flush();
    }
  }

  connection(online: boolean) {
    this.connected = online;
    if (!online) {
      if (this.pending) { this.recovery = this.pending; this.pending = null; }
      this.emit('offline', 'Offline. Changes are disabled. Reconnect to continue.');
    } else { void this.refresh(); }
  }
  rejectInvalidChange() {
    this.failed = true;
    this.pending = null;
    this.emit('error', 'The latest change contains invalid data and was not sent. Reload cloud data to restore the saved version.');
  }
  acknowledgeRecovery() { this.recovery = null; void this.refresh(); }
  dispose() { this.disposed = true; }
}
