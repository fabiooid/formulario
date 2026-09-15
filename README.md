# Formulario

A local proof of concept for indie skincare and perfume founders. **The formula table is the source of truth.** Chat can propose changes; you accept or reject them. INCI, market checks, and PIF drafts always come from the committed formula.

This is **not** a compliance product. It does not replace a qualified safety assessor or confirm legal market placement.

## Stack

- **Web:** Vite + React + shadcn/ui + Tailwind
- **Agent + API:** Mastra (Hono server)
- **App data:** SQLite via Drizzle (`apps/api/data/app.db`)
- **Agent memory:** LibSQL (`apps/api/data/mastra.db`)

## What this POC includes

- **Home** — shelf value, what to buy, formula cost, and what needs you today
- **Products** — card or list view, pin favorites, vegan / natural / organic claims
- **Product workspace** — brief prompt on top, formula below, regulatory / PIF on its own tab
- **Ingredients** — a shared library for the current organisation
- **Organisations** — a personal workspace plus named orgs you can switch between
- **Settings** — org name, theme, language, and a free / paid plan toggle

The agent is a side pane you can open from any signed-in page (sparkle in the breadcrumb, or ⌘J). Expand it to fill the window. Paid-only pieces stay in the same layout with an empty state — they are not hidden.

## How a formula gets drafted

The in-app Lab Assistant handles administration: saved records, empty products, inventory proposals and exact product copies. Formulation is handled by an external assistant connected through MCP. The description field is plain saved text.

MCP exposes workspace-scoped product context, formula history, material search, evidence and pending formula proposals. No MCP tool accepts or commits a proposal. There is no mandatory skeleton and no inventory preference; structural checks enforce totals, row identity and locks. Seeded regulatory checks and calculations remain in Formulario. The experimental specialist remains development-only.

See [MCP setup and the complete review loop](docs/mcp.md).

## Prerequisites

- Node.js **≥ 22.13**
- `OPENAI_API_KEY` (only needed for the paid agent feature)

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
- **API / Mastra Studio:** http://localhost:4111
- **Swagger:** http://localhost:4111/swagger-ui

## Demo login

- Email: `demo@local.test`
- Password: `demo`
- Plan: **free** by default — toggle to **paid** in Settings to try the agent

## Seeded products

| Product | What to look for |
|---|---|
| Dry Unscented Face Oil | Unknown INCI (`MadeUpine`) |
| Daily Barrier Cream | Phenoxyethanol 1.5% → restricted / reduce % |
| No. 3 Oil Perfume | Linalool relabel, Lilial EU ban, Fragrance→Parfum wording |

## Env vars

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Gemini key for the formulator agent (default) |
| `OPENAI_API_KEY` | OpenAI key for the formulator agent |
| `FORMULATOR_PROVIDER` | `gemini` or `openai`. Default is Gemini when both keys exist. The other provider is the fallback when both keys are set. |
| `GEMINI_MODEL` / `OPENAI_MODEL` | Model ids. Drafting full formulas works much better on a stronger model (e.g. `openai/gpt-4.1`). |
| `FORMULATOR_MAX_RETRIES` | Retries per model call on rate limits or busy providers, default `4` |
| `MASTRA_JWT_SECRET` | JWT signing secret (app auth + API) |
| `DATABASE_URL` | SQLite path, default `file:./data/app.db` |
| `PORT` | Mastra API port, default `4111` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API + web |
| `npm run dev:api` | Mastra server only |
| `npm run dev:web` | Vite UI only |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:seed` | Seed rules + demo products |
| `npm run db:setup` | Migrate + seed |
| `npm run test` | Domain, database/API regression tests, and formula draft state tests (isolated temporary databases) |
| `npm run eval:briefs --workspace=apps/api` | Run the fixed briefs through the live agent and score the proposals |

## Project layout

```
apps/web/          Vite + React UI
apps/api/          Mastra agent, REST routes, Drizzle
packages/domain/   Shared types, rules engine, PIF generator, formulation (materials, skeletons, gate)
DESIGN.md          Visual and UX rules for the web app
```

Formula rows retain their logical IDs across versions; their database key is `(version_id, id)`.
Version saves and formula patch acceptance are transactional and require the version they were based on.
Run `npm run db:migrate` after updating an existing checkout. Migration `0011` preserves existing rows;
older pending patches without a recorded base version must be rejected and requested again.
Uncommitted formula edits stay in the current browser tab across navigation and reloads.

## Free vs paid (stub billing)

- **Free:** notebook, formula editor, INCI list, seeded EU check, PIF draft with gaps
- **Paid:** administrative assistant (metered stub), extra markets label, export/version history (UI stubs)

Toggle plan in **Settings** — no real billing in this POC.

## Official references (linked in UI, not scraped)

- [EU CosIng](https://ec.europa.eu/growth/sectors/cosmetics/cosing_en)
- [EUR-Lex 1223/2009](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223)
- [IFRA Standards](https://ifrafragrance.org/standards)
- [ASEAN Cosmetic Directive](https://asean.org/our-communities/economic-community/integration-with-global-economy/asean-cosmetic-directive/)

### Assistant and formulation specialist

The chat calls `assistantAgent`: it reads app data, proposes empty products and stock edits, and duplicates products through the same service as the UI. New products and stock edits retain their accept/reject cards; an explicitly requested exact copy executes immediately. Other UI actions are not yet exposed as assistant tools.

The specialist, delegation tool and formulation scorers are not registered in the production Mastra instance. Experimental agent files remain available to development evals. External assistants propose via `/mcp`, and acceptance continues in the formula workspace.
