import { Input, Label } from "web"

export const Primary = () => (
  <Input className="w-90" defaultValue="Maison Verte" />
)

export const WithPlaceholder = () => (
  <Input className="w-90" placeholder="Search ingredients…" />
)

export const Labelled = () => (
  <div className="flex w-90 flex-col gap-1.5">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" defaultValue="demo@local.test" />
  </div>
)

export const Disabled = () => (
  <Input className="w-90" defaultValue="Aqua" disabled />
)

export const Invalid = () => (
  <Input className="w-90" defaultValue="MadeUpine" aria-invalid />
)
