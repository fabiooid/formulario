import { Badge } from "web"

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Final</Badge>
    <Badge variant="secondary">In house</Badge>
    <Badge variant="outline">Missing</Badge>
    <Badge variant="destructive">1 ban</Badge>
    <Badge variant="ghost">Draft</Badge>
  </div>
)

export const RegulatoryStatus = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="destructive">Banned</Badge>
    <Badge variant="secondary">Restricted</Badge>
    <Badge variant="outline">Unknown</Badge>
    <Badge variant="secondary">Sellable</Badge>
  </div>
)

export const StockLevel = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="secondary">In house</Badge>
    <Badge variant="secondary">Low</Badge>
    <Badge variant="secondary">Out</Badge>
    <Badge variant="outline">Missing</Badge>
  </div>
)
