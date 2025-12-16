-- ============================================
-- Supabase Schema: Try-On Usage Tracking
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1) Create the usage tracking table
create table if not exists tryon_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- 2) Enable Row Level Security
alter table tryon_usage enable row level security;

-- 3) RLS Policies - users can only access their own data
create policy "Users can read own usage"
on tryon_usage for select
using (auth.uid() = user_id);

create policy "Users can update own usage"
on tryon_usage for update
using (auth.uid() = user_id);

create policy "Users can insert own usage"
on tryon_usage for insert
with check (auth.uid() = user_id);

-- 4) RPC Function - atomic check and increment
create or replace function check_and_increment_tryons(daily_limit integer)
returns json
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
  new_count integer;
begin
  -- Atomic insert or update
  insert into tryon_usage (user_id, day, count)
  values (auth.uid(), today, 1)
  on conflict (user_id, day)
  do update set
    count = tryon_usage.count + 1,
    updated_at = now()
  returning count into new_count;

  -- Return JSON with usage info
  return json_build_object(
    'allowed', new_count <= daily_limit,
    'count', new_count,
    'limit', daily_limit,
    'remaining', greatest(0, daily_limit - new_count)
  );
end;
$$;

-- 5) Optional: Function to get current usage without incrementing
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

  if current_count is null then
    current_count := 0;
  end if;

  return json_build_object(
    'count', current_count,
    'date', today
  );
end;
$$;

-- Done! Now configure these environment variables in Vercel:
-- SUPABASE_URL=https://afqzpnwsxzhcffrrnyjw.supabase.co
-- SUPABASE_ANON_KEY=your_anon_key
-- DAILY_TRYON_LIMIT=50

-- ============================================
-- Anonymous (cookie-based) usage tracking
-- Server-side only (intended to be called with service_role)
-- ============================================

create table if not exists tryon_anon_usage (
  anon_id text not null,
  day date not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (anon_id, day)
);

alter table tryon_anon_usage enable row level security;

revoke all on table tryon_anon_usage from anon, authenticated;
grant all on table tryon_anon_usage to service_role;

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

    return json_build_object('allowed', false, 'count', new_count, 'limit', daily_limit, 'remaining', 0);
  end if;

  return json_build_object(
    'allowed', true,
    'count', new_count,
    'limit', daily_limit,
    'remaining', greatest(0, daily_limit - new_count)
  );
end;
$$;

revoke all on function check_and_increment_tryons_anon(text, integer) from public;
grant execute on function check_and_increment_tryons_anon(text, integer) to service_role;
