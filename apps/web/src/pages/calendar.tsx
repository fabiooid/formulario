import { useQuery } from '@tanstack/react-query'
import { CalendarDaysIcon, FlaskConicalIcon, PackageMinusIcon } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout'
import { EmptyState } from '@/components/empty-state'
import { StockBadge } from '@/components/stock-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import { api, type CalendarMacerationEntry } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatGrams } from '@/lib/format'

function formatDate(date: string | null, language: string, t: (key: MessageKey) => string) {
  if (!date) return t('calendar.noDate')
  try {
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${date}T12:00:00`))
  } catch {
    return date
  }
}

function macerationDetail(item: CalendarMacerationEntry, t: (key: MessageKey, vars?: Record<string, string | number>) => string) {
  if (item.kind === 'maceration_ready') {
    return t('calendar.maceration.readyDetail', { version: item.versionLabel })
  }
  if (item.daysLeft == null) {
    return t('calendar.maceration.targetNoDate', { version: item.versionLabel })
  }
  if (item.daysLeft <= 0) {
    return t('calendar.maceration.readyDetail', { version: item.versionLabel })
  }
  return t('calendar.maceration.targetDetail', {
    days: item.daysLeft,
    version: item.versionLabel,
  })
}

export function CalendarPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()

  const { data, isLoading } = useQuery({
    queryKey: ['calendar'],
    queryFn: () => api.getCalendar(),
    enabled: !!user,
  })

  if (!user) return <Navigate to="/login" replace />

  const maceration = data?.maceration ?? []
  const stock = data?.stock ?? []
  const empty = !isLoading && !maceration.length && !stock.length

  return (
    <AppShell title={t('nav.calendar')}>
      <PageHeader title={t('calendar.title')} description={t('calendar.subtitle')} />

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t('calendar.loading')}</p>
      ) : empty ? (
        <EmptyState
          title={t('calendar.emptyTitle')}
          description={t('calendar.emptyDescription')}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>{t('calendar.maceration.title')}</CardTitle>
              <CardDescription>{t('calendar.maceration.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!maceration.length ? (
                <EmptyState
                  title={t('calendar.maceration.emptyTitle')}
                  description={t('calendar.maceration.emptyDescription')}
                />
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {maceration.map((item) => (
                    <Link
                      key={item.id}
                      to={item.href}
                      className="flex min-w-0 items-start gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {item.kind === 'maceration_ready' ? (
                          <FlaskConicalIcon className="size-4" aria-hidden />
                        ) : (
                          <CalendarDaysIcon className="size-4" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="break-words font-medium tracking-tight">{item.productName}</p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatDate(item.date, language, t)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {macerationDetail(item, t)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>{t('calendar.stock.title')}</CardTitle>
              <CardDescription>{t('calendar.stock.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!stock.length ? (
                <EmptyState
                  title={t('calendar.stock.emptyTitle')}
                  description={t('calendar.stock.emptyDescription')}
                />
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {stock.map((item) => (
                    <Link
                      key={item.id}
                      to={item.href}
                      className="flex min-w-0 items-start gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <PackageMinusIcon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="break-words font-medium tracking-tight">{item.inci}</p>
                          <StockBadge status={item.stockStatus} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('calendar.stock.cannotEstimate')}
                        </p>
                        {item.onHandGrams != null ? (
                          <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                            {formatGrams(item.onHandGrams, language)}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  )
}
