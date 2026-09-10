# KM Afaq — User Profiles + Personalized Notifications

## What is included

- Private `/profile` page with avatar, name, username, bio, location, timezone and language preference.
- Avatar upload to Cloudinary (`km-afaq/avatars/<user-id>`).
- `/profile/notifications` with Email + LINE channels.
- Topics: AI & Tech, Business, Politics, World, Sports, Science, Health, Trending.
- Languages: Urdu, English, or both.
- Frequency: Daily, Weekly, Every 15 days, Every 30 days, or custom weekdays.
- User-selected preferred time + timezone.
- LINE account connection through LINE Login.
- Hourly GitHub Actions digest worker that only sends when a user's own schedule is due.
- Resend email delivery + LINE Messaging API delivery.
- Delivery history stored in Supabase.

## Setup order

1. Run `supabase/user_profiles_notifications_migration.sql`.
2. Deploy the updated frontend/API routes to Vercel.
3. Create/configure LINE Login (same provider as your Messaging API channel).
4. Configure Resend and verify `kmafaq.online`.
5. Add server/GitHub secrets.
6. Test one user manually with `python -m agent.main user-digests --force --user-id <UUID>`.
7. Enable `.github/workflows/user-notifications.yml`.

## Required server secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_LOGIN_CHANNEL_ID`
- `LINE_LOGIN_CHANNEL_SECRET`
- `LINE_LOGIN_CALLBACK_URL=https://kmafaq.online/api/line-callback`
- `LINE_STATE_SECRET`
- `RESEND_API_KEY`
- `DIGEST_EMAIL_FROM=KM Afaq <digest@kmafaq.online>`

Keep all of the above server-side. Do not use the `VITE_` prefix for secrets.
