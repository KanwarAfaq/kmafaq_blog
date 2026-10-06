from __future__ import annotations

import json
import logging
import tempfile
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .cloudinary_client import upload_cover
from .config import Settings
from .database import PostRepository
from .facebook import publish_photo
from .image_generator import generate_cover_image
from .llm import FallbackLLM
from .models import TopicSelection
from .research import research_topic
from .utils import slugify
from .writer import generate_article, infer_topic_category

LOGGER = logging.getLogger(__name__)

# Recovered from the failed scheduled GitHub Actions runs for Oct 2-5, 2026.
# Three Oct 5 slots did not retain a usable selection log; those are sourced
# from dated Oct 5 news archives and are marked historical_news_archive.
SLOTS = [
    # 2026-10-02
    ("2026-10-02", "08:00", "ur", "Men's Cricket World Cup 2027 ticket ballot launch and its impact on Pakistani fans", "cricket world cup 2027", "github_actions_log", ""),
    ("2026-10-02", "09:30", "en", "Cricket World Cup 2027: How to watch and what to expect for Pakistan", "cricket world cup 2027", "github_actions_log", ""),
    ("2026-10-02", "11:00", "ur", "ICC Men's Cricket World Cup 2027 schedule and Pakistan's prospects", "cricket world cup 2027", "github_actions_log", ""),
    ("2026-10-02", "12:30", "en", "Pakistan's National Cyber Crimes Investigation Agency raids illegal call centers", "national cyber crimes investigation agency", "github_actions_log", ""),
    ("2026-10-02", "14:00", "ur", "National Cyber Crimes Investigation Agency raids on Karachi and Rawalpindi call centres", "national cyber crimes investigation agency", "github_actions_log", ""),
    ("2026-10-02", "16:00", "en", "Pakistan's National Cyber Crimes Investigation Agency raids on illegal call centres", "national cyber crimes investigation agency", "github_actions_log", ""),
    ("2026-10-02", "18:00", "ur", "PTI's upcoming Oct 4 protest and its implications for Pakistan's political stability", "pakistan", "github_actions_log", ""),
    ("2026-10-02", "20:00", "en", "DG ISPR press conference refutes India's claims about a neutralised Pakistani terrorist", "dg ispr press conference", "github_actions_log", ""),
    ("2026-10-02", "22:00", "ur", "Pakistani government and opposition conclude first-round talks ahead of PTI's October 4 protest campaign", "pakistan", "github_actions_log", ""),
    ("2026-10-02", "23:30", "en", "Pakistan Army warns of decisive force against any May 9-like situation", "armed forces", "github_actions_log", ""),

    # 2026-10-03
    ("2026-10-03", "08:00", "ur", "India defeats Pakistan in Asian Games 2026 T20 cricket final", "ind vs pak", "github_actions_log", ""),
    ("2026-10-03", "09:30", "en", "OpenAI investigates potential AI-driven hacking incidents following the Hugging Face breach", "artificial intelligence news", "github_actions_log", ""),
    ("2026-10-03", "11:00", "ur", "Pakistan's cricket team settles for Asian Games silver after Hasan Nawaz's valiant 96 against India", "hasan nawaz", "github_actions_log", ""),
    ("2026-10-03", "12:30", "en", "India vs West Indies 3rd ODI - match highlights and implications", "ind vs wi", "github_actions_log", ""),
    ("2026-10-03", "14:00", "ur", "India vs Brazil football friendly match 2026 - live watch guide and match preview", "india vs brazil", "github_actions_log", ""),
    ("2026-10-03", "16:00", "en", "AI-generated deepfake video of Janhvi Kapoor sparks legal action in India", "janhvi kapoor chuttamalle ai", "github_actions_log", ""),
    ("2026-10-03", "18:00", "ur", "Indus Water Treaty tensions and Pakistan's response", "indus waters treaty", "github_actions_log", ""),
    ("2026-10-03", "20:00", "en", "Indus Waters Treaty tensions and potential suspension", "indus waters treaty", "github_actions_log", ""),
    ("2026-10-03", "22:00", "ur", "Indus Waters Treaty: recent developments and implications for Pakistan", "indus waters treaty", "github_actions_log", ""),
    ("2026-10-03", "23:30", "en", "Petrol price increase in Pakistan: new rates and consumer impact", "petrol", "github_actions_log", ""),

    # 2026-10-04
    ("2026-10-04", "08:00", "ur", "Pakistan petrol price increase: new rate and impact on the public", "petrol price", "github_actions_log", ""),
    ("2026-10-04", "09:30", "en", "Petrol price hike in Pakistan: Government raises price by Rs2.10 per litre", "petrol price", "github_actions_log", ""),
    ("2026-10-04", "11:00", "ur", "PTI-government talks deadlock ahead of the October 4 long march", "pakistan tehreek-e-insaf", "github_actions_log", ""),
    ("2026-10-04", "12:30", "en", "Iran's closure of the Strait of Hormuz and its implications for regional trade and security", "iran", "github_actions_log", ""),
    ("2026-10-04", "14:00", "ur", "Iran threatens to keep the Strait of Hormuz closed until the US meets its conditions", "iran", "github_actions_log", ""),
    ("2026-10-04", "16:00", "en", "Pakistan unveils Yadgar-e-Fatah monument and launches robotic surgery program at Dr. Ziauddin Hospital", "yadgar e fatah", "github_actions_log", ""),
    ("2026-10-04", "18:00", "ur", "PTI long march from Lakki Marwat to Islamabad: political protest and demands", "pti long march di khan", "github_actions_log", ""),
    ("2026-10-04", "20:00", "en", "PTI's Long March to Islamabad: political impact and public response", "pti long march di khan", "github_actions_log", ""),
    ("2026-10-04", "22:00", "ur", "Second round of talks between Imran Khan's party and the government and the long march implications", "imran khan", "github_actions_log", ""),
    ("2026-10-04", "23:30", "en", "Vivo V80 price and specifications ahead of its India launch", "vivo v80 price", "github_actions_log", ""),

    # 2026-10-05
    ("2026-10-05", "08:00", "ur", "National Savings announces closure of 111 centres and raises profit rates", "national savings", "github_actions_log", ""),
    ("2026-10-05", "09:30", "en", "India's multibillion-dollar Rafale fighter jet deal and Pakistan's plans for a 5th-generation jet with China", "rafale", "github_actions_log", ""),
    ("2026-10-05", "11:00", "ur", "KSE-100 Index slides amid political uncertainty and rising oil prices", "kse 100 index", "github_actions_log", ""),
    ("2026-10-05", "12:30", "en", "Imran Khan supporters mobilise across Pakistan as the long march gathers momentum", "imran khan release protests", "github_actions_log", ""),
    ("2026-10-05", "14:00", "ur", "Sahibzada Farhan appointed Pakistan T20I captain for Sri Lanka series", "sahibzada farhan", "github_actions_log", ""),
    ("2026-10-05", "16:00", "en", "UN Secretary-General begins Pakistan visit to discuss regional and international issues", "un secretary general pakistan visit", "historical_news_archive", "https://www.brecorder.com/pakistan/2026-10-05"),
    ("2026-10-05", "18:00", "ur", "Pakistan, Saudi Arabia and Turkiye move to activate the Makkah defence pact and deepen military cooperation", "makkah defence pact", "historical_news_archive", "https://www.brecorder.com/pakistan/2026-10-05"),
    ("2026-10-05", "20:00", "en", "Pakistan Election Commission prepares for Punjab local government elections amid legal hurdles in KP and Islamabad", "election commission of pakistan", "github_actions_log", ""),
    ("2026-10-05", "22:00", "ur", "Election Commission of Pakistan prepares for Punjab local government elections", "election commission of pakistan", "github_actions_log", ""),
    ("2026-10-05", "23:30", "en", "Hyderabad airport may resume operations after a 13-year hiatus", "hyderabad airport resumption", "historical_news_archive", "https://www.brecorder.com/pakistan/2026-10-05"),
]


