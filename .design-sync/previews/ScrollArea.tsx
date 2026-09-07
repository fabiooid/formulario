import { ScrollArea } from "web"

const ingredients = [
  "Aqua",
  "Caprylic/Capric Triglyceride",
  "Cetearyl Alcohol",
  "Butyrospermum Parkii Butter",
  "Glycerin",
  "Glyceryl Stearate",
  "Niacinamide",
  "Phenoxyethanol",
  "Tocopherol",
  "Squalane",
  "Panthenol",
  "Xanthan Gum",
]

export const Primary = () => (
  <ScrollArea className="h-50 w-90 rounded-lg border border-border/70">
    <div className="flex flex-col p-3">
      {ingredients.map((name) => (
        <div key={name} className="py-1.5 text-sm">
          {name}
        </div>
      ))}
    </div>
  </ScrollArea>
)

export const Prose = () => (
  <ScrollArea className="h-50 w-110 rounded-lg border border-border/70">
    <div className="p-4 font-mono text-sm leading-relaxed">
      Alcohol Denat., Parfum, Citrus Aurantium Amara Flower Oil, Cedrus
      Atlantica Bark Oil, Vetiveria Zizanoides Root Oil, Linalool, Limonene,
      Butylphenyl Methylpropional, Tocopherol, Aqua, Glycerin, Niacinamide,
      Phenoxyethanol, Xanthan Gum, Squalane, Panthenol.
    </div>
  </ScrollArea>
)
