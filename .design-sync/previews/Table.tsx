import {
  Badge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "web"

const rows = [
  ["Aqua", "A", "68.50", "In house"],
  ["Caprylic/Capric Triglyceride", "B", "8.00", "In house"],
  ["Cetearyl Alcohol", "B", "5.00", "Missing"],
  ["Glycerin", "A", "4.00", "In house"],
  ["Phenoxyethanol", "C", "1.50", "Restricted"],
]

export const Primary = () => (
  <div className="w-160">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead>Stock</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([name, phase, pct, stock]) => (
          <TableRow key={name}>
            <TableCell className="font-medium">{name}</TableCell>
            <TableCell className="text-muted-foreground">{phase}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {pct}
            </TableCell>
            <TableCell>
              <Badge variant={stock === "Missing" ? "outline" : "secondary"}>
                {stock}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)

export const WithFooter = () => (
  <div className="w-160">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 3).map(([name, , pct]) => (
          <TableRow key={name}>
            <TableCell>{name}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {pct}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-medium">Total</TableCell>
          <TableCell className="text-right font-mono tabular-nums">
            81.50
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </div>
)

export const WithCaption = () => (
  <div className="w-160">
    <Table>
      <TableCaption>Committed formula — version 4, 4 Sep 2026.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 3).map(([name, , pct]) => (
          <TableRow key={name}>
            <TableCell>{name}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {pct}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)
