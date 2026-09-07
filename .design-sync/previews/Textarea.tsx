import { Label, Textarea } from "web"

export const Primary = () => (
  <Textarea
    className="w-140"
    rows={4}
    defaultValue="A fragrance-free ceramide cream for compromised barriers. Under €40/kg, EU market, vegan. Keep the emulsifier system simple enough for a 5 kg bench batch."
  />
)

export const WithPlaceholder = () => (
  <Textarea
    className="w-140"
    rows={3}
    placeholder="Describe the product you want to make…"
  />
)

export const Labelled = () => (
  <div className="flex w-140 flex-col gap-1.5">
    <Label htmlFor="brief">Brief</Label>
    <Textarea id="brief" rows={3} defaultValue="Dry cedar and vetiver, low alcohol." />
  </div>
)
