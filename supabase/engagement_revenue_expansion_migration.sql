-- KM Afaq engagement + monetization expansion
-- Features: 4-digit email OTP auth support, reactions, comments/replies,
-- digital products, digest sponsorships, jobs/freelance board.
-- Safe to run after monetization_line_migration.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Server-only 4-digit OTP storage
-- ---------------------------------------------------------------------------
create table if not exists public.auth_otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('login','signup','reset')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  request_ip text,
  created_at timestamptz not null default now()
);
create index if not exists auth_otp_email_purpose_created_idx
  on public.auth_otp_codes (email, purpose, created_at desc);
alter table public.auth_otp_codes enable row level security;
-- No browser policies: service-role API only.

create or replace function public.auth_user_exists(target_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(target_email)));
$$;

create or replace function public.auth_user_id_by_email(target_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(target_email)) limit 1;
$$;

revoke all on function public.auth_user_exists(text) from public, anon, authenticated;
revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_exists(text) to service_role;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Reactions (one reaction per user/post)
-- ---------------------------------------------------------------------------
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  reaction text not null check (reaction in ('like','happy','sad','bad','excited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id, reaction);
create index if not exists post_reactions_user_idx on public.post_reactions (user_id, created_at desc);
alter table public.post_reactions enable row level security;

drop trigger if exists post_reactions_set_updated_at on public.post_reactions;
create trigger post_reactions_set_updated_at
before update on public.post_reactions
for each row execute function public.set_updated_at();

-- Preserve old likes as the new "like" reaction.
insert into public.post_reactions (post_id, user_id, reaction, created_at)
select l.post_id, l.user_id, 'like', l.created_at
from public.post_likes l
join public.user_profiles p on p.user_id = l.user_id
on conflict (post_id, user_id) do nothing;

drop policy if exists "Public can read reactions" on public.post_reactions;
create policy "Public can read reactions"
on public.post_reactions for select
to anon, authenticated
using (true);

drop policy if exists "Users can add own reaction" on public.post_reactions;
create policy "Users can add own reaction"
on public.post_reactions for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
);

drop policy if exists "Users can update own reaction" on public.post_reactions;
create policy "Users can update own reaction"
on public.post_reactions for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
);

drop policy if exists "Users can remove own reaction" on public.post_reactions;
create policy "Users can remove own reaction"
on public.post_reactions for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.notify_post_author_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_author uuid;
  target_title text;
  target_slug text;
begin
  select author_id, title, slug into target_author, target_title, target_slug
  from public.posts where id = new.post_id;

  if target_author is not null and target_author <> new.user_id then
    insert into public.notifications (user_id, type, message, link)
    values (
      target_author,
      'post_reaction',
      'Someone reacted ' || new.reaction || ' to your post: ' || target_title,
      '/blog/' || target_slug
    );
  end if;
  return new;
end;
$$;

drop trigger if exists post_reaction_notification_trigger on public.post_reactions;
create trigger post_reaction_notification_trigger
after insert on public.post_reactions
for each row execute function public.notify_post_author_on_reaction();

