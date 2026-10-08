# Follow-up issues

These are intentionally out of scope for the POC. Track as GitHub-style issues for future work.

## Billing & plans

- [ ] **Stripe integration** — real paid plans, metered agent usage, webhooks
- [ ] **Agent quota enforcement** — hard limits per plan with usage dashboard
- [ ] **Team / shared workspace** — multi-user products with roles

## Regulatory data

- [x] **EU Annex II bans** — loaded from the CosIng export; `npm run rules:refresh` replaces it when the Commission list changes
- [x] **Schedule the refresh** — the API runs it daily at 03:00 UTC in production and pings `REFRESH_HEARTBEAT_URL` (`/fail` on error)
- [ ] **ASEAN bans** — the official PDF is saved daily; read Annex II from it only after its table layout is checked
- [ ] **EU limits (Annex III–VI)** — dose limits and conditions from the same CosIng exports, shown separately from bans
- [ ] **UK, US/MoCRA, HK market packs** — each only from that country's own official list
- [ ] **IFRA category picker** — product-type → IFRA category mapping in UI
- [ ] **Allergen calculator** — aggregate fragrance allergens from compound rows

## Product file & compliance workflow

- [ ] **Assessor CPSR upload** — attach PDF, mark CPSR gap resolved
- [ ] **CoA / stability attachments** — file storage per product section
- [ ] **Version history UI** — browse and diff frozen formula versions
- [ ] **Export pack** — zip INCI + regulatory annex for assessor handoff
- [ ] **CPNP/SCPN filing** — explicit non-goal until assessor workflow is solid

## Formulation quality

- [ ] **Material data** — design a scalable, sourced material library (per-workspace table, supplier documents, links to official sources) to replace the removed hard-coded one, then decide whether MCP should expose it
- [ ] **Perfume concentrate view** — optional: build the concentrate at 100% and dilute, instead of flat finished-product percents

## Agent & platform

- [ ] **Patch preview diff** — side-by-side before accept
- [ ] **Observability dashboard** — trace viewer for tool calls in production
- [ ] **Email magic-link auth** — replace password-only stub

## Data & integrations

- [ ] **Supplier / trade-name graph** — optional, not core
- [ ] **China NMPA** — separate market pack
- [ ] **Postgres for production** — swap SQLite for hosted deploy
