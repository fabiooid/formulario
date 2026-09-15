# Formulario — agent notes

The formula table is the source of truth. Chat proposes changes; the person accepts or rejects them. Match existing screens. Do not invent a new look. Read `DESIGN.md` before changing the web app.

## Commands

- Install: `npm install`
- Env file: copy `.env.example` to `.env` if it is missing
- Database: `npm run db:setup` (migrate + seed demo data)
- Dev: `npm run dev` (web http://localhost:5173, API http://localhost:4111)
- The MVP exposes only the authenticated assistant stream under `/api`. Mastra Studio/editor and generic framework APIs are disabled. Run evals from the CLI.
- Tests: `npm test`
- Live formula eval: `npm run eval:briefs --workspace=apps/api` (needs a model key; see script header for `VERBOSE`, `KEEP`, `PAUSE_MS`)

## Formula drafting

MVP: the Lab Assistant is administrative only. Formulation runs in an external assistant through `apps/api/src/mcp/`. MCP connections are authenticated and pinned to an explicitly approved organization. External formulas become pending patches with an exact base version; only Formulario accepts them. Preserve structural validation, locks and stale-version protection. Do not filter or rank materials by inventory. The description field never starts an AI call.

The material library, evidence and experimental skeletons/gate remain in `packages/domain/src/formulation/` for reference and development evals. Do not re-enable the specialist or delegation in the production Mastra registration without an explicit product decision. See `docs/mcp.md` for setup and testing.

Demo login: `demo@local.test` / `demo`. Toggle free/paid in Settings.

## Cursor Cloud specific instructions

Cloud setup lives in `.cursor/environment.json`. The install script already installs packages, migrates the database, and seeds demo data.

Secrets belong in Cursor Cloud settings, not in git:

- `OPENAI_API_KEY` — needed to try the paid formulator agent with OpenAI
- `GEMINI_API_KEY` — needed to try it with Gemini
- `FORMULATOR_PROVIDER` — `openai` or `gemini` (Gemini is the default when both keys exist)
- `MASTRA_JWT_SECRET` — optional; a local default exists

After install, `npm run dev` starts on its own (web 5173, API 4111). Use the demo login to click through the app. Check light and dark, and a narrow window, for UI changes. Never commit `.env`.