-- ---------------------------------------------------------------------------
-- 3) Comments, replies, reports and notifications
-- ---------------------------------------------------------------------------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  author_name text not null default 'Reader',
  author_avatar_url text,
  status text not null default 'published' check (status in ('published','hidden','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_body_length check (char_length(trim(body)) between 1 and 2000)
);
create index if not exists post_comments_post_created_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_parent_idx on public.post_comments (parent_id, created_at);
create index if not exists post_comments_status_idx on public.post_comments (status, created_at desc);
alter table public.post_comments enable row level security;

drop trigger if exists post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
before update on public.post_comments
for each row execute function public.set_updated_at();

create or replace function public.prepare_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_post uuid;
  profile_name text;
  profile_avatar text;
begin
  if new.parent_id is not null then
    select post_id into parent_post from public.post_comments where id = new.parent_id;
    if parent_post is null or parent_post <> new.post_id then
      raise exception 'Reply parent must belong to the same post';
    end if;
  end if;

  select coalesce(nullif(display_name,''), nullif(username,''), nullif(full_name,''), 'Reader'), avatar_url
  into profile_name, profile_avatar
  from public.user_profiles where user_id = new.user_id;

  new.author_name := coalesce(profile_name, 'Reader');
  new.author_avatar_url := profile_avatar;
  new.body := trim(new.body);
  return new;
end;
$$;

drop trigger if exists post_comments_prepare_trigger on public.post_comments;
create trigger post_comments_prepare_trigger
before insert on public.post_comments
for each row execute function public.prepare_post_comment();

drop policy if exists "Public can read published comments" on public.post_comments;
create policy "Public can read published comments"
on public.post_comments for select
to anon, authenticated
using (status = 'published' or auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Users can add comments" on public.post_comments;
create policy "Users can add comments"
on public.post_comments for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'published'
  and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
);

drop policy if exists "Users can delete own comments" on public.post_comments;
create policy "Users can delete own comments"
on public.post_comments for delete
to authenticated
using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can moderate comments" on public.post_comments;
create policy "Admins can moderate comments"
on public.post_comments for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  reporter_id uuid not null references public.user_profiles(user_id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id),
  constraint comment_report_reason_length check (char_length(trim(reason)) between 2 and 500)
);
create index if not exists comment_reports_status_created_idx on public.comment_reports (status, created_at desc);
alter table public.comment_reports enable row level security;

