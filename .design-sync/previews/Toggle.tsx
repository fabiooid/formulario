import { Toggle } from "web"

export const Primary = () => <Toggle defaultPressed>Vegan</Toggle>

export const Variants = () => (
  <div className="flex items-center gap-2">
    <Toggle>Natural</Toggle>
    <Toggle defaultPressed>Vegan</Toggle>
    <Toggle variant="outline">Organic</Toggle>
    <Toggle variant="outline" defaultPressed>
      Fragrance-free
    </Toggle>
  </div>
)

export const Sizes = () => (
  <div className="flex items-center gap-2">
    <Toggle variant="outline" size="sm">
      Small
    </Toggle>
    <Toggle variant="outline">Default</Toggle>
    <Toggle variant="outline" size="lg">
      Large
    </Toggle>
  </div>
)
