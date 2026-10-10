# External formulation MVP

Formulario owns descriptions, formulas, versions, calculations and trial notes. A product can hold several formula versions at once; they are separate formulas to try, not a locked history. One version can be marked final — that is the formula that will be produced. The embedded assistant handles administration only and can read every version. An external assistant reads context through MCP and proposes a complete formula against one version. Formulario shows the proposal in the existing review interface; acceptance writes those rows onto that same version, rejection leaves it unchanged. Description editing makes no AI calls.

## Run locally

1. `npm install`
2. `npm run db:migrate` (adds OAuth clients, short-lived requests and revocable grants; the existing migration command also runs its usual demo backfills).
3. Set `MCP_PUBLIC_URL=http://localhost:4111` and `APP_PUBLIC_URL=http://localhost:5173` in `.env`.
4. `npm run dev`. Settings → Connections displays the endpoint and active grants.

The endpoint is **`/mcp`**. Tools are a Mastra MCP server named `formulario`. Login, workspace choice and revoke stay in Formulario → Settings → Connections. No model API key is required for MCP; reasoning runs in the external client. The administrative assistant still uses the configured model key.

Mastra Studio can list this server when `MASTRA_STUDIO=1`. That flag also opens extra Mastra APIs, so keep it off in production. External assistants should use **`/mcp`** with OAuth, not Studio’s `/api/mcp/...` routes.

## Connect a remote assistant

A cloud client must be able to reach the API. Deploy it behind HTTPS (or configure a supported private development tunnel) and set the two canonical origins above. Use a strong `MASTRA_JWT_SECRET`; production refuses the example secret. Reverse proxies must preserve the canonical Host and route `/mcp`, `/oauth/*`, `/.well-known/*`, `/auth/*` and `/app/*` to the API. Set the web origin in the API CORS configuration when hosting the web and API separately. The MVP blocks generic framework APIs and exposes only the authenticated assistant stream under `/api`; Studio/editor is disabled. Publish only the application and MCP routes through the proxy.

In the client's custom connector settings, add `https://YOUR_API_ORIGIN/mcp` and choose OAuth. The server provides protected-resource metadata, authorization-server metadata and dynamic public-client registration. It requires an exact registered redirect URI, authorization code + S256 PKCE, the MCP resource indicator, and the `formulario:read formulario:propose` scope. Client credentials are not used.

The authorization redirect opens Formulario → Settings → Connections. Sign in, check the self-reported client name and return address, choose a workspace and allow the connection. This is the point where a user authorizes sharing workspace context with the external model. A grant stays attached to that workspace even when the user switches workspaces in Formulario. Revoke it on the same page. Access tokens last one hour; refresh tokens rotate, with a maximum grant lifetime of 30 days. Codes expire after one minute and are single-use. Tokens and codes are stored as hashes.

Current provider documentation:

- [OpenAI authentication requirements](https://developers.openai.com/plugins/build/auth)
- [Claude remote MCP connections](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

Account and administrator controls vary. This repository does not provision a public deployment or enable a feature on a ChatGPT/Claude account. A real provider connection must be verified on the intended account after the deployment URL is available.

## First complete loop

1. Create a product in Formulario, or ask the external assistant to call `create_product` (name, optional type/markets/brief/claims). It lands in the connected workspace with an empty formula variant, same as the app. Description editing still makes no AI calls.
2. Externally ask: “Find my product, read its description and formula versions, then propose a revision of one version. Submit it as a pending Formulario proposal.”
3. `list_products` finds the product; `read_product` returns descriptions, every formula version (id, name, final mark, row IDs) and perfume maceration notes on each version (perfume only; not skincare or hybrid).
4. `read_history` lists the same versions in pages, with each version’s own maceration notes. Use it when a product has many versions. Formulario has no material library; ingredient knowledge comes from the external assistant, which should state its uncertainties in the proposal.
5. `submit_formula_proposal` takes a complete set of rows with percentages by weight totaling 100, a rationale, product/variant IDs and the exact `baseVersionId` of the version you are changing. Preserve existing row IDs for retained rows; omit IDs on additions. Include dilution basis and uncertainties in notes/summary. It checks positive finite percentages, totals, row IDs and workspace write access. It does not impose a skeleton or pretend to certify safety. Adding another version in Formulario does not make an older proposal stale.
6. Open the product workspace (which refreshes every ten seconds while visible), inspect the existing pending-patch preview on that version, and accept or reject. Wait for autosave to finish before accepting. Acceptance writes the rows onto that same version. If that version was deleted, ask for a fresh proposal.

EU ban checks use the Commission CosIng Annex II export. A missing name is not an approval. Trial/maceration notes live on each formula version (perfume only); there is no separate trial-record model in this MVP. `create_product` and `submit_formula_proposal` require editor or owner on the pinned workspace; viewers stay read-only.

## Verification

`npm test` includes an isolated SQLite OAuth/MCP integration test: initialize → list tools → create product → read product → submit pending proposal → accept via Formulario's service. It also checks PKCE failure, code replay, unauthenticated calls, host/origin rejection, token rotation/revocation, workspace isolation, viewer restrictions, pinned-org create, totals, row IDs and stale acceptance. No test transmits workspace data to a model or incurs model API charges.


## Local build caveat

With the installed Mastra CLI, `npm run build --workspace=apps/api` fails while packaging workspace dependencies when the repository path contains a space. The API typecheck, development server and protocol tests run successfully. Use a checkout path without spaces for production packaging until the upstream pack-command quoting issue is fixed.