drop policy if exists "Users can report comments" on public.comment_reports;
create policy "Users can report comments"
on public.comment_reports for insert
to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "Users can read own reports" on public.comment_reports;
create policy "Users can read own reports"
on public.comment_reports for select
to authenticated
using (auth.uid() = reporter_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage comment reports" on public.comment_reports;
create policy "Admins can manage comment reports"
on public.comment_reports for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.notify_on_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  target_title text;
  target_slug text;
  parent_user uuid;
begin
  select title, slug into target_title, target_slug from public.posts where id = new.post_id;

  if new.parent_id is not null then
    select user_id into parent_user from public.post_comments where id = new.parent_id;
    target_user := parent_user;
  else
    select author_id into target_user from public.posts where id = new.post_id;
  end if;

  if target_user is not null and target_user <> new.user_id then
    insert into public.notifications (user_id, type, message, link)
    values (
      target_user,
      case when new.parent_id is null then 'post_comment' else 'comment_reply' end,
      case when new.parent_id is null
        then new.author_name || ' commented on: ' || target_title
        else new.author_name || ' replied to your comment on: ' || target_title
      end,
      '/blog/' || target_slug || '#comments'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists post_comment_notification_trigger on public.post_comments;
create trigger post_comment_notification_trigger
after insert on public.post_comments
for each row execute function public.notify_on_post_comment();

create or replace function public.edit_own_comment(target_comment_id uuid, new_body text)
returns public.post_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.post_comments;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(coalesce(new_body, ''))) < 1 or char_length(trim(new_body)) > 2000 then
    raise exception 'Comment must be between 1 and 2000 characters';
  end if;
  update public.post_comments
  set body = trim(new_body)
  where id = target_comment_id and user_id = auth.uid() and status = 'published'
  returning * into updated_row;
  if updated_row.id is null then
    raise exception 'Comment not found or cannot be edited';
  end if;
  return updated_row;
end;
$$;

revoke all on function public.edit_own_comment(uuid, text) from public, anon;
grant execute on function public.edit_own_comment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Digital product store (manual payment/order handling until checkout later)
-- ---------------------------------------------------------------------------
create table if not exists public.digital_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text not null,
  description text,
  category text not null default 'AI Resources',
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'USD',
  cover_url text,
  preview_url text,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists digital_products_public_idx on public.digital_products (status, featured desc, created_at desc);
alter table public.digital_products enable row level security;

drop trigger if exists digital_products_set_updated_at on public.digital_products;
create trigger digital_products_set_updated_at
before update on public.digital_products
for each row execute function public.set_updated_at();

drop policy if exists "Public can read active digital products" on public.digital_products;
create policy "Public can read active digital products"
on public.digital_products for select
to anon, authenticated
using (status = 'active' or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins manage digital products" on public.digital_products;
create policy "Admins manage digital products"
on public.digital_products for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.digital_product_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.digital_products(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  message text,
  status text not null default 'new' check (status in ('new','contacted','paid','delivered','cancelled','spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists digital_product_orders_status_created_idx on public.digital_product_orders (status, created_at desc);
alter table public.digital_product_orders enable row level security;

drop trigger if exists digital_product_orders_set_updated_at on public.digital_product_orders;
create trigger digital_product_orders_set_updated_at
before update on public.digital_product_orders
for each row execute function public.set_updated_at();

drop policy if exists "Users can read own product orders" on public.digital_product_orders;
create policy "Users can read own product orders"
on public.digital_product_orders for select
to authenticated
using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins manage product orders" on public.digital_product_orders;
create policy "Admins manage product orders"
on public.digital_product_orders for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- Inserts are server/service-role only so price cannot be forged from the browser.

-- ---------------------------------------------------------------------------
-- 6) Sponsored Email / LINE digest campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.digest_sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_name text not null,
  headline text not null,
  body text,
  cta_label text not null default 'Learn more',
  cta_url text not null,
  channels text[] not null default array['email','line']::text[],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  impression_count bigint not null default 0,
  click_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digest_sponsor_channels_check check (
    channels <@ array['email','line']::text[] and cardinality(channels) >= 1
  )
);
create index if not exists digest_sponsor_active_idx on public.digest_sponsor_campaigns (status, starts_at, ends_at);
alter table public.digest_sponsor_campaigns enable row level security;

drop trigger if exists digest_sponsor_set_updated_at on public.digest_sponsor_campaigns;
create trigger digest_sponsor_set_updated_at
before update on public.digest_sponsor_campaigns
for each row execute function public.set_updated_at();

drop policy if exists "Admins manage digest sponsor campaigns" on public.digest_sponsor_campaigns;
create policy "Admins manage digest sponsor campaigns"
on public.digest_sponsor_campaigns for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.digest_sponsor_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.digest_sponsor_campaigns(id) on delete cascade,
  channel text not null check (channel in ('email','line','web')),
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists digest_sponsor_clicks_campaign_created_idx on public.digest_sponsor_clicks (campaign_id, created_at desc);
alter table public.digest_sponsor_clicks enable row level security;

drop policy if exists "Admins read digest sponsor clicks" on public.digest_sponsor_clicks;
create policy "Admins read digest sponsor clicks"
on public.digest_sponsor_clicks for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.increment_digest_sponsor_impression(target_campaign_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.digest_sponsor_campaigns
  set impression_count = impression_count + 1
  where id = target_campaign_id;
$$;

create or replace function public.increment_digest_sponsor_click(target_campaign_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.digest_sponsor_campaigns
  set click_count = click_count + 1
  where id = target_campaign_id;
$$;

-- ---------------------------------------------------------------------------
-- 7) Jobs / freelance board
-- ---------------------------------------------------------------------------
create table if not exists public.job_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  company_name text not null,
  description text not null,
  location text,
  work_mode text not null default 'remote' check (work_mode in ('remote','hybrid','onsite')),
  employment_type text not null default 'full-time' check (employment_type in ('full-time','part-time','contract','internship','freelance')),
  apply_url text,
  apply_email text,
  salary_text text,
  logo_url text,
  plan text not null default 'standard' check (plan in ('standard','featured')),
  featured boolean not null default false,
  status text not null default 'pending' check (status in ('pending','active','paused','rejected','expired')),
  expires_at timestamptz,
  click_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_apply_destination_check check (apply_url is not null or apply_email is not null)
);
create index if not exists job_listings_public_idx on public.job_listings (status, featured desc, created_at desc);
create index if not exists job_listings_expiry_idx on public.job_listings (expires_at);
alter table public.job_listings enable row level security;

drop trigger if exists job_listings_set_updated_at on public.job_listings;
create trigger job_listings_set_updated_at
before update on public.job_listings
for each row execute function public.set_updated_at();

drop policy if exists "Public can read active jobs" on public.job_listings;
create policy "Public can read active jobs"
on public.job_listings for select
to anon, authenticated
using (
  (status = 'active' and (expires_at is null or expires_at > now()))
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "Admins manage jobs" on public.job_listings;
create policy "Admins manage jobs"
on public.job_listings for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.job_submissions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.job_listings(id) on delete cascade,
  contact_name text not null,
  contact_email text not null,
  company_website text,
  notes text,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost','spam')),
  created_at timestamptz not null default now()
);
create index if not exists job_submissions_status_created_idx on public.job_submissions (status, created_at desc);
alter table public.job_submissions enable row level security;

drop policy if exists "Admins read job submissions" on public.job_submissions;
create policy "Admins read job submissions"
on public.job_submissions for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins update job submissions" on public.job_submissions;
create policy "Admins update job submissions"
on public.job_submissions for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.increment_job_click(target_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.job_listings
  set click_count = click_count + 1
  where id = target_job_id and status = 'active';
$$;

-- Add new products to the existing manual sales funnel.
alter table public.monetization_requests drop constraint if exists monetization_product_check;
alter table public.monetization_requests add constraint monetization_product_check
  check (product in (
    'premium-alerts',
    'featured-listing',
    'sponsored-post',
    'business-premium',
    'digest-sponsor',
    'featured-job',
    'digital-product'
  ));

-- Realtime helps comments and notifications update quickly.
do $$
begin
  alter publication supabase_realtime add table public.post_comments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_reactions;
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------------
-- Explicit grants: RLS remains the authorization layer. Server-only tables and
-- counters are restricted to service_role.
-- ---------------------------------------------------------------------------
revoke all on public.auth_otp_codes from anon, authenticated;
grant select, insert, update, delete on public.auth_otp_codes to service_role;

grant select on public.post_reactions to anon, authenticated;
grant insert, update, delete on public.post_reactions to authenticated;
grant select on public.post_comments to anon, authenticated;
grant insert, delete on public.post_comments to authenticated;
grant select, insert on public.comment_reports to authenticated;
grant update on public.comment_reports to authenticated;

grant select on public.digital_products to anon, authenticated;
grant insert, update, delete on public.digital_products to authenticated;
grant select on public.digital_product_orders to authenticated;
grant update on public.digital_product_orders to authenticated;
grant insert, select, update, delete on public.digital_product_orders to service_role;

grant select, insert, update, delete on public.digest_sponsor_campaigns to authenticated;
grant select on public.digest_sponsor_clicks to authenticated;
grant select, insert, update on public.digest_sponsor_campaigns to service_role;
grant insert, select on public.digest_sponsor_clicks to service_role;

grant select on public.job_listings to anon, authenticated;
grant insert, update, delete on public.job_listings to authenticated;
grant select, update on public.job_submissions to authenticated;
grant insert, select, update, delete on public.job_listings to service_role;
grant insert, select, update on public.job_submissions to service_role;

revoke all on function public.increment_digest_sponsor_impression(uuid) from public, anon, authenticated;
revoke all on function public.increment_digest_sponsor_click(uuid) from public, anon, authenticated;
revoke all on function public.increment_job_click(uuid) from public, anon, authenticated;
grant execute on function public.increment_digest_sponsor_impression(uuid) to service_role;
grant execute on function public.increment_digest_sponsor_click(uuid) to service_role;
grant execute on function public.increment_job_click(uuid) to service_role;
