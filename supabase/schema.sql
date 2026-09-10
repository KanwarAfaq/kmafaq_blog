-- KM Afaq Supabase schema
-- Run this file in the Supabase SQL Editor on a new project.
-- Media files are stored in Cloudinary; Supabase stores URLs + Cloudinary identifiers only.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text not null,
  excerpt text,
  language text not null default 'ur' check (language in ('ur', 'en')),

  -- Cloudinary image reference. Never store file blobs/base64 in Postgres.
  cover_image_url text,
  cover_image_public_id text,
  cover_image_asset_id text,

  -- Optional Cloudinary video reference.
  cover_video_url text,
  cover_video_public_id text,
  cover_video_asset_id text,

  -- AI agent / SEO metadata. These fields are nullable for manually-authored or demo posts.
  seo_description text,
  source_topic text,
  topic_category text not null default 'trending' check (topic_category in ('ai-tech','business','politics','world','sports','science','health','trending')),
  source_url text,
  source_provider text,
  research_provider text,
  ai_provider text,
  image_provider text,
  cover_image_source_url text,
  cover_image_attribution text,
  cover_image_license text,
  is_ai_generated boolean not null default false,
  agent_version text,
  agent_notification_status jsonb not null default '{}'::jsonb,

  -- Nullable so demo content can be seeded before an Auth user exists.
  -- Production/admin-authored posts should set this to auth.users.id.
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price numeric(12, 2),
  image_url text,
  image_public_id text,
  image_asset_id text
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_likes_post_user_unique unique (post_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Server-only state for the once-per-day LINE 10/10 completion summary.
create table if not exists public.agent_daily_status (
  publish_date date primary key,
  line_summary_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration-safe additions if you run this over the earlier Supabase-storage schema.
alter table public.posts add column if not exists language text not null default 'ur';
alter table public.posts drop constraint if exists posts_language_check;
alter table public.posts add constraint posts_language_check check (language in ('ur', 'en'));
alter table public.posts add column if not exists cover_image_public_id text;
alter table public.posts add column if not exists cover_image_asset_id text;
alter table public.posts add column if not exists cover_video_url text;
alter table public.posts add column if not exists cover_video_public_id text;
alter table public.posts add column if not exists cover_video_asset_id text;
alter table public.posts add column if not exists seo_description text;
alter table public.posts add column if not exists source_topic text;
alter table public.posts add column if not exists topic_category text not null default 'trending';
alter table public.posts drop constraint if exists posts_topic_category_check;
alter table public.posts add constraint posts_topic_category_check check (topic_category in ('ai-tech','business','politics','world','sports','science','health','trending'));
alter table public.posts add column if not exists source_url text;
alter table public.posts add column if not exists source_provider text;
alter table public.posts add column if not exists research_provider text;
alter table public.posts add column if not exists ai_provider text;
alter table public.posts add column if not exists image_provider text;
alter table public.posts add column if not exists cover_image_source_url text;
alter table public.posts add column if not exists cover_image_attribution text;
alter table public.posts add column if not exists cover_image_license text;
alter table public.posts add column if not exists is_ai_generated boolean not null default false;
alter table public.posts add column if not exists agent_version text;
alter table public.posts add column if not exists agent_notification_status jsonb not null default '{}'::jsonb;
alter table public.services add column if not exists image_public_id text;
alter table public.services add column if not exists image_asset_id text;

-- Allow seed/demo posts without an Auth user even when upgrading an older schema.
alter table public.posts alter column author_id drop not null;
alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

create index if not exists posts_status_created_at_idx on public.posts (status, created_at desc);
create index if not exists posts_language_status_created_at_idx on public.posts (language, status, created_at desc);
create index if not exists posts_source_topic_created_at_idx on public.posts (source_topic, created_at desc);
create index if not exists posts_topic_category_status_created_at_idx on public.posts (topic_category, status, created_at desc);
create index if not exists post_likes_post_id_idx on public.post_likes (post_id);
create index if not exists post_likes_user_id_idx on public.post_likes (user_id);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, is_read, created_at desc);

-- -----------------------------------------------------------------------------
-- Privileges + Row Level Security
-- -----------------------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.services enable row level security;
alter table public.post_likes enable row level security;
alter table public.notifications enable row level security;
alter table public.agent_daily_status enable row level security;

revoke all on table public.posts from anon, authenticated;
revoke all on table public.services from anon, authenticated;
revoke all on table public.post_likes from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.agent_daily_status from anon, authenticated;

grant select on table public.posts to anon, authenticated;
grant insert, update, delete on table public.posts to authenticated;

grant select on table public.services to anon, authenticated;
grant insert, update, delete on table public.services to authenticated;

grant select, insert, delete on table public.post_likes to authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

-- Public visitors only see published posts.
drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
on public.posts for select
to anon, authenticated
using (status = 'published');

-- Authenticated admins can additionally manage all posts.
drop policy if exists "Admins can read all posts" on public.posts;
create policy "Admins can read all posts"
on public.posts for select
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can insert posts" on public.posts;
create policy "Admins can insert posts"
on public.posts for insert
to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update posts" on public.posts;
create policy "Admins can update posts"
on public.posts for update
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
on public.posts for delete
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Services are public, but only admin users may modify them.
drop policy if exists "Public can read services" on public.services;
create policy "Public can read services"
on public.services for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert services" on public.services;
create policy "Admins can insert services"
on public.services for insert
to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update services" on public.services;
create policy "Admins can update services"
on public.services for update
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete services" on public.services;
create policy "Admins can delete services"
on public.services for delete
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Users can inspect only their own like row, preventing exposure of other user IDs.
drop policy if exists "Users can read own likes" on public.post_likes;
create policy "Users can read own likes"
on public.post_likes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can like published posts" on public.post_likes;
create policy "Users can like published posts"
on public.post_likes for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.posts p
    where p.id = post_id and p.status = 'published'
  )
);

drop policy if exists "Users can remove own likes" on public.post_likes;
create policy "Users can remove own likes"
on public.post_likes for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Notifications are private to the recipient. Browser clients cannot insert them.
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Secure public like count: avoids exposing post_likes.user_id to anonymous users.
-- -----------------------------------------------------------------------------
create or replace function public.get_post_like_count(target_post_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.post_likes l
  join public.posts p on p.id = l.post_id
  where l.post_id = target_post_id and p.status = 'published';
$$;

revoke all on function public.get_post_like_count(uuid) from public;
grant execute on function public.get_post_like_count(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Like -> notification automation.
-- Demo posts have author_id = null, so likes work but no notification is created.
-- Real authored posts notify their author.
-- -----------------------------------------------------------------------------
create or replace function public.notify_post_author_on_like()
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
  select author_id, title, slug
  into target_author, target_title, target_slug
  from public.posts
  where id = new.post_id;

  if target_author is not null then
    insert into public.notifications (user_id, type, message, link)
    values (
      target_author,
      'post_like',
      'Someone liked your post: ' || target_title,
      '/blog/' || target_slug
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_post_author_on_like() from public, anon, authenticated;

drop trigger if exists post_like_notification_trigger on public.post_likes;
create trigger post_like_notification_trigger
after insert on public.post_likes
for each row execute function public.notify_post_author_on_like();

-- -----------------------------------------------------------------------------
-- Realtime: new published posts and notifications update without reload.
-- -----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
