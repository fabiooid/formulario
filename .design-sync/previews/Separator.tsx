import { Separator } from "web"

export const Horizontal = () => (
  <div className="w-100">
    <p className="text-sm font-medium">Final INCI</p>
    <Separator className="my-3" />
    <p className="text-sm text-muted-foreground">
      Generated from the committed formula, not typed by hand.
    </p>
  </div>
)

export const Vertical = () => (
  <div className="flex h-6 items-center gap-3 text-sm">
    <span>Perfume</span>
    <Separator orientation="vertical" />
    <span>Final variant B</span>
    <Separator orientation="vertical" />
    <span>Macerated 8 weeks</span>
  </div>
)
