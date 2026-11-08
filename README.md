# Few prompt used

- please review Agents.md and the plan and let me know if you have any questions and do not do anything
- Enrich plan.md, yes create AGENTS.md for frontend right away and 80% coverage for unit testing coverage minimum and robust intergation testing. Go ahead part 1'
- confirmed, approved, on to step 2
- how to check myself it is working
- that is good. Part 2 is done. all are the success crieria for part 2 acheived
- Proceed to part 3
- iteration done till part 8
- update the plan.md based on Agents.md and till now design and architecture changes done
- create new chat   -> it will delete all the context
-  Actually I want it to go all the way to opernrouter - no mocking - lets check we can get an anwer from the model
- proceed to step 9

# Project Management MVP

## Run

- macOS/Linux: `sh scripts/start.sh` and `sh scripts/stop.sh`
- Windows PowerShell: `./scripts/start.ps1` and `./scripts/stop.ps1`

The app is available at `http://localhost:8000`. Set `PM_PORT` to change the host port. Docker Compose reads `OPENROUTER_API_KEY` from the project-root `.env` when present; the key is not needed for the current app. Board data is stored in the Compose-managed `app-data` volume.

Docker builds the static Next.js frontend and serves it from FastAPI at `/`. The API includes `/api/health` and `/api/example`.

## Sign In

Sign in with username `user` and password `password`. The backend stores the signed session in an HTTP-only, SameSite=Lax cookie that expires after 12 hours. Set `SESSION_SECRET` in the project-root `.env` to keep existing sessions valid across container restarts; otherwise, restarting the backend invalidates sessions. These hardcoded credentials are for local MVP use only.

## Backend Tests

Run from `backend/` with `uv run --group dev pytest`.

## OpenRouter Smoke Test

Set `OPENROUTER_API_KEY` in the project-root `.env`, then run `docker compose exec app python -m app.openrouter_smoke`. The smoke test uses `openrouter/free` unless `OPENROUTER_MODEL` is set and is not part of routine tests.

## Frontend Tests

Run from `frontend/` with `npm ci`, `npm run test:unit`, `npm run test:e2e`, and `npm run build`. Unit tests enforce the 80% coverage thresholds. Install Playwright's browser once with `npx playwright install chromium`.