import asyncio
import re
import sys

from app.openrouter import OpenRouterError, chat_completion


async def run_smoke_test() -> None:
    answer = await chat_completion(
        [{"role": "user", "content": "What is 2 + 2? Reply with only the number."}]
    )
    if not re.search(r"\b4\b", answer):
        raise OpenRouterError("The 2+2 smoke test did not return the expected answer.")


def main() -> None:
    try:
        asyncio.run(run_smoke_test())
    except OpenRouterError as error:
        print(f"OpenRouter smoke test failed: {error}", file=sys.stderr)
        raise SystemExit(1) from None
    print("OpenRouter smoke test passed.")


if __name__ == "__main__":
    main()