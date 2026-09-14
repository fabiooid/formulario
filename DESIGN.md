# Atelier design rules

Living reference for how the product should look and feel. Update this file when we change a pattern, so the next screen matches the ones we already have.

Product name in the UI: **Atelier**.

## What it should feel like

Calm, dense, and formula-first. This is a quiet lab notebook for indie skincare and perfume — not a chat app, not a marketing site, not a dashboard full of charts.

- The **formula table** is the source of truth. Chat proposes. The person commits.
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
| `sidebar*` | Sidebar only |

**Brand violet** (`accent-brand`) is an accent, not a fill. Do not paint large blocks with it.

**Status colors**

| Status | Badge |
|---|---|
| banned | `destructive` |
| restricted | `secondary` |
| unknown | `outline` |
| sellable | `secondary` |

**Warning:** a formula that does not add up to ~100% uses amber text (`text-amber-600`). That is the only allowed raw color. Do not spread amber elsewhere — if we need a real warning token later, add it in CSS first.

Text selection uses a soft brand tint (`--accent-brand-muted`).

Both light and dark are first-class. The theme switcher lives in the user menu and on Settings. Press **D** (when not typing) to flip light/dark.

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

- Resting cards and outline buttons: `shadow-soft`
- Hover on clickable cards: `shadow-soft-hover`
- Keep shadows quiet. No heavy drop shadows, no glow.

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

The formulator sparkle is hidden here. Breadcrumb: app name / Settings / current topic.

### Product list

Header actions, right side: Active / Archived filter, view switcher, then primary **New from brief**.

