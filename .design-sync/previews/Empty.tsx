import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "web"

// Inline icon — see the note in Button.tsx. Not exported.
const IconFlask = () => (
  <svg
    className="size-6"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <path
      d="M10 3v6.5L4.8 18A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9.5V3M9 3h6M7.5 15h9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const Primary = () => (
  <Empty className="w-120">
    <EmptyHeader>
      <EmptyTitle>No products yet</EmptyTitle>
      <EmptyDescription>
        Create your first product from a spoken-style brief.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button>New from brief</Button>
    </EmptyContent>
  </Empty>
)

export const WithMedia = () => (
  <Empty className="w-120">
    <EmptyHeader>
      <EmptyMedia>
        <IconFlask />
      </EmptyMedia>
      <EmptyTitle>The shelf is empty</EmptyTitle>
      <EmptyDescription>
        Add what you keep in house so formulas know what they can use.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button variant="outline">Add ingredient</Button>
    </EmptyContent>
  </Empty>
)

export const TextOnly = () => (
  <Empty className="w-120">
    <EmptyHeader>
      <EmptyTitle>No INCI yet</EmptyTitle>
      <EmptyDescription>
        Commit a formula to generate the INCI list.
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
)
