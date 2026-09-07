import { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from "web"

export const Primary = () => (
  <Meter className="w-110" max={50} value={38.4}>
    <div className="flex items-baseline justify-between">
      <MeterLabel>Daily Barrier Cream</MeterLabel>
      <MeterValue className="text-muted-foreground">€ 38.40 /kg</MeterValue>
    </div>
    <MeterTrack>
      <MeterIndicator />
    </MeterTrack>
  </Meter>
)

export const CostRows = () => (
  <div className="flex w-140 flex-col gap-3">
    {[
      ["Daily Barrier Cream", 38.4],
      ["No. 3 Oil Perfume", 26.75],
      ["Dry Unscented Face Oil", 15.2],
    ].map(([label, value]) => (
      <Meter
        key={label as string}
        className="flex-row items-center gap-4"
        max={50}
        value={value as number}
      >
        <MeterLabel className="w-50 flex-none font-normal">{label}</MeterLabel>
        <MeterTrack className="flex-1">
          <MeterIndicator />
        </MeterTrack>
        <span className="w-28 flex-none text-right font-mono text-sm tabular-nums">
          € {(value as number).toFixed(2)} /kg
        </span>
      </Meter>
    ))}
  </div>
)

export const Unpriced = () => (
  <Meter className="w-110" max={50} value={9}>
    <div className="flex items-baseline justify-between">
      <MeterLabel className="text-muted-foreground">
        Neroli Hand Balm
      </MeterLabel>
      <span className="font-mono text-sm text-muted-foreground">—</span>
    </div>
    <MeterTrack>
      <MeterIndicator variant="muted" />
    </MeterTrack>
    <p className="text-xs text-muted-foreground">61% priced</p>
  </Meter>
)
