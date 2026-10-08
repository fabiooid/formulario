# Formulario — agent notes

The formula table is the source of truth. Chat proposes changes; the person accepts or rejects them. Match existing screens. Do not invent a new look. Read `DESIGN.md` before changing the web app.

## Commands

- Install: `npm install`
- Env file: copy `.env.example` to `.env` if it is missing
- Database: `npm run db:setup` (migrate + seed demo data)
- Dev: `npm run dev` (web http://localhost:5173, API http://localhost:4111)
- The MVP exposes only the authenticated assistant stream under `/api`. Mastra Studio/editor and generic framework APIs are disabled. Run evals from the CLI. Local Studio listing of the Formulario MCP needs `MASTRA_STUDIO=1`; do not use that flag in production.
- Tests: `npm test`

## Formula drafting

MVP: the Lab Assistant is administrative only. Formulation runs in an external assistant through `apps/api/src/mcp/`. That MCP is registered with Mastra as `formulario` so Studio can list it. MCP connections are authenticated and pinned to an explicitly approved organization. External formulas become pending patches with an exact base version; only Formulario accepts them. Preserve structural validation and stale-version protection. Do not filter or rank materials by inventory. The description field never starts an AI call.

There is no built-in material library, evidence store or in-app formulation agent. Do not add one without an explicit product decision. See `docs/mcp.md` for setup and testing.

Country bans shown in the app come only from the official CosIng Annex II file at `packages/domain/data/eu-annex-ii.csv`. Do not seed or display `seed-rules.ts`. A missing name is not an approval. Other countries stay unchecked until their own official list is loaded.

`npm run rules:refresh` downloads that Commission file and Singapore's current ASEAN annex PDF. The EU list replaces the one in use only after the new file parses, inside one database transaction. The ASEAN PDF is stored and is not turned into bans.

Public registration is closed. Create an account with `npm run users:create -- person@example.com` (add `--plan paid`, or `--reset` to send a new temporary password). They choose their own password on first sign-in. Demo login: `demo@local.test` / `demo`.

V1 gives every account the Lab Assistant: `ASSISTANT_REQUIRES_PAID_PLAN` in `packages/domain/src/plans.ts` is the single switch for the API gate, the chat pane and Settings → Plan. Accounts cannot change their own plan in production.

The Lab Assistant has live scorers in `apps/api/src/mastra/scorers/assistant-scorers.ts` (code checks on every reply, two LLM judges sampled by `SCORER_SAMPLE_RATE`). Studio is off in production; read results with `npm run scores:report` and tester feedback with `npm run feedback:report`. Deployment: `docs/deployment.md`.

## Cursor Cloud specific instructions

Cloud setup lives in `.cursor/environment.json`. The install script already installs packages, migrates the database, and seeds demo data.

Secrets belong in Cursor Cloud settings, not in git:

- `OPENAI_API_KEY` — needed to try the paid Lab Assistant with OpenAI
- `GEMINI_API_KEY` — needed to try it with Gemini
- `FORMULATOR_PROVIDER` — `openai` or `gemini` (Gemini is the default when both keys exist)
- `MASTRA_JWT_SECRET` — optional; a local default exists

After install, `npm run dev` starts on its own (web 5173, API 4111). Use the demo login to click through the app. Check light and dark, and a narrow window, for UI changes. Never commit `.env`.
