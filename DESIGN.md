# Formulario design rules

Living reference for how the product should look and feel. Update this file when we change a pattern, so the next screen matches the ones we already have.

Product name in the UI: **Formulario**.

## What it should feel like

Calm, dense, and formula-first. This is a quiet lab notebook for indie skincare and perfume — not a chat app, not a marketing site, not a metrics wall.

- The **formula table** is the source of truth. Chat proposes. The person accepts on that formula.
- Surfaces stay quiet. Color, motion, and decoration are used sparingly.
- Everything should feel like it belongs to the same product: same spacing, same cards, same buttons, same words.

Core principles: **consistency**, **reuse**, **continuity**. Prefer an existing pattern over a new one.

## Stack we build on

- shadcn/ui, **Vega** style, **neutral** base, **Lucide** icons
- Tailwind with CSS variables in `apps/web/src/index.css`
- Primitive components live in `apps/web/src/components/ui/`
- App patterns live next to pages in `apps/web/src/components/`

Do not invent a second visual system. Extend what is already here.

---

## Color

Use **semantic tokens** only (`bg-background`, `text-muted-foreground`, `border-border`). Never pick a raw Tailwind color like `bg-blue-500` or `text-purple-600`.

Light mode is warm paper with cool ink. Dark mode inverts it: near-neutral charcoal surfaces with just a trace of warmth (not blue-black), light type.

| Token | Use for |
|---|---|
| `background` | Page canvas |
| `foreground` | Main text and primary buttons |
| `card` / `popover` | Raised surfaces |
| `muted` / `muted-foreground` | Quiet fills and secondary text |
| `border` / `input` | Lines and field edges |
| `primary` | Main actions (near-black in light, near-white in dark) |
| `accent-brand` | Sparse brand moments only (focus tint, sparkle) |
| `destructive` | Errors, bans, delete, sign out |
| `warning` | Formula total not near 100% (`text-warning`) |
| `sidebar*` | Sidebar only |

**Brand violet** (`accent-brand`) is an accent, not a fill. Do not paint large blocks with it.

**Status colors**

| Status | Badge |
|---|---|
| banned | `destructive` |
| restricted | `secondary` |
| not on the banned list | `outline` |
| not checked | `outline` |

**Warning:** unbalanced formula totals use `text-warning` (semantic token in `index.css`). Do not use raw amber Tailwind classes.

Focus rings use opaque `--ring` (brand violet). Components may soften with `ring-ring/50`; do not bake alpha into the token itself.

Text selection uses a soft brand tint (`--accent-brand-muted`).

Both light and dark are first-class. The theme switcher lives only on Settings → Appearance (and on the sign-in screen). Press **D** (when not typing) to flip light/dark.

---

## Type

- **UI text:** Geist Variable (`font-sans`)
- **Formulas, INCI, percents, money, grams:** Geist Mono (`font-mono`)
- **Agent chat:** same as UI text. Mono is for numbers and INCI in the notebook, not for conversation.
- Antialiased. Headings use the same family as body — no second display font.

| Role | Size | Weight |
|---|---|---|
| Page title (`PageHeader`) | `text-3xl` / `sm:text-[2rem]` | `font-semibold` |
| Section title (`WorkspaceSection`, formula) | `text-lg` | `font-semibold` |
| Card title | `text-base` | `font-medium` |
| Body, forms, tables | `text-sm` | regular |
| Meta, hints, table headers | `text-xs` | `font-medium` or muted |
| Loading / empty helper | `text-sm text-muted-foreground` | regular |

Page titles use `tracking-tight`; other tracking stays mostly `tracking-normal`. Product names may use `tracking-tight`. Table column headers are `uppercase tracking-wide`.

Page descriptions: `text-sm leading-relaxed text-muted-foreground`, max width `max-w-2xl`.

---

## Space, radius, shadow

**Page**

