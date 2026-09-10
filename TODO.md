# Follow-up issues

These are intentionally out of scope for the POC. Track as GitHub-style issues for future work.

## Billing & plans

- [ ] **Stripe integration** — real paid plans, metered agent usage, webhooks
- [ ] **Agent quota enforcement** — hard limits per plan with usage dashboard
- [ ] **Team / shared workspace** — multi-user products with roles

## Regulatory data

- [ ] **CosIng import pipeline** — versioned ingest of EU CosIng annexes with diff alerts
- [ ] **Live regulatory watch** — scheduled re-checks when seed/rules version changes
- [ ] **UK, US/MoCRA, HK market packs** — expand beyond seeded EU/ASEAN
- [ ] **IFRA category picker** — product-type → IFRA category mapping in UI
- [ ] **Allergen calculator** — aggregate fragrance allergens from compound rows

## Product file & compliance workflow

- [ ] **Assessor CPSR upload** — attach PDF, mark CPSR gap resolved
- [ ] **CoA / stability attachments** — file storage per product section
- [ ] **Version history UI** — browse and diff frozen formula versions
- [ ] **Export pack** — zip PIF draft + INCI + regulatory annex for assessor handoff
- [ ] **CPNP/SCPN filing** — explicit non-goal until assessor workflow is solid

## Formulation quality

- [ ] **Materials library review** — have a formulator check bands, ceilings and notes in `formulation/materials.ts`; grow past ~140 materials (more actives, more aroma materials, surfactants for a future rinse-off format)
- [ ] **More formats** — cleanser / rinse-off, toner without gum, hair oil, body butter (whipped), room spray
- [ ] **Show gate warnings on the card** — the accepted proposal already carries `warnings`, `allergens` and `toOrder`; surface them under the proposal card
- [ ] **Chat-driven format switch** — “make it a balm instead” should re-run the guide for the new format on the same product
- [ ] **Score history** — keep `eval:briefs` results per model / prompt version so a change can be compared, not eyeballed
- [ ] **Perfume concentrate view** — optional: build the concentrate at 100% and dilute, instead of flat finished-product percents

## Agent & platform

- [ ] **First-turn auto-formula** — on “new from brief”, trigger agent propose_formula_patch automatically
- [ ] **Patch preview diff** — side-by-side before accept
- [ ] **Observability dashboard** — trace viewer for tool calls in production
- [ ] **Email magic-link auth** — replace password-only stub

## Data & integrations

- [ ] **Supplier / trade-name graph** — optional, not core
- [ ] **China NMPA** — separate market pack
- [ ] **Postgres for production** — swap SQLite for hosted deploy