def _scheduled_at(settings: Settings, publish_date: str, local_time: str) -> str:
    zone = ZoneInfo(settings.publish_timezone)
    local = datetime.fromisoformat(f"{publish_date}T{local_time}:00").replace(tzinfo=zone)
    return local.astimezone().isoformat()


def _slug(publish_date: str, local_time: str, language: str, topic: str) -> str:
    hhmm = local_time.replace(":", "")
    topic_part = slugify(topic)[:55]
    return f"{publish_date}-{language}-{hhmm}-{topic_part}"[:90].rstrip("-")


def _selection(row: tuple[str, str, str, str, str, str, str]) -> TopicSelection:
    publish_date, _, _, topic, source_query, source_provider, source_url = row
    angle = (
        f"Historical snapshot as of {publish_date}. Explain what was known on that date, "
        "the immediate implications, and practical context. Do not incorporate developments after this date."
    )
    return TopicSelection(
        topic=topic,
        angle=angle,
        reason=f"Recovered scheduled topic for the {publish_date} backfill",
        source_query=source_query,
        source_url=source_url,
        relevance_score=100,
        provider="historical-backfill",
        trend=None,
        source_provider=source_provider,
        topic_category=infer_topic_category(f"{topic} {source_query}"),
    )


def _repair_existing_facebook(settings: Settings, repo: PostRepository, existing: dict, language: str) -> dict:
    post_id = str(existing["id"])
    latest = repo.latest_facebook_post(post_id)
    if latest and latest.get("status") == "published" and latest.get("facebook_post_id"):
        return {
            "status": "already-complete",
            "post_id": post_id,
            "url": f"{settings.site_url}/blog/{existing['slug']}",
            "facebook_post_id": latest.get("facebook_post_id"),
        }

    article_url = f"{settings.site_url}/blog/{existing['slug']}"
    fb = publish_photo(
        settings,
        title=str(existing.get("title") or ""),
        excerpt=str(existing.get("excerpt") or ""),
        article_url=article_url,
        image_url=existing.get("cover_image_url"),
    )
    repo.record_facebook_post(
        post_id=post_id,
        language=language,
        status=fb.status,
        facebook_post_id=fb.facebook_post_id,
        image_url=existing.get("cover_image_url"),
        article_url=article_url,
        error_message=fb.error,
    )
    if fb.status != "published" or not fb.facebook_post_id:
        raise RuntimeError(f"Facebook repair failed: status={fb.status}, error={fb.error}")
    return {
        "status": "facebook-repaired",
        "post_id": post_id,
        "url": article_url,
        "facebook_post_id": fb.facebook_post_id,
    }


