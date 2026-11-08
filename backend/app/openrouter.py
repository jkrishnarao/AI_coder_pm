import os
from collections.abc import Mapping, Sequence
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openrouter/free"


class OpenRouterError(RuntimeError):
    pass


class OpenRouterConfigurationError(OpenRouterError):
    pass


class OpenRouterProviderError(OpenRouterError):
    pass


class OpenRouterResponseError(OpenRouterError):
    pass


async def chat_completion(
    messages: Sequence[Mapping[str, str]],
    *,
    client: httpx.AsyncClient | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    key = api_key or os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise OpenRouterConfigurationError("OPENROUTER_API_KEY is not configured.")

    request_client = client or httpx.AsyncClient(timeout=30.0)
    request_model = model or os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL)
    try:
        try:
            response = await request_client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "Project Management MVP",
                },
                json={"model": request_model, "messages": list(messages)},
            )
            response.raise_for_status()
        except httpx.TimeoutException:
            raise OpenRouterProviderError("OpenRouter request timed out.") from None
        except httpx.HTTPStatusError as error:
            raise OpenRouterProviderError(
                f"OpenRouter returned HTTP {error.response.status_code}."
            ) from None
        except httpx.RequestError:
            raise OpenRouterProviderError("OpenRouter request failed.") from None

        try:
            payload: dict[str, Any] = response.json()
            content = payload["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise OpenRouterResponseError("OpenRouter returned an invalid response.") from None

        if not isinstance(content, str) or not content.strip():
            raise OpenRouterResponseError("OpenRouter returned an invalid response.")
        return content.strip()
    finally:
        if client is None:
            await request_client.aclose()