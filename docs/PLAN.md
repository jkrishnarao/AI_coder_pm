# Project Plan

## Goals and Constraints

- Deliver a locally run Project Management MVP in one Docker container, with a Next.js frontend and a Python FastAPI backend.
- Support one hardcoded MVP login (`user` / `password`) and one Kanban board per user. Keep the data model capable of associating boards with multiple users later.
- Persist board data in a local SQLite database that is initialized automatically when missing.
- Use OpenRouter for AI requests. Read `OPENROUTER_API_KEY` from the project-root `.env`; do not commit, expose in frontend code, or log the key. Use the agreed free model configuration.
- Preserve the current demo's fixed set of columns, column renaming, card editing, and drag-and-drop behavior. The AI may create, edit, and move cards.
- Keep implementation focused on the MVP. Do not add product features outside these requirements without approval.

## Quality Gates

- Unit tests are required for frontend and backend logic. Each package must achieve at least **80% statements, branches, functions, and lines coverage**. Configure enforceable thresholds and report the measurements; do not count generated output, dependencies, or test files as production source.
- Integration tests must exercise the frontend/backend boundary and real SQLite behavior using an isolated temporary database. Cover successful flows and failure cases, including invalid input, unauthenticated access, and persistence across reload/restart where applicable.
- Browser end-to-end tests must cover user-visible workflows. Use deterministic test data and a stubbed AI provider in routine tests; do not make test success depend on network access or OpenRouter availability.
- Keep a separate, explicitly invoked OpenRouter smoke test for the `2+2` connectivity check. It requires a configured key and must not run as part of ordinary offline test suites.
- Run relevant tests and lint/type checks at each stage. A stage is complete only when its listed tests pass and its success criteria are met.

## Current Architecture and Design Baseline

These are the implementation decisions currently reflected in the code. Where they differ from the original stage order, the implementation was delivered early to support the working MVP and persistence fix.

### Architecture

- The Next.js frontend is statically exported. A multi-stage Docker build produces the static assets and packages them with the FastAPI backend; FastAPI serves the frontend at `/` and registers `/api/*` routes before its static mount.
- Docker Compose runs one app service and stores SQLite data in the persistent `app-data` volume. The database path is configurable with `DB_PATH`.
- Authentication uses the MVP `user` / `password` credentials and a signed, HTTP-only, SameSite=Lax session cookie with a 12-hour lifetime. `SESSION_SECRET` should be set to preserve sessions across restarts.
- SQLite has a `users` table (`id` primary key, unique `username`) and a `boards` table (`user_id` primary key and foreign key to `users`, serialized `board_json`, `updated_at`). The current initializer creates missing tables and seeds the MVP user; it does not yet include versioned schema migrations.
- A board JSON document contains `columns` and `cards`. Columns have stable fixed IDs, editable titles, and ordered `cardIds`; cards are keyed by ID and contain `id`, `title`, and `details`. Backend validation enforces the fixed column IDs/order and that each card appears in exactly one column. The full validated board snapshot is stored per user and seeded from `backend/app/default_board.json`.
- OpenRouter credentials and requests stay in the backend. The connectivity smoke test is an explicit CLI command, not a URL/API route; `/api/health` checks app health only. The AI board-assistant API is planned for Part 9.

### Frontend Design

- Product name: Kanban Studio. The interface uses Space Grotesk for display text and Manrope for body text.
- Existing palette tokens are accent yellow `#ecad0a`, primary blue `#209dd7`, secondary purple `#753991`, dark navy `#032147`, and gray text `#888888`, with white and pale-gray surfaces. Tokens are defined in `frontend/src/app/globals.css`.
- The root page gates the board behind backend session verification; the authenticated view is the existing single-board workflow. The AI chat sidebar remains planned for Part 10.

## Part 1: Plan and Approval

### Checklist

- [x] Review the existing project requirements and frontend structure.
- [x] Expand every project stage into implementation tasks, tests, and measurable exit criteria.
- [x] Create `frontend/AGENTS.md` documenting the existing frontend and its commands.
- [x] Resolve the approval questions below with the user.
- [x] Obtain explicit user approval of this plan before starting Part 2.

### Tests and Review

- Review this plan against the business requirements in the root `AGENTS.md`.
- Confirm each feature has an implementation stage, test approach, and success criteria.
- Confirm that the frontend guidance describes the existing code rather than future functionality.

