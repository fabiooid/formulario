import { LogOutIcon, MessageSquareIcon, SettingsIcon } from 'lucide-react'
import { ASSISTANT_REQUIRES_PAID_PLAN } from '@formulario/domain'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { FeedbackDialog } from '@/components/feedback-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useSidebar, SidebarReveal } from '@/components/sidebar-provider'

function initialsFromEmail(email: string) {
  return (email.split('@')[0]?.[0] ?? '?').toUpperCase()
}

export function UserMenu({
  onNavigate,
}: {
  onNavigate?: () => void
}) {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const { collapsed } = useSidebar()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  if (!user) return null

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('sidebar.accountMenu')}
        title={collapsed ? user.email : undefined}
        className={cn(
          'flex w-full items-center rounded-lg py-2 text-left text-sm text-muted-foreground outline-none transition-[color,background-color,padding,gap] duration-200 ease-out motion-reduce:transition-none hover:bg-sidebar-accent/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground',
          collapsed ? 'justify-center gap-0 px-2' : 'gap-2.5 px-2.5',
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-xs font-medium text-foreground">
          {initialsFromEmail(user.email)}
        </span>
        <SidebarReveal className="flex min-w-0 items-center gap-2.5">
          <span className="min-w-0 flex-1 truncate">{user.email}</span>
          <SettingsIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </SidebarReveal>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'end' : 'start'}
        sideOffset={8}
        className="w-56 min-w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal text-foreground">
            <p className="truncate text-sm font-medium">{user.email}</p>
            {ASSISTANT_REQUIRES_PAID_PLAN ? (
              <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                {t(`plan.${user.plan}` as MessageKey)}
              </p>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link to="/settings/account" onClick={onNavigate} />}
          >
            <SettingsIcon />
            {t('nav.settings')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onNavigate?.()
              setFeedbackOpen(true)
            }}
          >
            <MessageSquareIcon />
            {t('sidebar.feedback')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">{t('settings.appearance')}</span>
          <ThemeSwitcher />
        </div>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            onNavigate?.()
            logout()
          }}
        >
          <LogOutIcon />
          {t('nav.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  )
}
