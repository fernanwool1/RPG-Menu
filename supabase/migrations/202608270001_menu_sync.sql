-- Run once in your Supabase SQL editor. No service-role credential is needed by the app.
create table public.menu_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  last_commit_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.menu_saves enable row level security;
revoke all on public.menu_saves from anon, authenticated;
grant select on public.menu_saves to authenticated;
create policy own_save_read on public.menu_saves for select to authenticated
  using ((select auth.uid()) = user_id);

-- Only this function may write. Ownership is derived from the authenticated JWT,
-- never from a client-provided user_id. CAS is serialized by the row lock.
create function public.save_menu(expected_revision bigint, new_snapshot jsonb, commit_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved public.menu_saves;
begin
  if actor is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if expected_revision is null or expected_revision < 0 or commit_id is null then
    raise exception 'Invalid commit' using errcode = '22023';
  end if;
  if new_snapshot is null or jsonb_typeof(new_snapshot) <> 'object'
    or (new_snapshot ->> 'schemaVersion') is distinct from '2'
    or jsonb_typeof(new_snapshot -> 'initialized') is distinct from 'boolean'
    or jsonb_typeof(new_snapshot -> 'data') is distinct from 'object'
    or octet_length(new_snapshot::text) > 10000000 then
    raise exception 'Invalid or oversized save' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.menu_saves(user_id, revision, snapshot, last_commit_id)
      values(actor, 1, new_snapshot, commit_id) on conflict (user_id) do nothing;
  end if;
  select * into saved from public.menu_saves where user_id = actor for update;
  if saved.last_commit_id = commit_id then
    return jsonb_build_object('revision', saved.revision, 'snapshot', saved.snapshot);
  end if;
  if saved.user_id is null or saved.revision <> expected_revision then
    raise exception 'Another device saved first' using errcode = '40001';
  end if;
  update public.menu_saves set snapshot = new_snapshot, revision = revision + 1,
    last_commit_id = commit_id, updated_at = now() where user_id = actor returning * into saved;
  return jsonb_build_object('revision', saved.revision, 'snapshot', saved.snapshot);
end;
$$;
revoke all on function public.save_menu(bigint, jsonb, uuid) from public, anon;
grant execute on function public.save_menu(bigint, jsonb, uuid) to authenticated;
