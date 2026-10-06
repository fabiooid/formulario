# External formulation MVP

Formulario owns descriptions, formulas, versions, calculations, evidence and trial notes. The embedded assistant handles administration only. An external assistant reads context through MCP and proposes a complete formula. Formulario shows the proposal in the existing review interface; acceptance creates a version, rejection leaves the formula unchanged. Description editing makes no AI calls.

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

1. Create or open a product in Formulario and save its description.
2. Externally ask: “Find my product, read its description and current formula, then propose a revision. Use material evidence where relevant. Submit it as a pending Formulario proposal.”
3. `list_products` finds the product; `read_product` returns descriptions, variants, exact current version IDs, row IDs and trial/maceration notes.
4. The client can call `search_materials`, `get_material_evidence` and `read_history` as needed. Responses are bounded; history is paginated. Material search has no stock filtering or ranking.
5. `submit_formula_proposal` takes a complete set of rows with percentages by weight totaling 100, a rationale, product/variant IDs and the exact `baseVersionId`. Preserve existing row IDs for retained rows; omit IDs on additions. Include dilution basis and uncertainties in notes/summary. It checks positive finite percentages, totals, row IDs, workspace write access and locks. It does not impose a skeleton or pretend to certify safety.
6. Open the product workspace (which refreshes every ten seconds while visible), inspect the existing pending-patch preview, and accept or reject. Local unsaved drafts are preserved and must be resolved before accepting. Acceptance checks the base version again atomically. If another change was committed, ask for a fresh proposal.

EU ban checks use the Commission CosIng Annex II export. A missing name is not an approval. Evidence remains incomplete. Trial notes currently mean the existing variant maceration notes; there is no new independent trial-record model in this MVP. Initial product creation happens in Formulario or through its administrative assistant.

## Verification

`npm test` includes an isolated SQLite OAuth/MCP integration test: initialize → list tools → read product → submit pending proposal → accept via Formulario's service. It also checks PKCE failure, code replay, unauthenticated calls, host/origin rejection, token rotation/revocation, workspace isolation, viewer restrictions, totals, row IDs, locks and stale acceptance. No test transmits workspace data to a model or incurs model API charges.

The former specialist remains a development tool. It is not registered in the running application, and the in-app assistant cannot delegate to it.

## Local build caveat

With the installed Mastra CLI, `npm run build --workspace=apps/api` fails while packaging workspace dependencies when the repository path contains a space. The API typecheck, development server and protocol tests run successfully. Use a checkout path without spaces for production packaging until the upstream pack-command quoting issue is fixed.
