import { Bubble, BubbleContent, BubbleGroup } from "web"

export const Primary = () => (
  <BubbleGroup className="w-110">
    <Bubble align="end">
      <BubbleContent>
        Preservative is at 1.5%. Is that inside the EU limit for a leave-on
        cream?
      </BubbleContent>
    </Bubble>
  </BubbleGroup>
)

export const Variants = () => (
  <BubbleGroup className="w-110">
    <Bubble align="end">
      <BubbleContent>Default</BubbleContent>
    </Bubble>
    <Bubble variant="secondary" align="end">
      <BubbleContent>Secondary</BubbleContent>
    </Bubble>
    <Bubble variant="muted" align="start">
      <BubbleContent>Muted</BubbleContent>
    </Bubble>
    <Bubble variant="outline" align="start">
      <BubbleContent>Outline</BubbleContent>
    </Bubble>
    <Bubble variant="destructive" align="start">
      <BubbleContent>Destructive</BubbleContent>
    </Bubble>
  </BubbleGroup>
)

export const Conversation = () => (
  <BubbleGroup className="w-110">
    <Bubble align="end">
      <BubbleContent>Cost per kilo?</BubbleContent>
    </Bubble>
    <Bubble variant="muted" align="start">
      <BubbleContent>
        Daily Barrier Cream comes to € 38.40 /kg from current inventory prices.
      </BubbleContent>
    </Bubble>
  </BubbleGroup>
)
