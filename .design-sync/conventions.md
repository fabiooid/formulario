# Building with Atelier

Atelier is the design system behind a quiet lab notebook for indie skincare and
perfume. It is **shadcn/ui (Vega style) on a neutral base**, built with Tailwind
utilities bound to semantic CSS variables. Both light and dark are first-class.

## Setup

Wrap the app once in `ThemeProvider`. It owns the theme and toggles the `dark`
class on the root element, so **without it every dark-mode token stays on its
light value**, and `Toaster` throws outright (it reads the theme via context).

```jsx
<ThemeProvider defaultTheme="light">
  <App />
  <Toaster />
</ThemeProvider>
```

`Toaster` is mounted once near the root; toasts are pushed at runtime.

## Styling idiom: utilities over semantic tokens

Style with Tailwind utility classes whose colour names are **semantic tokens** —
never a raw palette colour. `bg-blue-500` and `text-purple-600` are wrong here;
`bg-muted` and `text-muted-foreground` are right.

| Family | Utilities | Use for |
|---|---|---|
| Surface | `bg-background`, `bg-card`, `bg-popover` | Page canvas and raised surfaces |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground` | Primary and secondary type |
| Quiet fill | `bg-muted`, `bg-secondary`, `bg-accent` | Chips, hover fills, table headers |
| Line | `border-border`, `border-input`, `ring-ring` | Card edges, field edges, focus rings |
| Action | `bg-primary`, `text-primary-foreground` | Main actions (near-black in light, near-white in dark) |
| Alarm | `bg-destructive`, `text-destructive` | Bans, delete, sign out, over-limit |
| Brand | `text-accent-brand` | Sparse accents only — see below |
| Sidebar | `bg-sidebar`, `bg-sidebar-accent`, `border-sidebar-border` | Sidebar only |

Brand violet is the one colour to use sparingly. It belongs on small accents —
the Lab Assistant label, a focus tint (`focus-visible:border-accent-brand/40`),
the text selection colour. `bg-accent-brand` compiles, but DESIGN.md is explicit
that brand is an accent and **never a painted surface**: do not fill a card,
banner, or sidebar with it.

Shape and depth: `rounded-lg` (10px) for controls, `rounded-xl` (12px) for
cards, `rounded-full` for pills. Use `shadow-soft` for resting cards and
`shadow-soft-hover` on hover — not Tailwind's stock `shadow-*`.

Type: `font-sans` is Geist. **Use `font-mono` with `tabular-nums` for every
number that lines up** — percentages, prices, batch counts. That is the single
most recognisable habit in this product.

Variants come from props, not classes: `<Button variant="outline" size="sm">`,
`<Badge variant="secondary">`, `<Toggle variant="outline">`. Reach for a prop
before adding a utility.

## Where the truth lives

- `styles.css` and the files it imports — the full compiled token set.
- `guidelines/DESIGN.md` — the product's own design rules: what it should feel
  like, the status-badge mapping, and the one sanctioned raw colour
  (`text-amber-600`, used only for a formula that does not total 100%).
- Each component's `.prompt.md` — its real props and composition examples.

## An idiomatic composition

```jsx
<Card className="w-90">
  <CardHeader>
    <CardTitle>Daily Barrier Cream</CardTitle>
    <CardDescription>Fragrance-free ceramide cream. Pump, 50 ml.</CardDescription>
    <CardAction>
      <Button variant="outline" size="sm">Duplicate</Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">Skincare</Badge>
      <Badge variant="secondary">Formula</Badge>
    </div>
    <p className="font-mono text-sm tabular-nums">€ 38.40 /kg</p>
  </CardContent>
</Card>
```

Layout glue is yours (`flex`, `gap-2`, `w-90`); the control is always a library
component.
