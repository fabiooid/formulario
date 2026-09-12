import { BanknoteIcon, FlaskConicalIcon, ShoppingBagIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout'
import { SimpleBarChart } from '@/components/simple-bar-chart'
import { StockBadge } from '@/components/stock-badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey, TranslateVars } from '@/i18n/catalogs'
import { api, type HomeAttention } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatEur } from '@/lib/format'

function attentionDetail(item: HomeAttention, t: (key: MessageKey, vars?: TranslateVars) => string) {
  if (item.kind === 'banned') return t('home.attention.banned', { inci: item.inci ?? '' })
  if (item.kind === 'restricted') return t('home.attention.restricted', { inci: item.inci ?? '' })
  if (item.kind === 'claim_block') {
    const claimKey = (`claims.${item.claim ?? 'vegan'}`) as MessageKey
    return t('home.attention.claimBlock', { inci: item.inci ?? '', claim: t(claimKey) })
  }
  if (item.kind === 'unbalanced') {
    return t('home.attention.unbalanced', { total: item.totalPercent ?? 0 })
  }
  if (item.kind === 'maceration_ready') {
    return t('home.attention.ready', { variant: item.variantLabel ?? '' })
  }
  if (item.daysLeft == null) return t('home.attention.maceratingNoDate', { variant: item.variantLabel ?? '' })
  return t('home.attention.macerating', { days: item.daysLeft, variant: item.variantLabel ?? '' })
}

function HeroCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card size="sm" className="relative border-t-2 border-t-accent-brand/40">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription>{label}</CardDescription>
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-brand/5 text-accent-brand"><Icon className="size-4" /></span>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-medium tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()

  const { data, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: () => api.getHome(),
    enabled: !!user,
  })

  // Each href identifies a product; preserve the API's severity order.
  const attentionByProduct = new Map<string, HomeAttention[]>()
  for (const item of data?.attention ?? []) {
    const group = attentionByProduct.get(item.href)
    if (group) group.push(item)
    else attentionByProduct.set(item.href, [item])
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <AppShell title={t('nav.home')}>
      <PageHeader title={t('home.title')} description={t('home.subtitle')} />

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t('products.loading')}</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <HeroCard
              label={t('home.hero.shelfValue')}
              value={data.shelf.valuedCount ? formatEur(data.shelf.value, language) : '—'}
              hint={
                data.shelf.shelfCount
                  ? t('home.hero.shelfCoverage', {
                      valued: data.shelf.valuedCount,
                      shelf: data.shelf.shelfCount,
                    })
                  : t('home.hero.shelfEmpty')
              }
              icon={BanknoteIcon}
            />
            <HeroCard
              label={t('home.hero.toPurchase')}
              value={String(data.purchaseCount)}
              hint={t('home.hero.toPurchaseHint')}
              icon={ShoppingBagIcon}
            />
            <HeroCard
              label={t('home.hero.formulaCosts')}
              value={
                data.formulaCost.totalCount
                  ? `${data.formulaCost.completeCount} / ${data.formulaCost.totalCount}`
                  : '—'
              }
              hint={
                data.formulaCost.totalCount
                  ? t('home.hero.formulaCostsHint', {
                      complete: data.formulaCost.completeCount,
                      total: data.formulaCost.totalCount,
                    })
                  : t('home.hero.formulaCostsNone')
              }
              icon={FlaskConicalIcon}
            />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t('home.purchase.title')}</CardTitle>
                <CardDescription>{t('home.purchase.subtitle')}</CardDescription>
                <CardAction>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/ingredients" />}>
                    {t('home.purchase.viewInventory')}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {!data.purchaseSuggestions.length ? (
                  <EmptyState
                    title={t('home.purchase.emptyTitle')}
                    description={t('home.purchase.emptyDescription')}
                  />
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {data.purchaseSuggestions.map((item) => (
                      <div
                        key={`${item.reason}-${item.inci}`}
                        className="flex min-w-0 flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 break-words font-medium tracking-tight">{item.inci}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {item.pricePerKg != null ? (
                              <p className="font-mono text-sm tabular-nums tracking-tight">
                                {formatEur(item.pricePerKg, language)}
                                <span className="ml-1 font-sans text-muted-foreground">
                                  {t('ingredients.priceUnit')}
                                </span>
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">{t('home.purchase.noPrice')}</p>
                            )}
                            <StockBadge status={item.reason === 'missing' ? 'missing' : item.reason} />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.usedIn.length
                            ? t('home.purchase.usedIn', { names: item.usedIn.join(', ') })
                            : t('home.purchase.unused')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t('home.attention.title')}</CardTitle>
                <CardDescription>{t('home.attention.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                {!data.attention.length ? (
                  <EmptyState
                    title={t('home.attention.emptyTitle')}
                    description={t('home.attention.emptyDescription')}
                  />
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {[...attentionByProduct].map(([href, items]) => (
                      <Link
                        key={href}
                        to={href}
                        className="flex min-w-0 flex-col gap-1.5 rounded-md px-2 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <p className="break-words font-medium tracking-tight">{items[0].productName}</p>
                        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                          {items.map((item) => (
                            <li key={item.id} className="break-words">{attentionDetail(item, t)}</li>
                          ))}
                        </ul>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>{t('home.formulaCosts.title')}</CardTitle>
              <CardDescription>{t('home.formulaCosts.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!data.formulaCosts.length ? (
                <EmptyState
                  title={t('home.formulaCosts.emptyTitle')}
                  description={t('home.formulaCosts.emptyDescription')}
                />
              ) : (
                <SimpleBarChart
                  emptyLabel={t('home.formulaCosts.emptyDescription')}
                  formatValue={(value) =>
                    value > 0
                      ? `${formatEur(value, language)} ${t('home.formulaCosts.perKg')}`
                      : '—'
                  }
                  items={data.formulaCosts.map((item) => ({
                    label: item.productName,
                    value: item.costPerKg ?? 0,
                    href: item.href,
                    hint: item.hasGap
                      ? t('home.formulaCosts.incomplete', { percent: Math.round(item.pricedPercent) })
                      : undefined,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  )
}
