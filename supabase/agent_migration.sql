-- KM Afaq Python AI Agent v0.2 migration
-- Safe to run on an existing KM Afaq database.

alter table public.posts add column if not exists language text not null default 'ur';
alter table public.posts drop constraint if exists posts_language_check;
alter table public.posts add constraint posts_language_check check (language in ('ur', 'en'));
alter table public.posts add column if not exists seo_description text;
alter table public.posts add column if not exists source_topic text;
alter table public.posts add column if not exists source_url text;
alter table public.posts add column if not exists source_provider text;
alter table public.posts add column if not exists research_provider text;
alter table public.posts add column if not exists ai_provider text;
alter table public.posts add column if not exists image_provider text;
alter table public.posts add column if not exists is_ai_generated boolean not null default false;
alter table public.posts add column if not exists agent_version text;

-- External stock/open-license image metadata. The actual image remains in Cloudinary.
alter table public.posts add column if not exists cover_image_source_url text;
alter table public.posts add column if not exists cover_image_attribution text;
alter table public.posts add column if not exists cover_image_license text;

-- Kept for backwards compatibility with older runs; v0.2 no longer uses per-post owner notifications.
alter table public.posts add column if not exists agent_notification_status jsonb not null default '{}'::jsonb;

create index if not exists posts_source_topic_created_at_idx
on public.posts (source_topic, created_at desc);

create index if not exists posts_language_status_created_at_idx
on public.posts (language, status, created_at desc);

-- Tracks the single LINE completion message for each Pakistan publishing day.
create table if not exists public.agent_daily_status (
  publish_date date primary key,
  line_summary_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_daily_status enable row level security;
revoke all on table public.agent_daily_status from anon, authenticated;

comment on column public.posts.source_topic is 'Original Google Trends/search candidate selected by the publishing agent.';
comment on column public.posts.source_provider is 'Topic discovery provider such as google_trends, tavily, brave, or manual.';
comment on column public.posts.research_provider is 'Research context provider chain used to ground the article.';
comment on column public.posts.ai_provider is 'Text provider that successfully generated the final article.';
comment on column public.posts.image_provider is 'Cover provider: Gemini model, Pexels, Pixabay, or Openverse.';
comment on column public.posts.cover_image_source_url is 'Original landing/source page for externally sourced cover images.';
comment on column public.posts.cover_image_attribution is 'Display attribution for externally sourced images.';
comment on column public.posts.cover_image_license is 'License/source label for externally sourced images.';
comment on column public.posts.language is 'Article language: ur for Urdu, en for English.';
comment on table public.agent_daily_status is 'Server-side agent state used to ensure one LINE 10/10 daily summary.';


-- Reader-facing topic category for filters/recommendations.
alter table public.posts add column if not exists topic_category text not null default 'trending';
alter table public.posts drop constraint if exists posts_topic_category_check;
alter table public.posts add constraint posts_topic_category_check check (topic_category in ('ai-tech','business','politics','world','sports','science','health','trending'));
create index if not exists posts_topic_category_status_created_at_idx on public.posts (topic_category, status, created_at desc);