- App chrome: sidebar + main. No separate page navbar.
- Main padding: `px-4` → `sm:px-6` → `lg:px-10`, extra space at the bottom (`pb-16` / `sm:pb-20`) so the last block is not cut off
- Content width: fluid and full-width by default, with comfortable side padding. Wide workspaces may cap at `max-w-[90rem]`. Must shrink (`min-w-0`) so nothing blows past the window.
- Breadcrumb sits at the top of the page content (same width and padding) and scrolls with the page. Page title (`PageHeader`) follows it. The agent launcher (sparkle) sits on the right of this row. On a product page, the pin sits immediately after the last breadcrumb, then the product overflow menu, and the title sits close to the tabs (`gap-2`, no extra bottom margin).
- Vertical stacks: `gap-4` inside a section, `gap-6` on a page of cards, `gap-4` between the brief prompt and the formula below
- Prefer `gap-*` over `space-y-*`

**Sidebar**

- Expanded: `w-60` (240px)
- Collapsed: `w-14`
- Remembers collapsed state
- On small screens it is an overlay, not a persistent column

**Agent pane**

The assistant is named **Lab Assistant** in the UI (breadcrumb launcher, message author, paid-gate copy). It is app chrome, not a page and not a card on the formula step. One chat handles app questions and administrative actions. Formulation happens in an external assistant connected through MCP; the in-app assistant explains that workflow. There is no separate specialist chat or agent switcher. The pane header shows the **thread name**, not the agent name.

- Closed (default): sparkle button in the breadcrumb row. Shortcut **⌘J** / **Ctrl+J**. Escape closes the pane.
- Side pane: default `w-[22rem]` on the right of the page, full viewport height. It stays put while the page scrolls. A 1px split sits in the center of the left-edge hit area. Drag to resize; a short handle appears on that same center line on hover. Remembers width. Left nav stays. Page content shrinks.
- Full window: chat fills the main area; left nav stays. Collapse returns to the side pane. The thread and composer cap at `900px` and sit in the centre.
- On small screens, open goes straight to full screen (no side column).
- Remembers closed / pane / full, like the left nav.
- Header: editable thread name (same inline rename as the product title), expand/collapse, close. Before the first prompt it shows Lab Assistant. After that it uses a short title from the first prompt. Composer placeholder stays general (stock, a formula, or a new product) — not one example formula.
- Conversation uses MessageScroller, Message, Bubble, Marker, Attachment. Chat text uses the UI font (`text-sm`, relaxed line height), not mono. Assistant messages render Markdown (headings, emphasis, lists and source links) inside the existing Bubble; raw HTML and images are disabled. Keep headings modest and formula rows on proposal cards. Composer is shadcn `InputGroup` + `InputGroupTextarea`, with a round send arrow in the footer. Enter sends, Shift+Enter makes a new line.
- Formula replies are a short “why” in the bubble. Percents and INCI live on the accept card, not as a list in chat.
- Paid gate: same pane, `EmptyState` inside — do not hide the chrome.
- Chat proposes stock edits, new products, and formula patches. The person accepts. Formula accept/reject stays next to the table. Stock and new-product accept/reject sit on Attachment cards in the thread. A new product from chat can include a starting formula — accepting it should fill the table.
- If they ask what the agent can do or how to work together, it answers like a lab partner in a few short sentences: propose / accept, then the menu, then an open question. It does not dump a status report, stack FAQ lists, or lead with “draft a formula”.

**Radius** (`--radius: 0.5rem`)

| Surface | Radius |
|---|---|
| Buttons, inputs, nav items, dialogs | `rounded-lg` |
| Cards, empty states, list containers | `rounded-xl` |
| Badges, avatars, completed steps | `rounded-full` |
| Compact toggles / icon buttons | `rounded-md` |

**Shadow**

- Resting cards, dialogs, and outline buttons: `shadow-soft` (dialogs may use `shadow-soft-hover` so they lift over the page)
- Hover on clickable cards: `shadow-soft-hover`
- Keep shadows quiet. No heavy drop shadows, no glow.

**Borders (what to keep vs skip)**

Separate raised surfaces with **background**, **elevation** (`shadow-soft`), and **spacing**. Do not frame cards, empty states, dialogs, or formula shells with decorative hairlines.

Keep borders only when they carry meaning or structure:

