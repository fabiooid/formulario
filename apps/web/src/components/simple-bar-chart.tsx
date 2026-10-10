import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/empty-state'
import { Meter, MeterIndicator, MeterLabel, MeterTrack } from '@/components/ui/meter'

export function SimpleBarChart({
  items,
  emptyLabel,
  formatValue,
}: {
  items: Array<{ label: string; value: number; hint?: string; href?: string }>
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

        const inner = (
          <Meter
            className="flex-row flex-wrap items-center gap-x-4 gap-y-2"
            max={max || 1}
            value={item.value}
          >
            <div className="w-full min-w-0 sm:w-50 sm:flex-none">
              <MeterLabel
                className={priced ? undefined : 'text-muted-foreground'}
              >
                {item.label}
              </MeterLabel>
              {item.hint ? (
                <span className="block text-xs text-muted-foreground">
                  {item.hint}
                </span>
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
              {formatValue ? formatValue(item.value) : item.value}
            </span>
          </Meter>
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
