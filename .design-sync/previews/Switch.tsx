import { Label, Switch } from "web"

export const Primary = () => <Switch defaultChecked />

export const States = () => (
  <div className="flex items-center gap-4">
    <Switch />
    <Switch defaultChecked />
    <Switch disabled />
    <Switch defaultChecked disabled />
  </div>
)

export const RowWithLabel = () => (
  <div className="flex w-110 items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
    <div>
      <Label>Lab Assistant</Label>
      <p className="text-sm text-muted-foreground">
        Extra markets, export, and version history.
      </p>
    </div>
    <Switch defaultChecked />
  </div>
)
