from __future__ import annotations

import base64
import logging
import re
from pathlib import Path
from urllib.parse import urlparse

import requests
from google import genai

from .config import Settings
from .models import CoverImage

LOGGER = logging.getLogger(__name__)
PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"
PIXABAY_SEARCH_URL = "https://pixabay.com/api/"
OPENVERSE_SEARCH_URL = "https://api.openverse.org/v1/images/"


class AllImageProvidersFailed(RuntimeError):
    pass


def _short_query(prompt: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9\s-]", " ", prompt)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    words = [
        word for word in cleaned.split()
        if word.casefold() not in {
            "a", "an", "the", "with", "and", "or", "for", "showing", "modern", "professional",
            "blog", "cover", "illustration", "clean", "layout", "logos", "readable", "text",
        }
    ]
    return " ".join(words[:10])[:95] or "artificial intelligence technology"


def _download_image(settings: Settings, url: str, output_path: Path) -> Path:
    response = requests.get(
        url,
        stream=True,
        timeout=settings.request_timeout,
        headers={"User-Agent": "KM-Afaq-Agent/0.2 (+https://kmafaq.online)"},
    )
    response.raise_for_status()
    content_type = (response.headers.get("Content-Type") or "").split(";", 1)[0].lower()
    if content_type and not content_type.startswith("image/"):
        raise RuntimeError(f"Remote URL did not return an image ({content_type})")

    suffix = {
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/jpeg": ".jpg",
    }.get(content_type, Path(urlparse(url).path).suffix.lower() or ".jpg")
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        suffix = ".jpg"
    target = output_path.with_suffix(suffix)
    target.parent.mkdir(parents=True, exist_ok=True)

    limit = settings.image_download_max_mb * 1024 * 1024
    total = 0
    with target.open("wb") as handle:
        for chunk in response.iter_content(chunk_size=64 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > limit:
                handle.close()
                target.unlink(missing_ok=True)
                raise RuntimeError(f"Image exceeded {settings.image_download_max_mb} MB limit")
            handle.write(chunk)
    if total < 5_000:
        target.unlink(missing_ok=True)
        raise RuntimeError("Downloaded image is unexpectedly small")
    return target


def _gemini(settings: Settings, prompt: str, output_path: Path) -> CoverImage | None:
    if not settings.gemini_api_key:
        return None
    client = genai.Client(api_key=settings.gemini_api_key)
    interaction = client.interactions.create(
        model=settings.gemini_image_model,
        input=(
            f"Create a premium editorial blog cover for KM Afaq. {prompt}. "
            "Clean modern composition, technology publication aesthetic, no logos, no watermarks added by prompt, "
            "no readable text, no UI screenshots."
        ),
        response_format={
            "type": "image",
            "mime_type": "image/jpeg",
            "aspect_ratio": "16:9",
            "image_size": "1K",
        },
    )
    image = getattr(interaction, "output_image", None)
    if image is None or not getattr(image, "data", None):
        raise RuntimeError("Gemini returned no generated image")
    payload = image.data
    if isinstance(payload, str):
        payload = base64.b64decode(payload)
    target = output_path.with_suffix(".jpg")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    return CoverImage(path=target, provider=f"gemini:{settings.gemini_image_model}")


def _pexels(settings: Settings, prompt: str, output_path: Path) -> CoverImage | None:
    if not settings.pexels_api_key:
        return None
    response = requests.get(
        PEXELS_SEARCH_URL,
        headers={"Authorization": settings.pexels_api_key},
        params={"query": _short_query(prompt), "orientation": "landscape", "per_page": 5},
        timeout=settings.request_timeout,
    )
    response.raise_for_status()
    for photo in response.json().get("photos") or []:
        image_url = ((photo.get("src") or {}).get("landscape") or (photo.get("src") or {}).get("large2x"))
        if not image_url:
            continue
        try:
            path = _download_image(settings, image_url, output_path)
            photographer = str(photo.get("photographer") or "Pexels contributor")
            return CoverImage(
                path=path,
                provider="pexels",
                source_url=str(photo.get("url") or "https://www.pexels.com"),
                attribution=f"Photo by {photographer} on Pexels",
                license="Pexels License",
            )
        except Exception as exc:
            LOGGER.warning("Pexels image download failed; trying next result: %s", exc)
    return None


def _pixabay(settings: Settings, prompt: str, output_path: Path) -> CoverImage | None:
    if not settings.pixabay_api_key:
        return None
    response = requests.get(
        PIXABAY_SEARCH_URL,
        params={
            "key": settings.pixabay_api_key,
            "q": _short_query(prompt),
            "image_type": "photo",
            "orientation": "horizontal",
            "safesearch": "true",
            "per_page": 10,
        },
        timeout=settings.request_timeout,
    )
    response.raise_for_status()
    for photo in response.json().get("hits") or []:
        image_url = photo.get("largeImageURL") or photo.get("webformatURL")
        if not image_url:
            continue
        try:
            path = _download_image(settings, str(image_url), output_path)
            creator = str(photo.get("user") or "Pixabay contributor")
            return CoverImage(
                path=path,
                provider="pixabay",
                source_url=str(photo.get("pageURL") or "https://pixabay.com"),
                attribution=f"Image by {creator} via Pixabay",
                license="Pixabay Content License",
            )
        except Exception as exc:
            LOGGER.warning("Pixabay image download failed; trying next result: %s", exc)
    return None


def _openverse(settings: Settings, prompt: str, output_path: Path) -> CoverImage | None:
    response = requests.get(
        OPENVERSE_SEARCH_URL,
        params={"q": _short_query(prompt), "page_size": 10},
        headers={"User-Agent": "KM-Afaq-Agent/0.2 (+https://kmafaq.online)"},
        timeout=settings.request_timeout,
    )
    response.raise_for_status()
    for photo in response.json().get("results") or []:
        if photo.get("mature") is True:
            continue
        image_url = photo.get("url") or photo.get("thumbnail")
        if not image_url:
            continue
        try:
            path = _download_image(settings, str(image_url), output_path)
            attribution = str(photo.get("attribution") or "").strip()
            creator = str(photo.get("creator") or "Openverse contributor").strip()
            license_name = str(photo.get("license") or "").strip().upper()
            license_version = str(photo.get("license_version") or "").strip()
            if not attribution:
                attribution = f"Image by {creator} via Openverse"
            license_label = " ".join(x for x in (license_name, license_version) if x).strip() or "Open license"
            return CoverImage(
                path=path,
                provider="openverse",
                source_url=str(photo.get("foreign_landing_url") or photo.get("detail_url") or "https://openverse.org"),
                attribution=attribution,
                license=license_label,
            )
        except Exception as exc:
            LOGGER.warning("Openverse image download failed; trying next result: %s", exc)
    return None


def generate_cover_image(settings: Settings, prompt: str, output_path: Path) -> CoverImage:
    """Gemini -> Pexels -> Pixabay -> Openverse. Raises only after every source fails."""
    failures: list[str] = []
    providers = (
        ("gemini", _gemini),
        ("pexels", _pexels),
        ("pixabay", _pixabay),
        ("openverse", _openverse),
    )
    for name, provider in providers:
        try:
            result = provider(settings, prompt, output_path)
            if result:
                LOGGER.info("Cover image ready via %s: %s", result.provider, result.path)
                return result
            LOGGER.info("Cover image provider %s is not configured or returned no result", name)
        except Exception as exc:
            LOGGER.warning("Cover image provider %s failed; trying fallback: %s", name, exc)
            failures.append(f"{name}: {exc}")
    raise AllImageProvidersFailed("; ".join(failures) or "No image provider returned an image")
