# Backend Guidance

## Current Structure

- `app/main.py` defines the FastAPI application, dummy login/session/logout routes, health and example API routes, and a configurable static frontend mount at `/`.
- `app/database.py` initializes SQLite and stores one JSON board snapshot per user; `app/default_board.json` seeds the MVP board on first read.
- `app/openrouter.py` is the backend-only OpenRouter chat-completion client; `app/openrouter_smoke.py` provides the optional live `2+2` check.
- `app/static/index.html` is a minimal fallback page for local backend development. The Docker image serves the Next.js static export from `/app/frontend` instead.
- `tests/` contains pytest API tests using FastAPI's `TestClient`.
- `pyproject.toml` defines runtime dependencies and the `uv`-managed development/test dependencies. Coverage is measured with pytest-cov and currently enforced at 80% for statements, branches, functions, and lines.
- The root `Dockerfile` builds the backend image; root `compose.yaml` runs the service and declares the persistent `app-data` volume.

## Commands

Run from `backend/`:

- `uv run --group dev pytest` runs backend tests and enforces coverage.
- `uv run uvicorn app.main:app --reload` starts the API for local development.

The service listens on port 8000 in the container. `FRONTEND_DIR` selects the static frontend directory; API routes are registered before the static mount. Login accepts only the MVP credentials `user` / `password`. Session state is signed in an HTTP-only, SameSite=Lax cookie with a 12-hour lifetime. Set `SESSION_SECRET` to keep sessions valid across restarts; if omitted, a random process-local key is generated. `DB_PATH` selects the SQLite database, defaulting to `backend/data/kanban.sqlite3` for local development and `/app/data/kanban.sqlite3` in Docker. `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL` are passed only to the backend container. The API key is never logged or sent to the frontend.

Keep route behavior testable through the ASGI app. Board access must derive its owner from the authenticated session, never from a caller-supplied user ID. OpenRouter tests must use a mock HTTP transport; run the live smoke test explicitly only when a configured key and network access are available.