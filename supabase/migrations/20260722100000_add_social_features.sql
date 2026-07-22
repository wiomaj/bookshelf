-- Social features: friends (add-by-email, one-directional), and a minimal
-- notifications inbox used for the one-time "X added you as a friend" ping.

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Mirrors auth.users (id, email, display_name) so we have a table the client
-- can query under RLS. auth.users itself is not queryable from the client.
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_select_friends" on profiles
  for select using (
    exists (
      select 1 from friendships f
      where f.owner_id = auth.uid() and f.friend_id = profiles.id
    )
  );

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Keep profiles in sync with auth.users on signup / metadata changes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set display_name = new.raw_user_meta_data->>'display_name', email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_update();

-- Backfill existing users.
insert into public.profiles (id, email, display_name)
select id, email, raw_user_meta_data->>'display_name' from auth.users
on conflict (id) do nothing;

-- ── friendships ───────────────────────────────────────────────────────────────
-- One-directional: owner_id added friend_id, which grants owner_id read access
-- to friend_id's books. No approval step for MVP.
create table if not exists friendships (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (owner_id, friend_id),
  check (owner_id <> friend_id)
);

alter table friendships enable row level security;

create policy "friendships_select_own" on friendships
  for select using (auth.uid() = owner_id or auth.uid() = friend_id);

create policy "friendships_insert_own" on friendships
  for insert with check (auth.uid() = owner_id);

create policy "friendships_delete_own" on friendships
  for delete using (auth.uid() = owner_id);

-- Let a friend's owner read the friend's books (notes/comments are simply
-- never selected for by the friend-facing queries — this only grants row
-- visibility, the app enforces the column-level privacy).
create policy "books_select_friends" on books
  for select using (
    exists (
      select 1 from friendships f
      where f.owner_id = auth.uid() and f.friend_id = books.user_id
    )
  );

-- ── notifications ─────────────────────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  payload    jsonb default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select using (auth.uid() = user_id);

create policy "notifications_update_own" on notifications
  for update using (auth.uid() = user_id);

create index if not exists notifications_user_id_idx on notifications (user_id);
