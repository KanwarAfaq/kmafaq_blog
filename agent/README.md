# KM Afaq Python AI Agent v0.2

## Pipeline

1. Topic discovery: Google Trends first; Tavily then Brave can supply fallback/search context.
2. Research enrichment: Tavily, then Brave, with Google Trends context retained.
3. Article generation: Groq -> Gemini -> OpenRouter Free.
4. Cover image: Gemini -> Pexels -> Pixabay -> Openverse.
5. Every successful cover is uploaded to Cloudinary; Supabase stores only Cloudinary IDs/URL plus attribution metadata.
6. Publish to Supabase in `ur` or `en`.
7. No per-post email or LINE messages. One LINE summary is sent only after 5 Urdu + 5 English posts are complete for the Pakistan day.

## Required migration

Run `supabase/agent_migration.sql` once.

## Environment

Copy `agent/.env.example` to `.env.agent` and fill your keys. SMTP/email variables are no longer used.

New optional/free fallback keys:

```env
OPENROUTER_API_KEY=
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
PEXELS_API_KEY=
PIXABAY_API_KEY=
```

Openverse requires no API key for the anonymous fallback.

## Local tests

```bash
python -m agent.main run --language ur --dry-run
python -m agent.main run --language en --dry-run
```

Real publish with images/fallbacks:

```bash
python -m agent.main run --language ur
python -m agent.main run --language en
```

LINE test:

```bash
python -m agent.main notify-test
```

Daily summary status/send check:

```bash
python -m agent.main daily-summary
```

The summary command sends nothing until both language counts reach 5. Once sent, the database records the date so later checks do not send a duplicate.

## GitHub Actions

The ready workflow is `.github/workflows/ai-agent.yml`. It runs 10 publish schedules plus one 23:50 PKT safety summary check. The 10th successful post can send the summary immediately; the safety run sees it as already sent and does nothing.
