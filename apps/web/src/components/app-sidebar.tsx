import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowLeftIcon,
  Building2Icon,
  CreditCardIcon,
  FlaskConicalIcon,
  HomeIcon,
  LanguagesIcon,
  LayoutGridIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SunMoonIcon,
  TriangleIcon,
  UserIcon,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLanguage } from '@/i18n/language-provider'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useSidebar, SidebarReveal } from '@/components/sidebar-provider'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { CreateOrganizationDialog } from '@/components/create-organization-dialog'
import { OrganizationSwitcher } from '@/components/organization-switcher'
import { UserMenu } from '@/components/user-menu'
import { PinButton, isProductPinned, usePinProduct } from '@/components/pin-button'
import { getSettingsReturnPath, isSettingsPath } from '@/lib/settings'

function SidebarNavLink({
  to,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  onNavigate?: () => void
}) {
  const { collapsed } = useSidebar()

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center rounded-lg py-2 text-sm transition-[color,background-color,padding,gap] duration-200 ease-out motion-reduce:transition-none',
        collapsed ? 'justify-center gap-0 px-2' : 'gap-2.5 px-2.5',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center">
        <Icon className="size-4 shrink-0" />
      </span>
      <SidebarReveal className="truncate">{label}</SidebarReveal>
    </Link>
  )
}

function SidebarBackButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  const { collapsed } = useSidebar()

  return (
    <button
      type="button"
      aria-label={label}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center rounded-lg py-2 text-sm text-muted-foreground transition-[color,background-color,padding,gap] duration-200 ease-out motion-reduce:transition-none hover:bg-sidebar-accent/70 hover:text-foreground',
        collapsed ? 'justify-center gap-0 px-2' : 'gap-2.5 px-2.5',
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center">
        <ArrowLeftIcon className="size-4 shrink-0" />
      </span>
      <SidebarReveal className="truncate">{label}</SidebarReveal>
    </button>
  )
}

