# Atelier — agent notes

The formula table is the source of truth. Chat proposes changes; the person accepts or rejects them. Match existing screens. Do not invent a new look. Read `DESIGN.md` before changing the web app.

## Commands

- Install: `npm install`
- Env file: copy `.env.example` to `.env` if it is missing
- Database: `npm run db:setup` (migrate + seed demo data)
- Dev: `npm run dev` (web http://localhost:5173, API http://localhost:4111)
- Tests: `npm test`

Demo login: `demo@local.test` / `demo`. Toggle free/paid in Settings.

Seeded products: SUPERSKIN, Gel Doccia Vetiver, Crema Mani Cedro (pinned), plus Dry Unscented Face Oil for the unknown-INCI state. Re-running `npm run db:seed` refreshes those demo formulas.

## Cursor Cloud specific instructions

Cloud setup lives in `.cursor/environment.json`. The install script already installs packages, migrates the database, and seeds demo data.

Secrets belong in Cursor Cloud settings, not in git:

- `OPENAI_API_KEY` — needed to try the paid formulator agent
- `MASTRA_JWT_SECRET` — optional; a local default exists

After install, `npm run dev` starts on its own (web 5173, API 4111). Use the demo login to click through the app. Check light and dark, and a narrow window, for UI changes. Never commit `.env`.
