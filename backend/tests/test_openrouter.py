import asyncio
import json

import httpx
import pytest

from app.openrouter import (
    DEFAULT_MODEL,
    OPENROUTER_URL,
    OpenRouterConfigurationError,
    OpenRouterProviderError,
    OpenRouterResponseError,
    chat_completion,
)

MESSAGES = [{"role": "user", "content": "What is 2 + 2?"}]


def test_sends_authorized_request_to_free_model() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == OPENROUTER_URL
        assert request.headers["authorization"] == "Bearer test-key"
        assert request.headers["x-title"] == "Project Management MVP"
        assert request.read()
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "  4  "}}]},
        )

    async def run() -> str:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await chat_completion(MESSAGES, client=client, api_key="test-key")

    assert asyncio.run(run()) == "4"


def test_uses_configured_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_MODEL", "provider/model-free")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.read()
        assert b'"model":"provider/model-free"' in request.content
        return httpx.Response(200, json={"choices": [{"message": {"content": "4"}}]})

    async def run() -> str:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await chat_completion(MESSAGES, client=client, api_key="test-key")

    assert asyncio.run(run()) == "4"


def test_defaults_to_free_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.read()
        assert DEFAULT_MODEL.encode() in request.content
        return httpx.Response(200, json={"choices": [{"message": {"content": "4"}}]})

    async def run() -> str:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await chat_completion(MESSAGES, client=client, api_key="test-key")

    assert asyncio.run(run()) == "4"


def test_forwards_structured_response_format() -> None:
    response_format = {
        "type": "json_schema",
        "json_schema": {"name": "test", "strict": True, "schema": {"type": "object"}},
    }

    def handler(request: httpx.Request) -> httpx.Response:
        assert json.loads(request.read())["response_format"] == response_format
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    async def run() -> str:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await chat_completion(
                MESSAGES,
                client=client,
                api_key="test-key",
                response_format=response_format,
            )

    assert asyncio.run(run()) == "{}"


def test_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(OpenRouterConfigurationError, match="not configured"):
        asyncio.run(chat_completion(MESSAGES))


def test_sanitizes_provider_http_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        request.read()
        return httpx.Response(401, text="sensitive provider response")

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await chat_completion(MESSAGES, client=client, api_key="test-key")

    with pytest.raises(OpenRouterProviderError, match="HTTP 401") as error:
        asyncio.run(run())
    assert "sensitive provider response" not in str(error.value)


def test_sanitizes_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        request.read()
        raise httpx.ReadTimeout("sensitive timeout details", request=request)

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await chat_completion(MESSAGES, client=client, api_key="test-key")

    with pytest.raises(OpenRouterProviderError, match="timed out") as error:
        asyncio.run(run())
    assert "sensitive timeout details" not in str(error.value)


def test_sanitizes_connection_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        request.read()
        raise httpx.ConnectError("sensitive connection details", request=request)

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await chat_completion(MESSAGES, client=client, api_key="test-key")

    with pytest.raises(OpenRouterProviderError, match="request failed") as error:
        asyncio.run(run())
    assert "sensitive connection details" not in str(error.value)


@pytest.mark.parametrize(
    "body",
    [
        {"choices": []},
        {"choices": [{"message": {"content": []}}]},
        {"unexpected": True},
    ],
)
def test_rejects_malformed_provider_responses(body: object) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        request.read()
        return httpx.Response(200, json=body)

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await chat_completion(MESSAGES, client=client, api_key="test-key")

    with pytest.raises(OpenRouterResponseError, match="invalid response"):
        asyncio.run(run())