| Keep | Examples |
|---|---|
| Form controls | `Input`, `Textarea`, `Select`, outline `Button`, theme toggle cluster |
| Tables | Row and cell dividers so formula and inventory rows stay readable |
| Focus | `ring` / `ring-ring/50` on keyboard focus |
| Status | Badge outlines (`outline`, Low stock, banned destructive edge) |
| App chrome splits | Sidebar edge, agent pane resize split |
| Meaningful error | Destructive ring/border on invalid or error attachments |

Do not add: card outlines, dashed empty-state frames, Home brand top edges, ornamental footer rules on product cards, or per-dialog border overrides.

**Background texture**

The dotted grid (`28px`) covers the **whole page**, including behind the sidebar. Do not add extra textures, gradients, or photos behind content.

The sidebar sits on a frosted fill (`bg-sidebar/80` + light blur) so the grid shows through softly.

Page content is fluid and fills the available width. The in-page breadcrumb uses that same width so it lines up with the title.

---

## Motion

Short and boring.

- Color / hover: `duration-150`
- Sidebar width / slide: `duration-200 ease-out`
- Agent pane open / close / expand: same `duration-200 ease-out` (no motion while dragging the resize handle)
- Collapsible height: `duration-200 ease-out` (height 0 ↔ content)
- Overlay fade (mobile menu): `duration-200 ease-out`
- Chevrons on expand triggers: rotate `duration-200 ease-out`
- Dialogs and menus: fade + slight zoom, `duration-100`
- Card hover: `duration-200`

Do not add bounce, large slide-ins, or decorative animation. Theme changes should not flash (transitions are disabled while the class swaps). Honor `prefers-reduced-motion` with `motion-reduce:transition-none` on chrome collapse.

---

## Icons

Lucide only. Default size `size-4`. Compact chrome (logo, theme, chevrons) uses `size-3.5`.

Put icons **before** the label. On shadcn buttons, mark them:

```tsx
<PlusIcon data-icon="inline-start" />
```

Icon-only buttons need an `aria-label` (and `title` when the sidebar is collapsed).

---

## Layout recipes

### App pages (signed in)

Use `AppShell` + `PageHeader`. Do not rebuild the chrome.

```tsx
<AppShell title={t('nav.products')}>
  <PageHeader
    title={t('products.title')}
    description={t('products.subtitle')}
    actions={/* buttons */}
  />
  {/* content */}
</AppShell>
```

Breadcrumb (in the page, above `PageHeader`): muted app name / current page title. App name links home. On Settings, insert a muted Settings segment in the middle. On small screens, the menu button sits in this row.

### Auth

Centered card (`max-w-[400px]`) on the dotted grid. Logo + name top-left, theme control top-right. Full-width primary submit. Link to the other auth page under the button.

### Settings

Settings is a mode of the left nav, not a second menu on the page. While in Settings, the sidebar stays expanded: no logo, no product name, no collapse control, and no org switcher. A back arrow sits in the header. The list is Account, Appearance, Language, Plan, Organisation, Connections. Back leaves Settings and returns to the last app page.

One route per topic (`/settings/account`, and so on). `/settings` opens Account. `PageHeader` then a **narrow stack** of cards (`max-w-lg`, `gap-4`). One topic per card.

The Lab Assistant sparkle is hidden here. Breadcrumb: app name / Settings / current topic.

### Product list

Header actions, right side: Active / Archived filter, view switcher, then primary **New product**.

