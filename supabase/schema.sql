create extension if not exists pgcrypto;

create table if not exists public.app_states (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  last_client_id text,
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;

drop policy if exists "app_states_select" on public.app_states;
create policy "app_states_select"
on public.app_states
for select
to anon, authenticated
using (true);

drop policy if exists "app_states_insert" on public.app_states;
create policy "app_states_insert"
on public.app_states
for insert
to anon, authenticated
with check (true);

drop policy if exists "app_states_update" on public.app_states;
create policy "app_states_update"
on public.app_states
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "app_states_delete" on public.app_states;
create policy "app_states_delete"
on public.app_states
for delete
to anon, authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_states'
  ) then
    alter publication supabase_realtime add table public.app_states;
  end if;
end
$$;
