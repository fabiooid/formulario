import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "web"

export const Primary = () => (
  <Card className="w-90">
    <CardHeader>
      <CardTitle>Daily Barrier Cream</CardTitle>
      <CardDescription>
        Fragrance-free ceramide cream for compromised barriers. Pump, 50 ml.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Skincare</Badge>
        <Badge variant="secondary">Formula</Badge>
        <Badge variant="outline">Vegan</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Created 12 Mar 2026 · Edited 2 Sep 2026
      </p>
    </CardContent>
  </Card>
)

export const WithAction = () => (
  <Card className="w-90">
    <CardHeader>
      <CardTitle>To purchase</CardTitle>
      <CardDescription>Missing from inventory, or marked as low.</CardDescription>
      <CardAction>
        <Button variant="outline" size="sm">
          Inventory
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Squalane, Tocopherol and Cetearyl Alcohol need restocking.
      </p>
    </CardContent>
  </Card>
)

export const WithFooter = () => (
  <Card className="w-90">
    <CardHeader>
      <CardTitle>Formula cost</CardTitle>
      <CardDescription>
        Estimated cost to make 1 kg, from inventory prices.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="font-mono text-2xl tabular-nums">€ 38.40 /kg</p>
    </CardContent>
    <CardFooter className="border-t">
      <p className="text-xs text-muted-foreground">
        3 of 6 formulas have a full cost
      </p>
    </CardFooter>
  </Card>
)

export const Compact = () => (
  <Card size="sm" className="w-90">
    <CardHeader>
      <CardTitle>Cedar Room Mist</CardTitle>
      <CardDescription>Batch 02 is macerating — 6 days left.</CardDescription>
    </CardHeader>
  </Card>
)
