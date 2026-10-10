import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { LeafIcon, SproutIcon, VeganIcon, ArrowUpRightIcon, ArchiveIcon, InboxIcon, LayoutGridIcon, ListIcon, PlusIcon } from 'lucide-react'
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
import { ProductActionsMenu, isProductArchived } from '@/components/product-actions'

type ProductView = 'cards' | 'list'

const VIEW_STORAGE_KEY = 'products-view'

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
  const updatedAt = formatProductDate(product.updatedAt, language) ? product.updatedAt : product.createdAt
  const updated = formatProductDate(updatedAt, language)
  const created = formatProductDate(product.createdAt, language)
  if (!updated) return null

  return (
    <p
      className={cn('text-xs text-muted-foreground', className)}
      title={created ? t('products.created', { date: created }) : undefined}
    >
      <time dateTime={updatedAt}>{t('products.updated', { date: updated })}</time>
      {created ? <span className="sr-only"> · {t('products.created', { date: created })}</span> : null}
    </p>
  )
}

function ProductMeta({ product }: { product: ProductSummary }) {
  const { t } = useLanguage()

  return (
    <>
      <span className="min-w-0">
        <Badge variant="secondary" className="max-w-full truncate">
          {t(`productType.${product.type}` as MessageKey)}
        </Badge>
      </span>
      <span className="min-w-0">
        <Badge variant="secondary" className="max-w-full truncate">
          {t(stageLabelKey(product.stage))}
        </Badge>
      </span>
    </>
  )
}

// These represent selected product claims, not verified certifications.
function ProductClaimIcons({ product }: { product: ProductSummary }) {
  const { t } = useLanguage()
  const claims = [
    { key: 'vegan', icon: VeganIcon },
    { key: 'natural', icon: LeafIcon },
    { key: 'organic', icon: SproutIcon },
  ] as const

  return (
    <span className="flex w-16 shrink-0 items-center gap-2 text-muted-foreground">
      {claims.map(({ key, icon: Icon }) => product.claims?.includes(key) ? (
        <span key={key} role="img" aria-label={t(`claims.${key}`)} title={t(`claims.${key}`)} className="inline-flex size-4 shrink-0">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      ) : null)}
    </span>
  )
}

function ProductStatusSwitcher({
  archived,
  onArchivedChange,
}: {
  archived: boolean
  onArchivedChange: (archived: boolean) => void
}) {
  const { t } = useLanguage()

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[archived ? 'archived' : 'active']}
      onValueChange={(next) => {
        const value = next[0]
        if (value === 'active') onArchivedChange(false)
        if (value === 'archived') onArchivedChange(true)
      }}
      aria-label={t('products.statusGroup')}
    >
      <ToggleGroupItem value="active" aria-label={t('products.statusActive')} title={t('products.statusActive')}>
        <InboxIcon data-icon="inline-start" />
        <span className="hidden lg:inline">{t('products.statusActive')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="archived"
        aria-label={t('products.statusArchived')}
        title={t('products.statusArchived')}
      >
        <ArchiveIcon data-icon="inline-start" />
        <span className="hidden lg:inline">{t('products.statusArchived')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
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
  const [archived, setArchived] = useState(false)
  const pinMutation = usePinProduct()

  function handleViewChange(next: ProductView) {
    setView(next)
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: archived ? ['products', 'archived'] : ['products'],
    queryFn: () => api.listProducts({ archived }),
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
        actions={
          <>
            <ProductStatusSwitcher archived={archived} onArchivedChange={setArchived} />
            <ProductViewSwitcher view={view} onViewChange={handleViewChange} />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <PlusIcon data-icon="inline-start" />
              {createMutation.isPending ? t('products.creating') : t('products.newProduct')}
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
          >
              <Button variant="outline" onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
          </EmptyState>
        ) : !data?.products.length ? (
          <EmptyState
            title={archived ? t('products.emptyArchivedTitle') : t('products.emptyTitle')}
            description={
              archived ? t('products.emptyArchivedDescription') : t('products.emptyDescription')
            }
          />
        ) : (
          view === 'list' ? (
            <Card className="@container/products gap-0 overflow-hidden py-0">
              {data.products.map((product) => {
                const pinned = isProductPinned(product)
                return (
                  <div
                    key={product.id}
                    className="group/pin flex min-w-0 items-stretch border-b border-border/70 last:border-b-0"
                  >
                    <Link
                      to={`/products/${product.id}`}
                      className={cn(
                        'group grid grid-cols-[minmax(0,1fr)] min-w-0 flex-1 gap-2 overflow-hidden px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        'transition-colors hover:bg-muted/50 @min-[800px]/products:grid-cols-[minmax(0,1fr)_11rem_19rem] @min-[800px]/products:items-center @min-[800px]/products:gap-4',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium tracking-tight group-hover:text-foreground">{product.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                          {product.brief.trim() || t('products.noBrief')}
                        </p>
                      </div>
                      <ProductDates product={product} className="truncate" />
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4rem] items-center gap-2 text-xs min-w-0 w-full max-w-76">
                        <ProductMeta product={product} />
                        <ProductClaimIcons product={product} />
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center pr-2">
                      {isProductArchived(product) ? null : (
                        <PinButton
                          pinned={pinned}
                          revealOnHover
                          onToggle={() =>
                            pinMutation.mutate({ productId: product.id, pinned: !pinned })
                          }
                        />
                      )}
                      <ProductActionsMenu product={product} />
                    </div>
                  </div>
                )
              })}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((product) => {
                const pinned = isProductPinned(product)
                return (
                  <div key={product.id} className="group/pin relative h-full max-w-sm">
                    <Link to={`/products/${product.id}`} className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Card className="h-full gap-3 transition-[border-color,box-shadow] duration-200 hover:border-border hover:shadow-soft-hover motion-reduce:transition-none">
                        <CardHeader className="pr-24">
                          <CardTitle className="line-clamp-1 min-h-6 text-base font-medium tracking-tight group-hover:text-foreground">
                            {product.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 min-h-[2.875rem] text-sm leading-relaxed">
                            {product.brief.trim() || t('products.noBrief')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          <div className="flex min-h-6 flex-wrap items-center gap-2 text-xs">
                            <ProductMeta product={product} />
                            <span className="ml-auto"><ProductClaimIcons product={product} /></span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                            <ProductDates product={product} className="truncate" />
                            <ArrowUpRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                    <div className="absolute top-3 right-3 flex items-center">
                      {isProductArchived(product) ? null : (
                        <PinButton
                          pinned={pinned}
                          revealOnHover
                          onToggle={() =>
                            pinMutation.mutate({ productId: product.id, pinned: !pinned })
                          }
                        />
                      )}
                      <ProductActionsMenu product={product} />
                    </div>
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
