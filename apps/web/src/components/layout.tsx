import { MenuIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AgentLauncher, AgentPane } from '@/components/agent-pane'
import { AppSidebar } from '@/components/app-sidebar'
import { useAgent } from '@/components/agent-provider'
import { SidebarProvider, useSidebar } from '@/components/sidebar-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import { isSettingsPath } from '@/lib/settings'
import { cn } from '@/lib/utils'

function PageBreadcrumb({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  const { t } = useLanguage()
  const { setMobileOpen } = useSidebar()
  const location = useLocation()
  const inSettings = isSettingsPath(location.pathname)

  return (
    <div className="mb-4 flex min-w-0 items-center gap-2 sm:mb-5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label={t('sidebar.openMenu')}
        onClick={() => setMobileOpen(true)}
      >
        <MenuIcon className="size-4" />
      </Button>
      <nav aria-label={t('sidebar.breadcrumb')} className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          to="/"
          className="hidden truncate text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground sm:inline"
        >
          {t('appName')}
        </Link>
        <span className="hidden text-border/80 sm:inline" aria-hidden="true">
          /
        </span>
        {inSettings ? (
          <>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {t('settings.title')}
            </span>
            <span className="hidden text-border/80 sm:inline" aria-hidden="true">
              /
            </span>
          </>
        ) : null}
        <span aria-current="page" className="truncate text-sm font-medium text-foreground/90">
          {title}
        </span>
        {action}
      </nav>
      {inSettings ? null : <AgentLauncher />}
    </div>
  )
}

function AppShellFrame({
  title,
  children,
  wide,
  breadcrumbAction,
}: {
  title: string
  children: React.ReactNode
  wide?: boolean
  breadcrumbAction?: React.ReactNode
}) {
  const { mode } = useAgent()
  const location = useLocation()
  const inSettings = isSettingsPath(location.pathname)
  const contentWidth = wide ? 'max-w-[90rem]' : 'max-w-none'
  const full = mode === 'full' && !inSettings

  return (
    <div className="app-grid flex h-dvh w-full overflow-hidden">
      <AppSidebar />
      <div className="flex h-dvh min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col overflow-y-auto transition-[flex-grow,flex-basis,opacity] duration-200 ease-out motion-reduce:transition-none',
            full
              ? 'max-md:flex-1 md:pointer-events-none md:min-w-0 md:flex-none md:basis-0 md:opacity-0'
              : 'flex-1 opacity-100',
          )}
          aria-hidden={full}
          inert={full ? true : undefined}
        >
          <main className="flex w-full min-w-0 flex-1 justify-center px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 lg:px-10">
            <div className={cn('min-h-full w-full min-w-0', contentWidth)}>
              <PageBreadcrumb title={title} action={breadcrumbAction} />
              {children}
            </div>
          </main>
        </div>
        {inSettings ? null : <AgentPane />}
      </div>
    </div>
  )
}

export function AppShell({
  title,
  children,
  wide,
  breadcrumbAction,
}: {
  title: string
  children: React.ReactNode
  wide?: boolean
  breadcrumbAction?: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppShellFrame title={title} wide={wide} breadcrumbAction={breadcrumbAction}>
        {children}
      </AppShellFrame>
    </SidebarProvider>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className ?? 'mb-8 sm:mb-10',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal sm:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage()
  const variant =
    status === 'banned'
      ? 'destructive'
      : status === 'restricted'
        ? 'secondary'
        : status === 'unknown'
          ? 'outline'
          : 'secondary'
  const key = `status.${status}` as MessageKey
  return <Badge variant={variant}>{t(key)}</Badge>
}
