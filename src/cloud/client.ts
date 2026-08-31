import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runMigrations, SCHEMA_VERSION } from '@/store/persistence';
import { snapshotSchema } from './schema';
import { ConflictError, type CloudRecord, type CloudTransport } from './engine';

let client: SupabaseClient | undefined;
export function getCloudClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Cloud setup is incomplete. Set the Supabase URL and publishable key, then restart the app.');
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: false, storageKey: 'menu-cloud-auth' } });
  return client;
}

/**
 * A row written by an older release is migrated on read, exactly like a local
 * save, so upgrading the app never orphans data that is already in the cloud.
 * Anything at or beyond the current version is passed through untouched.
 */
function upgrade(snapshot: unknown): unknown {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const envelope = snapshot as { schemaVersion?: unknown; data?: unknown };
  const from = envelope.schemaVersion;
  if (!Number.isInteger(from) || (from as number) < 1 || (from as number) >= SCHEMA_VERSION) {
    return snapshot;
  }
  return {
    ...envelope,
    schemaVersion: SCHEMA_VERSION,
    data: runMigrations(envelope.data, from as number),
  };
}

function decode(value: unknown): CloudRecord {
  const row = value as { revision?: number; snapshot?: unknown };
  if (!row || !Number.isSafeInteger(row.revision) || (row.revision ?? 0) < 1) {
    throw new Error('Invalid cloud revision. No data was loaded.');
  }
  const parsed = snapshotSchema.safeParse(upgrade(row.snapshot));
  if (!parsed.success) throw new Error('This cloud save is invalid or from a different app version. No data was loaded.');
  return { revision: row.revision!, snapshot: parsed.data };
}

export function cloudTransport(userId: string): CloudTransport {
  const supabase = getCloudClient();
  return {
    async read() {
      const { data, error } = await supabase.from('menu_saves').select('revision,snapshot')
        .eq('user_id', userId).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? decode(data) : null;
    },
    async write(snapshot, revision, commitId) {
      const { data, error } = await supabase.rpc('save_menu', {
        expected_revision: revision, new_snapshot: snapshotSchema.parse(snapshot), commit_id: commitId,
      }).abortSignal(AbortSignal.timeout(15_000));
      if (error?.code === '40001') throw new ConflictError(error.message);
      if (error) throw new Error(error.message);
      return decode(data);
    },
  };
}
