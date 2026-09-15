# Formulario Agent for Dummies

**Current implementation, checked on 12 September 2026.** This describes the code now, not a promise that every model response follows the instructions perfectly. This documentation update checks the implementation; it does not establish quality improvements through live model evaluations.

## What have we actually built?

Formulario now has **two agents behind one chat**. The **Formulario Assistant** is your point of contact: it reads saved information and handles administrative requests. The **Formulator Agent** is a specialist the assistant calls for formulation creation, revision, review, ingredient suitability, and related regulatory judgment. Reading back a saved amount does not need the specialist.

Think of it as an assistant with a notebook, a small reference shelf, and a checklist. It can help develop a formula. It cannot smell a perfume, mix a batch, or prove that a product works.

**You describe → the assistant delegates formulation work → the specialist reviews or proposes → software checks proposals → you accept or reject.**

A review can end with an assessment and no changes. Administrative work stays with the assistant. Most changes require accepting a proposal card; an explicitly requested product duplication runs immediately.

## The six pieces

### 1. The model: the part that writes and makes choices

Both agents use the same model-selection configuration, with different instructions and tools. The specialist interprets formulation requests and selects materials and amounts. The app supports Gemini and OpenAI; configuration and available keys determine which it uses, with a fallback when configured.

The model already has general knowledge from its training. That knowledge is not automatically reliable evidence for a specific ingredient, dose, or mixture.

### 2. The prompt: instructions for the assistant

Each agent has its own prompt. The assistant is instructed to handle administration and delegate formulation judgment without choosing ingredients or percentages itself. The specialist is instructed to understand the brief, explain an approach, consult evidence, and disclose uncertainty. Both use concise Markdown. For a critique, the specialist should assess the formula without submitting changes unless you request them.

These are instructions, not guarantees. Telling the model to respect a budget is different from having software calculate and enforce that budget.

### 3. The material library: our local reference shelf

This contains ingredient names, roles, typical amounts, solubility, and notes. It is separate from your inventory: the library describes possible materials; inventory records what you own.

Most library guidance currently has no verified source attached. We now label that explicitly. Being listed in the library does not mean a material's recommended amount has been scientifically validated.

### 4. The evidence library: supporting sources

This is a new, very small collection of source-backed statements.

Today it contains **one record**: IFF's description of the scent of its Iso E Super product. That supports a scent description. It does not verify its dose, safety, compatibility, or performance in a new blend.

The record includes its source, supplier product, access date, and limitations. There is no automatic supplier-document upload, internet search, or broad research database connected to the Lab Assistant yet.

### 5. The validator: a programmed checklist

Before a formula proposal becomes available, software checks its rows against our current rules. These include the total, required template roles and minimum row counts, material checks, library ceilings, some claims, and a limited set of stored regulatory rules. Some findings block a proposal; others only warn.

The validator is incomplete. It does not establish that the formula fulfils every part of the brief, smells good, has the desired texture, is stable, or meets all applicable restrictions. Material-identity, duplicate-dose, and compatibility gaps identified in our review still need work.

**“Passed the checks” means exactly that—not “validated by a chemist.”**

### 6. Mastra: the framework running the assistant

Mastra registers both agents, connects them to their allowed tools, and records runs for inspection. The assistant keeps the last 30 messages in conversation memory. Each specialist call receives a focused brief and product context, without inheriting that conversation memory; it reads saved product data through tools. This makes the handoff important: the assistant must include your earlier decisions and constraints. The assistant has a limit of 12 steps per run, and each specialist call has 18. These are execution limits, not quality guarantees.

Two live scorers are attached to the specialist, not the front assistant: one flags replies containing several percentages without a proposal-tool call; the other estimates whether the answer is relevant. Neither certifies formulation quality or automatically blocks a proposal.

The dedicated multi-step validation workflow we discussed has **not been built**.

## What happens when I ask for a formula?

Suppose you write: “A dry, smoky sandalwood perfume, without a sweet vanilla effect.”

1. **Hand off the request.** The assistant calls `delegate_formulation` with your brief, earlier decisions, constraints, and the relevant product/variant. It chooses create, revise, or review mode. For a new product, the handoff clears the open product context so the specialist does not accidentally work on it.
2. **Understand and read the context.** The specialist reads the saved brief, claims, markets, and formula for an existing product. If concentration basis or another consequential detail is unclear, it should ask rather than invent it.
3. **Read the guide.** The app suggests a format and provides materials, a starter example, and the current validator requirements.
4. **Choose an approach and ingredients.** The model makes these choices using the brief and our material and evidence libraries. Stock does not influence material ranking or composition; it tells you what to buy after materials are selected.
5. **Submit the draft.** The proposal tool runs the programmed checks. A rejected draft returns reasons to the assistant for repair. The prompt instructs it to stop after three rejected submissions, or earlier if a fundamental limitation is the problem.
6. **Return the result.** The specialist returns its assessment to the assistant, which is instructed to preserve its evidence links, warnings, and uncertainties. A successful submission also makes a proposal card available. Acceptance in the UI applies the proposed change. A new product with a formula should arrive as one complete proposal, rather than an empty product followed by a separate formula.

