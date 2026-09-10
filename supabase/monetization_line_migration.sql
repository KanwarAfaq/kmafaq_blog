-- KM Afaq: LINE QR subscribers + monetization features
-- Run once in Supabase SQL Editor after the existing migrations.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- LINE subscribers who do not need a website/Auth account.
-- Access is server-only; a signed random preference token is used by the API.
-- ---------------------------------------------------------------------------
create table if not exists public.line_subscribers (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  line_display_name text,
  line_picture_url text,
  line_friend boolean not null default true,
  active boolean not null default true,
  topics text[] not null default array['ai-tech','business','politics','world','sports','science','health','trending']::text[],
  languages text[] not null default array['ur','en']::text[],
  frequency text not null default 'daily',
  weekly_day smallint not null default 1,
  custom_weekdays smallint[] not null default '{}'::smallint[],
  preferred_time time not null default '09:00',
  timezone text not null default 'Asia/Karachi',
  preference_token_hash text,
  last_sent_at timestamptz,
  next_digest_at timestamptz,
  followed_at timestamptz not null default now(),
  unfollowed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint line_subscriber_frequency_check check (frequency in ('daily','weekly','every_15_days','every_30_days','custom_days')),
  constraint line_subscriber_weekly_day_check check (weekly_day between 0 and 6),
  constraint line_subscriber_topics_check check (
    topics <@ array['ai-tech','business','politics','world','sports','science','health','trending']::text[]
  ),
  constraint line_subscriber_languages_check check (
    languages <@ array['ur','en']::text[] and cardinality(languages) >= 1
  )
);

create index if not exists line_subscribers_due_idx
  on public.line_subscribers (active, line_friend, next_digest_at);
create index if not exists line_subscribers_token_idx
  on public.line_subscribers (preference_token_hash) where preference_token_hash is not null;

drop trigger if exists line_subscribers_set_updated_at on public.line_subscribers;
create trigger line_subscribers_set_updated_at
before update on public.line_subscribers
for each row execute function public.set_updated_at();

create table if not exists public.line_delivery_log (
  id uuid primary key default gen_random_uuid(),
  line_subscriber_id uuid not null references public.line_subscribers(id) on delete cascade,
  period_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  post_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (line_subscriber_id, period_key)
);
create index if not exists line_delivery_subscriber_created_idx
  on public.line_delivery_log (line_subscriber_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Monetization plan state + premium keyword/company/person alerts.
-- Payments can be handled manually first; activate a user by setting
-- subscription_tier='premium' and subscription_status='active'.
-- ---------------------------------------------------------------------------
alter table public.user_profiles
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists subscription_expires_at timestamptz;

alter table public.user_profiles drop constraint if exists user_profiles_subscription_tier_check;
alter table public.user_profiles add constraint user_profiles_subscription_tier_check
  check (subscription_tier in ('free','premium','business'));
alter table public.user_profiles drop constraint if exists user_profiles_subscription_status_check;
alter table public.user_profiles add constraint user_profiles_subscription_status_check
  check (subscription_status in ('inactive','active','trial','past_due','cancelled'));

create table if not exists public.premium_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  keywords text[] not null,
  topics text[] not null default '{}'::text[],
  languages text[] not null default array['ur','en']::text[],
  channels text[] not null default array['email']::text[],
  active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint premium_alert_name_length check (char_length(name) between 2 and 80),
  constraint premium_alert_keywords_check check (cardinality(keywords) between 1 and 20),
  constraint premium_alert_topics_check check (
    topics <@ array['ai-tech','business','politics','world','sports','science','health','trending']::text[]
  ),
  constraint premium_alert_languages_check check (
    languages <@ array['ur','en']::text[] and cardinality(languages) >= 1
  ),
  constraint premium_alert_channels_check check (
    channels <@ array['email','line']::text[] and cardinality(channels) >= 1
  )
);
create index if not exists premium_alerts_user_active_idx on public.premium_alerts (user_id, active);

drop trigger if exists premium_alerts_set_updated_at on public.premium_alerts;
create trigger premium_alerts_set_updated_at
before update on public.premium_alerts
for each row execute function public.set_updated_at();