export function AppSidebar() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const inSettings = isSettingsPath(location.pathname)
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const pinMutation = usePinProduct()

  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.listProducts(),
    enabled: !!user && !inSettings,
  })

  function closeMobile() {
    setMobileOpen(false)
  }

  const homePath = location.pathname === '/'
  const productsPath = location.pathname === '/products'
  const ingredientsPath = location.pathname === '/ingredients'
  const workspaceMatch = location.pathname.match(/^\/products\/([^/]+)/)
  const activeProductId = workspaceMatch?.[1]
  const pinnedProducts = (data?.products ?? [])
    .filter(isProductPinned)
    .sort((a, b) => (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? ''))

  return (
    <>
      <button
        type="button"
        aria-label={t('sidebar.closeMenu')}
        tabIndex={mobileOpen ? 0 : -1}
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ease-out md:hidden motion-reduce:transition-none',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeMobile}
      />

      <aside
        className={cn(
          'group/nav dot-grid fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-sidebar-border bg-sidebar/80 backdrop-blur-sm transition-[width,transform] duration-200 ease-out motion-reduce:transition-none md:sticky md:top-0 md:h-dvh md:self-start md:translate-x-0',
          collapsed ? 'w-14' : 'w-60',
          mobileOpen ? 'translate-x-0 shadow-soft-hover' : '-translate-x-full md:translate-x-0',
        )}
      >
        {inSettings ? (
          <div className="flex h-14 shrink-0 items-center px-3">
            <SidebarBackButton
              label={t('sidebar.back')}
              onClick={() => {
                closeMobile()
                navigate(getSettingsReturnPath())
              }}
            />
          </div>
        ) : (
          <div
            className={cn(
              'flex h-14 shrink-0 items-center transition-[padding] duration-200 ease-out motion-reduce:transition-none',
              collapsed ? 'justify-center px-2' : 'px-3',
            )}
          >
            <div
              className={cn(
                'flex min-w-0 items-center transition-[gap,padding] duration-200 ease-out motion-reduce:transition-none',
                collapsed ? 'gap-0' : 'w-full gap-2.5 px-2.5',
              )}
            >
              <Link
                to="/"
                onClick={closeMobile}
                title={t('appName')}
                className="flex min-w-0 items-center gap-2.5 text-foreground transition-opacity hover:opacity-80 md:hidden"
              >
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <TriangleIcon className="size-4 fill-current" />
                </span>
                <span className="truncate text-sm font-semibold tracking-normal">{t('appName')}</span>
              </Link>
              {collapsed ? (
                <div className="group/mark relative hidden size-7 shrink-0 md:block">
                  <Link
                    to="/"
                    onClick={closeMobile}
                    title={t('appName')}
                    aria-label={t('appName')}
                    className="flex size-7 items-center justify-center text-foreground group-hover/nav:opacity-0 group-focus-within/mark:opacity-0"
                  >
                    <TriangleIcon className="size-4 fill-current" />
                  </Link>
                  <button
                    type="button"
                    className="pointer-events-none absolute inset-0 flex size-7 items-center justify-center text-foreground opacity-0 outline-none focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-hover/nav:pointer-events-auto group-hover/nav:opacity-100"
                    onClick={toggleCollapsed}
                    aria-label={t('sidebar.expand')}
                    title={t('sidebar.expand')}
                  >
                    <PanelLeftOpenIcon className="size-4" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/"
                  onClick={closeMobile}
                  title={t('appName')}
                  aria-label={t('appName')}
                  className="hidden size-7 shrink-0 items-center justify-center text-foreground md:flex"
                >
                  <TriangleIcon className="size-4 fill-current" />
                </Link>
              )}
              <SidebarReveal>
                <Link
                  to="/"
                  onClick={closeMobile}
                  tabIndex={collapsed ? -1 : undefined}
                  className="hidden min-w-0 truncate text-sm font-semibold tracking-normal text-foreground transition-opacity hover:opacity-80 md:inline"
                >
                  {t('appName')}
                </Link>
              </SidebarReveal>
              {collapsed ? null : (
                <button
                  type="button"
                  className="-mr-1.5 ml-auto hidden size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-opacity duration-150 pointer-events-none opacity-0 motion-reduce:transition-none hover:bg-sidebar-accent/70 hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-hover/nav:pointer-events-auto group-hover/nav:opacity-100 md:flex"
                  onClick={toggleCollapsed}
                  aria-label={t('sidebar.collapse')}
                  title={t('sidebar.collapse')}
                >
                  <PanelLeftCloseIcon className="size-4" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-5 overflow-hidden p-3">
          {inSettings ? null : (
            <OrganizationSwitcher
              onCreate={() => {
                closeMobile()
                setCreateOrgOpen(true)
              }}
            />
          )}
          {inSettings ? (
            <nav className="flex flex-col gap-0.5">
              <SidebarNavLink
                to="/settings/account"
                icon={UserIcon}
                label={t('settings.account')}
                active={location.pathname === '/settings/account'}
                onNavigate={closeMobile}
              />
              <SidebarNavLink
                to="/settings/appearance"
                icon={SunMoonIcon}
                label={t('settings.appearance')}
                active={location.pathname === '/settings/appearance'}
                onNavigate={closeMobile}
              />
              <SidebarNavLink
                to="/settings/language"
                icon={LanguagesIcon}
                label={t('settings.language')}
                active={location.pathname === '/settings/language'}
                onNavigate={closeMobile}
              />
              <SidebarNavLink
                to="/settings/plan"
                icon={CreditCardIcon}
                label={t('settings.plan')}
                active={location.pathname === '/settings/plan'}
                onNavigate={closeMobile}
              />
              <SidebarNavLink
                to="/settings/organization"
                icon={Building2Icon}
                label={t('settings.organization')}
                active={location.pathname === '/settings/organization'}
                onNavigate={closeMobile}
              />
            </nav>
          ) : (
            <nav className="flex flex-col gap-0.5">
              <SidebarNavLink
                to="/"
                icon={HomeIcon}
                label={t('nav.home')}
                active={homePath}
                onNavigate={closeMobile}
              />
              <SidebarNavLink
                to="/products"
                icon={LayoutGridIcon}
                label={t('nav.products')}
                active={productsPath}
                onNavigate={closeMobile}
              />
              <SidebarNavLink
                to="/ingredients"
                icon={FlaskConicalIcon}
                label={t('nav.ingredients')}
                active={ingredientsPath}
                onNavigate={closeMobile}
              />
            </nav>
          )}

          <Collapsible
            open={!inSettings && !collapsed && pinnedProducts.length > 0}
            className={cn(
              'flex min-h-0 flex-col',
              !inSettings && !collapsed && pinnedProducts.length > 0 && 'flex-1',
            )}
          >
            <CollapsibleContent className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                <p className="px-2.5 text-xs font-medium text-muted-foreground">
                  {t('sidebar.pinned')}
                </p>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="flex flex-col gap-0.5 pr-1">
                    {pinnedProducts.map((product) => {
                      const isActive = activeProductId === product.id
                      return (
                        <div key={product.id} className="group/pin relative">
                          <Link
                            to={`/products/${product.id}`}
                            onClick={closeMobile}
                            tabIndex={collapsed ? -1 : undefined}
                            className={cn(
                              'relative block rounded-lg py-2 pr-8 pl-2.5 text-sm transition-colors duration-150',
                              isActive
                                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                            )}
                          >
                            <span className="line-clamp-2 leading-snug">{product.name}</span>
                          </Link>
                          <PinButton
                            pinned
                            className="absolute top-1.5 right-1 opacity-0 group-hover/pin:opacity-100 focus-visible:opacity-100"
                            onToggle={() =>
                              pinMutation.mutate({ productId: product.id, pinned: false })
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border/80 p-3">
          <UserMenu onNavigate={closeMobile} />
        </div>
      </aside>
      <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
    </>
  )
}
