# Frontend Guidance

## Current Structure

- `src/app/page.tsx` renders `AuthGate` at the root route. `AuthGate` checks the backend session before mounting `KanbanBoard`; `src/app/layout.tsx` provides the document shell, fonts, metadata, and global stylesheet.
- `src/components/KanbanBoard.tsx` loads the signed-in user's board, owns its interactive state, and queues ordered saves after edits. It composes the board columns and drag preview.
- `src/components/KanbanColumn.tsx` renders a column and its cards; `KanbanCard.tsx`, `KanbanCardPreview.tsx`, and `NewCardForm.tsx` provide the card and card-entry UI.
- `src/lib/kanban.ts` defines the `Card`, `Column`, and `BoardData` types, demo board shape, card-movement logic, and ID creation. `src/lib/board-api.ts` contains the typed same-origin board GET/PUT client.
- Unit/component tests live alongside source as `*.test.ts` or `*.test.tsx` under `src/`. Browser tests live in `tests/` and use Playwright.
- `src/test/setup.ts` configures the Vitest test environment. `vitest.config.ts` uses jsdom and the `@` alias for `src/`; `playwright.config.ts` runs the browser suite against the local Next.js development server.

Board interactions load and persist through the authenticated FastAPI API. The login gate uses same-origin session endpoints and does not store credentials or authorization state in local storage. The frontend is statically exported and served by FastAPI in the Docker image.

## Commands

Run these from `frontend/`:

- `npm run dev` starts the Next.js development server.
- `npm run build` builds the frontend.
- `npm run lint` runs ESLint.
- `npm run test:unit` runs Vitest with coverage and enforces the 80% statements, branches, functions, and lines thresholds; `npm run test:unit:watch` runs it in watch mode.
- `npm run test:e2e` runs Playwright; `npm run test:all` runs unit and browser tests in sequence.

The Vitest configuration reports text and HTML coverage for frontend production code, excluding generated output, dependencies, and test files. Keep unit tests deterministic and use Playwright for browser-level workflows. Set `PLAYWRIGHT_BASE_URL` to run the browser suite against an already-running container instead of starting the Next.js development server.

## Conventions

- Keep board domain types and pure transformations in `src/lib/kanban.ts` or a nearby focused library module; keep UI state and event wiring in components.
- Prefer accessible roles and labels in UI and tests. Use Testing Library for component behavior and Playwright for complete user workflows.
- Keep API access in a reusable frontend client module when backend integration is introduced. Never put server secrets or the OpenRouter key in frontend code.
- Keep changes focused and run the relevant unit tests, browser tests, lint, and build checks for the affected behavior.