create table if not exists public.premium_alert_delivery_log (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.premium_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  channel text not null check (channel in ('email','line')),
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (alert_id, post_id, channel)
);
create index if not exists premium_alert_delivery_user_created_idx
  on public.premium_alert_delivery_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sponsored content metadata.
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists is_sponsored boolean not null default false,
  add column if not exists sponsor_name text,
  add column if not exists sponsor_url text,
  add column if not exists sponsor_cta text;

create index if not exists posts_sponsored_status_created_idx
  on public.posts (is_sponsored, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Business directory + lead generation.
-- ---------------------------------------------------------------------------
create table if not exists public.business_listings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text not null,
  description text,
  category text not null default 'technology',
  website_url text,
  contact_email text,
  logo_url text,
  city text,
  country text,
  plan text not null default 'free',
  featured boolean not null default false,
  status text not null default 'pending',
  click_count bigint not null default 0,
  lead_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_listing_plan_check check (plan in ('free','featured','premium')),
  constraint business_listing_status_check check (status in ('pending','active','paused','rejected'))
);
create index if not exists business_listings_public_idx
  on public.business_listings (status, featured desc, created_at desc);

drop trigger if exists business_listings_set_updated_at on public.business_listings;
create trigger business_listings_set_updated_at
before update on public.business_listings
for each row execute function public.set_updated_at();

create table if not exists public.business_leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_listings(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  source_url text,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost','spam')),
  created_at timestamptz not null default now()
);
create index if not exists business_leads_listing_created_idx
  on public.business_leads (listing_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Affiliate / AI tools directory with first-party click tracking.
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  category text not null,
  pricing_label text,
  website_url text not null,
  affiliate_url text not null,
  logo_url text,
  badge text,
  featured boolean not null default false,
  status text not null default 'active',
  click_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_tool_status_check check (status in ('active','paused'))
);
create index if not exists affiliate_tools_public_idx
  on public.affiliate_tools (status, featured desc, created_at desc);

