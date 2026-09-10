# Atelier — agent notes

The formula table is the source of truth. Chat proposes changes; the person accepts or rejects them. Match existing screens. Do not invent a new look. Read `DESIGN.md` before changing the web app.

## Commands

- Install: `npm install`
- Env file: copy `.env.example` to `.env` if it is missing
- Database: `npm run db:setup` (migrate + seed demo data)
- Dev: `npm run dev` (web http://localhost:5173, API http://localhost:4111)
- Tests: `npm test`
- Live formula eval: `npm run eval:briefs --workspace=apps/api` (needs a model key; see script header for `VERBOSE`, `KEEP`, `PAUSE_MS`)

## Formula drafting

The Lab Assistant fills a skeleton, it does not free-write. Knowledge lives in `packages/domain/src/formulation/`: `materials.ts` (library, separate from the shelf), `skeletons.ts` (formats, roles, bands, starters), `check.ts` (the gate every proposal passes), `guide.ts` (what the agent reads first), `briefs.ts` (fixed test set). If a formula looks wrong, fix the library or the skeleton first, then the prompt. A complete formula beats using only what is in stock; stock is a flag on each row.

Demo login: `demo@local.test` / `demo`. Toggle free/paid in Settings.

## Cursor Cloud specific instructions

Cloud setup lives in `.cursor/environment.json`. The install script already installs packages, migrates the database, and seeds demo data.

Secrets belong in Cursor Cloud settings, not in git:

- `OPENAI_API_KEY` — needed to try the paid formulator agent with OpenAI
- `GEMINI_API_KEY` — needed to try it with Gemini
- `FORMULATOR_PROVIDER` — `openai` or `gemini` (Gemini is the default when both keys exist)
- `MASTRA_JWT_SECRET` — optional; a local default exists

After install, `npm run dev` starts on its own (web 5173, API 4111). Use the demo login to click through the app. Check light and dark, and a narrow window, for UI changes. Never commit `.env`.
