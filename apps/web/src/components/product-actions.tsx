import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArchiveIcon, ArchiveRestoreIcon, CopyIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLanguage } from '@/i18n/language-provider'
import { api, type ProductSummary } from '@/lib/api'
import { cn } from '@/lib/utils'

export function isProductArchived(product: Pick<ProductSummary, 'status'>) {
  return product.status === 'archived'
}

function invalidateProductQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  productId?: string,
) {
  queryClient.invalidateQueries({ queryKey: ['products'] })
  queryClient.invalidateQueries({ queryKey: ['home'] })
  if (productId) queryClient.invalidateQueries({ queryKey: ['workspace', productId] })
}

export function useArchiveProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, archived }: { productId: string; archived: boolean }) =>
      api.setProductArchived(productId, archived),
    onSuccess: (result) => {
      const next = result.workspace.product
      queryClient.setQueryData(['workspace', next.id], result.workspace)
      invalidateProductQueries(queryClient)
    },
  })
}

export function ProductActionsMenu({
  product,
  className,
}: {
  product: ProductSummary
  className?: string
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [deleting, setDeleting] = useState(false)
  const archived = isProductArchived(product)
  const archiveMutation = useArchiveProduct()

  const duplicateMutation = useMutation({
    mutationFn: () =>
      api.duplicateProduct(product.id, t('products.copyName', { name: product.name }).slice(0, 120)),
    onSuccess: (result) => {
      invalidateProductQueries(queryClient)
      navigate(`/products/${result.product.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProduct(product.id),
    onSuccess: () => {
      queryClient.setQueryData<{ products: ProductSummary[] }>(['products'], (current) =>
        current
          ? { ...current, products: current.products.filter((item) => item.id !== product.id) }
          : current,
      )
      queryClient.removeQueries({ queryKey: ['workspace', product.id] })
      invalidateProductQueries(queryClient)
      setDeleting(false)
      if (location.pathname.startsWith(`/products/${product.id}`)) {
        navigate('/products')
      }
    },
  })

  const busy = duplicateMutation.isPending || archiveMutation.isPending || deleteMutation.isPending

  return (
    <div
      className={cn('flex items-center', className)}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={t('products.actionsFor', { name: product.name })}
          title={t('products.actionsFor', { name: product.name })}
        >
          <MoreHorizontalIcon className="size-4.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled={busy} onClick={() => duplicateMutation.mutate()}>
            <CopyIcon />
            {duplicateMutation.isPending ? t('products.duplicating') : t('products.duplicate')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onClick={() => archiveMutation.mutate({ productId: product.id, archived: !archived })}
          >
            {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            {archived ? t('products.restore') : t('products.archive')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => setDeleting(true)}>
            <Trash2Icon />
            {t('products.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleting} onOpenChange={(open) => !open && !deleteMutation.isPending && setDeleting(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('products.deleteDescription', { name: product.name })}
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError ? (
            <p className="text-sm text-destructive">{t('products.actionFailed')}</p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(false)}
              disabled={deleteMutation.isPending}
            >
              {t('products.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('products.deleting') : t('products.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ProductArchivedNotice({
  product,
}: {
  product: ProductSummary
}) {
  const { t } = useLanguage()
  const archiveMutation = useArchiveProduct()
  if (!isProductArchived(product)) return null

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <p>{t('products.archivedNotice')}</p>
      <Button
        variant="outline"
        size="sm"
        disabled={archiveMutation.isPending}
        onClick={() => archiveMutation.mutate({ productId: product.id, archived: false })}
      >
        {t('products.restore')}
      </Button>
    </div>
  )
}
