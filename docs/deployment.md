# Production deployment plan

Status, 2026-10-08: code is ready for a first tester (see "V1 readiness"). Nothing deployed yet. Next step: Phase 2 in the Railway dashboard.

## Recommendation: Railway only

Run Formulario as **one Railway service** with **one volume** and **one public domain**. Skip Vercel for now.

Why:

- **The API cannot run on Vercel.** It keeps three file databases (`app.db`, `mastra.db`, `observability.duckdb`) on local disk and streams long chat responses. That needs a long-running process with a persistent disk, which is what Railway gives.
- **The web app expects the API on the same origin.** `apps/web/src/lib/api.ts` calls relative paths (`/auth/*`, `/app/*`, `/api/*`). There is no `VITE_API_URL`. A split setup would need Vercel rewrites to Railway, two origins in CORS, and the chat stream passing through an extra proxy.
- **MCP checks the Host header.** `apps/api/src/mcp/routes.ts` rejects requests whose host is not `MCP_PUBLIC_URL`. One domain that the API itself answers on is the simplest way to keep that true.
- **SQLite means one instance.** A Railway service with a volume runs one replica. That matches the current database. Postgres is already on the TODO list for later.

Vercel stays useful later for a marketing site on the root domain.

```
Browser ─┐
         ├─ https://<origin> ─ Railway service "formulario"
Claude / │                      Node 22, node .mastra/output/index.mjs
ChatGPT ─┘                      serves web/dist + /auth /app /api /mcp /oauth /.well-known /healthz
                                volume → /app/apps/api/data
                                  app.db, mastra.db, observability.duckdb, official/
```

`<origin>` is the free Railway domain at launch and a custom domain later (see "Domain").

## Domain

Railway gives each service a free `https://<name>.up.railway.app` domain with HTTPS. Launch on it: set `APP_PUBLIC_URL` and `MCP_PUBLIC_URL` to that URL.

Moving to a custom domain later:

1. Add the custom domain in Railway and the CNAME at your DNS.
2. Change both `*_PUBLIC_URL` variables to the custom domain, then redeploy.
3. Everyone signs in again on the new domain, because browser storage is per domain.
4. **Every MCP connection (Claude, ChatGPT) must be removed and added again** with the new `/mcp` URL. The OAuth issuer and resource are tied to the origin.

Only one origin works for MCP at a time. After the switch, the old `*.up.railway.app` URL still loads the app, but MCP rejects it.

## Phase 0 — Blockers (resolved)

1. **The API production build failed.** `mastra build` reinstalls dependencies from the `package.json` ranges, so `@mastra/duckdb@^1.7.0` pulled 1.13.0, which needs a newer `@mastra/core`. Fixed by pinning the `@mastra/*` packages to the versions in the lockfile, and removing the unused `@mastra/evals`. Upgrade Mastra deliberately later; it includes an `@mastra/mcp` 2.x major.
2. **The build breaks when the path contains a space** (see `docs/mcp.md`). The container builds at `/app`, so it doesn't apply there.
3. **`db:seed` created the demo account.** Production now runs `db:seed:official`, which loads only the EU Annex II list.
4. **Nothing served the web build in production.** The API now does.
5. The web build has a 950 kB main chunk warning. That doesn't block launch.

## Phase 1 — Code changes (done)

| Change | Where |
|---|---|
| Mastra packages pinned | `apps/api/package.json`, lockfile |
| `db:seed:official`: official list only, re-checks saved formulas when the list changes | `apps/api/src/db/seed.ts` |
| API serves `apps/web/dist` with an SPA fallback, when `NODE_ENV=production`. API prefixes never fall back. A missing `/assets/*` file returns 404. Path traversal is blocked | `apps/api/src/mastra/web-static.ts` |
| `GET /healthz` returns 200 after a DB read | `apps/api/src/mastra/routes/app-routes.ts` |
| Daily refresh at 03:00 UTC inside the API process, one run at a time. It pings `REFRESH_HEARTBEAT_URL` on success and `…/fail` on failure | `apps/api/src/services/refresh-schedule.ts`, `official-refresh.ts` |
| `npm run rules:refresh` still works by hand (same code) | `apps/api/src/db/refresh-official-lists.ts` |
| Dockerfile, `.dockerignore`, `railway.json` (Dockerfile build, `/healthz` check, restart on failure) | repo root |

Startup runs `db:migrate`, then `db:seed:official`, then the server. Both scripts are safe to run on every boot. They run at startup and not as a pre-deploy step because Railway mounts the volume only at runtime. The refresh runs inside the API process because a Railway cron service couldn't reach this service's volume.

