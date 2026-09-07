import { ToggleGroup, ToggleGroupItem } from "web"

export const Primary = () => (
  <ToggleGroup defaultValue={["vegan"]}>
    <ToggleGroupItem value="vegan">Vegan</ToggleGroupItem>
    <ToggleGroupItem value="natural">Natural</ToggleGroupItem>
    <ToggleGroupItem value="organic">Organic</ToggleGroupItem>
  </ToggleGroup>
)

export const Outline = () => (
  <ToggleGroup variant="outline" defaultValue={["cards"]}>
    <ToggleGroupItem value="list">List</ToggleGroupItem>
    <ToggleGroupItem value="cards">Cards</ToggleGroupItem>
  </ToggleGroup>
)

export const ThemePicker = () => (
  <ToggleGroup variant="outline" defaultValue={["light"]}>
    <ToggleGroupItem value="light">Light</ToggleGroupItem>
    <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
    <ToggleGroupItem value="system">System</ToggleGroupItem>
  </ToggleGroup>
)
