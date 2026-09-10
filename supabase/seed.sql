-- KM Afaq demo content
-- Run AFTER supabase/schema.sql. Safe to run repeatedly.
-- These rows use Cloudinary's public demo assets so the UI is populated immediately.

insert into public.services (
  name, description, price, image_url, image_public_id, image_asset_id
)
select
  'AI Automation',
  'AI agents, workflow automation, API integrations, and repetitive task optimization.',
  149,
  'https://res.cloudinary.com/demo/image/upload/c_fill,w_900,h_600,q_auto,f_auto/cld-sample-5',
  'cld-sample-5',
  null
where not exists (select 1 from public.services where name = 'AI Automation');

insert into public.services (
  name, description, price, image_url, image_public_id, image_asset_id
)
select
  'Web Development',
  'Responsive React websites with modern UX, Supabase integrations, SEO, and deployment.',
  299,
  'https://res.cloudinary.com/demo/image/upload/c_fill,w_900,h_600,q_auto,f_auto/cld-sample-3',
  'cld-sample-3',
  null
where not exists (select 1 from public.services where name = 'Web Development');

insert into public.services (
  name, description, price, image_url, image_public_id, image_asset_id
)
select
  'Tech Consulting',
  'Practical strategy for AI adoption, technology stacks, SEO, and digital product decisions.',
  79,
  'https://res.cloudinary.com/demo/image/upload/c_fill,w_900,h_600,q_auto,f_auto/cld-sample-2',
  'cld-sample-2',
  null
where not exists (select 1 from public.services where name = 'Tech Consulting');

insert into public.posts (
  title, slug, content, excerpt, language,
  cover_image_url, cover_image_public_id, cover_image_asset_id,
  author_id, created_at, status
)
select
  'AI Automation: Rozmarra Kaam Ko Smart Kaise Banayein',
  'ai-automation-rozmarra-kaam',
  E'# AI Automation kya hai?\n\nAI automation ka matlab repetitive digital tasks ko smart workflows aur AI tools ke zariye automate karna hai. Is se businesses response time kam kar sakte hain aur team ko high-value kaam par focus karne ka waqt milta hai.\n\n## Practical examples\n\n- Customer inquiries ko categorize karna\n- Leads ko CRM mein automatically save karna\n- Reports aur summaries generate karna\n- Content workflow ko organize karna\n\n## Start small\n\nSab se pehle ek repeat hone wala task choose karein, us ka clear input/output define karein, phir automation build karein. Reliable automation hamesha measurable workflow se start hoti hai.',
  'AI automation ko simple Urdu mein samjhein aur dekhein ke repetitive business tasks ko smart workflows mein kaise badla ja sakta hai.',
  'ur',
  'https://res.cloudinary.com/demo/image/upload/c_fill,w_1400,h_788,q_auto,f_auto/cld-sample-5',
  'cld-sample-5',
  null,
  null,
  now() - interval '2 days',
  'published'
where not exists (select 1 from public.posts where slug = 'ai-automation-rozmarra-kaam');

insert into public.posts (
  title, slug, content, excerpt, language,
  cover_image_url, cover_image_public_id, cover_image_asset_id,
  author_id, created_at, status
)
select
  'React + Supabase: A Modern Website Stack for 2026',
  'react-supabase-modern-stack-2026',
  E'# Why React and Supabase?\n\nReact is a strong choice for fast interactive interfaces, while Supabase combines database, authentication, and realtime features in a practical backend platform.\n\n## The KM Afaq stack\n\nThis demo uses Vite, React, Tailwind CSS, and Supabase. Media files are not stored as database blobs; images and videos live on Cloudinary while Supabase stores only their URLs and identifiers.\n\n## Result\n\nThis architecture keeps the frontend lightweight and makes CDN-based media delivery straightforward.',
  'A practical overview of combining React, Supabase, and Cloudinary for a fast, maintainable, media-friendly web architecture.',
  'en',
  'https://res.cloudinary.com/demo/image/upload/c_fill,w_1400,h_788,q_auto,f_auto/cld-sample-3',
  'cld-sample-3',
  null,
  null,
  now() - interval '1 day',
  'published'
where not exists (select 1 from public.posts where slug = 'react-supabase-modern-stack-2026');

insert into public.posts (
  title, slug, content, excerpt, language,
  cover_image_url, cover_image_public_id, cover_image_asset_id,
  cover_video_url, cover_video_public_id, cover_video_asset_id,
  author_id, created_at, status
)
select
  'Cloudinary Media Workflow: Images aur Videos Ko Sahi Tarah Store Karein',
  'cloudinary-media-workflow',
  E'# Cloudinary media workflow\n\nLarge images aur videos ko Postgres rows mein blobs ki form mein rakhna zaroori nahi. Media ko Cloudinary par upload karein aur Supabase mein references save karein.\n\n## Database mein kya save hota hai?\n\n1. `secure_url` delivery ke liye\n2. `public_id` transformations aur management ke liye\n3. `asset_id` stable immutable Cloudinary reference ke liye\n\nYeh approach database ko clean rakhti hai aur CDN-based delivery ko simple banati hai.',
  'Cloudinary upload response ke URL, public ID aur immutable asset ID ko Supabase ke saath clean media architecture mein use karein.',
  'ur',
  'https://res.cloudinary.com/demo/image/upload/c_fill,w_1400,h_788,q_auto,f_auto/sample',
  'sample',
  null,
  'https://res.cloudinary.com/demo/video/upload/q_auto/dog.mp4',
  'dog',
  null,
  null,
  now(),
  'published'
where not exists (select 1 from public.posts where slug = 'cloudinary-media-workflow');


-- Keep language values correct even if these demo rows already existed before this migration.
update public.posts set language = 'ur' where slug in ('ai-automation-rozmarra-kaam', 'cloudinary-media-workflow');
update public.posts set language = 'en' where slug = 'react-supabase-modern-stack-2026';


update public.posts
set title = 'React + Supabase: A Modern Website Stack for 2026',
    content = E'# Why React and Supabase?\n\nReact is a strong choice for fast interactive interfaces, while Supabase combines database, authentication, and realtime features in a practical backend platform.\n\n## The KM Afaq stack\n\nThis demo uses Vite, React, Tailwind CSS, and Supabase. Media files are not stored as database blobs; images and videos live on Cloudinary while Supabase stores only their URLs and identifiers.\n\n## Result\n\nThis architecture keeps the frontend lightweight and makes CDN-based media delivery straightforward.',
    excerpt = 'A practical overview of combining React, Supabase, and Cloudinary for a fast, maintainable, media-friendly web architecture.',
    language = 'en'
where slug = 'react-supabase-modern-stack-2026';
