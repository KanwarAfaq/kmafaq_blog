-- KM Afaq blog UX/topic upgrade
-- Run once in Supabase SQL Editor before deploying the updated frontend/agent.

alter table public.posts
add column if not exists topic_category text not null default 'trending';

alter table public.posts drop constraint if exists posts_topic_category_check;
alter table public.posts
add constraint posts_topic_category_check
check (topic_category in ('ai-tech','business','politics','world','sports','science','health','trending'));

-- Backfill existing content using deterministic keyword groups.
update public.posts
set topic_category = case
  when lower(coalesce(source_topic,'') || ' ' || coalesce(title,'')) ~
    '(cricket|football|soccer|formula 1|\mf1\M|tennis|world cup|premier league|nba|fifa|match|tournament)'
    then 'sports'
  when lower(coalesce(source_topic,'') || ' ' || coalesce(title,'')) ~
    '(election|politic|government|parliament|president|prime minister|minister|senate|public policy|\mpti\M|\mpml\M|\mppp\M)'
    then 'politics'
  when lower(coalesce(source_topic,'') || ' ' || coalesce(title,'')) ~
    '(war|conflict|ceasefire|military|missile|ukraine|gaza|israel|iran|geopolit|diplomac|\mnato\M|united nations)'
    then 'world'
  when lower(coalesce(source_topic,'') || ' ' || coalesce(title,'')) ~
    '(health|medical|hospital|snakebite|anti.?venom|vaccine|cancer|disease|virus|doctor|medicine)'
    then 'health'
  when lower(coalesce(source_topic,'') || ' ' || coalesce(title,'')) ~
    '(science|space|\mnasa\M|climate|earthquake|astronomy|\mmoon\M|\mmars\M|satellite)'
    then 'science'
  when lower(coalesce(source_topic,'') || ' ' || coalesce(title,'')) ~
    '(business|econom|market|inflation|interest rate|stock|finance|freelanc|earning|income|startup|crypto|\mxrp\M|bitcoin)'
    then 'business'
  when lower(coalesce(source_topic,'') || ' ' || coalesce(title,'')) ~
    '(artificial intelligence|\mai\M|chatgpt|gemini|groq|automation|technology|\mtech\M|software|coding|developer|cyber|iphone|android|chip|intel|nvidia|apple|google|microsoft)'
    then 'ai-tech'
  else 'trending'
end;

create index if not exists posts_topic_category_status_created_at_idx
on public.posts (topic_category, status, created_at desc);

comment on column public.posts.topic_category is
'Normalized reader-facing category used for blog filters and related-post recommendations.';