Checked locally: the production build ran with `NODE_ENV=production`. `/`, client routes and assets served correctly. `/healthz` returned 200, `/auth/me` and `/app/*` returned 401 without a token, and `/api/agents` returned 404. On a fresh database, migrate plus the official seed loaded 1,723 bans and created no users; a second run made no changes. All 75 tests pass.

**Not yet checked:** the Docker image itself (Docker isn't installed on this machine). The first Railway build is its first real test.

Later: shrink the image by pruning dev dependencies and copying only `.mastra/output` and the scripts.

## V1 readiness

Added for the first testers:

- **Free Lab Assistant.** Every account can use the assistant. `ASSISTANT_REQUIRES_PAID_PLAN` in `packages/domain/src/plans.ts` switches the API gate, the chat pane and Settings → Plan together. Settings → Plan is hidden, and `PATCH /app/plan` returns 403 in production, so nobody can upgrade themselves.
- **Live scorers** on every Lab Assistant reply (`apps/api/src/mastra/scorers/assistant-scorers.ts`). They run after the reply and never slow it down.

  | Scorer | Kind | Catches |
  |---|---|---|
  | `formulation-boundary` | code, every reply | a formula drafted in chat (3+ percentages without reading a saved formula) |
  | `honest-completion` | code, every reply | "added / created / duplicated" (EN, FR, IT) when no tool reported `completed`, e.g. a pending card described as done |
  | `tool-errors` | code, every reply | share of tool calls that failed |
  | `handled-in-scope` | LLM judge, sampled | in-scope requests not answered; formulation refusals that don't point to Settings → Connections |
  | `hallucination-scorer` | LLM judge, sampled | quantities or records not in the tool results (**lower is better**) |

  The judges cost one extra model call each per reply. `SCORER_SAMPLE_RATE` (default 1) sets the share of replies they score. A generic answer-relevancy judge was tried and dropped: it scored correct refusals as 0.
- **Reports** for production, where Studio is off. Run inside `railway ssh`:
  - `npm run scores:report -- --days 7`: averages per scorer and the latest flagged replies, with what was asked.
  - `npm run feedback:report -- --days 7`: messages from the in-app feedback form.
- **Sign-in throttle:** 10 failed attempts per account in 15 minutes returns 429.
- **Chat requires a chosen password:** an account still on its temporary password can't use the assistant.
- **Chat thread per person per organization.** Before, team members shared one thread ID, which Mastra rejects for the second member ("thread belongs to a different resource").
- **Ingredients table** keeps the INCI column readable when the chat pane is open.

Checked end to end against the production build on a fresh database:
- A new account was created with `users:create`, signed in with its temporary password and chose its own.
- The free account chatted with the assistant. It proposed a stock change, the card was accepted, and the stock appeared in Ingredients.
- A formulation request was refused.
- All five scorers saved results. The `handled-in-scope` judge was also checked by hand: a good refusal scored 1, a bare refusal 0.5, a drafted formula 0, an in-scope answer 1.
- The throttle, the 403 on plan changes and the password-before-chat rule all worked.
- Light, dark and mobile looked right.
- 88 tests pass. The API and web typechecks are clean.

### Known limitations (fine for invited testers)

- **Chat history isn't shown after a page reload.** The assistant still remembers the thread on the server.
- **The model sometimes skips the "Settings → Connections" pointer** when it refuses formulation work. `handled-in-scope` flags these as 0.5. If they're frequent, a stronger `OPENAI_MODEL` (e.g. `openai/gpt-4.1-mini`) is the first thing to try.
- **No self-service password reset.** Use `npm run users:create -- email --reset`, then send the new temporary password.
- **No account deletion or data export.**
- **Tester data goes to OpenAI** (chat) and is stored on the Railway volume. Tell testers before they start.
- **MCP with Claude or ChatGPT is tested in the repo only** (`mcp.test.ts`). It needs the public HTTPS URL, so it's Phase 3 step 7.

## Phase 2 — Railway setup

1. Commit and push the Phase 1 changes.
2. Create a new project from the GitHub repo. `railway.json` selects the Dockerfile. `main` deploys automatically.
3. **Add a volume** mounted at `/app/apps/api/data`. All three databases and `official/` live there. The `mastra.db` and DuckDB paths are fixed in code, so the mount path must match.
4. **Volume backups:** turn on daily backups if Hobby has them (see Decisions).
5. **Generate the free domain** in the service's networking settings. Put it in both `*_PUBLIC_URL` variables.
6. Set the environment variables below, then deploy.

### Environment variables

| Variable | Value |
|---|---|
| `MASTRA_JWT_SECRET` | `openssl rand -base64 48`. Rotating it signs everyone out |
| `DATABASE_URL` | `file:/app/apps/api/data/app.db` |
| `APP_PUBLIC_URL` | `https://<name>.up.railway.app` |
| `MCP_PUBLIC_URL` | same as `APP_PUBLIC_URL` |
| `OPENAI_API_KEY` | production key, from a dedicated OpenAI project with a spend limit |
| `FORMULATOR_PROVIDER` | `openai` |
| `OPENAI_MODEL`, `FORMULATOR_MAX_RETRIES` | optional (defaults: `openai/gpt-4o-mini`, 4) |
| `REFRESH_HEARTBEAT_URL` | Healthchecks.io ping URL for a daily check (grace period about 2 hours) |
| `SCORER_SAMPLE_RATE` | optional, default `1` (judge every reply). Lower it if testing grows |
| `NODE_ENV`, `MASTRA_HOST` | set by the Dockerfile (`production`, `0.0.0.0`) |
| `PORT` | set by Railway |
| `GEMINI_API_KEY` | **not set** |
| `MASTRA_STUDIO` | **never set** |

With `NODE_ENV=production`, the API refuses to start with the example JWT secret or with plain-HTTP public URLs.

## Phase 3 — First deploy and smoke test

1. In the deploy logs, look for `Migrations complete`, `Loaded … EU Annex II bans` and `Official lists refresh daily at 03:00 UTC`, and make sure there is no JWT warning.
2. Open a shell with `railway ssh`, then run `npm run rules:refresh` once by hand.
3. Create the first account: `npm run users:create -- you@example.com`. The temporary password prints to the terminal. Run this inside `railway ssh`, not `railway run`, because `railway run` runs on your laptop against your local database.
4. In the browser: sign in, choose a password, create a product, edit the formula, check the regulatory tab, and send a Lab Assistant message (the reply must stream in pieces, not arrive all at once at the end).
5. Check that `demo@local.test` can't sign in.
6. Check that `/api/agents` returns 404.
7. Connect Claude or ChatGPT to `https://<origin>/mcp`: OAuth consent, organization choice, read a formula, and propose a patch that shows up as pending in Formulario.
8. Check light and dark mode, and a narrow window.
9. **Restore drill:** restore a backup into a new service and confirm it boots with the data. Do this before inviting anyone.

## Phase 4 — Operations

- **Accounts:** registration is closed. Create users with `railway ssh` → `npm run users:create`. An invite email can come later.
- **Deploys:** a push to `main` deploys. With a volume, Railway stops the old container before starting the new one, so expect a few seconds of downtime per deploy.
- **Migrations:** they run on every boot. Make each new migration backward-safe: add first, drop in a later release.
- **Testing loop:** run `npm run scores:report` and `npm run feedback:report` every few days while testers are active.
- **Monitoring:** Railway logs and metrics, the refresh heartbeat, an uptime check on `/healthz`, and volume usage (`observability.duckdb` grows without a retention policy).

## Later

- Move to Postgres when you need more than one instance or managed point-in-time recovery. Mastra storage also needs a Postgres store.
- Back up off-platform (Litestream to R2 or S3) if Railway backups aren't enough.
- Add a custom domain (see "Domain"), and a marketing site on Vercel.
- Upgrade Mastra as a separate, tested change.
- Code-split the web bundle.

## Decisions

Made 2026-10-08:

- **Model provider: OpenAI.** Set `OPENAI_API_KEY` and `FORMULATOR_PROVIDER=openai`, and don't set `GEMINI_API_KEY`, so nothing falls back to Gemini. `gpt-4o-mini` is enough for the administrative Lab Assistant, since formulation runs in the external assistant over MCP. Put a monthly spend limit on the OpenAI project.
- **Railway plan: Hobby.** One small service fits. Before launch, check in the dashboard the volume size cap and whether Hobby includes volume backups, and how long they're kept. If backups are limited, move Litestream-to-R2 up to launch.
- **Alerts: email.** Healthchecks.io emails you when the daily refresh fails or misses its ping. A free uptime monitor (e.g. UptimeRobot) checks `/healthz`. Railway emails on failed deploys and crashes; make sure those emails are on in account settings.
- **Domain: the free `*.up.railway.app` domain at launch.** Custom domain later.
