import { PipetteIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AppBrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-7 shrink-0 items-center justify-center', className)}>
      <PipetteIcon className="size-4" />
    </span>
  )
}
