import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/empty-state'
import { Meter, MeterIndicator, MeterLabel, MeterTrack } from '@/components/ui/meter'

export function SimpleBarChart({
  items,
  emptyLabel,
  formatValue,
}: {
  items: Array<{
    label: string
    value: number
    hint?: string
    href?: string
    pricedPercent?: number
    pricedLabel?: string
  }>
  emptyLabel: string
  formatValue?: (value: number) => string
}) {
  const max = Math.max(...items.map((item) => item.value), 0)

  if (!items.length) {
    return <EmptyState title={emptyLabel} />
  }

  return (
    <div className="-mx-2 flex flex-col">
      {items.map((item) => {
        const priced = item.value > 0
        const pricedPercent = Math.min(100, Math.max(0, item.pricedPercent ?? (priced ? 100 : 0)))

        const inner = (
          <div className="flex min-w-0 flex-col gap-2">
            <Meter
              className="flex-row flex-wrap items-center gap-x-4 gap-y-2"
              max={max || 1}
              value={item.value}
            >
              <div className="w-full min-w-0 sm:w-50 sm:flex-none">
                <MeterLabel className={priced ? undefined : 'text-muted-foreground'}>
                  {item.label}
                </MeterLabel>
                {item.hint ? (
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                ) : null}
              </div>
              <MeterTrack className="min-w-0 flex-1">
                <MeterIndicator
                  className={priced ? 'min-w-[6%]' : undefined}
                  variant={priced ? 'default' : 'muted'}
                />
              </MeterTrack>
              <span
                className={`w-32 flex-none text-right font-mono text-sm tabular-nums${
                  priced ? '' : ' text-muted-foreground'
                }`}
              >
                {formatValue ? formatValue(item.value) : String(item.value)}
              </span>
            </Meter>
            {item.pricedLabel ? (
              <Meter
                className="flex-row flex-wrap items-center gap-x-4 gap-y-1"
                max={100}
                value={pricedPercent}
                aria-label={item.pricedLabel}
              >
                <span className="w-full min-w-0 text-xs text-muted-foreground sm:w-50 sm:flex-none">
                  {item.pricedLabel}
                </span>
                <MeterTrack className="h-1.5 min-w-0 flex-1">
                  <MeterIndicator variant={pricedPercent >= 99.5 ? 'default' : 'muted'} />
                </MeterTrack>
                <span className="w-32 flex-none text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {Math.round(pricedPercent)}%
                </span>
              </Meter>
            ) : null}
          </div>
        )

        if (item.href) {
          return (
            <Link
              key={item.href}
              to={item.href}
              className="rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
            >
              {inner}
            </Link>
          )
        }

        return (
          <div key={item.label} className="px-2 py-2.5">
            {inner}
          </div>
        )
      })}
    </div>
  )
}
