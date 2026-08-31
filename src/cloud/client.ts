import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

function decode(value: unknown): CloudRecord {
  const row = value as { revision?: number; snapshot?: unknown };
  if (!row || !Number.isSafeInteger(row.revision) || (row.revision ?? 0) < 1) {
    throw new Error('Invalid cloud revision. No data was loaded.');
  }
  const parsed = snapshotSchema.safeParse(row.snapshot);
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
