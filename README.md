# Atelier — cosmetics formula tracker

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

The Lab Assistant does not write formulas from memory. It fills a **skeleton** for the product format and every draft passes a **gate** before it becomes a card:

1. **Format** — the brief is read for a format: cream / lotion, serum, face oil, balm, alcohol perfume (EDP), oil perfume, solid perfume. The agent names the format it chose in its reply; say “make it a balm” to redirect.
2. **Skeleton** (`packages/domain/src/formulation/skeletons.ts`) — the roles a real product of that format needs (emulsifier, chelator, preservative, pH adjuster, fixative…), the percent band each role takes, the phases, bench steps, and a worked starter split that already adds to 100.
3. **Materials library** (`packages/domain/src/formulation/materials.ts`) — ~140 real materials with INCI, aliases, roles, usual band, ceiling, phase, allergen and origin flags, and process notes. This is knowledge, separate from your shelf.
4. **Gate** (`packages/domain/src/formulation/check.ts`) — the draft is rejected and sent back to the agent when: rows do not add to 100, a required role is missing, a material is not in the library or on the shelf, a percent is over its ceiling, water is present without preservative / chelator / pH adjuster, a perfume has fewer than 6–8 aroma materials or a single “Fragrance” row, a seed rule bans or limits a material, or a vegan product has an animal-derived row. Softer issues travel as warnings on the accepted proposal.
5. **Stock is a flag, not a filter.** The agent proposes the right material and tells you what is not on the shelf. A complete formula beats using only what is in stock.

The seeded briefs in `packages/domain/src/formulation/briefs.ts` are the fixed test set. Run them against the live agent with `npm run eval:briefs --workspace=apps/api` (see the script header for options). A small model (e.g. `gpt-4o-mini`) reaches the gate but rarely repairs a rejected perfume; `gpt-4.1` or an equivalent passes most briefs in one or two tries.

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
- **Paid:** formulator agent (metered stub), extra markets label, export/version history (UI stubs)

Toggle plan in **Settings** — no real billing in this POC.

## Official references (linked in UI, not scraped)

- [EU CosIng](https://ec.europa.eu/growth/sectors/cosmetics/cosing_en)
- [EUR-Lex 1223/2009](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223)
- [IFRA Standards](https://ifrafragrance.org/standards)
- [ASEAN Cosmetic Directive](https://asean.org/our-communities/economic-community/integration-with-global-economy/asean-cosmetic-directive/)

### Assistant and formulation specialist

The chat calls `assistantAgent`: it reads app data, proposes empty products and stock edits, and duplicates products through the same service as the UI. New products and stock edits retain their accept/reject cards; an explicitly requested exact copy executes immediately. Other UI actions are not yet exposed as assistant tools.

`delegate_formulation` calls `formulatorAgent` with the brief, authenticated user and selected product/variant. The specialist reads fresh formula data and owns formulation proposals. Review mode exposes only read tools. A new product with a formula is one specialist proposal. Conversation memory belongs to the assistant; specialist calls do not share its thread. Both routes use the existing authenticated paid-plan gate and existing model/fallback settings. The brief eval continues to target the specialist independently.
