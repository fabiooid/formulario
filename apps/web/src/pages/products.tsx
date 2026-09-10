import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { LayoutGridIcon, ListIcon, PlusIcon } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'
import type { Language } from '@/i18n/languages'
import type { MessageKey } from '@/i18n/catalogs'
import type { ProductStage, ProductSummary } from '@/lib/api'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PinButton, isProductPinned, usePinProduct } from '@/components/pin-button'

type ProductView = 'cards' | 'list'

const VIEW_STORAGE_KEY = 'products-view'
const CARD_META_MAX = 4

function readStoredView(): ProductView {
  const stored = localStorage.getItem(VIEW_STORAGE_KEY)
  return stored === 'list' ? 'list' : 'cards'
}

function stageLabelKey(stage?: ProductStage): MessageKey {
  if (stage === 'formula') return 'products.stageFormula'
  if (stage === 'final') return 'products.stageFinal'
  return 'products.stageIdea'
}

function formatProductDate(value: string | undefined, language: Language) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function ProductDates({ product, className }: { product: ProductSummary; className?: string }) {
  const { t, language } = useLanguage()
  const created = formatProductDate(product.createdAt, language)
  const edited = formatProductDate(product.updatedAt, language)
  if (!created && !edited) return null

  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {created ? t('products.created', { date: created }) : null}
      {created && edited ? <span className="mx-1.5 text-border">·</span> : null}
      {edited ? t('products.edited', { date: edited }) : null}
    </p>
  )
}

function ProductMeta({
  product,
  maxItems,
}: {
  product: ProductSummary
  maxItems?: number
}) {
  const { t } = useLanguage()
  const items = [
    {
      key: 'type',
      label: t(`productType.${product.type}` as MessageKey),
      variant: 'secondary' as const,
    },
    {
      key: 'stage',
      label: t(stageLabelKey(product.stage)),
      variant: 'secondary' as const,
    },
    ...product.markets.map((market) => ({
      key: `market-${market}`,
      label: market,
      variant: 'secondary' as const,
    })),
    ...(product.claims ?? []).map((claim) => ({
      key: `claim-${claim}`,
      label: t(`claims.${claim}` as MessageKey),
      variant: 'outline' as const,
    })),
  ]
  const visible =
    maxItems != null && items.length > maxItems
      ? items.slice(0, maxItems - 1)
      : items
  const extra = items.length - visible.length

  return (
    <>
      {visible.map((item) => (
        <Badge key={item.key} variant={item.variant}>
          {item.label}
        </Badge>
      ))}
      {extra > 0 ? (
        <Badge variant="outline">{t('products.moreMeta', { count: extra })}</Badge>
      ) : null}
    </>
  )
}

function ProductViewSwitcher({
  view,
  onViewChange,
}: {
  view: ProductView
  onViewChange: (view: ProductView) => void
}) {
  const { t } = useLanguage()

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[view]}
      onValueChange={(next) => {
        const value = next[0]
        if (value === 'cards' || value === 'list') onViewChange(value)
      }}
      aria-label={t('products.viewGroup')}
    >
      <ToggleGroupItem value="list" aria-label={t('products.viewList')} title={t('products.viewList')}>
        <ListIcon data-icon="inline-start" />
        <span className="hidden sm:inline">{t('products.viewList')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="cards" aria-label={t('products.viewCards')} title={t('products.viewCards')}>
        <LayoutGridIcon data-icon="inline-start" />
        <span className="hidden sm:inline">{t('products.viewCards')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function ProductsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState<ProductView>(readStoredView)
  const pinMutation = usePinProduct()

  function handleViewChange(next: ProductView) {
    setView(next)
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.listProducts(),
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createProduct({
        name: t('products.untitled'),
        type: 'skincare',
        markets: ['EU'],
        brief: '',
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate(`/products/${result.product.id}?focus=brief`)
    },
  })

  if (!user) return <Navigate to="/login" replace />

  return (
    <AppShell title={t('nav.products')}>
      <PageHeader
        title={t('products.title')}
        description={t('products.subtitle')}
        actions={
          <>
            <ProductViewSwitcher view={view} onViewChange={handleViewChange} />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <PlusIcon data-icon="inline-start" />
              {createMutation.isPending ? t('products.creating') : t('products.newFromBrief')}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {createMutation.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('products.createFailed')}</AlertTitle>
            <AlertDescription>{createMutation.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('products.loading')}</p>
        ) : isError && !data ? (
          <EmptyState
            title={t('products.loadFailedTitle')}
            description={t('workspace.loadFailedDescription')}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : !data?.products.length ? (
          <EmptyState
            title={t('products.emptyTitle')}
            description={t('products.emptyDescription')}
          />
        ) : (
          view === 'list' ? (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft">
              {data.products.map((product) => {
                const pinned = isProductPinned(product)
                return (
                  <div
                    key={product.id}
                    className="group/pin flex items-stretch border-b border-border/70 last:border-b-0"
                  >
                    <Link
                      to={`/products/${product.id}`}
                      className={cn(
                        'group flex min-w-0 flex-1 flex-col gap-2 px-4 py-3',
                        'transition-colors hover:bg-muted/50 lg:flex-row lg:items-center lg:justify-between lg:gap-4',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium tracking-tight group-hover:text-foreground">{product.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                          {product.brief.trim() || t('products.noBrief')}
                        </p>
                      </div>
                      <ProductDates product={product} className="shrink-0 sm:min-w-40" />
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end">
                        <ProductMeta product={product} />
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center pr-2">
                      <PinButton
                        pinned={pinned}
                        revealOnHover
                        onToggle={() =>
                          pinMutation.mutate({ productId: product.id, pinned: !pinned })
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((product) => {
                const pinned = isProductPinned(product)
                return (
                  <div key={product.id} className="group/pin relative h-full max-w-sm">
                    <Link to={`/products/${product.id}`} className="group block h-full">
                      <Card className="h-full transition-all duration-200 hover:border-border hover:shadow-soft-hover">
                        <CardHeader className="pb-3 pr-10">
                          <CardTitle className="line-clamp-1 min-h-6 text-base font-medium tracking-tight group-hover:text-foreground">
                            {product.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 min-h-[2.875rem] text-sm leading-relaxed">
                            {product.brief.trim() || t('products.noBrief')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          <div className="flex h-12 flex-wrap content-start items-start gap-2 overflow-hidden text-xs">
                            <ProductMeta product={product} maxItems={CARD_META_MAX} />
                          </div>
                          <ProductDates product={product} className="truncate" />
                        </CardContent>
                      </Card>
                    </Link>
                    <PinButton
                      pinned={pinned}
                      revealOnHover
                      className="absolute top-3 right-3"
                      onToggle={() =>
                        pinMutation.mutate({ productId: product.id, pinned: !pinned })
                      }
                    />
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </AppShell>
  )
}
