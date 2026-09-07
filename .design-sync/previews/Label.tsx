import { Input, Label } from "web"

export const Primary = () => <Label>Organisation name</Label>

export const WithInput = () => (
  <div className="flex w-90 flex-col gap-1.5">
    <Label htmlFor="inci">Final INCI</Label>
    <Input id="inci" defaultValue="Alcohol Denat., Parfum, Linalool" />
  </div>
)
