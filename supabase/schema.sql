create extension if not exists pgcrypto;

create table if not exists public.inventarios_general_states (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  last_client_id text,
  updated_at timestamptz not null default now()
);

alter table public.inventarios_general_states enable row level security;

drop policy if exists "inventarios_general_states_select" on public.inventarios_general_states;
create policy "inventarios_general_states_select"
on public.inventarios_general_states
for select
to anon, authenticated
using (true);

drop policy if exists "inventarios_general_states_insert" on public.inventarios_general_states;
create policy "inventarios_general_states_insert"
on public.inventarios_general_states
for insert
to anon, authenticated
with check (true);

drop policy if exists "inventarios_general_states_update" on public.inventarios_general_states;
create policy "inventarios_general_states_update"
on public.inventarios_general_states
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "inventarios_general_states_delete" on public.inventarios_general_states;
create policy "inventarios_general_states_delete"
on public.inventarios_general_states
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
      and tablename = 'inventarios_general_states'
  ) then
    alter publication supabase_realtime add table public.inventarios_general_states;
  end if;
end
$$;
