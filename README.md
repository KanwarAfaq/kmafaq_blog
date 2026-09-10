# KM Afaq — Blog + Services website

Production-oriented Vite + React 18 website for **kmafaq.online** using Tailwind CSS v4, Supabase, and Cloudinary.

> A local-first Python AI publishing agent is included under `agent/`. GitHub Actions scheduling is intentionally deferred until local end-to-end testing passes.

## Stack

- Vite + React 18 + JSX
- Tailwind CSS v4 via `@tailwindcss/vite`
- `react-router-dom` v6
- `lucide-react`
- React Hooks only (no Redux)
- `react-hot-toast`
- `react-helmet-async`
- Supabase Database, Auth, RLS, Realtime
- Cloudinary for image/video storage and CDN delivery
- Vercel serverless endpoint for signed Cloudinary uploads

## Project structure

```text
km-afaq/
├── api/
│   └── cloudinary-signature.js
├── agent/
│   ├── main.py
│   ├── pipeline.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── README.md
│   └── templates/
│       └── github-action.yml
├── public/
│   ├── images/
│   │   └── about-km-afaq.svg
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
├── scripts/
│   └── generate-seo.mjs
├── src/
│   ├── components/
│   ├── constants/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   │   ├── api.js
│   │   ├── cloudinary.js
│   │   └── supabase.js
│   ├── pages/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   ├── schema.sql
│   ├── seed.sql
│   └── agent_migration.sql
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

## 1. Create and configure Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Then run `supabase/seed.sql` to add three services and three published demo blog posts.
4. The schema creates:
   - `posts`
   - `services`
   - `post_likes`
   - `notifications`
   - Cloudinary URL/public-ID/asset-ID columns
   - RLS policies
   - a secure like-count RPC
   - the like → author notification trigger
   - Realtime publication entries for `posts` and `notifications`
5. In **Authentication → URL Configuration**, set the production Site URL to `https://kmafaq.online` and add local/production redirect URLs such as `http://localhost:5173/**` and `https://kmafaq.online/**`.

Demo posts use `author_id = null`, which means you can see the blog immediately even before creating an Auth user. For real posts, set `author_id` to your Supabase Auth user UUID so post-like notifications have a recipient.

### Make your account an admin

After creating/signing in your owner account, you can set its app metadata from the Supabase SQL editor. Replace the email first:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'you@example.com';
```

Sign out and back in after changing the role so a fresh JWT contains the admin claim.

## 2. Cloudinary setup

Create a Cloudinary product environment and copy its Cloud Name, API Key, and API Secret.

Media architecture:

1. Image/video bytes are uploaded to **Cloudinary**, not Supabase Storage.
2. Cloudinary returns `secure_url`, `public_id`, and immutable `asset_id`.
3. Supabase stores only those references in normal text columns.
4. No image/video blobs or base64 values are stored in Postgres.

For posts, the important columns are:

```text
cover_image_url
cover_image_public_id
cover_image_asset_id
cover_video_url
cover_video_public_id
cover_video_asset_id
```

For services:

```text
image_url
image_public_id
image_asset_id
```

The requested media “hash/reference” is represented by the Cloudinary identifiers. `public_id` is used for delivery/transformations, and `asset_id` is the immutable stable identifier.

### Secure browser upload helper

`src/lib/cloudinary.js` exports:

```js
uploadMediaToCloudinary(file)
```

It:

- requires a signed-in Supabase admin
- asks `/api/cloudinary-signature` for a short-lived signed upload
- uploads directly from the browser to Cloudinary
- supports both images and videos
- returns:

```js
{
  url,
  publicId,
  assetId,
  resourceType,
  format,
  bytes,
  width,
  height,
  duration
}
```

Example database mapping after an image upload:

```js
const media = await uploadMediaToCloudinary(file);

