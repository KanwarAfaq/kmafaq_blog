from __future__ import annotations

import logging
from typing import Any

import requests
from google import genai
from google.genai import types
from groq import Groq

from .config import Settings
from .utils import extract_json

LOGGER = logging.getLogger(__name__)


class AllProvidersFailed(RuntimeError):
    pass


class FallbackLLM:
    """JSON-only LLM wrapper: Groq, Gemini, then OpenRouter free models."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def generate_json(
        self,
        *,
        system: str,
        prompt: str,
        temperature: float = 0.4,
        max_output_tokens: int = 7000,
    ) -> tuple[dict[str, Any], str]:
        failures: list[str] = []
        max_attempts = 2
        for provider in self.settings.provider_order():
            for attempt in range(1, max_attempts + 1):
                try:
                    if provider == "groq" and self.settings.groq_api_key:
                        return self._groq(system, prompt, temperature, max_output_tokens), "groq"
                    if provider == "gemini" and self.settings.gemini_api_key:
                        return self._gemini(system, prompt, temperature, max_output_tokens), "gemini"
                    if provider == "openrouter" and self.settings.openrouter_api_key:
                        return self._openrouter(system, prompt, temperature, max_output_tokens), "openrouter"
                    break
                except Exception as exc:
                    if attempt < max_attempts:
                        LOGGER.warning(
                            "%s generation failed on attempt %d/%d; retrying: %s",
                            provider,
                            attempt,
                            max_attempts,
                            exc,
                        )
                        continue
                    LOGGER.warning("%s generation failed; trying fallback: %s", provider, exc)
                    failures.append(f"{provider}: {exc}")
        raise AllProvidersFailed("; ".join(failures) or "No configured LLM provider")

    def _groq(self, system: str, prompt: str, temperature: float, max_output_tokens: int) -> dict[str, Any]:
        client = Groq(api_key=self.settings.groq_api_key)
        response = client.chat.completions.create(
            model=self.settings.groq_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            max_completion_tokens=max_output_tokens,
            response_format={"type": "json_object"},
        )
        return extract_json(response.choices[0].message.content or "")

    def _gemini(self, system: str, prompt: str, temperature: float, max_output_tokens: int) -> dict[str, Any]:
        client = genai.Client(api_key=self.settings.gemini_api_key)
        response = client.models.generate_content(
            model=self.settings.gemini_text_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                response_mime_type="application/json",
            ),
        )
        return extract_json(response.text or "")

    def _openrouter(self, system: str, prompt: str, temperature: float, max_output_tokens: int) -> dict[str, Any]:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": self.settings.site_url,
                "X-Title": "KM Afaq",
            },
            json={
                "model": self.settings.openrouter_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": temperature,
                "max_tokens": max_output_tokens,
                "response_format": {"type": "json_object"},
            },
            timeout=max(self.settings.request_timeout, 45),
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["choices"][0]["message"]["content"] or ""
        return extract_json(text)
