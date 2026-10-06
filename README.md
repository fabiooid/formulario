# Formulario

A quiet lab notebook for indie skincare and perfume.

Formulario keeps your formulas, ingredients, and product notes in one place. The formula table is the source of truth. Chat can suggest a change. You decide whether to accept it.

This is a local prototype. It is **not** a compliance product. It does not replace a safety assessor, and it does not say a formula is legal to sell.

## What you can do

- See what needs attention today: stock to buy, formula cost, and issues on current products
- Keep a product list with briefs, claims, and pinned favorites
- Edit a formula, then check INCI, market notes, and a PIF draft from the committed version
- Share an ingredient library across your workspace
- Switch between a personal space and named organisations

An in-app Lab Assistant can help with admin work such as empty products, stock proposals, and exact copies. Formula drafting happens in an external assistant you connect yourself. Nothing lands in the formula until you accept it.

## Try it locally

You need Node.js 22 or newer.

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) and sign in with:

- Email: `demo@local.test`
- Password: `demo`

The demo starts on the free plan. In Settings you can switch to paid to try the assistant. An API key in `.env` is only needed if you want that chat to talk to a model.

The sample perfume includes Butylphenyl Methylpropional, a name on the EU banned list. Ban checks use the European Commission CosIng Annex II export. A name that is not on that list is not an approval.

To refresh the official files, run `npm run rules:refresh`. It downloads the Commission list and replaces it only when the new file still matches the expected export. It also saves Singapore's current ASEAN annex PDF, without turning that PDF into bans. Run it once a day in production. If either download fails, the list already in use stays put and the command exits with an error.

## A note on claims

INCI lists, market checks, and PIF drafts always come from the formula you committed — not from chat. Unknown ingredients stay unknown. Official references (CosIng, EU rules, IFRA, ASEAN) are linked in the app, not scraped.

For how the product should look and feel, see [DESIGN.md](DESIGN.md).
