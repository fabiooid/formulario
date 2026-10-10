"use client"

import { Meter as MeterPrimitive } from "@base-ui/react/meter"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Meter({ className, ...props }: MeterPrimitive.Root.Props) {
  return (
    <MeterPrimitive.Root
      data-slot="meter"
      className={cn("group/meter flex min-w-0 flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function MeterLabel({ className, ...props }: MeterPrimitive.Label.Props) {
  return (
    <MeterPrimitive.Label
      data-slot="meter-label"
      className={cn("min-w-0 truncate text-sm font-medium", className)}
      {...props}
    />
  )
}

function MeterValue({ className, ...props }: MeterPrimitive.Value.Props) {
  return (
    <MeterPrimitive.Value
      data-slot="meter-value"
      className={cn("font-mono text-sm tabular-nums", className)}
      {...props}
    />
  )
}

function MeterTrack({ className, ...props }: MeterPrimitive.Track.Props) {
  return (
    <MeterPrimitive.Track
      data-slot="meter-track"
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
}

// Base UI sets `width` and `height: inherit` inline on the indicator, so the
// height comes from the track — only the fill and radius are ours to set.
const meterIndicatorVariants = cva(
  "rounded-full transition-[width] duration-300 ease-out",
  {
    variants: {
      variant: {
        default: "bg-foreground",
        muted: "bg-muted-foreground/45",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function MeterIndicator({
  className,
  variant = "default",
  ...props
}: MeterPrimitive.Indicator.Props & VariantProps<typeof meterIndicatorVariants>) {
  return (
    <MeterPrimitive.Indicator
      data-slot="meter-indicator"
      className={cn(meterIndicatorVariants({ variant }), className)}
      {...props}
    />
  )
}

export {
  Meter,
  MeterLabel,
  MeterValue,
  MeterTrack,
  MeterIndicator,
  meterIndicatorVariants,
}
