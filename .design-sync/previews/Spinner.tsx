import { Spinner } from "web"

export const Primary = () => <Spinner />

export const Sizes = () => (
  <div className="flex items-center gap-4">
    <Spinner className="size-3" />
    <Spinner className="size-4" />
    <Spinner className="size-6" />
  </div>
)

export const InContext = () => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Spinner className="size-4" />
    Drafting the label wording…
  </div>
)