- **Cards** (default): 1 / 2 / 3 columns (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`). Cards cap at `max-w-sm` and share one height: 1-line name, 2-line brief (empty still uses the slot), only type and stage pills, one Updated date (creation date retained in the date hover text and accessible text). Remove the page subtitle; keep card header/content spacing at gap-3 without extra header bottom padding. Same meta order as list: type, then stage. Markets belong inside the product. Selected claims use muted Lucide icons (Vegan, Leaf for natural, Sprout for organic), with translated accessible labels and native hover titles; they do not imply certification. Overflow menu (Duplicate / Archive / Delete) sits top-right; pin sits to its left and still reveals on hover.
- **List:** one bordered card wrapping rows (`rounded-xl border-border/70 shadow-soft`). Each row is a link. Same type and stage metadata as cards. At 800px of available list width, rows use a flexible name/brief column, an 11rem date column, and a 19rem metadata column with equal type/stage slots and a reserved 4rem claim-icon slot. Below that, rows stack. Pin and the same overflow menu sit at the end of the row.
- Active / Archived filter beside the view switcher (icons only on small screens). Archived products leave Home, pins, and the default list. Restore from the menu or the product page.
- Remember the last view in `localStorage`.
- On small screens the switcher shows icons only.

### Home

A morning brief, not a metrics wall. Same cards as everywhere else.

1. Three small numbers: shelf value, to-purchase count, formulas with a full cost
2. Two working lists: to purchase (with € / kg) and needs attention. Use simple divided purchase rows inside the existing Card. Group attention findings by product link, with the product name once and all issues underneath; preserve severity order and keep every issue visible.
3. Ranked formula cost (`SimpleBarChart`, foreground fill, mono money)

Money and grams use `font-mono tabular-nums`. Shelf value only counts in-house and low stock that have both a price and an amount on hand. Always show coverage so a missing price cannot look like zero.

### Product workspace

Wide shell. Two peer tabs, not a numbered sequence. One column, so the agent pane can open without squeezing two work areas.

- **Workspace** — brief prompt on top, formula table under it. Claims sit under the table, not inside the prompt.
- **Regulatory** — final INCI, market checks, PIF draft, and references. Market findings lead with ingredient names and action badges, sorted with bans and over-limits first. Blocking messages stay visible; sources and supporting details use shadcn Collapsible. Group unknown coverage into a count with expandable ingredient names and shared citations; never hide real labelling requirements in that group.

The product description uses shadcn Collapsible: expanded for an empty formula, collapsed initially when the selected variant has a committed formula, with a Description heading and chevron to reopen it. Keep workspace sections at gap-4 and the tab content at pt-4 so the table stays close to the top. The description is a plain textarea that saves changes on blur. It has no AI-generation action.

Use `WorkspaceSection` for a quiet heading (no step number). Empty regulatory state uses `EmptyState`, not a locked dashed card or a checklist of steps.

The variant selector sits beside the formula heading and wraps on narrow screens. New variant and Duplicate live in an adjacent shadcn DropdownMenu. Add ingredient and Commit remain visible; Commit is disabled when the rows match the committed formula or a save is pending. Product Duplicate / Archive / Delete live in the breadcrumb overflow menu, next to the pin.

Stock needs above the formula use a compact purchase count in a shadcn Collapsible, followed by an inventory link. Expand to see ingredient names and existing stock badges; keep details closed initially. Only show the summary after inventory loads and when purchases are needed.

Formula table is full width. The agent is not embedded here — it lives in the app chrome.

---

## Components — when to use which

Reuse these. Do not restyle them ad hoc for one screen.

### Buttons

| Variant | When |
|---|---|
| `default` | The one main action on a block (Create, Commit, Send, Sign in) |
| `outline` | Secondary action next to a primary (Add row, Duplicate, Reject) |
| `ghost` | Quiet chrome (menu, delete in a table, close) |
| `destructive` | Harmful (sign out). Prefer ghost/destructive in menus, not a red primary in the page. |
| `link` | Text-only action in a sentence |
| `secondary` | Rare; muted fill when outline is too weak |

Sizes: `sm` in toolbars and patches, `default` in pages, `icon-sm` for table/chrome icons. One primary button per cluster.

Pending labels: “Saving…”, “Signing in…”, “Thinking…” — same button, disabled.

### Cards

Default grouping for a topic (maceration, settings, product list). `rounded-xl`, `border-border/70`, `shadow-soft`. Brief, formula, and INCI on the product page stay flat — headings, separators, and spacing, not Card-in-Card.

- Card titles are `text-base`, not another page title
- Optional description is muted `text-sm`
- Title and description always stack. If there is a header action, it sits to the right until the card is narrow, then it drops under the text. Do not overlap.
- Clickable cards (product grid): whole card is the link, hover border + `shadow-soft-hover`

### Badges

Pills. `secondary` for type/stage/plan/markets, `outline` for extra/locked info, `destructive` for bans. Use `StatusBadge` for regulatory status so every market chip matches.

### Empty states

Use `EmptyState` (dashed border, centered, quiet). For free-plan gaps, paid-only agent, no products, no INCI, no PIF. Do not invent a custom blank illustration.

### Forms

`FieldGroup` → `Field` → `FieldLabel` → `Input` / `Textarea` / `Select`. Labels are `text-sm font-medium`. Fields are `h-9`, `rounded-lg`. Auth fields may be `h-10`.

Errors: `text-sm text-destructive` under the field. Invalid fields get the destructive border from the primitive — do not add a second error style.

### Dialogs

Small (`sm:max-w-md`), centered, light overlay (`bg-black/10` + slight blur). Title, then fields, then the primary action in the field group. One job per dialog (new product, new organisation).

### Tables

The formula editor is a real table, not a list of cards. Header row `bg-muted/60`, uppercase muted labels, cell borders. Inputs sit flush in cells (`border-0 bg-transparent`). Percents are right-aligned mono. Row numbers are mono.

### Ingredient inventory

Use one ingredient cell with mono INCI and optional trade name beneath. Keep category, flags, and notes in the edit dialog. Price and amount remain visible on wider screens. Use a fixed-layout shadcn Table with wrapping ingredient names and reserved widths for Stock and an always-visible row DropdownMenu (Edit / Delete). Delete retains its confirmation dialog.

### Tabs

Use for peer views of the same record. Product page: Workspace / Regulatory at the top. On Regulatory: Markets / PIF / Refs. Use `variant="line"` (word + underline), not the pill / button look.

### Toggle groups

Mutually exclusive view or preference: product cards vs list, light / dark / system. `size="sm"`, `spacing={0}`, outline (or unstyled inside a chrome cluster).

**Claim chips** are the exception: vegan / natural / organic can all be on at once (`multiple`). Same outline toggle on create and under the formula table. Product cards show the selected claims as outline badges.

### Menus

User menu and org switcher: `w-56`, avatar/initials in a 28px square, same hover as sidebar nav. Destructive items at the bottom.

### Toasts

Sonner, themed with popover colors. Use for short confirmations later; do not toast every save if the button already says “Saving…”.

---

## Sidebar & navigation

- Logo: simple triangle mark, product name beside it. Icon only — no fill, border, or card. Do not put the resting logo inside a button-like card.
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
- Formula is “committed”, patches are “accepted” or “rejected”.
- Claims always include a visible “No claims” state. Empty claims should feel intentional, not missing.

---

## Interaction details worth keeping

- **Inline rename:** the workspace title and the Lab Assistant thread name are inputs that look like a heading until hover/focus (`hover:bg-muted/50`, ring on focus). Enter saves, Escape cancels, empty blur restores the old name.
- **Remembered chrome:** sidebar collapsed, product view (cards/list), theme, language.
- **Locked formula rows:** cannot edit, cannot delete. Show the lock icon at the front of the ingredient name, not next to the Lock switch — the Lock column holds only the centred switch.
- **Uncommitted formula edits:** keep a separate draft for each user, organisation, product and variant in the current browser tab. Refreshing workspace data or switching products/variants must preserve it. Show a quiet text notice and an outline discard action with confirmation. Commit or discard edits before accepting an agent patch. Failed saves keep the draft and show an error; a stale draft must never silently overwrite a newer committed version.
- **Destructive in menus:** Delete lives last in the product overflow menu (after Duplicate and Archive), with a confirmation dialog. Same pattern as inventory.
- **Archived product:** quiet restore line under the title (same tone as the uncommitted-draft notice). Hide the pin while archived.
- **Paid gates:** same layout, `EmptyState` inside — do not hide the panel entirely. Agent pane included.
- **Empty regulatory / PIF / INCI:** `EmptyState` with a short next step. Do not use a numbered checklist to unlock a tab.

---

## Accessibility

- Visible focus ring (`ring` / `ring-ring/50`). Do not remove it.
- Icon-only controls have names.
- Do not use color alone for status — badge text is required.
- Mobile menu overlay is dismissible (click outside, Escape). Agent pane is dismissible the same way (Escape, close).
- Hit targets in chrome stay at least 28–32px.

---

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
- Mix cards and a custom “panel” look for the same kind of content
- Skip empty, loading, locked, and error states
- Change only one instance of a pattern (if list rows change, product cards should still match)

Product supporting tools: keep INCI preview and Choose as final together directly after the formula/claims. Separate them from the scent pyramid with a separator. The pyramid is a closed-by-default shadcn Collapsible Card describing scent direction, independent of INCI. Maceration follows as a closed-by-default status Card; expand to edit dates side by side and notes below. Keep editors mounted to preserve unsaved input. Choose as final is disabled while formula drafts exist.

## Expressive details

Keep shadcn primitives and the quiet notebook layout. Home summary cards use a fine `accent-brand/40` top edge. Product cards stay neutral, without type icons or violet accents, and have a divided date footer with a directional arrow. Reserve header space for the pin and overflow controls. Large surfaces stay neutral. Product links have a visible keyboard focus ring. Home figures use 30px mono type, with small tinted icon tiles. Do not add decorative motion. Cost rows wrap their labels above the bar on narrow screens.

Product pin and overflow controls use shadcn `icon-sm` buttons (32px targets) and 18px Lucide icons. Card headers reserve `pr-24` for the pair so product names do not overlap the controls.

### External assistant connections

Connections uses the same narrow Settings card stack. Show the MCP endpoint, brief setup guidance and existing connections with revoke actions. An OAuth request adds a consent card naming the client and return address, explaining which data is shared, and requiring explicit workspace selection. No automatic consent. External proposals appear in the existing formula review UI; the workspace refreshes periodically without replacing local drafts.
