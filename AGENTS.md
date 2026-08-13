# Repository Guidelines

## Project Structure & Module Organization

InsightUX uses React/Vite with a Node HTTP API and SQLite.

- `src/pages/participant/`: anonymous test and calibration flows.
- `src/pages/analyst/`: authenticated task, session, and report pages.
- `src/components/`: reusable participant, researcher, and shared UI.
- `src/lib/`: API client, rrweb recorder, and MediaPipe integration.
- `server/`: API, authentication, persistence, diagnosis, and site hosting.
- `test/*.test.js`: Node unit and API integration tests.
- `test/e2e/`: Playwright browser workflows and fixtures.
- `docs/`: product, implementation, and SDK documentation.
- `scripts/`: development and end-to-end test launchers.

Do not commit generated `dist/`, `data/`, or `test-results/` content.

## Build, Test, and Development Commands

- `npm install`: install dependencies; Node 22.5 or newer is required.
- `npm run dev`: build the SDK and start Vite plus the API.
- `npm run dev:web` / `npm run dev:api`: start one development service independently.
- `npm test`: run Node unit and API integration tests.
- `npm run test:e2e`: run Playwright workflows with local Chrome.
- `npm run lint`: check JavaScript and React hook rules with ESLint.
- `npm run build`: create the app and stable recorder SDK bundle.

Run lint, relevant tests, and the production build before submitting changes.

## Coding Style & Naming Conventions

Use ES modules, two-space indentation, single quotes, and no semicolons, matching existing files. React components and page files use `PascalCase` (for example, `TaskManagePage.jsx`); functions, hooks, and variables use `camelCase`. Keep server validation near route boundaries and persistence logic in `server/db.js`. Prefer Tailwind utility classes and existing shared styles over new one-off CSS.

## Testing Guidelines

Use Node's built-in `node:test` with strict assertions. Name unit/integration files `*.test.js`; name Playwright files `*.spec.js`. Add regression coverage for validation, authorization, migrations, session isolation, and recording limits. Browser-facing workflows should verify persisted API state, not only visible text.

## Commit & Pull Request Guidelines

History follows Conventional Commits: `feat(tasks): ...`, `fix: ...`, `test: ...`, and `docs: ...`. Keep each commit independently testable and scoped to one behavior. Pull requests should include a concise problem/solution summary, validation commands and results, linked issues when applicable, and screenshots for visible UI changes. Call out schema migrations, privacy changes, and deployment configuration explicitly.

## Security & Configuration

Copy `.env.example` to `.env`; never commit passwords, session secrets, or API keys. Preserve ZIP extraction limits, iframe sandboxing, opaque tokens, and participant consent boundaries. Document new environment variables and ensure uploaded content remains under the configured data directory.