await supabase.from('posts').insert({
  title,
  slug,
  content,
  excerpt,
  cover_image_url: media.url,
  cover_image_public_id: media.publicId,
  cover_image_asset_id: media.assetId,
  author_id: user.id,
  status: 'published',
});
```

For video, save the same returned values to the `cover_video_*` columns.

## 3. Environment variables

```bash
cp .env.example .env
```

Minimum values:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_BROWSER_SAFE_KEY
SITE_URL=https://kmafaq.online

CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
```

`CLOUDINARY_API_SECRET` is server-only. Never rename it to a `VITE_*` variable.

## 4. Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the Vite URL shown in your terminal, normally `http://localhost:5173`.

The main site works with `npm run dev`. The signed Cloudinary API route is a Vercel serverless function, so when you later build an admin upload screen and want to test uploads locally, use Vercel's local runtime (`vercel dev`) so `/api/cloudinary-signature` is available.

Useful commands:

```bash
npm run lint
npm run build
npm run preview
```

`npm run build` first runs `scripts/generate-seo.mjs`, which reads published Supabase post slugs and regenerates `public/sitemap.xml` and `public/robots.txt`.

## 5. Demo content

Run:

```text
supabase/schema.sql
supabase/seed.sql
```

`seed.sql` adds:

- AI Automation service
- Web Development service
- Tech Consulting service
- 3 published blog posts
- Cloudinary-hosted demo cover images
- 1 blog post with a Cloudinary-hosted demo video

The seed is safe to run repeatedly because rows are inserted only when the matching service name or post slug is missing.

## 6. Likes and notifications

Visitors can read published posts without signing in. A user must sign in by Supabase magic link before liking a post.

When an authenticated user inserts a like:

- RLS verifies `post_likes.user_id = auth.uid()`.
- A unique constraint prevents duplicate likes.
- If the post has an `author_id`, a database trigger creates `Someone liked your post: [Post Title]` for that author.
- Browser clients cannot insert arbitrary notification rows.
- Header notifications update through Supabase Realtime.
- Clicking a notification marks it as read and opens its internal link.

Demo posts intentionally have no author, so liking demo content does not create an orphan notification.

## 7. Python AI agent

A local-first Python publishing agent now lives in `agent/`. Its pipeline is:

1. Google Trends RSS -> select an AI/Tech/Earning topic.
2. Groq generates/selects first; Gemini automatically handles text fallback.
3. Gemini generates a 16:9 cover image.
4. Cloudinary stores the image and returns `secure_url`, `public_id`, and `asset_id`.
5. Supabase receives the article + Cloudinary references.
6. After all 5 Urdu + 5 English posts for the Pakistan day are complete, the agent sends one LINE summary notification.

Run `supabase/agent_migration.sql` once before the first agent publish, then follow `agent/README.md`. The GitHub Actions file is intentionally only a template under `agent/templates/` until local testing passes.

## 8. SEO implementation

Every route has dynamic Helmet metadata including title, meta description, canonical URL, Open Graph, Twitter Card, and robots directives. Organization and WebSite JSON-LD are global; article pages add BlogPosting JSON-LD.

Other SEO/accessibility details include semantic landmarks, clean `/blog/:slug` URLs, lazy-loaded images with alt text, mobile-first layouts, explicit focus styles, and build-time sitemap generation.

After deployment, submit `https://kmafaq.online/sitemap.xml` in Google Search Console for discovery and monitoring.

## 9. Deploy to Vercel

1. Push the project to GitHub/GitLab/Bitbucket.
2. Import it into Vercel.
3. Add these Vercel Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SITE_URL=https://kmafaq.online`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - optional social URL variables
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy.
7. Add `kmafaq.online` as the custom domain.
8. Update Supabase Auth URL Configuration with the final production callback URL.

## 10. Profile photo

`public/images/about-km-afaq.svg` remains a lightweight placeholder. When you add the real profile image, upload it to Cloudinary and replace the page image source with the resulting Cloudinary URL.
