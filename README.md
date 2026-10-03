# Formulario

A formula notebook for indie skincare and perfume makers, with an AI assistant that can suggest changes but can never commit them.

> **Screenshot placeholder.** Add `docs/screenshot-workspace.png` of the product workspace (formula table with a pending patch). No image is committed yet, so this README does not link to a missing file.

## Why

Small beauty brands keep formulas in spreadsheets and email. Every change risks a label, a regulatory check or a product file going out of date. Formulario keeps the formula table as the single source of truth: the label ingredient list (INCI), market checks and product information file (PIF) drafts are always generated from the committed formula.

AI is useful here, but only if a person stays in control. The rule is simple: agents propose, people approve.

## What it shows

- **Approval boundary.** External assistants connect over MCP and can read product context, formula history and evidence. They can only create pending patches. No MCP tool can accept or commit one.
- **Safe edits.** Formula patches carry the exact version they were based on. Stale patches are rejected. Structural checks enforce totals, row identity and locked rows.
- **Evals and tests.** `npm test` covers domain rules, database and API behaviour, MCP and formula draft state. `npm run eval:briefs --workspace=apps/api` is a CLI eval for the development formulation specialist (fixed briefs, scored proposals). It needs a model key. That specialist is not registered in the running app.
- **Product scope.** Free and paid tiers with a stubbed billing toggle (no Stripe). Paid unlocks the in-app Lab Assistant. Extra markets, export and version history are UI stubs. This is not a compliance product.

## Status

Local proof of concept. There is no public hosted demo.

## How this was built

I own the product, UX, agent design and evals. Much of the code was written with Claude and Cursor coding agents and reviewed by me. The co-author lines in the history show which commits.

## Stack

- **Web:** Vite + React + shadcn/ui + Tailwind
- **Agent + API:** Mastra (Hono server)
- **App data:** SQLite via Drizzle (`apps/api/data/app.db`)
- **Agent memory:** LibSQL (`apps/api/data/mastra.db`)

## What this includes

- **Home:** shelf value, what to buy, formula cost, and what needs you today
- **Products:** card or list view, pin favourites, vegan / natural / organic claims
- **Product workspace:** description on top, formula below, regulatory / PIF on its own tab
- **Ingredients:** a shared library for the current organisation
- **Organisations:** a personal workspace plus named orgs you can switch between
- **Settings:** org name, theme, language, Connections for MCP, and a free / paid plan toggle

The Lab Assistant is a side pane on any signed-in page (sparkle in the breadcrumb, or ⌘J). Expand it to fill the window. Paid-only pieces stay in the same layout with an empty state; they are not hidden.

## How a formula gets drafted

The in-app Lab Assistant is administrative only: saved records, empty products, inventory proposals and exact product copies. Formulation runs in an external assistant connected through MCP. The description field is plain saved text and never starts an AI call.

MCP can read workspace-scoped product context, formula history, materials and evidence, and can submit a pending proposal. No MCP tool accepts or commits one. There is no inventory ranking. Seeded regulatory checks and PIF drafts stay in Formulario.

See [the agent guide](docs/agent-guide.md) and [MCP setup](docs/mcp.md).

## Prerequisites

- Node.js **≥ 22.13**
- A model key only if you want the paid Lab Assistant or the CLI eval (`GEMINI_API_KEY` or `OPENAI_API_KEY`)

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env (copy and edit)
cp .env.example .env

# 3. Migrate + seed demo data
npm run db:setup

# 4. Run API + web together
npm run dev
```

- **Web:** http://localhost:5173
- **API:** http://localhost:4111
- **Swagger:** http://localhost:4111/swagger-ui

Mastra Studio and the generic framework APIs are disabled. The app exposes the authenticated assistant stream under `/api` and the MCP/OAuth routes.

## Demo login

- Email: `demo@local.test`
- Password: `demo`
- Plan: **free** by default. Toggle to **paid** in Settings to try the Lab Assistant.

## Seeded products

These are synthetic demo records for the local notebook. They are not commercial formulas.

| Product | What to look for |
|---|---|
| Dry Unscented Face Oil | Unknown INCI (`MadeUpine`) |
| Daily Barrier Cream | Phenoxyethanol over the seeded limit |
| No. 3 Oil Perfume | Allergen labelling, an EU ban, Fragrance/Parfum wording |

## Env vars

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Gemini key for the Lab Assistant and development evals (default) |
| `OPENAI_API_KEY` | OpenAI key for the same |
| `FORMULATOR_PROVIDER` | `gemini` or `openai`. Default is Gemini when both keys exist. The other provider is the fallback when both keys are set. |
| `GEMINI_MODEL` / `OPENAI_MODEL` | Model ids. Stronger models repair drafts more reliably. |
| `FORMULATOR_MAX_RETRIES` | Retries per model call on rate limits or busy providers, default `4` |
| `MASTRA_JWT_SECRET` | JWT signing secret. Production refuses the example value. |
| `DATABASE_URL` | SQLite path, default `file:./data/app.db` |
| `PORT` | API port, default `4111` |
| `MCP_PUBLIC_URL` | Public API origin for MCP OAuth metadata, default `http://localhost:4111` |
| `APP_PUBLIC_URL` | Public web origin for consent redirects, default `http://localhost:5173` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API + web |
| `npm run dev:api` | Mastra server only |
| `npm run dev:web` | Vite UI only |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:seed` | Seed rules + demo products |
| `npm run db:setup` | Migrate + seed |
| `npm run test` | Domain, database/API, MCP and formula draft tests (isolated temporary databases) |
| `npm run eval:briefs --workspace=apps/api` | CLI eval: fixed briefs through the development specialist. Needs a model key. See the script header for `VERBOSE`, `KEEP`, `PAUSE_MS`. |

## Project layout

```
apps/web/          Vite + React UI
apps/api/          Mastra agent, REST routes, Drizzle, MCP
packages/domain/   Shared types, rules engine, PIF generator, formulation references
DESIGN.md          Visual and UX rules for the web app
docs/agent-guide.md  Lab Assistant, MCP boundary and development specialist
docs/mcp.md        MCP setup and the review loop
```

Formula rows keep their logical IDs across versions. The database key is `(version_id, id)`. Version saves and formula patch acceptance are transactional and require the version they were based on. Run `npm run db:migrate` after updating an existing checkout. Uncommitted formula edits stay in the current browser tab across navigation and reloads.

## Free vs paid (stub billing)

- **Free:** notebook, formula editor, INCI list, seeded EU check, PIF draft with gaps
- **Paid:** Lab Assistant (administrative, gated in the UI), extra markets, export and version history as UI stubs

Toggle the plan in **Settings**. There is no real billing and no usage meter in this proof of concept.

## Official references (linked in the UI, not scraped)

- [EU CosIng](https://ec.europa.eu/growth/sectors/cosmetics/cosing_en)
- [EUR-Lex 1223/2009](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223)
- [IFRA Standards](https://ifrafragrance.org/standards)
- [ASEAN Cosmetic Directive](https://asean.org/our-communities/economic-community/integration-with-global-economy/asean-cosmetic-directive/)

## Licence

Source shared for review. All rights reserved.