def _run_slot(settings: Settings, repo: PostRepository, llm: FallbackLLM, row) -> dict:
    publish_date, local_time, language, topic, _, _, _ = row
    slug = _slug(publish_date, local_time, language, topic)
    existing = repo.get_post_by_slug(slug)
    if existing:
        return _repair_existing_facebook(settings, repo, existing, language)

    selection = _selection(row)
    research = research_topic(settings, selection)
    LOGGER.info(
        "Backfill research ready: date=%s time=%s language=%s provider=%s topic=%s",
        publish_date,
        local_time,
        language,
        research.provider,
        topic,
    )
    article = generate_article(llm, selection, language=language, research=research)
    article.slug = slug

    with tempfile.TemporaryDirectory(prefix="km-afaq-backfill-") as tmp:
        cover = generate_cover_image(settings, article.image_prompt, Path(tmp) / "cover")
        media = upload_cover(settings, cover.path)
        result = repo.publish(
            article,
            selection,
            media,
            cover,
            research_provider=research.provider,
            created_at=_scheduled_at(settings, publish_date, local_time),
        )
        fb = publish_photo(
            settings,
            title=article.title,
            excerpt=article.excerpt,
            article_url=result.url,
            image_url=media.secure_url,
        )
        repo.record_facebook_post(
            post_id=result.post_id,
            language=language,
            status=fb.status,
            facebook_post_id=fb.facebook_post_id,
            image_url=media.secure_url,
            article_url=result.url,
            error_message=fb.error,
        )
        if fb.status != "published" or not fb.facebook_post_id:
            raise RuntimeError(f"Website published but Facebook failed: status={fb.status}, error={fb.error}")

        return {
            "status": "published",
            "date": publish_date,
            "time": local_time,
            "language": language,
            "title": result.title,
            "url": result.url,
            "post_id": result.post_id,
            "facebook_post_id": fb.facebook_post_id,
            "image_provider": cover.provider,
            "research_provider": research.provider,
        }


def run_backfill() -> dict:
    settings = Settings()
    missing = settings.validate_for_run(publish=True, generate_image=True)
    if missing:
        raise RuntimeError(f"Missing required environment variables: {settings.pretty_missing(missing)}")
    if not settings.facebook_posting_enabled:
        raise RuntimeError("FACEBOOK_POSTING_ENABLED must be true for this backfill")

    repo = PostRepository(settings)
    llm = FallbackLLM(settings)
    results: list[dict] = []
    failures: list[dict] = []

    for index, row in enumerate(SLOTS, 1):
        publish_date, local_time, language, topic, *_ = row
        LOGGER.info("BACKFILL %d/%d | %s %s %s | %s", index, len(SLOTS), publish_date, local_time, language, topic)
        last_error: Exception | None = None

        for attempt in (1, 2):
            try:
                result = _run_slot(settings, repo, llm, row)
                results.append(result)
                print("BACKFILL_RESULT " + json.dumps(result, ensure_ascii=False))
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                LOGGER.exception(
                    "Backfill slot failed (attempt %d/2): %s %s %s",
                    attempt,
                    publish_date,
                    local_time,
                    language,
                )
                if attempt == 1:
                    time.sleep(8)

        if last_error is not None:
            failures.append(
                {
                    "date": publish_date,
                    "time": local_time,
                    "language": language,
                    "topic": topic,
                    "error": str(last_error),
                }
            )
        time.sleep(1)

    counts: dict[str, dict[str, int]] = {}
    for row in results:
        if not row.get("date"):
            continue
        date = str(row["date"])
        lang = str(row.get("language") or "")
        counts.setdefault(date, {"ur": 0, "en": 0})
        if lang in {"ur", "en"}:
            counts[date][lang] += 1

    summary = {
        "requested_slots": len(SLOTS),
        "completed": len(results),
        "failures": len(failures),
        "counts_from_this_run": counts,
        "failure_details": failures,
    }
    print("BACKFILL_SUMMARY " + json.dumps(summary, ensure_ascii=False, indent=2))
    if failures:
        raise RuntimeError(f"Backfill completed with {len(failures)} failed slot(s)")
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    run_backfill()
