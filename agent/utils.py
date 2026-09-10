from __future__ import annotations

import json
import re
import unicodedata
from datetime import UTC, datetime
from typing import Any


def extract_json(text: str) -> dict[str, Any]:
    """Parse a JSON object, tolerating markdown fences or small wrapper text."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        value = json.loads(cleaned)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        value = json.loads(cleaned[start : end + 1])
        if isinstance(value, dict):
            return value
    raise ValueError("Model response did not contain a valid JSON object")


def slugify(value: str, fallback: str = "ai-tech-update") -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    normalized = re.sub(r"-{2,}", "-", normalized)
    return normalized[:90] or fallback


def ensure_slug(value: str, fallback_source: str) -> str:
    candidate = slugify(value, fallback="")
    if candidate:
        return candidate
    return slugify(fallback_source)


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
