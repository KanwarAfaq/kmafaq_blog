-- KM Afaq: private user profiles + digest notification preferences
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  display_name text,
  bio text,
  avatar_url text,
  avatar_public_id text,
  avatar_asset_id text,
  phone text,
  country text,
  city text,
  timezone text not null default 'Asia/Karachi',
  preferred_language text not null default 'both',
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_format check (
    username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'
  ),
  constraint user_profiles_bio_length check (bio is null or char_length(bio) <= 500),
  constraint user_profiles_language_check check (preferred_language in ('ur','en','both'))
);

create unique index if not exists user_profiles_username_unique_idx
  on public.user_profiles (lower(username)) where username is not null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  email_enabled boolean not null default false,
  line_enabled boolean not null default false,
  line_user_id text,
  line_display_name text,
  line_picture_url text,
  line_friend boolean not null default false,
  line_connected_at timestamptz,
  topics text[] not null default array['ai-tech','business','politics','world','sports','science','health','trending']::text[],
  languages text[] not null default array['ur','en']::text[],
  frequency text not null default 'daily',
  weekly_day smallint not null default 1,
  custom_weekdays smallint[] not null default '{}'::smallint[],
  preferred_time time not null default '09:00',
  timezone text not null default 'Asia/Karachi',
  last_sent_at timestamptz,
  next_digest_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_frequency_check check (frequency in ('daily','weekly','every_15_days','every_30_days','custom_days')),
  constraint notification_weekly_day_check check (weekly_day between 0 and 6),
  constraint notification_topics_check check (
    topics <@ array['ai-tech','business','politics','world','sports','science','health','trending']::text[]
  ),
  constraint notification_languages_check check (
    languages <@ array['ur','en']::text[] and cardinality(languages) >= 1
  )
);

create table if not exists public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email','line')),
  period_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  post_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, channel, period_key)
);

create index if not exists notification_preferences_due_idx
  on public.notification_preferences (active, next_digest_at);
create index if not exists notification_delivery_user_created_idx
  on public.notification_delivery_log (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Seed rows for existing Auth users.
insert into public.user_profiles (user_id, full_name, display_name)
select
  id,
  nullif(raw_user_meta_data ->> 'full_name', ''),
  coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1))
from auth.users
on conflict (user_id) do nothing;

insert into public.notification_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Auto-create account rows for new users.
create or replace function public.handle_new_user_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, full_name, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Keep the trigger idempotent if another app has a similarly named trigger.
drop trigger if exists on_auth_user_created_km_afaq on auth.users;
create trigger on_auth_user_created_km_afaq
after insert on auth.users
for each row execute function public.handle_new_user_account();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_delivery_log enable row level security;

revoke all on public.user_profiles from anon, authenticated;
revoke all on public.notification_preferences from anon, authenticated;
revoke all on public.notification_delivery_log from anon, authenticated;

grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notification_delivery_log to authenticated;

drop policy if exists "Users manage own profile" on public.user_profiles;
create policy "Users manage own profile"
on public.user_profiles
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences"
on public.notification_preferences
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own delivery log" on public.notification_delivery_log;
create policy "Users read own delivery log"
on public.notification_delivery_log
for select to authenticated
using ((select auth.uid()) = user_id);
