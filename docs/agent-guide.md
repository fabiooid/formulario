# Agent guide

This describes the code as it is now. It is not a promise that every model reply will follow the instructions.

Formulario has one in-app agent and one external formulation path. Agents can propose. Only a person in Formulario can accept a formula change.

## The two paths

**Lab Assistant (in-app).** A paid side pane. It reads saved products, formulas, inventory and the home overview. It can propose an empty product or a stock edit (you accept on a card), and it can duplicate a saved product immediately when you ask. It cannot choose ingredients or percentages, and it cannot delegate formulation.

**External assistant (MCP).** ChatGPT, Claude or another MCP client connects from Settings → Connections. It reads workspace context and can submit a pending formula proposal. No MCP tool can accept or commit that proposal. Acceptance stays in the product workspace.

The experimental formulation specialist still lives in the repo for development evals. It is not registered in the running Mastra instance. The Lab Assistant cannot call it.

See [MCP setup and the review loop](mcp.md) for connection details.

## What happens when someone asks for a formula

1. The person writes a description in Formulario. Saving it does not start an AI call.
2. An external assistant reads the product, current formula version and row IDs, and any evidence it needs.
3. It submits a complete formula through `submit_formula_proposal`, including the exact `baseVersionId`.
4. Software checks the total, row IDs, locks and workspace access. A rejected draft never becomes a card.
5. Formulario shows a pending patch. Accepting it creates a new version. Rejecting it leaves the formula unchanged. If the formula has moved on, acceptance fails and a fresh proposal is required.

A review can end with an assessment and no patch. Passing the checks means the software rules passed. It does not mean a chemist validated the formula.

## Lab Assistant tools

These are the tools registered on `assistantAgent`.

| Tool | What it does |
|---|---|
| `list_products` | Lists products the person can access. |
| `get_product` | Reads one product's saved description, type, markets and claims. |
| `get_formula` | Reads the committed formula and row IDs for a variant. It cannot see unsaved browser edits. |
| `get_inventory` | Reads the ingredient shelf. |
| `get_home` | Reads the calculated home overview. |
| `propose_empty_product` | Stores a pending product card with no formula rows. |
| `propose_inventory_change` | Stores a pending stock create or update. There is no delete action. |
| `duplicate_product` | Makes an exact saved copy through the same service as the UI. This runs immediately. |

The assistant keeps the last 30 messages in conversation memory and has a limit of 12 steps per run. Those are execution limits, not quality guarantees.

## MCP tools

These are the only tools an external client can call. The server instructions say that no tool can accept a proposal. Tests check that a submitted proposal stays pending until Formulario accepts it.

| Tool | What it does |
|---|---|
| `list_products` | Finds products in the authorised workspace. |
| `read_product` | Reads the description, current formulas with version and row IDs, claims, scent direction and trial notes. |
| `read_history` | Reads saved formula versions, newest first. |
| `search_materials` | Searches the local material library. No inventory filter or ranking. |
| `get_material_evidence` | Returns stored source records. An empty result means we have no matching record, not that a material is safe or unsafe. |
| `submit_formula_proposal` | Stores a pending complete formula. Requires the exact current `baseVersionId`. Never commits. |

Material search does not browse the internet. Evidence is a small curated set. Seeded regulatory checks returned with a proposal are a screening report, not certification.

## What the software checks

Before a formula proposal is stored, and again when a person accepts it, the app enforces:

- percentages that are positive and finite, totalling 100
- unique row IDs that belong to the base formula
- locked rows left unchanged
- the exact base version still being current (stale patches are rejected)

The experimental specialist still uses older template and library-ceiling checks when you run it from the CLI. Those gates are not applied to MCP proposals. MCP does not impose a skeleton.

The validator does not prove that a formula matches the brief, smells right, is stable, or meets every legal restriction.

## Development specialist

`formulatorAgent` and `delegate_formulation` remain in the codebase. They are used for development and for `npm run eval:briefs --workspace=apps/api`. Production Mastra registers only `assistantAgent`.

The specialist can read products and formulas, search materials and evidence, run seeded regulatory lookups, and propose a formula or a new product with a formula. Review mode can drop its writing tools. Do not register it in the running app without an explicit product decision.

The eval script scores proposals against a fixed set of briefs. It needs a model key. It looks up `formulatorAgent` on the production Mastra instance, which does not register that agent today, so treat the script as development tooling rather than a green in-app eval.

## How to use it today

Use the notebook to keep a formula, generate an INCI list, and run the seeded checks. Use the Lab Assistant for records, empty products, stock and copies. Use a connected external assistant for formulation, then accept or reject in the workspace.

Ask what is supported by a stored source, and what still needs a bench test. Treat every proposal as a draft for review, not a finished product.
