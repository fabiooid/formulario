# design-sync notes — Atelier

Repo-specific gotchas for syncing `apps/web/src/components/ui/` to claude.ai/design.

## Shape: this is not a design-system package

`apps/web` is a **private Vite SPA** (`"private": true`, no `main`/`module`/`exports`/`types`)
whose only `dist/` is the bundled app. There is no component-library build. Everything the
converter needs is synthesized by **`.design-sync/prepare.sh`** (wired as `cfg.buildCmd`):

1. `apps/web/ds-entry.ts` — barrel re-exporting every `ui/*.tsx` plus `theme-provider`.
2. `apps/web/ds-types/` + `apps/web/index.d.ts` — real declarations via `.ds-tsconfig.json`.
3. `apps/web/.ds-compiled.css` — vite's compiled CSS, `@font-face` rules stripped.

All three are gitignored build artifacts. Re-run `prepare.sh` before every converter run.

## Converter gotchas hit here (cost real time — don't rediscover)

- **`--entry` is mandatory.** `PKG_DIR` is `join(NODE_MODULES, pkg)` unless `--entry` is
  given; `node_modules/web` doesn't exist, so without `--entry` every package-relative
  config path (`cssEntry`, `tsconfig`, `srcDir`) silently resolves against a nonexistent
  dir and is "skipped". Symptom: `[ZERO_MATCH]` plus the CSS scrape falling back to
  `src/index.css` and failing to bundle `@import "tailwindcss"`.
- **The `.d.ts` glob skips dot-prefixed paths.** `addSourceFilesAtPaths('<root>/**/*.d.ts')`
  never matched `.ds-types/` or `.ds-entry.d.ts`. That is why the emitted tree is
  `ds-types/` and the entry is `ds-entry.ts` — **do not re-add the leading dot.**
- **The types entry falls back to `<pkg>/index.d.ts`.** `apps/web/package.json` has no
  `types` field and we deliberately don't add one; `prepare.sh` writes `index.d.ts`
  instead, re-exporting the emitted tree. Without it discovery finds 0 components.
- **Dependencies are split across two `node_modules`.** `react`/`react-dom` are hoisted to
  the repo root; `@base-ui/react`, `lucide-react`, `cva` live in `apps/web/node_modules`.
  Pass `--node-modules ./node_modules` (the root) — esbuild walks up for the rest.

## Fonts

Vite emits `@font-face` with **absolute** `/assets/*.woff2` URLs the converter can't
resolve, so the compiled CSS shipped 22 rules and 0 font files (`[FONT_DANGLING]`, and
every design would have rendered in a fallback face). Fixed by stripping `@font-face`
from the compiled CSS in `prepare.sh` and pointing `cfg.extraFonts` at the
`@fontsource-variable/geist{,-mono}` packages, whose CSS uses relative `./files/` paths.
`ds-bundle/fonts/` must contain **11 woff2 files** — if it only has `fonts.css`, this
regressed.

## Components and grouping

147 exported components from 32 source files (`Card` ships with `CardHeader`,
`CardTitle`, … — all real API). There are no per-component docs in the repo, so
`.design-sync/docs/<Name>.md` holds a `category:` frontmatter stub per component purely
to drive grouping (`cfg.docsDir`); the `.prompt.md` bodies are synthesized from the
`.d.ts` plus authored previews. Adding a component means adding a stub, or it lands in
`General`.

## Providers

Only `Toaster` needs context — it calls `useTheme()` from `components/theme-provider`,
whose context defaults to `undefined`, so it throws when unwrapped. `ThemeProvider` is
therefore exported from the barrel and set as `cfg.provider`. `ToggleGroup` uses its own
internal context and needs nothing.

## Build command