drop trigger if exists affiliate_tools_set_updated_at on public.affiliate_tools;
create trigger affiliate_tools_set_updated_at
before update on public.affiliate_tools
for each row execute function public.set_updated_at();

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.affiliate_tools(id) on delete cascade,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_tool_created_idx
  on public.affiliate_clicks (tool_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sales/inquiry funnel for premium alerts, sponsored posts and listings.
-- This makes the features sellable immediately while payment is handled
-- manually; Stripe/Lemon Squeezy can be plugged in later without schema churn.
-- ---------------------------------------------------------------------------
create table if not exists public.monetization_requests (
  id uuid primary key default gen_random_uuid(),
  product text not null,
  name text not null,
  email text not null,
  company text,
  website_url text,
  budget text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint monetization_product_check check (product in ('premium-alerts','featured-listing','sponsored-post','business-premium')),
  constraint monetization_status_check check (status in ('new','contacted','qualified','won','lost','spam'))
);
create index if not exists monetization_requests_created_idx
  on public.monetization_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS / grants.
-- ---------------------------------------------------------------------------
alter table public.line_subscribers enable row level security;
alter table public.line_delivery_log enable row level security;
alter table public.premium_alerts enable row level security;
alter table public.premium_alert_delivery_log enable row level security;
alter table public.business_listings enable row level security;
alter table public.business_leads enable row level security;
alter table public.affiliate_tools enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.monetization_requests enable row level security;

-- LINE and private sales/lead data stay server-only (service role bypasses RLS).
revoke all on public.line_subscribers from anon, authenticated;
revoke all on public.line_delivery_log from anon, authenticated;
revoke all on public.business_leads from anon, authenticated;
revoke all on public.affiliate_clicks from anon, authenticated;
revoke all on public.monetization_requests from anon, authenticated;

-- Premium alerts are owned by authenticated users.
grant select, insert, update, delete on public.premium_alerts to authenticated;
grant select on public.premium_alert_delivery_log to authenticated;

drop policy if exists "Users manage own premium alerts" on public.premium_alerts;
create policy "Users manage own premium alerts"
on public.premium_alerts
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own premium alert delivery log" on public.premium_alert_delivery_log;
create policy "Users read own premium alert delivery log"
on public.premium_alert_delivery_log
for select to authenticated
using ((select auth.uid()) = user_id);

-- Public directory/tool browsing. Admin mutations follow the existing JWT role convention.
grant select on public.business_listings to anon, authenticated;
grant select on public.affiliate_tools to anon, authenticated;

drop policy if exists "Public can read active business listings" on public.business_listings;
create policy "Public can read active business listings"
on public.business_listings for select to anon, authenticated
using (status = 'active');

drop policy if exists "Admins manage business listings" on public.business_listings;
create policy "Admins manage business listings"
on public.business_listings for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can read active affiliate tools" on public.affiliate_tools;
create policy "Public can read active affiliate tools"
on public.affiliate_tools for select to anon, authenticated
using (status = 'active');

drop policy if exists "Admins manage affiliate tools" on public.affiliate_tools;
create policy "Admins manage affiliate tools"
on public.affiliate_tools for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Existing posts table already has RLS; sponsorship columns inherit it.

-- Atomic counters used by server endpoints.
create or replace function public.increment_business_lead_count(target_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.business_listings
  set lead_count = lead_count + 1
  where id = target_listing_id;
$$;

create or replace function public.increment_affiliate_click_count(target_tool_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.affiliate_tools
  set click_count = click_count + 1
  where id = target_tool_id;
$$;

revoke all on function public.increment_business_lead_count(uuid) from public, anon, authenticated;
revoke all on function public.increment_affiliate_click_count(uuid) from public, anon, authenticated;

-- Admin access for revenue operations.
grant select, update on public.business_leads to authenticated;
grant select, update on public.monetization_requests to authenticated;
grant select on public.affiliate_clicks to authenticated;
grant select on public.line_subscribers to authenticated;
grant select on public.line_delivery_log to authenticated;
grant select, insert, update, delete on public.business_listings to authenticated;
grant select, insert, update, delete on public.affiliate_tools to authenticated;

drop policy if exists "Admins read and update business leads" on public.business_leads;
create policy "Admins read and update business leads"
on public.business_leads for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins read and update monetization requests" on public.monetization_requests;
create policy "Admins read and update monetization requests"
on public.monetization_requests for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins read affiliate clicks" on public.affiliate_clicks;
create policy "Admins read affiliate clicks"
on public.affiliate_clicks for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins read LINE subscribers" on public.line_subscribers;
create policy "Admins read LINE subscribers"
on public.line_subscribers for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins read LINE delivery log" on public.line_delivery_log;
create policy "Admins read LINE delivery log"
on public.line_delivery_log for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

grant execute on function public.increment_business_lead_count(uuid) to service_role;
grant execute on function public.increment_affiliate_click_count(uuid) to service_role;

-- Enforce the premium paywall in RLS, not only in the React UI.
drop policy if exists "Users manage own premium alerts" on public.premium_alerts;
drop policy if exists "Users select own premium alerts" on public.premium_alerts;
drop policy if exists "Premium users insert own alerts" on public.premium_alerts;
drop policy if exists "Premium users update own alerts" on public.premium_alerts;
drop policy if exists "Users delete own premium alerts" on public.premium_alerts;

create policy "Users select own premium alerts"
on public.premium_alerts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Premium users insert own alerts"
on public.premium_alerts for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid())
      and p.subscription_tier in ('premium','business')
      and p.subscription_status in ('active','trial')
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  )
);

create policy "Premium users update own alerts"
on public.premium_alerts for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid())
      and p.subscription_tier in ('premium','business')
      and p.subscription_status in ('active','trial')
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  )
);

create policy "Users delete own premium alerts"
on public.premium_alerts for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.increment_business_click_count(target_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.business_listings
  set click_count = click_count + 1
  where id = target_listing_id;
$$;
revoke all on function public.increment_business_click_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_business_click_count(uuid) to service_role;

-- Protect paid-plan fields from self-upgrade through the normal authenticated API.
-- Users can still edit their normal profile fields; service_role/admin backend can manage plan fields.
revoke insert, update on public.user_profiles from authenticated;
grant insert (user_id, username, full_name, display_name, bio, avatar_url, avatar_public_id, avatar_asset_id, phone, country, city, timezone, preferred_language, website_url)
  on public.user_profiles to authenticated;
grant update (username, full_name, display_name, bio, avatar_url, avatar_public_id, avatar_asset_id, phone, country, city, timezone, preferred_language, website_url)
  on public.user_profiles to authenticated;
