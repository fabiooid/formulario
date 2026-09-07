import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "web"

const turns = [
  "Preservative is at 1.5%. Is that inside the EU limit?",
  "Phenoxyethanol is restricted to 1.0% max in the EU (Annex V, entry 29).",
  "Cutting it to 1.0% leaves 0.5% to redistribute.",
  "Aqua is the safest home for it — the emulsifier ratio stays put.",
]

export const Primary = () => (
  <MessageScrollerProvider>
    <MessageScroller className="h-60 w-110 rounded-lg border border-border/70">
      <MessageScrollerViewport>
        <MessageScrollerContent className="p-3">
          {turns.map((text, i) => (
            <MessageScrollerItem key={i} className="py-1.5 text-sm">
              {text}
            </MessageScrollerItem>
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>
    </MessageScroller>
  </MessageScrollerProvider>
)
