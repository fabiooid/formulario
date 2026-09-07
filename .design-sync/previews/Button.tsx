import { Button } from "web"

// Inline icons: lucide-react lives in apps/web/node_modules, which previews
// (resolved from the repo root) can't reach. Not exported — only exported
// members become preview cells.
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5v14" strokeLinecap="round" />
  </svg>
)
const IconSparkles = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path
      d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"
      strokeLinejoin="round"
    />
  </svg>
)
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" />
  </svg>
)

export const Primary = () => <Button>Commit version</Button>

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>Commit version</Button>
    <Button variant="outline">Duplicate</Button>
    <Button variant="secondary">Export PIF draft</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="destructive">Remove row</Button>
    <Button variant="link">Open inventory</Button>
  </div>
)

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button>Default</Button>
    <Button size="lg">Large</Button>
  </div>
)

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>
      <IconSparkles />
      Generate
    </Button>
    <Button variant="outline">
      <IconPlus />
      Ingredient
    </Button>
    <Button variant="destructive" size="icon" aria-label="Remove row">
      <IconTrash />
    </Button>
  </div>
)

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button disabled>Commit version</Button>
    <Button variant="outline" disabled>
      Duplicate
    </Button>
  </div>
)