### Success Criteria

- The user has reviewed and approved the plan and the open decisions below are resolved before implementation begins.
- Frontend guidance exists at `frontend/AGENTS.md` and accurately reflects the current app.

### Decisions for Approval

- **Frontend serving:** Confirm that the Next.js app should be statically exported and served by FastAPI at `/`, with API paths kept separate from frontend routes. Verify this is compatible with the features used before committing to static export.
- **Authentication:** Choose the MVP session mechanism (prefer an HTTP-only cookie managed by the backend) and confirm expected behavior on reload, logout, and API requests. This is a local MVP, not production-grade identity management.
- **Database schema artifact:** Confirm that Part 5 should provide both a JSON board-shape/schema artifact and a concise SQLite table/relationship document, with user sign-off before Part 6.
- **AI change contract:** Confirm that AI changes will be expressed as validated, allowlisted board operations, applied by the backend, rather than allowing arbitrary database writes.

## Part 2: Docker and Backend Scaffolding

Status: complete. The user confirmed that all Part 2 success criteria have been achieved.

### Checklist

- [x] Inspect existing backend and scripts instructions before implementation; preserve the repository's existing conventions.
- [x] Create the FastAPI application and Python project configuration using `uv`.
- [x] Add a health endpoint and a minimal API example that can be called locally.
- [x] Add a minimal static HTML hello-world response for the initial container smoke test.
- [x] Create the Docker build and runtime configuration, including only required files and dependencies.
- [x] Add start and stop scripts for macOS/Linux and Windows; make startup report the local URL and stop only the app's own container.
- [x] Document required environment variables and persistent database volume behavior without exposing secrets.

### Tests

- [x] Backend unit tests for the root HTML, health route, and example API route; all pass with 100% measured coverage.
- [x] Container smoke test: build and start the image, request `/` and the API endpoint, then stop it using each supported operating-system script where CI/runtime permits.
- [x] Verify an absent optional AI key does not prevent the non-AI hello-world service from starting.
- [x] Parse-check the macOS/Linux shell scripts and Windows PowerShell scripts.

### Success Criteria

- [x] A clean checkout can build and run the container with documented commands.
- [x] The static hello-world page and API response are reachable on localhost, and stop scripts leave unrelated containers untouched.
- [x] The app does not require the database or OpenRouter integration to be implemented at this stage.

## Part 3: Serve the Existing Frontend

Status: complete. The exported Kanban board was verified in the production container.

### Checklist

- [x] Configure the frontend for the approved static-export/serving approach and integrate its output with FastAPI.
- [x] Display the Kanban board at `/`, retaining its interactions and adding the required card-edit workflow.
- [x] Ensure API paths do not collide with frontend assets or routes.
- [x] Add and enforce frontend unit-test coverage thresholds from the Quality Gates.
- [x] Add browser integration coverage for the delivered board workflows.

### Tests

- [x] Frontend unit tests for board rendering, column renaming, card creation/editing/deletion, and drag-and-drop state transitions; all four coverage metrics pass 80%.
- [x] Playwright tests against the built app served from the container, covering initial load and board interactions (6 passed).
- [x] Production build, lint, TypeScript build checks, and coverage-threshold checks.
- [x] Backend static-file integration tests preserve API routing (4 passed, 100% backend coverage).

### Success Criteria

- [x] The container serves the built app at `/`; the board and its interactions work in a browser.
- [x] Frontend unit coverage meets all 80% thresholds, and browser tests pass against the production-style served build.

## Part 4: Dummy Sign-In and Sign-Out

Status: complete. The board is gated by a backend-verified signed session cookie.

### Checklist

- [x] Add the agreed login flow using exactly the MVP credentials `user` and `password`.
- [x] Keep the static board unrendered until the backend confirms a session and reject unauthenticated session-check requests.
- [x] Add logout and define session behavior for page reload and expired/invalid sessions.
- [x] Keep credentials and session validation on the backend; do not treat frontend-only state as authorization.

### Tests

