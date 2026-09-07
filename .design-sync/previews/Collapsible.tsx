import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "web"

export const Open = () => (
  <Collapsible className="w-110" defaultOpen>
    <CollapsibleTrigger className="text-sm font-medium">
      Tool trace — 3 steps
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="mt-2 flex flex-col gap-1 border-l border-border pl-3 font-mono text-xs text-muted-foreground">
        <span>read_formula · 9 rows</span>
        <span>check_eu_rules · 1 restricted</span>
        <span>rebalance · Annex V entry 29</span>
      </div>
    </CollapsibleContent>
  </Collapsible>
)

export const Closed = () => (
  <Collapsible className="w-110">
    <CollapsibleTrigger className="text-sm font-medium">
      Tool trace — 3 steps
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="mt-2 font-mono text-xs text-muted-foreground">
        read_formula · 9 rows
      </div>
    </CollapsibleContent>
  </Collapsible>
)
