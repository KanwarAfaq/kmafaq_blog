# KM Afaq Modern Blog Upgrade

## 1) Run the database migration
In Supabase SQL Editor run:

`supabase/blog_ui_migration.sql`

This adds `posts.topic_category`, backfills existing posts, and creates the filter index.

## 2) Install the new frontend dependency

```powershell
npm install
```

`remark-gfm` is used to render Markdown tables correctly.

## 3) Test locally

```powershell
npm run dev
```

Check:
- `/blog/urdu`
- `/blog/english`
- any article page

The blog list now has topic filters and pagination. Article pages have a related-post sidebar and bottom recommendations.

## 4) Agent changes
The agent now stores `topic_category`, uses exact trend candidate selection, supports broader current-affairs topics, and future article prompts require valid Markdown tables.

The daily LINE summary now includes all Urdu and English post titles. Because the 2026-09-08 summary was already marked sent before this change, the title-rich message will begin on the next completed publishing day unless you intentionally reset that day's `agent_daily_status` row for testing.

## 5) Push

```powershell
git add .
git commit -m "Modernize blog reader UI, filters and LINE daily summary"
git push
```