For a review, the delegation code disables the specialist’s proposal tools: it can inspect and assess but cannot submit a formula change during that call. This restriction is enforced by tool availability, not just prompt wording.

The exact tool sequence is chosen by the model. The checks inside the proposal tools run automatically when those tools are used.

## Which tools does it have?

A “tool” is an app function an agent can call. Most read data or prepare proposals; `delegate_formulation` calls the specialist agent. There are **16 distinct tools** across the two agents.

Both agents can read products, formulas, and inventory. Only the assistant gets the home overview, inventory editing, empty-product creation, duplication, and delegation tools. Only the specialist gets formulation references, evidence, regulatory tools, and formula proposals. Review mode removes its two proposal tools.

### `list_products` — find your products

This gives the assistant a list of products it can access, including their names, IDs, types, stages, briefs, markets, and claims. It reads those summaries from the app's database without needing a search phrase. The assistant can use the results to identify which product you mean before requesting its details or formula. It does not return formula rows or change anything.

### `get_product` — read one product's brief

This reads the saved details of a particular product, such as its brief, type, target markets, and claims. The assistant can supply a product ID or name, or use the product currently open in the conversation. If a name matches several products, the tool returns the matches so the assistant can ask which one you mean. It provides context for the formulation and does not change the product.

### `get_formula` — read the saved formula

This loads the committed formula for a product and selected variant, including the ingredient rows, their IDs, and the version label. It uses the supplied product and variant, or the current conversation context when available. Those row IDs let the assistant propose changes to specific ingredients later. It reads saved data, so it cannot see unsaved edits in your browser; if there is no saved formula, it returns an empty set of rows.

### `get_formulation_guide` — get the app's formulation reference

This builds a guide from the product brief, type, and claims, or from details supplied by the assistant. A requested format takes precedence; otherwise, the code uses keywords to suggest a format. It then combines our local templates, material library, and inventory into guidance covering ingredient roles, percentage bands, phases, process notes, starter examples, and stock availability. It does not create a formula or change data. Although starters are references, the validator still enforces structural template requirements.

### `search_materials` — look up possible ingredients

This searches our local material library using a text query, an optional ingredient role, and a result limit. The code matches ingredient names, aliases, roles, and notes, then adds information from your inventory. Results describe possible uses, typical amounts, library ceilings, phase, solubility, stock, and evidence status. This helps the assistant choose candidates, but the library's guidance is not automatically verified chemistry. It neither searches the internet nor changes your shelf.

### `get_material_evidence` — find supporting source records

This searches our curated evidence records for a material or topic and returns any matching source-backed statements. Each record identifies the source, relevant supplier product, supported property, and limitations, so the assistant can explain what the evidence actually supports. Today there is only one record: IFF's scent description of Iso E Super. An empty result means we have no matching stored evidence; this tool does not browse for new sources or verify a proposed formula.

### `search_ingredient_rules` — look up stored restrictions

This searches the app's stored ingredient rules using a query and, optionally, a market such as the EU or UK. It returns matching rule information for the assistant to consult while discussing or drafting a formula. The search uses our limited local rule collection, rather than a live regulatory database. It does not change data, and finding no matching rule does not establish that an ingredient is unrestricted.

### `run_regulatory_check` — check a saved formula against stored rules

This loads a product's saved formula for the relevant variant, along with its product type and target markets, and passes them to the programmed regulatory checker. The checker compares the rows with the rules stored in the app and returns findings. It does not edit the formula or evaluate an unsaved draft in your browser. Its coverage is limited to those stored rules, so its results are a screening report rather than proof of full compliance.

### `get_inventory` — read your ingredient shelf

This reads your inventory, optionally filtering it by text found in ingredient names, trade names, or notes. It returns ingredient records, a list marked as in stock, and items marked low or to buy, including recorded quantities. The assistant can use this to answer stock questions or consider what you already own. It does not update quantities, and its purchase list does not automatically include formula ingredients that have never been added to your inventory.

### `get_home` — read the app's overview

This asks the app's dashboard service to calculate an overview from your saved product, formula, and inventory data. It returns information such as shelf valuation, purchase suggestions, items needing attention, and formula cost coverage. Unlike simply reading the inventory, this overview can identify materials used in formulas but missing from your shelf. The assistant receives the app's calculated results; this tool does not change records or invent missing prices.

