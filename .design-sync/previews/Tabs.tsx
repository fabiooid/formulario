import { Tabs, TabsContent, TabsList, TabsTrigger } from "web"

export const Primary = () => (
  <Tabs className="w-140" defaultValue="workspace">
    <TabsList>
      <TabsTrigger value="workspace">Workspace</TabsTrigger>
      <TabsTrigger value="regulatory">Regulatory</TabsTrigger>
    </TabsList>
    <TabsContent value="workspace">
      <p className="pt-3 text-sm text-muted-foreground">
        Committed formula is the source of truth.
      </p>
    </TabsContent>
    <TabsContent value="regulatory">
      <p className="pt-3 text-sm text-muted-foreground">
        Seeded from Regulation 1223/2009 annexes.
      </p>
    </TabsContent>
  </Tabs>
)

export const LineVariant = () => (
  <Tabs className="w-140" defaultValue="markets">
    <TabsList variant="line">
      <TabsTrigger value="markets">Markets</TabsTrigger>
      <TabsTrigger value="pif">PIF</TabsTrigger>
      <TabsTrigger value="references">References</TabsTrigger>
    </TabsList>
    <TabsContent value="markets">
      <p className="pt-3 text-sm text-muted-foreground">
        Three rows need a decision.
      </p>
    </TabsContent>
    <TabsContent value="pif">
      <p className="pt-3 text-sm text-muted-foreground">
        Four of seven sections filled from the record.
      </p>
    </TabsContent>
    <TabsContent value="references">
      <p className="pt-3 text-sm text-muted-foreground">
        Sources cited for each annex entry.
      </p>
    </TabsContent>
  </Tabs>
)
