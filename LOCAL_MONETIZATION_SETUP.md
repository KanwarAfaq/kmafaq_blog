# KM Afaq local-first setup: LINE + monetization

## 1) Database
Run `supabase/monetization_line_migration.sql` once in Supabase SQL Editor.

## 2) Local website/API
```bash
npm install
npm run dev
```
Vite serves both React and the local `/api/*` handlers on `http://localhost:5173`.

## 3) LINE QR without website login
Create/use a LINE Messaging API channel and set these in `.env`:

```env
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_MESSAGING_CHANNEL_SECRET=...
VITE_LINE_OFFICIAL_ACCOUNT_URL=https://lin.ee/...
VITE_LINE_ADD_FRIEND_QR_URL=https://...
```

LINE must reach your local webhook, so expose local Vite with a tunnel, for example:

```bash
cloudflared tunnel --url http://localhost:5173
```

Copy the HTTPS tunnel URL into `.env`:

```env
LINE_PUBLIC_BASE_URL=https://YOUR-TUNNEL.trycloudflare.com
```

Restart `npm run dev`, then set the LINE Messaging API webhook URL to:

```text
https://YOUR-TUNNEL.trycloudflare.com/api/line-webhook
```

Enable webhooks. Scan `/line`, add the Official Account, and LINE should reply with a private `/line/preferences?token=...` link. Type `settings` in the LINE chat anytime to get a fresh link.

## 4) SMTP email
Use the existing SMTP variables. Gmail requires an App Password.

```bash
python -m agent.main email-test --to you@example.com
```

## 5) Local workers
Run all digest + premium alert workers:

```bash
npm run worker
```

One immediate test run:

```bash
npm run worker:force
```

## 6) Premium plan test
Premium alerts are intentionally gated. Activate a test user manually:

```sql
update public.user_profiles
set subscription_tier = 'premium',
    subscription_status = 'active'
where user_id = 'YOUR_AUTH_USER_UUID';
```

Then create a watchlist at `/alerts`.

## 7) Money-making features included
- `/pricing`: sell Premium Intelligence, featured listings, sponsored articles, business premium packages.
- `/business`: public business directory; listing detail pages collect leads.
- `/tools`: affiliate tools directory with first-party click tracking.
- Sponsored post fields are added to `posts`; blog cards/articles clearly show sponsorship.
- `/admin/revenue`: admin-only revenue dashboard for inquiries, leads, LINE subscribers, listing performance and affiliate clicks.

### Add a business listing
```sql
insert into public.business_listings
(name, slug, short_description, description, category, website_url, contact_email, plan, featured, status)
values
('Example Business', 'example-business', 'Short value proposition', 'Longer business description', 'technology', 'https://example.com', 'sales@example.com', 'featured', true, 'active');
```

### Add an affiliate tool
Only add real programs you are approved to promote.

```sql
insert into public.affiliate_tools
(name, slug, description, category, pricing_label, website_url, affiliate_url, badge, featured, status)
values
('Example Tool', 'example-tool', 'What the tool does and who it is for.', 'AI', 'Free + Paid', 'https://example.com', 'https://YOUR-APPROVED-AFFILIATE-LINK', 'Recommended', true, 'active');
```

### Publish a sponsored article
```sql
update public.posts
set is_sponsored = true,
    sponsor_name = 'Sponsor Name',
    sponsor_url = 'https://sponsor.example',
    sponsor_cta = 'Learn more'
where id = 'POST_UUID';
```
