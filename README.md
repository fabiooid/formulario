# Formulario

**A quiet lab notebook for indie skincare and perfume.** Formulario keeps your formulas, ingredients, and product notes in one place. The formula table is the source of truth. Chat can suggest a change. You decide whether to accept it.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![Status: local prototype](https://img.shields.io/badge/status-local%20prototype-orange)

> [!IMPORTANT]
> Formulario is a **local prototype**. It is not a compliance product. It does not replace a safety assessor, and it does not say a formula is legal to sell. Read [Project status](#project-status) before you treat any check as regulatory advice.

---

## Contents

- [What it does](#what-it-does)
- [Design principles](#design-principles)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Project status](#project-status)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## What it does

- See what needs attention today: stock to buy, formula cost, and issues on current products
- Keep a product list with briefs, claims, and pinned favorites
- Edit a formula, then check INCI and market notes from the committed version
- Share an ingredient library across your workspace
- Switch between a personal space and named organisations

An in-app Lab Assistant can help with admin work such as empty products, stock proposals, and exact copies. Formula drafting happens in an external assistant you connect yourself. Nothing lands in the formula until you accept it.

## Design principles

- **The committed formula is the source of truth.** INCI lists and market notes always come from the formula you committed, not from chat.
- **No guessing.** Unknown ingredients stay unknown. Official references (CosIng, EU rules, IFRA, ASEAN) are linked in the app, not scraped into false certainty.
- **Nothing writes without you.** Chat can propose a change. You accept it, or it does not land.
- **Local prototype first.** The demo path runs without treating the tool as production compliance software.

## Quick start

**Requirements:** Node.js 22 or newer, and npm.

```bash
git clone https://github.com/fabiooid/formulario.git
cd formulario
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) and sign in with:

- Email: `demo@local.test`
- Password: `demo`

The demo starts on the free plan. In Settings you can switch to paid to try the assistant. Model keys in `.env` are only needed if you want that chat to talk to a model.

The sample perfume includes Butylphenyl Methylpropional, a name on the EU banned list. Ban checks use the European Commission CosIng Annex II export. A name that is not on that list is not an approval.

To refresh the official files, run `npm run rules:refresh`. It downloads the Commission list and replaces it only when the new file still matches the expected export. It also saves Singapore's current ASEAN annex PDF, without turning that PDF into bans. In production the API runs the same refresh every day at 03:00 UTC (see [docs/deployment.md](docs/deployment.md)). If either download fails, the list already in use stays put and the command exits with an error.

For how the product should look and feel, see [DESIGN.md](DESIGN.md).

## Configuration

Settings come from `.env` (see [`.env.example`](.env.example)):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Model keys for the Lab Assistant |
| `FORMULATOR_PROVIDER` | `gemini` (default) or `openai` |
| `GEMINI_MODEL` / `OPENAI_MODEL` | Optional model overrides |
| `DATABASE_URL` | App database (default `file:./data/app.db`) |
| `PORT` | API port (default `4111`) |
| `MASTRA_JWT_SECRET` | Local auth secret for Mastra routes |
| `MCP_PUBLIC_URL` / `APP_PUBLIC_URL` | Public origins for MCP OAuth |
| `SCORER_SAMPLE_RATE` | Optional sampling for live Lab Assistant scorers |
| `REFRESH_HEARTBEAT_URL` | Optional production heartbeat for the daily list refresh |

`.env`, local databases and private data stay out of git. Keep them that way.

## Project status

Formulario is a **local prototype**.

**Working**

- [x] Formula notebook with products, ingredients and committed-formula checks
- [x] Demo sign-in and free/paid plan switch for trying the assistant
- [x] CosIng Annex II ban refresh (manual locally; scheduled in production)

**Not yet**

- [ ] Production-ready compliance tooling (out of scope for this prototype)

## Contributing

Contributions are welcome. Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** first. Use only fictional or public sample data. Never commit credentials, customer formulas you do not own, traces or databases. Run the project's check and test scripts before opening a pull request.

## Security

Please **do not open public issues for security problems.** Report them privately through GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository.

Never paste tokens into issues or pull requests.

## License

[MIT](LICENSE) © 2026 Fabio Vella. Third-party dependencies keep their own licenses.

*CosIng and related official lists belong to their publishers. They are used here only as linked references and as the Annex II export for ban checks.*
