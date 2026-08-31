import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const payload = { schemaVersion: 2, initialized: true, data: {} };
async function actor(id: string, role = 'authenticated') {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function save(revision: number, commit = crypto.randomUUID()) {
  return db.query<{ result: { revision: number } }>('select public.save_menu($1, $2, $3) as result',
    [revision, JSON.stringify(payload), commit]);
}

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');`);
  await db.exec(readFileSync(resolve('supabase/migrations/202608270001_menu_sync.sql'), 'utf8'));
}, 30_000);
afterAll(async () => { await db.close(); });

describe('PostgreSQL save authorization and concurrency', () => {
  it('creates an account-owned save and treats duplicate commit ids idempotently', async () => {
    await actor(alice);
    const commit = crypto.randomUUID();
    expect((await save(0, commit)).rows[0].result.revision).toBe(1);
    expect((await save(0, commit)).rows[0].result.revision).toBe(1);
  });
  it('rejects a stale revision and keeps the accepted revision', async () => {
    await actor(alice);
    expect((await save(1)).rows[0].result.revision).toBe(2);
    await expect(save(1)).rejects.toThrow('Another device saved first');
    const row = await db.query<{ revision: number }>('select revision from public.menu_saves');
    expect(row.rows[0].revision).toBe(2);
  });
  it('isolates reads and writes between two authenticated accounts', async () => {
    await actor(bob);
    expect((await db.query('select * from public.menu_saves')).rows).toHaveLength(0);
    expect((await save(0)).rows[0].result.revision).toBe(1);
    const rows = await db.query<{ user_id: string }>('select user_id from public.menu_saves');
    expect(rows.rows).toEqual([{ user_id: bob }]);
    await actor(alice);
    expect((await db.query<{ revision: number }>('select revision from public.menu_saves')).rows[0].revision).toBe(2);
  });
  it('denies direct table modifications', async () => {
    await actor(alice);
    await expect(db.query('update public.menu_saves set revision = 99')).rejects.toThrow('permission denied');
    await expect(db.query('delete from public.menu_saves')).rejects.toThrow('permission denied');
  });
  it('denies anonymous saves and reads', async () => {
    await actor('', 'anon');
    await expect(save(0)).rejects.toThrow('permission denied');
    await expect(db.query('select * from public.menu_saves')).rejects.toThrow('permission denied');
  });
  it('fails closed for missing identity and malformed envelopes', async () => {
    await actor(''); await expect(save(0)).rejects.toThrow('Sign in first');
    await actor(alice);
    await expect(db.query('select public.save_menu(2, $1, $2)', ['{}', crypto.randomUUID()]))
      .rejects.toThrow('Invalid or oversized save');
  });
});
