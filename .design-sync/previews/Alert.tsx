import { Alert, AlertAction, AlertDescription, AlertTitle, Button } from "web"

export const Primary = () => (
  <Alert className="w-140">
    <AlertTitle>Some ingredients are not in house</AlertTitle>
    <AlertDescription>
      They are missing from inventory, running low, or marked to buy.
    </AlertDescription>
  </Alert>
)

export const WithAction = () => (
  <Alert className="w-140">
    <AlertTitle>Formula does not add up</AlertTitle>
    <AlertDescription>
      Neroli Hand Balm totals 98.4%. Rebalance before committing a version.
    </AlertDescription>
    <AlertAction>
      <Button variant="outline" size="sm">
        Rebalance
      </Button>
    </AlertAction>
  </Alert>
)

export const TitleOnly = () => (
  <Alert className="w-140">
    <AlertTitle>Committed 4 Sep 2026, 09:12</AlertTitle>
  </Alert>
)