### `propose_formula_patch` — submit formula changes for your review

This takes a summary and a list of proposed row changes, applies them to a temporary copy of the saved formula, and runs the formulation validator on the result. If a blocking check fails, it returns reasons for the assistant to address. If the checks pass, it stores a pending proposal linked to the formula version it started from, with any warnings and purchase information. Your committed formula changes only when you accept the proposal in the UI.

### `propose_product` — suggest a new product with a formula

The specialist uses this for a requested new product with a complete starting formula. It takes a proposed name, type, brief, and optional markets, claims, and formula rows. If a formula is included, it runs the same formulation checks before allowing the proposal; the underlying tool still accepts an empty formula, but the specialist’s prompt directs empty-product requests to the assistant instead. It stores the result as a pending proposal for you to review. Calling this tool does not immediately create the product: acceptance in the UI creates it with the proposed details.

### `propose_inventory_change` — suggest a shelf update

This prepares either a new inventory entry or an update to an existing ingredient. For a new entry, it checks the required details and looks for a duplicate; for an update, it finds the ingredient and preserves fields that were not supplied. It validates the proposed data and saves a pending proposal. Your inventory changes only after you accept it, and this tool does not offer a delete action.

### `propose_empty_product` — suggest a product without a formula

The assistant uses this when you want a new product record without formulation work. It accepts a name, type, brief, and optional markets and claims, then uses the existing product-proposal service to store a pending card. Its input does not allow formula rows, so the assistant cannot choose a composition through this tool. You must accept the card to create the product; requests for a product with a formula go to the specialist instead.

### `duplicate_product` — make an exact saved copy

The assistant uses this only when you request a copy, after resolving the source product’s ID. It calls the same duplication service as the UI to copy the product and its saved variants, with an optional new name. This executes immediately and returns the new product’s ID and name; there is no proposal acceptance step. It copies saved data rather than asking the specialist to redesign the formula.

### `delegate_formulation` — ask the formulation specialist

The assistant passes a complete brief, a mode of create, revise, or review, and any relevant product and variant IDs. The tool starts a specialist call with the authenticated user and selected product context, but without the assistant’s conversation memory. New-product requests clear the current screen context, and review mode exposes only reading and checking tools. The specialist’s text comes back to the assistant for the reply, while any allowed proposals are stored through the usual proposal tools. This handoff adds a model call; it does not itself validate chemistry.

The data tools access local app data and curated records. They do not independently search the internet. The web research performed in our development conversation was done by the coding assistant, not by Formulario's Lab Assistant.

## Are we still using templates?

**Yes. This is the main unfinished transition.**

The new prompt says: use starters as references, choose ingredients for the brief, and do not pad a formula to match a template.

But the validator still enforces template roles and minimum ingredient counts. We have changed how the assistant is instructed to think; we have not yet removed those structural constraints from the software.

When they conflict, the new instruction is to explain the limitation instead of disguising it as chemistry.

## What is done, and what was only discussed?

**Implemented:** an administrative assistant and a formulation specialist; explicit delegation with read-only review mode; immediate requested product duplication; proposal and acceptance flow; local material library; template-based checks; a rewritten prompt; Markdown replies; a small evidence registry with one sourced record; Mastra memory, traces, and two scorers.

**Discussed but not implemented:** a broad supplier-backed palette, automatic document ingestion, removal of rigid validator constraints, structured brief enforcement, comprehensive compatibility and dilution checks, a dedicated Mastra validation workflow, and systematic learning from your lab trials.

Passing unit tests or building the app confirms software behaviour covered by those checks. It does not demonstrate that the rewritten prompt now produces better formulas. That requires live comparisons and, ultimately, physical trials.

## How should I use it today?

Use it to discuss an idea, inspect a formula, organise stock, and develop a tentative starting proposal. Give it clear exclusions and explain whether you want a concentrate or finished product.

Ask: “Why these materials?”, “Which parts are supported by a source?”, and “What still needs testing?” Accept only the changes you intend to make. Treat the result as a proposal for review—not a finished, validated product.

## Your planned learning baseline

You want to start with a very simple prompt and add capabilities one at a time to learn prompt engineering, context engineering, and evaluations. **That minimal baseline has not been implemented in the current code.** The app still has the two-agent setup, tools, evidence lookup, and template-based validator described above.

For that learning exercise, the next step is to preserve this version and establish a small baseline with fixed example briefs and clear success criteria. Change one thing at a time and compare the results, so you can see what each instruction, piece of context, or tool contributes.
