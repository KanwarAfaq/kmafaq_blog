-- KM Afaq production content audit (READ ONLY)
-- Safe to run in the Supabase SQL Editor. This file does not modify data.

-- 1) Public inventory used by the website and sitemap.
select 'published_posts' as metric, count(*)::bigint as value
from public.posts where status = 'published'
union all
select 'active_products', count(*) from public.digital_products where status = 'active'
union all
select 'active_jobs', count(*) from public.job_listings where status = 'active' and (expires_at is null or expires_at > now())
union all
select 'active_businesses', count(*) from public.business_listings where status = 'active'
union all
select 'active_tools', count(*) from public.affiliate_tools where status = 'active'
union all
select 'services', count(*) from public.services
order by metric;

-- 2) Published posts with missing/weak search metadata.
select
  id,
  title,
  slug,
  language,
  topic_category,
  created_at,
  length(coalesce(seo_description, '')) as seo_description_length,
  length(coalesce(excerpt, '')) as excerpt_length,
  cover_image_url
from public.posts
where status = 'published'
  and (
    nullif(trim(slug), '') is null
    or nullif(trim(title), '') is null
    or length(coalesce(seo_description, '')) < 70
    or length(coalesce(excerpt, '')) < 50
  )
order by created_at desc;

-- 3) Look for accidental test/demo/placeholder content in public records.
select 'post' as content_type, id::text, title as name, slug
from public.posts
where status = 'published'
  and (title ~* '(test post|testing post|demo post|sample post|dummy post|lorem ipsum|placeholder content|placeholder text)' or coalesce(excerpt, '') ~* '(lorem ipsum|placeholder content|placeholder text|this is a test post|dummy content)')
union all
select 'product', id::text, name, slug
from public.digital_products
where status = 'active'
  and name ~* '(^|[^[:alnum:]_])(demo|sample|dummy|placeholder)([^[:alnum:]_]|$)'
union all
select 'job', id::text, title, slug
from public.job_listings
where status = 'active'
  and title ~* '(test job|demo job|sample job|dummy job|lorem ipsum|placeholder)'
union all
select 'business', id::text, name, slug
from public.business_listings
where status = 'active'
  and name ~* '(^|[^[:alnum:]_])(demo|sample|dummy|placeholder)([^[:alnum:]_]|$)'
order by content_type, name;

-- 4) URL/slug health. Unique constraints should keep these empty.
select 'posts' as source, slug, count(*) as duplicates
from public.posts
where status = 'published'
group by slug having count(*) > 1
union all
select 'digital_products', slug, count(*)
from public.digital_products
where status = 'active'
group by slug having count(*) > 1
union all
select 'job_listings', slug, count(*)
from public.job_listings
where status = 'active'
group by slug having count(*) > 1
union all
select 'business_listings', slug, count(*)
from public.business_listings
where status = 'active'
group by slug having count(*) > 1;

-- 5) Jobs that are still marked active but are already expired.
select id, title, slug, company_name, expires_at, status
from public.job_listings
where status = 'active'
  and expires_at is not null
  and expires_at <= now()
order by expires_at desc;

-- 6) Public records missing useful image/logo metadata.
select 'post' as content_type, id::text, title as name, slug
from public.posts
where status = 'published' and nullif(trim(cover_image_url), '') is null
union all
select 'product', id::text, name, slug
from public.digital_products
where status = 'active' and nullif(trim(cover_url), '') is null
union all
select 'business', id::text, name, slug
from public.business_listings
where status = 'active' and nullif(trim(logo_url), '') is null
order by content_type, name;

-- 7) Latest public URLs for spot-checking against /sitemap.xml.
select 'blog' as type, slug, created_at
from public.posts
where status = 'published'
union all
select 'shop', slug, created_at
from public.digital_products
where status = 'active'
union all
select 'jobs', slug, created_at
from public.job_listings
where status = 'active' and (expires_at is null or expires_at > now())
union all
select 'business', slug, created_at
from public.business_listings
where status = 'active'
order by created_at desc
limit 100;
