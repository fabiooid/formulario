import {
  AlertTriangleIcon,
  BanIcon,
  BanknoteIcon,
  FlaskConicalIcon,
  PackageMinusIcon,
  PackageXIcon,
  ScaleIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout'
import { SimpleBarChart } from '@/components/simple-bar-chart'
import { StockBadge } from '@/components/stock-badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Meter, MeterIndicator, MeterTrack } from '@/components/ui/meter'
import { EmptyState } from '@/components/empty-state'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey, TranslateVars } from '@/i18n/catalogs'
import {
  api,
  type HomeAttention,
  type HomeAttentionKind,
  type HomeAtRisk,
  type HomeAtRiskKind,
} from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatEur } from '@/lib/format'
import { cn } from '@/lib/utils'

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
    return t('home.attention.ready', { version: item.versionLabel ?? '' })
  }
  if (item.daysLeft == null) {
    return t('home.attention.maceratingNoDate', { version: item.versionLabel ?? '' })
  }
  return t('home.attention.macerating', { days: item.daysLeft, version: item.versionLabel ?? '' })
}

function atRiskDetail(item: HomeAtRisk, t: (key: MessageKey, vars?: TranslateVars) => string) {
  if (item.kind === 'banned') return t('home.atRisk.banned', { inci: item.reasonInci ?? '' })
  if (item.kind === 'missing_ingredient') {
    return t('home.atRisk.missing', { inci: item.reasonInci ?? '' })
  }
  return t('home.atRisk.stockOut', { inci: item.reasonInci ?? '' })
}

const ATTENTION_ICONS: Record<
  HomeAttentionKind,
  React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  banned: BanIcon,
  restricted: AlertTriangleIcon,
  claim_block: AlertTriangleIcon,
  unbalanced: ScaleIcon,
  maceration_ready: SparklesIcon,
  macerating: FlaskConicalIcon,
}

const AT_RISK_ICONS: Record<
  HomeAtRiskKind,
  React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  banned: BanIcon,
  missing_ingredient: PackageXIcon,
  stock_out: PackageMinusIcon,
}

