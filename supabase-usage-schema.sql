-- ============================================
-- Supabase Schema: Try-On Usage Tracking (Auth + Anonymous)
-- Copy/paste into Supabase SQL Editor and run.
-- ============================================

-- ===========================
-- 1) AUTHENTICATED USAGE
-- ===========================

create table if not exists tryon_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table tryon_usage enable row level security;

drop policy if exists "Users can read own usage" on tryon_usage;
drop policy if exists "Users can update own usage" on tryon_usage;
drop policy if exists "Users can insert own usage" on tryon_usage;

create policy "Users can read own usage"
on tryon_usage for select
using (auth.uid() = user_id);

create policy "Users can update own usage"
on tryon_usage for update
using (auth.uid() = user_id);

create policy "Users can insert own usage"
on tryon_usage for insert
with check (auth.uid() = user_id);

-- Atomic: increments ONLY if count < daily_limit
create or replace function check_and_increment_tryons(daily_limit integer)
returns json
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
  new_count integer;
begin
  if auth.uid() is null then
    return json_build_object('allowed', false, 'error', 'not_authenticated');
  end if;

  insert into tryon_usage (user_id, day, count)
  values (auth.uid(), today, 1)
  on conflict (user_id, day) do update
    set count = tryon_usage.count + 1,
        updated_at = now()
    where tryon_usage.count < daily_limit
  returning count into new_count;

  if new_count is null then
    select count into new_count
    from tryon_usage
    where user_id = auth.uid() and day = today;

    return json_build_object(
      'allowed', false,
      'count', coalesce(new_count, 0),
      'limit', daily_limit,
      'remaining', 0
    );
  end if;

  return json_build_object(
    'allowed', true,
    'count', new_count,
    'limit', daily_limit,
    'remaining', greatest(0, daily_limit - new_count)
  );
end;
$$;

create or replace function get_tryon_usage()
returns json
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
  current_count integer;
begin
  select count into current_count
  from tryon_usage
  where user_id = auth.uid() and day = today;

  return json_build_object(
    'count', coalesce(current_count, 0),
    'date', today
  );
end;
$$;

-- Refund one try for authenticated user (used if generation fails after reserving quota)
create or replace function decrement_tryons()
returns void
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null then
    return;
  end if;

  update tryon_usage
  set count = greatest(0, count - 1),
      updated_at = now()
  where user_id = auth.uid() and day = today;
end;
$$;

-- ===========================
-- 2) ANONYMOUS USAGE
-- ===========================

create table if not exists tryon_anon_usage (
  anon_id text not null,
  day date not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (anon_id, day)
);

alter table tryon_anon_usage enable row level security;

-- No direct client access to anon table
revoke all on table tryon_anon_usage from anon, authenticated;

-- Atomic: increments ONLY if count < daily_limit
create or replace function check_and_increment_tryons_anon(p_anon_id text, daily_limit integer)
returns json
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
  new_count integer;
begin
  if p_anon_id is null or length(p_anon_id) < 16 then
    return json_build_object('allowed', false, 'error', 'bad_anon_id');
  end if;

  insert into tryon_anon_usage (anon_id, day, count)
  values (p_anon_id, today, 1)
  on conflict (anon_id, day) do update
    set count = tryon_anon_usage.count + 1,
        updated_at = now()
    where tryon_anon_usage.count < daily_limit
  returning count into new_count;

  if new_count is null then
    select count into new_count
    from tryon_anon_usage
    where anon_id = p_anon_id and day = today;

    return json_build_object(
      'allowed', false,
      'count', coalesce(new_count, 0),
      'limit', daily_limit,
      'remaining', 0
    );
  end if;

  return json_build_object(
    'allowed', true,
    'count', new_count,
    'limit', daily_limit,
    'remaining', greatest(0, daily_limit - new_count)
  );
end;
$$;

-- Refund one try for anonymous user (used if generation fails after reserving quota)
create or replace function decrement_tryons_anon(p_anon_id text)
returns void
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if p_anon_id is null or length(p_anon_id) < 16 then
    return;
  end if;

  update tryon_anon_usage
  set count = greatest(0, count - 1),
      updated_at = now()
  where anon_id = p_anon_id and day = today;
end;
$$;

-- ===========================
-- 3) PERMISSIONS (IMPORTANT)
-- ===========================

-- Authenticated users can call only the authenticated RPCs
revoke all on function check_and_increment_tryons(integer) from public;
revoke all on function get_tryon_usage() from public;
revoke all on function decrement_tryons() from public;

grant execute on function check_and_increment_tryons(integer) to authenticated;
grant execute on function get_tryon_usage() to authenticated;
grant execute on function decrement_tryons() to authenticated;

-- Anonymous quota RPCs must NOT be callable from clients.
-- They are intended to be called ONLY from Vercel serverless using the Supabase service role key.
revoke all on function check_and_increment_tryons_anon(text, integer) from public;
revoke all on function decrement_tryons_anon(text) from public;

-- Done.
-- Vercel env vars you will use:
-- SUPABASE_URL
-- SUPABASE_ANON_KEY
-- SUPABASE_SERVICE_KEY   (service role key)
-- ANON_DAILY_TRYON_LIMIT=3
-- USER_DAILY_TRYON_LIMIT=4
