create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sex text not null,
  skill int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  session_data jsonb not null
);

alter table public.players enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "players_select_own" on public.players;
drop policy if exists "players_insert_own" on public.players;
drop policy if exists "players_update_own" on public.players;
drop policy if exists "players_delete_own" on public.players;
drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "sessions_update_own" on public.sessions;
drop policy if exists "sessions_delete_own" on public.sessions;

create policy "players_select_own"
on public.players
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "players_insert_own"
on public.players
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "players_update_own"
on public.players
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "players_delete_own"
on public.players
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "sessions_select_own"
on public.sessions
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "sessions_insert_own"
on public.sessions
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "sessions_update_own"
on public.sessions
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "sessions_delete_own"
on public.sessions
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
