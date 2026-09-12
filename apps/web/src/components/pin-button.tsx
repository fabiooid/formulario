import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PinIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/language-provider'
import { api, type ProductSummary } from '@/lib/api'
import { cn } from '@/lib/utils'

export function isProductPinned(product: Pick<ProductSummary, 'pinnedAt'>) {
  return Boolean(product.pinnedAt)
}

export function usePinProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, pinned }: { productId: string; pinned: boolean }) =>
      api.setProductPinned(productId, pinned),
    onSuccess: (result) => {
      const next = result.workspace.product
      queryClient.setQueryData(['workspace', next.id], result.workspace)
      queryClient.setQueryData<{ products: ProductSummary[] }>(['products'], (current) =>
        current
          ? {
              ...current,
              products: current.products.map((product) =>
                product.id === next.id ? { ...product, pinnedAt: next.pinnedAt } : product,
              ),
            }
          : current,
      )
    },
  })
}

export function PinButton({
  pinned,
  onToggle,
  className,
  revealOnHover,
}: {
  pinned: boolean
  onToggle: () => void
  className?: string
  revealOnHover?: boolean
}) {
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-pressed={pinned}
      aria-label={pinned ? t('products.unpin') : t('products.pin')}
      title={pinned ? t('products.unpin') : t('products.pin')}
      className={cn(
        'text-muted-foreground',
        pinned && 'text-foreground',
        revealOnHover && !pinned && 'opacity-0 group-hover/pin:opacity-100 focus-visible:opacity-100',
        className,
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      <PinIcon className={cn('size-4.5', pinned && 'fill-current')} />
    </Button>
  )
}