- [x] Backend tests cover valid/invalid credentials, HTTP-only/SameSite cookie flags, session reuse, logout invalidation, and unauthorized access (7 passed, 100% coverage).
- [x] Frontend unit tests cover the unauthenticated gate, login/logout, rejected credentials, and recoverable request failures (13 passed; all coverage thresholds met).
- [x] Playwright tests cover signed-out navigation, invalid credentials, reload, logout, and board workflows (9 passed).
- [x] Production-container HTTP check verified the board is absent before session verification and a real cookie is invalidated on logout.

### Success Criteria

- [x] Only the configured dummy credentials establish a session.
- [x] The board is rendered only with a valid session, and logout invalidates that session.
- [x] Auth behavior remains usable after page reload and is consistently enforced by the backend.

## Part 5: Database Modeling and Sign-Off

Status: the data model and persistence implementation were delivered early in Parts 6 and 7. The current representation and SQLite mapping are recorded in the architecture baseline above; formal schema artifact validation and user sign-off remain outstanding.

### Checklist

- [x] Document the implemented JSON board representation for fixed columns and cards.
- [x] Document the SQLite tables, keys, relationships, and current initialization behavior in this plan.
- [x] Record how fixed column IDs and user-to-board ownership are represented while allowing column titles to be renamed.
- [ ] Create and validate a formal JSON Schema artifact for the persisted board shape.
- [ ] Review the proposal with the user and record approval before implementation.

### Tests and Review

- [ ] Validate the formal JSON Schema artifact using a standard JSON/schema validator.
- Review examples for empty and populated boards, stable IDs, and the one-board-per-user constraint.
- Note: production database code was implemented early to resolve the persistence issue; do not treat Part 5 as signed off until the formal schema and user review are complete.

### Success Criteria

- The data shape and SQLite mapping are documented; the formal schema artifact and user approval remain required to close Part 5.

## Part 6: Persistent Backend API

Status: board persistence implementation completed early to resolve the reported data-loss issue. Formal Part 5 schema approval and multi-user isolation remain outstanding.

### Checklist

- [x] Implement database initialization so a missing SQLite database and required tables are created automatically.
- [x] Implement authenticated API operations to read and update the signed-in user's board.
- [x] Validate the fixed columns and card-to-column consistency at the API boundary; scope access to the authenticated session user.
- [x] Persist column renames and card creation, editing, deletion, and movement by storing the validated board snapshot.
- [x] Keep database access and transaction handling in a small, testable backend layer.

### Tests

- [x] Backend tests cover validation, mapping, session enforcement, fresh-database seeding, save/reload, and invalid board payloads; 12 passed at 97% coverage.
- [x] Temporary-SQLite API tests and an isolated Docker-volume check verified persistence across logout/re-login and backend restart.
- [ ] Multi-user ownership isolation tests remain pending; MVP currently has one hardcoded user and the API does not accept a caller-supplied user ID.

### Success Criteria

- [x] The API returns and persists valid board data for the authenticated user.
- [x] A fresh database is initialized automatically; invalid requests and unauthorized access are rejected without corrupting stored data.
- [x] Backend unit coverage meets the 80% thresholds and isolated-database integration tests pass.

## Part 7: Persistent Frontend and Backend Integration

Status: persistence and dashboard integration are implemented and verified; session-expiry UX and broader failure/recovery cases remain for this stage.

### Checklist

- [x] Replace demo-only board state with data loaded from the backend API.
- [x] Persist user actions for renaming columns and creating, editing, deleting, and moving cards.
- [ ] Add clear loading, empty, save/error, and session-expired behavior without losing unsaved user input unnecessarily.
- [x] Keep frontend API access typed and centralized; do not put database or authentication secrets in the browser.

### Tests

- [x] Frontend API/client/component tests cover load, save, error responses, and persisted edits; 18 passed with all coverage thresholds met.
- [x] API tests and an opt-in Playwright test cover the dashboard-to-SQLite request path.
- [x] Playwright tests cover board operations, sign-out/re-login persistence, and login/logout; 10 routine tests and the isolated real-backend persistence test passed.

### Success Criteria

- [x] Board changes persist across reloads and are scoped to the signed-in MVP user.
- [x] The app reports board loading and save/load failures accessibly without discarding in-memory changes.
- [x] Container-based persistence and browser integration tests pass.

## Part 8: OpenRouter Connectivity

Status: complete. The mocked client suite passes, and the live `2+2` smoke test succeeded inside the Docker container.

### Checklist