function KindIcon({
  icon: Icon,
  label,
  tone = 'muted',
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  tone?: 'muted' | 'danger' | 'warning'
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
        tone === 'danger' && 'bg-destructive/10 text-destructive',
        tone === 'warning' && 'bg-muted text-foreground',
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  )
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
    <Card size="sm" className="relative">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription>{label}</CardDescription>
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-brand/5 text-accent-brand">
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-medium tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function StockLevelMeter({
  reason,
  label,
}: {
  reason: 'missing' | 'low' | 'to_buy'
  label: string
}) {
  const value = reason === 'low' ? 25 : 0
  return (
    <Meter className="w-20 gap-1" max={100} value={value} aria-label={label}>
      <MeterTrack className="h-1.5">
        <MeterIndicator variant={reason === 'low' ? 'default' : 'muted'} />
      </MeterTrack>
    </Meter>
  )
}

function MacerationProgress({
  item,
  t,
}: {
  item: HomeAttention
  t: (key: MessageKey, vars?: TranslateVars) => string
}) {
  if (item.kind !== 'macerating' && item.kind !== 'maceration_ready') return null
  const progress =
    item.kind === 'maceration_ready' ? 1 : (item.macerationProgress ?? null)
  if (progress == null && item.daysRested == null) return null
  const percent = Math.round((progress ?? (item.kind === 'maceration_ready' ? 1 : 0)) * 100)
  return (
    <div className="mt-1.5 flex min-w-0 flex-col gap-1">
      <Meter max={100} value={percent} aria-label={t('home.attention.macerationProgressLabel')}>
        <MeterTrack className="h-1.5">
          <MeterIndicator variant={item.kind === 'maceration_ready' ? 'default' : 'muted'} />
        </MeterTrack>
      </Meter>
      <p className="text-xs text-muted-foreground">
        {item.kind === 'maceration_ready'
          ? t('home.attention.macerationReadyHint', { rested: item.daysRested ?? 0 })
          : t('home.attention.macerationProgressHint', {
              rested: item.daysRested ?? 0,
              left: item.daysLeft ?? 0,
            })}
      </p>
    </div>
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

  // Each href identifies a product (or version deep link); preserve API severity order.
  const attentionByProduct = new Map<string, HomeAttention[]>()
  for (const item of data?.attention ?? []) {
    const groupKey = item.href.split('?')[0] ?? item.href
    const group = attentionByProduct.get(groupKey)
    if (group) group.push(item)
    else attentionByProduct.set(groupKey, [item])
  }

  if (!user) return <Navigate to="/login" replace />

  const productCount = data?.productCount ?? 0
  const attentionTotal = data?.attentionTotal ?? data?.attention.length ?? 0

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
              value={data.shelf.valuedCount ? formatEur(data.shelf.value, language) : '-'}
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
                  : '-'
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

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>{t('home.atRisk.title')}</CardTitle>
              <CardDescription>
                {data.atRisk.length
                  ? t('home.atRisk.count', { count: data.atRisk.length })
                  : t('home.atRisk.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!data.atRisk.length ? (
                <EmptyState
                  title={t('home.atRisk.emptyTitle')}
                  description={t('home.atRisk.emptyDescription')}
                />
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {data.atRisk.map((item) => {
                    const Icon = AT_RISK_ICONS[item.kind]
                    const kindLabel = t(`home.atRisk.kind.${item.kind}` as MessageKey)
                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        className="flex min-w-0 items-start gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <KindIcon
                          icon={Icon}
                          label={kindLabel}
                          tone={item.kind === 'banned' ? 'danger' : 'warning'}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium tracking-tight">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">{atRiskDetail(item, t)}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

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
                    title={
                      productCount === 0
                        ? t('home.purchase.emptyNoFormulasTitle')
                        : t('home.purchase.emptyTitle')
                    }
                    description={
                      productCount === 0
                        ? t('home.purchase.emptyNoFormulasDescription')
                        : t('home.purchase.emptyDescription')
                    }
                  />
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {data.purchaseSuggestions.map((item) => {
                      const stockLabel = t(
                        `ingredients.stockStatus.${item.reason === 'missing' ? 'missing' : item.reason}` as MessageKey,
                      )
                      return (
                        <div
                          key={`${item.reason}-${item.inci}`}
                          className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0"
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
                          <div className="flex flex-wrap items-center gap-3">
                            <StockLevelMeter reason={item.reason} label={stockLabel} />
                            <p className="text-sm text-muted-foreground">
                              {item.usedIn.length
                                ? t('home.purchase.usedIn', { names: item.usedIn.join(', ') })
                                : t('home.purchase.unused')}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t('home.attention.title')}</CardTitle>
                <CardDescription>
                  {attentionTotal
                    ? t('home.attention.count', { count: attentionTotal })
                    : t('home.attention.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!data.attention.length ? (
                  <EmptyState
                    title={t('home.attention.emptyTitle')}
                    description={t('home.attention.emptyDescription')}
                  />
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {[...attentionByProduct].map(([groupKey, items]) => (
                      <div key={groupKey} className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0">
                        <p className="break-words font-medium tracking-tight">{items[0].productName}</p>
                        <ul className="flex flex-col gap-2">
                          {items.map((item) => {
                            const Icon = ATTENTION_ICONS[item.kind]
                            const kindLabel = t(`home.attention.kind.${item.kind}` as MessageKey)
                            return (
                              <li key={item.id}>
                                <Link
                                  to={item.href}
                                  className="flex min-w-0 items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                >
                                  <KindIcon
                                    icon={Icon}
                                    label={kindLabel}
                                    tone={
                                      item.kind === 'banned' || item.kind === 'claim_block'
                                        ? 'danger'
                                        : item.kind === 'unbalanced' || item.kind === 'restricted'
                                          ? 'warning'
                                          : 'muted'
                                    }
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm text-muted-foreground">
                                      {attentionDetail(item, t)}
                                    </p>
                                    <MacerationProgress item={item} t={t} />
                                  </div>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
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
                      : '-'
                  }
                  items={data.formulaCosts.map((item) => ({
                    label: item.productName,
                    value: item.costPerKg ?? 0,
                    href: item.href,
                    hint: item.fullCost
                      ? t('home.formulaCosts.fullCost')
                      : item.hasGap
                        ? t('home.formulaCosts.incomplete', { percent: Math.round(item.pricedPercent) })
                        : t('home.formulaCosts.unbalanced'),
                    pricedPercent: item.pricedPercent,
                    pricedLabel: t('home.formulaCosts.pricedMeter', {
                      percent: Math.round(item.pricedPercent),
                    }),
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