```sh
./.design-sync/prepare.sh
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./apps/web/ds-entry.ts --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

Playwright/chromium for the render check lives at `~/Library/Caches/ms-playwright`
(macOS — **not** `~/.cache/ms-playwright`, which is what the skill's check suggests).

## Authoring previews

- **Previews import from the bare package name `web`** (shimmed to `window.Atelier`).
- **`lucide-react` is NOT importable from previews.** It lives in
  `apps/web/node_modules`, but previews resolve from the repo root (which must stay
  the root so `react` resolves). `cfg.storyImports.bundle` can't fix a module that
  cannot be resolved at all. Previews therefore use small **inline SVGs**, defined
  un-exported in the preview file (an exported const would become a preview cell).
- **Give inline SVGs an explicit `size-*` class.** `Button` auto-sizes bare svgs via
  `[&_svg:not([class*='size-'])]:size-4`, but most components don't — an unsized svg
  renders invisibly (this silently blanked `Empty.WithMedia` first time round).

## Component-specific gotchas found while authoring

- **`DropdownMenuLabel` must be inside a `DropdownMenuGroup`.** It maps to base-ui's
  `Menu.GroupLabel`, which throws `MenuGroupContext is missing` outside a group — and
  the throw takes down the *whole* menu, so the card renders completely blank (not just
  a missing label). The menu also needs a `DropdownMenuTrigger`: base-ui anchors the
  positioner to it, and without one the popup never positions.
- **`MeterValue` ignores children** and renders base-ui's formatted value (a percentage
  of `value`/`max`). Put a custom-formatted figure in your own element next to it.
- **`Toaster` cannot show a toast statically.** `sonner`'s `toast()` helper is not
  resolvable from previews (same root-vs-app node_modules split as lucide), and a toast
  only exists after a runtime call. Its card mounts the real toast layer and says so.
- **`cfg.overrides.<Name>.skip` takes an array of story names, not `true`** — passing a
  boolean crashes the build in `lib/emit.mjs` (`new Set(true)`).
- `Dialog` and `DropdownMenu` use `cardMode: "single"` with an explicit viewport so the
  open overlay renders inside the card instead of escaping it.

## Known render warns

- **`[RENDER_THIN]` on `Dialog` is benign.** The card reports a measured height of 0px
  because the dialog renders through a portal with fixed positioning. The screenshot is
  correct — overlay, title, description and footer buttons all present. Confirmed
  visually; do not rework the preview to chase this.
- **`[GRID_OVERFLOW]` drove the `cardMode` overrides.** 21 components are wider than a
  grid cell now that the width utilities actually compile, so they use
  `cardMode: "column"`; `Meter`, `Select`, `Dialog` and `DropdownMenu` use
  `cardMode: "single"` with an explicit `primaryStory`. These are presentation-only and
  cannot re-flag.

- `Avatar.Group` clips the first set of initials slightly — that is the component's own
  overlap behaviour, not a preview bug.
- `Badge.StockLevel` / `Badge.RegulatoryStatus` render several pills identically. That is
  correct: DESIGN.md maps restricted and sellable (and in-house/low/out) onto the same
  `secondary` badge. Do not "fix" by inventing new variants.

## Stylesheet: why we do NOT reuse vite's app CSS

The first build pointed `cfg.cssEntry` at `apps/web/dist/assets/index-*.css`. That
looked fine and was quietly wrong: **Tailwind tree-shakes to the classes the app
happens to use**, so `w-90`, `w-110`, `w-140`, `h-60`, `bg-accent`, `ring-ring` and
`text-accent-brand` were all absent. Preview cards using those widths rendered at the
wrong size (they filled the cell instead, which is why it was not obvious), and any
utility the design agent reached for outside the app's own vocabulary would have
silently not resolved.

`prepare.sh` now compiles `apps/web/.ds-tailwind.css` with the Tailwind CLI. That entry
re-imports `src/index.css` for the tokens, adds `@source` for `.design-sync/previews`,
and carries an `@source inline(...)` safelist of the semantic-token utilities and the
width/height steps the cards use. **If you change the safelist, re-run the name
validation in the conventions step** — `conventions.md` names classes and every one of
them must exist in the compiled output.

`apps/web/.ds-tailwind.css` and `apps/web/.ds-tsconfig.json` are **hand-authored inputs**
and are committed. Everything else `prepare.sh` emits (`ds-entry.ts`, `ds-types/`,
`index.d.ts`, `.ds-compiled.css`) is generated and gitignored.

## Re-sync risks — what can silently go stale

- **New `ui/*.tsx` file → no group.** Grouping is driven by one `category:` stub per
  component in `.design-sync/docs/`. A newly exported component with no stub silently
  lands in `General`. Regenerate stubs after adding components.
- **The safelist is a fixed list.** A preview (or the design agent) using a width or
  token utility outside it will not resolve. Widen `@source inline(...)` in
  `.ds-tailwind.css` rather than hand-writing CSS.
- **`conventions.md` names real classes.** It is prepended to the README the design
  agent reads. Re-validate every class/component name in it against the fresh build on
  each sync; a name that stops existing is worse than no guidance at all.
- **147 components come from 32 files.** Adding one export to any `ui/*.tsx` adds a
  component (and a floor card). That is expected, not a bug.
- **The 610-error `tsc -b` baseline is unrelated** to this sync (i18n catalogues typed
  against English string literals). `prepare.sh`'s declaration emit uses its own
  `.ds-tsconfig.json` scoped to `ui/` + `lib/utils` + `theme-provider`, so it is
  unaffected — but do not "fix" the baseline expecting this to change.
- **Toolchain assumptions:** node 22+, playwright chromium at
  `~/Library/Caches/ms-playwright`, and `@tailwindcss/cli` installed into `.ds-sync`
  (not a repo dependency — re-install it on a fresh clone).