- [x] Add a backend-only OpenRouter client configured from environment variables, using `openrouter/free` by default with an `OPENROUTER_MODEL` override.
- [x] Keep API key handling server-side and exclude secret values from logs and responses.
- [x] Add a 30-second request timeout and useful, non-secret error handling.
- [x] Add a manually invoked connectivity smoke test that asks `2+2` and checks for the answer.

### Tests

- [x] Mocked HTTP unit tests cover success, model selection, missing configuration, timeout, provider errors, and malformed responses; 10 OpenRouter cases pass offline.
- [x] Live smoke test passed using the configured key from the container environment; it remains separate from routine suites.

### Success Criteria

- [x] Mocked provider tests pass offline and the live `2+2` smoke test succeeds.
- [x] No API key is present in frontend assets, logs, or API responses.

## Part 9: Structured AI Board Assistant API

Status: complete. Mocked-provider integration tests pass, and the authenticated assistant endpoint returned a live OpenRouter response in the production-style container.

### API Contract

- `POST /api/assistant` requires the existing authenticated session. The request is `{ "message": string, "history"?: [{ "role": "user" | "assistant", "content": string }] }`. Message and history content are limited to 2,000 characters; history is limited to 20 entries. Extra fields, including a caller-supplied board or user ID, are rejected.
- The backend loads the current user's board from SQLite and sends it with the bounded conversation to OpenRouter using strict JSON Schema output. The response is `{ "reply": string, "board": BoardData }`; the board is the resulting current board, unchanged for reply-only output.
- Allowed operations are `create_card` (title, details, fixed `column_id`), `edit_card` (existing `card_id` and at least one of nullable title/details), and `move_card` (existing `card_id` and fixed `column_id`). At most 20 operations are accepted. New card IDs are generated by the backend.
- All operations are validated and applied to an in-memory board copy before one database save. Invalid output or a provider failure returns a controlled 502 response and does not save partial changes; missing OpenRouter configuration returns 503.

### Checklist

- [x] Define and document the request/response contract, including board JSON, user message, conversation history, assistant reply, and optional board operations.
- [x] Send the current authenticated user's board and relevant conversation history to OpenRouter from the backend.
- [x] Require structured output and validate it against a strict schema before returning or applying changes.
- [x] Restrict changes to approved operations on the current user's board; apply valid updates atomically and return the updated board.
- [x] Define conversation-history limits and behavior when the provider fails or returns invalid output.

### Tests

- [x] Unit tests for prompt/request construction, schema validation, operation validation, and atomic application.
- [x] Backend integration tests with a mocked provider for reply-only results, valid multi-card changes, invalid output, provider failure, and ownership boundaries.
- [x] Confirm no provider call can directly bypass API validation or write to another user's data.
- [x] Production-container live request verified an assistant reply and unchanged board using OpenRouter.

### Success Criteria

- [x] The endpoint always uses the current board and supplied conversation context, returns a validated reply, and applies only valid authorized changes.
- [x] Invalid or failed AI responses leave the board unchanged and produce a controlled error response.

## Part 10: AI Chat Sidebar

Status: complete. The authenticated board includes a responsive assistant panel connected to `/api/assistant`; mocked browser workflows pass, and a live request through the running app returned an OpenRouter response without changing the board.

### Checklist

- [x] Add a responsive chat sidebar to the authenticated board view with message history and a message composer.
- [x] Show sending, response, and failure states; prevent accidental duplicate submissions while a request is pending.
- [x] Render assistant replies and reflect returned board changes without requiring a page reload.
- [x] Preserve usable board interactions at desktop and mobile widths, including when the sidebar is open.
- [x] Provide accessible labels, keyboard interaction, and clear focus behavior.

### Tests

- [x] Frontend unit tests for chat submission, pending/error states, and applying returned board data.
- [x] Playwright tests with a deterministic mocked AI response for chat, reply-only, board-changing response, provider error, and narrow viewport behavior.
- [x] Final regression run: frontend/backend unit suites with coverage thresholds, backend/frontend integration tests, Playwright, lint, type-check, and production container build.

### Success Criteria

- [x] A signed-in user can chat with the assistant; valid returned board changes appear immediately and persist.
- [x] Error states do not lose the current board or expose secrets, and the board/chat remain usable on supported viewport sizes.
- [x] All final quality gates pass, including 80% minimum unit coverage for both frontend and backend.