- **Cards** (default): 1 / 2 / 3 columns (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`). Cards cap at `max-w-sm` and share one height: 1-line name, 2-line brief (empty still uses the slot), only type and stage pills, one Updated date (creation date retained in the date hover text and accessible text). Remove the page subtitle; keep card header/content spacing at gap-3 without extra header bottom padding. Same meta order as list: type, then stage. Markets belong inside the product. Selected claims use muted Lucide icons (Vegan, Leaf for natural, Sprout for organic), with translated accessible labels and native hover titles; they do not imply certification. Overflow menu (Duplicate / Archive / Delete) sits top-right; pin sits to its left and still reveals on hover.
- **List:** one bordered card wrapping rows (`rounded-xl border-border/70 shadow-soft`). Each row is a link. Same type and stage metadata as cards. At 800px of available list width, rows use a flexible name/brief column, an 11rem date column, and a 19rem metadata column with equal type/stage slots and a reserved 4rem claim-icon slot. Below that, rows stack. Pin and the same overflow menu sit at the end of the row.
- Active / Archived filter beside the view switcher (icons only on small screens). Archived products leave Home, pins, and the default list. Restore from the menu or the product page.
- Remember the last view in `localStorage`.
- On small screens the switcher shows icons only.

### Home

A morning brief, not a metrics wall. Same cards as everywhere else. Small icons, meters, and one cost chart are welcome when they carry meaning (stock level, maceration progress, % priced). Do not add decorative sparklines, badge clusters, or colour-only status.

1. Three small numbers: shelf value, to-purchase count, formulas that are fully priced **and** balanced near 100%
2. **Formulas at risk:** one line per product (ban on a final formula, or missing / low stock on the active or final formula). Lucide icon + plain-language reason naming the ingredient (and market / list / grams when known) + product link (Regulatory tab for bans, version for stock). If a product has several reasons, show the top one and an “and N more” expand. Ordered by severity. Do not repeat the same ban under Needs attention.
3. Two working lists: to purchase (ingredients that block an active/final formula, with € / kg, `StockBadge`, a small stock-level meter, and grouped by supplier when linked) and needs attention (claims, over-limits, unbalanced totals, maceration on versions the maker can open). Group attention by product; each finding has a type icon and text. Maceration rows show a progress meter (days rested vs target) and deep-link with `?version=`. Show the full list and a count; do not silently truncate.
4. Ranked formula cost (`SimpleBarChart`, foreground fill, mono money) with a second quiet meter for how much of each formula is priced

Ban and claim checks on Home run only after a final version exists (same gate as Regulatory). Money and grams use `font-mono tabular-nums`. Shelf value only counts in-house and low stock that have both a price and an amount on hand. Always show coverage so a missing price cannot look like zero. Empty purchase copy must stay honest when there are no formulas yet.

### Calendar

A calm **list timeline** (not a month grid). Two sections: maceration dates on perfume versions the maker can open (same visible-version rule as Home), and stock to watch (low / to buy) **without invented run-out dates**. Each row links to the product version or Ingredients. Empty states stay honest.

### Product workspace

Wide shell. Two peer tabs, not a numbered sequence. One column, so the agent pane can open without squeezing two work areas.

- **Workspace** — brief prompt on top, formula table under it. Claims sit in the Description section, with the brief text. Ingredients that sit outside the chosen claims show a warning icon on the row (tooltip for the reason), not a banner above the table.
- **Regulatory** — final INCI, market checks, and references. Market findings lead with ingredient names and action badges, sorted with bans and over-limits first. Blocking messages stay visible; sources and supporting details use shadcn Collapsible. Group unknown coverage into a count with expandable ingredient names and shared citations; never hide real labelling requirements in that group.

The product description stays open always (no collapse). Keep workspace sections at gap-4 and the tab content at pt-4 so the table stays close to the top. The description is a plain textarea that saves changes on blur. Claim chips sit under that textarea, in the same section. It has no AI-generation action.

Use `WorkspaceSection` for a quiet heading (no step number). Empty regulatory state uses `EmptyState`, not a locked dashed card or a checklist of steps.

Formula header shows **versions only for now**: a bordered dropdown shows the version name and switches saved versions. Each version is a separate formula you can try — there is no locked history. A pencil opens a field in that same spot to rename the version you are viewing. Beside the name: **Choose as final** (shows **Final** on the chosen version), **New version** (empty or copy from another version), and **Delete** (not the last version). Trial/variant picker, New variant, and Duplicate stay out of this header for this pass (API still uses the product’s default variant under the hood). Any version is editable; edits autosave shortly after typing. **Add ingredient** stays visible. There is no Commit button. Product Duplicate / Archive / Delete live in the breadcrumb overflow menu, next to the pin.

Pending formula proposals (MCP or agent) preview **in the formula table** as a read-only proposed state: same table, muted rows, short subtitle under the heading (“Proposed formula — accept to apply on this version, or reject.”), Accept / Reject in the toolbar. The MCP/agent patch summary is still stored and returned by the API, but it is not shown above the table for now. Accept applies rows on the version the proposal was based on. Wait for autosave to finish before accepting. The open product workspace refreshes about every ten seconds so new proposals appear without leaving the page.

Formula table is full width. The agent is not embedded here — it lives in the app chrome.

**Sort by %** is view-only by default. Click the `%` column header to cycle highest first → lowest first → your order. A sort icon on that header shows the current state (`aria-sort` + accessible label). While sorted, drag handles hide and a quiet note offers **Back to your order** and **Keep this order** (Keep rewrites saved `sortOrder` to the display order; Back only clears the view). Sort preference may remember per product in `localStorage` and must not sync as server data. Pending MCP proposal rows sort with the rest by their proposed %.

---

## Components — when to use which

Reuse these. Do not restyle them ad hoc for one screen.

### Buttons

| Variant | When |
|---|---|
| `default` | The one main action on a block (Create, Send, Sign in) |
| `outline` | Secondary action next to a primary (Add row, Duplicate, Reject) |
| `ghost` | Quiet chrome (menu, delete in a table, close) |
| `destructive` | Harmful (sign out). Prefer ghost/destructive in menus, not a red primary in the page. |
| `link` | Text-only action in a sentence |
| `secondary` | Rare; muted fill when outline is too weak |

Sizes: `sm` in toolbars and patches, `default` in pages, `icon-sm` for table/chrome icons. One primary button per cluster.

Pending labels: “Saving…”, “Signing in…”, “Thinking…” — same button, disabled.

### Cards

Default grouping for a topic (maceration, settings, product list). `rounded-xl`, `bg-card`, `shadow-soft`, no outline border. Brief, formula, and INCI on the product page stay flat: headings, separators, and spacing, not Card-in-Card.

- Card titles are `text-base`, not another page title
- Optional description is muted `text-sm`
- Title and description always stack. If there is a header action, it sits to the right until the card is narrow, then it drops under the text. Do not overlap.
- Clickable cards (product grid): whole card is the link, hover `shadow-soft-hover` (no hover border)

### Badges

Pills. `secondary` for type/stage/plan/markets, `outline` for extra/locked info, `destructive` for bans. Use `StatusBadge` for regulatory status so every market chip matches.

### Empty states

Use `EmptyState` (muted fill `bg-muted/40`, centered, quiet, no dashed frame). For free-plan gaps, paid-only agent, no products, no INCI. Do not invent a custom blank illustration.

### Forms

`FieldGroup` → `Field` → `FieldLabel` → `Input` / `Textarea` / `Select`. Labels are `text-sm font-medium`. Fields are `h-9`, `rounded-lg`. Auth fields may be `h-10`.

Password choose/change: a live checklist under the new-password field (`text-xs`). Unmet rows use `text-muted-foreground` with an empty circular mark; met rows use `text-foreground` with a filled circle and Lucide check. No raw green.

Errors: `text-sm text-destructive` under the field. Invalid fields get the destructive border from the primitive — do not add a second error style.

### Dialogs

Small (`sm:max-w-md`), centered, light overlay (`bg-black/10` + slight blur). Raised with `shadow-soft-hover`, no outline border. Title, then fields, then the primary action in the field group. One job per dialog (new product, new organisation).

### Tables

The formula editor is a real table, not a list of cards. Shell is `bg-card` + `shadow-soft` (no outer hairline). Header row `bg-muted/60`, uppercase muted labels, cell borders for reading. Inputs sit flush in cells (`border-0 bg-transparent`). Percents are right-aligned mono. Row numbers are mono.

### Ingredient inventory

Use one ingredient cell with mono INCI and optional trade name beneath. Keep category, flags, and notes in the edit dialog. Price and amount remain visible on wider screens. Use a fixed-layout shadcn Table with wrapping ingredient names and reserved widths for Stock and an always-visible row DropdownMenu (Edit / Delete). Delete retains its confirmation dialog.

### Tabs

Use for peer views of the same record. Product page: Workspace / Regulatory at the top. On Regulatory: Markets / Refs. Use `variant="line"` (word + underline), not the pill / button look.

### Toggle groups

Mutually exclusive view or preference: product cards vs list, light / dark / system. `size="sm"`, `spacing={0}`, outline (or unstyled inside a chrome cluster).

**Claim chips** are the exception: vegan / natural / organic can all be on at once (`multiple`). Same outline toggle on create and in the product Description section. Product cards show the selected claims as outline badges.

### Menus

User menu and org switcher: `w-56`, avatar/initials in a 28px square, same hover as sidebar nav. Destructive items at the bottom.

### Toasts

Sonner, themed with popover colors. Use for short confirmations later; do not toast every save if the button already says “Saving…”.

---

## Sidebar & navigation

- Logo: simple Lucide pipette mark, product name beside it. Reuse `AppBrandMark`. Icon only — no fill, border, or card. Do not put the resting logo inside a button-like card. Ingredients keep the flask so the two stay distinct.
- Active item: muted fill with a short violet edge marker
- Inactive: `text-muted-foreground`, hover to foreground on a light accent fill
- Pinned products under a tiny muted heading (“Pinned”). Hide the block if nothing is pinned, and while in Settings.
- Account lives at the **bottom**. When the nav is expanded, a collapse control sits on the right of the logo row and appears on sidebar hover. When the nav is collapsed, hover the logo mark to expand (same overlay as before).
- Collapsed: icons only, `title` tooltip, menus open to the right
- Settings mode reuses this same nav, always expanded. No logo, no org switcher, no collapse. Do not add a second in-page settings menu.

Do not add a second nav in the page. The in-page breadcrumb is location, not a duplicate of the sidebar. On small screens the menu button lives in that breadcrumb row.

---

## Copy

Plain, short, calm. No hype, no emoji in product UI, no “AI-powered” language.

- All visible strings go through i18n (`en`, `fr`, `it`). Do not hardcode English in components.
- Loading: “Loading…”
- Empty: a title + one sentence of what to do next
- Compliance honesty: never say a formula is legally on the market. Unknown INCI stays “unknown”.
- Formula versions are peer formulas you can try; each autosaves; patches are “accepted” or “rejected”.
- Claims always include a visible “No claims” state. Empty claims should feel intentional, not missing.

---

## Interaction details worth keeping

- **Inline rename:** the workspace title and the Lab Assistant thread name are inputs that look like a heading until hover/focus (`hover:bg-muted/50`, ring on focus). Enter saves, Escape cancels, empty blur restores the old name.
- **Formula versions (for now):** a bordered dropdown in the formula header shows the version name and switches saved versions. Each version is a formula you can edit. A pencil opens a field in that same spot to rename the version you are viewing. Enter saves, Escape cancels, empty blur restores the old name. **Choose as final**, **New version**, and **Delete** sit beside the dropdown. No trial/variant dropdown in this header yet. Switching versions shows that version’s formula and, for perfume only, its maceration. Regulatory INCI and market checks use the **final** version’s rows.
- **Remembered chrome:** sidebar collapsed, product view (cards/list), theme, language.
- **Claim warnings on formula rows:** a Lucide `TriangleAlert` sits immediately after the ingredient name. The stock badge stays at the end of the cell. Hover or focus shows the reason in a shadcn Tooltip. Blocking vegan hits use `text-destructive`; missing flags stay muted. Do not use a banner above the table.
- **Formula autosave:** edits on the version you are viewing save to the server after a short pause and again before **New version**, switching versions, or leaving the page. Failed saves keep what you typed and show an error. Wait for saving to finish before accepting an agent patch.
- **Destructive in menus:** Delete lives last in the product overflow menu (after Duplicate and Archive), with a confirmation dialog. Same pattern as inventory.
- **Archived product:** quiet restore line under the title (same tone as the uncommitted-draft notice). Hide the pin while archived.
- **Paid gates:** same layout, `EmptyState` inside — do not hide the panel entirely. Agent pane included.
- **Empty regulatory / INCI:** `EmptyState` with a short next step. Do not use a numbered checklist to unlock a tab.

---

## Accessibility

- Visible focus ring (`ring` / `ring-ring/50`). Do not remove it.
- Icon-only controls have names.
- Do not use color alone for status — badge text is required.
- Mobile menu overlay is dismissible (click outside, Escape). Agent pane is dismissible the same way (Escape, close).
- Hit targets in chrome stay at least 28–32px.

---

## Base components (use these, do not fork)

| Need | Use |
|---|---|
| Page chrome + title | `AppShell`, `PageHeader` |
| Grouped topic / list shell | `Card` (override `gap-0 py-0` for dense tables/lists) |
| Primary / secondary / quiet / dangerous actions | `Button` variants (`default`, `outline`, `ghost`, `destructive`, `link`) |
| Status chips (regulatory) | `StatusBadge` |
| Stock chips | `StockBadge` |
| Other pills | `Badge` (`secondary`, `outline`, `destructive`, `warning`) |
| Blank / paid-gap / locked | `EmptyState` |
| Forms | `FieldGroup` → `Field` → `FieldLabel` → `Input` / `Textarea` / `Select` |
| Confirm / create modals | `Dialog` + `DialogContent` (default chrome; no per-screen border overrides) |
| Peer views | `Tabs` `variant="line"` |
| Menus | `DropdownMenu` |
| Quiet section heading on product page | `WorkspaceSection` |

Icon-only controls: `Button` `size="icon-sm"` or `icon-xs`, with `aria-label`. Do not hand-roll focus rings on raw `<button>`.

## How to add something new

1. Find the closest existing screen and copy its structure (`AppShell`, `PageHeader`, `Card`, `EmptyState`).
2. Use tokens and primitives. If you need a new color or radius, add it in `index.css` first, then use it everywhere.
3. If a pattern will be used twice, put it in `components/` (like `PageHeader`, `EmptyState`, `StatusBadge`). Do not fork a one-off.
4. Add copy to **all three** language files.
5. Check light **and** dark, and a narrow screen.
6. Update this file if the new pattern should become the default.

## Do not

- Center the product around chat
- Introduce a second font, icon set, or button style
- Use large brand-colored banners
- Frame cards or empty states with decorative borders (use fill + shadow + gap)
- Mix cards and a custom “panel” look for the same kind of content
- Skip empty, loading, locked, and error states
- Change only one instance of a pattern (if list rows change, product cards should still match)

Product supporting tools: keep INCI preview and Choose as final together directly after the formula. Separate them from maceration with a separator. Maceration is a closed-by-default status Card for perfume; expand to edit dates side by side and notes below. Keep editors mounted to preserve unsaved input. Choose as final is disabled while formula drafts exist.

## Expressive details

Keep shadcn primitives and the quiet notebook layout. Home summary cards are plain raised cards (no brand top edge). Product cards stay neutral, without type icons or violet accents, with a date row and directional arrow separated by spacing (not a hairline). Reserve header space for the pin and overflow controls. Large surfaces stay neutral. Product links have a visible keyboard focus ring. Home figures use 30px mono type, with small tinted icon tiles. Home list rows may use a quiet Lucide type icon (ban, stock, balance, maceration) plus text; never colour alone. Do not add decorative motion. Cost rows wrap their labels above the bar on narrow screens; a second thin meter may show % priced.

Product pin and overflow controls use shadcn `icon-sm` buttons (32px targets) and 18px Lucide icons. Card headers reserve `pr-24` for the pair so product names do not overlap the controls.

### External assistant connections

Connections uses the same narrow Settings card stack. Lead with a short maker-language loop (connect assistant → propose formula → accept in Formulario), then the MCP endpoint URL, a link to `docs/mcp.md` for tunnels/HTTPS, and existing connections with revoke actions. An OAuth request adds a consent card naming the client and return address, explaining which data is shared, and requiring explicit workspace selection. No automatic consent. External proposals appear in the existing formula review UI; the workspace refreshes periodically without replacing local drafts.
