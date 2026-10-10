import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'
import { SettingsSection } from '@/pages/settings/section'

export function SettingsPlanPage() {
  const { user, refreshUser } = useAuth()
  const { t } = useLanguage()

  const planMutation = useMutation({
    mutationFn: (plan: 'free' | 'paid') => api.updatePlan(plan),
    onSuccess: () => refreshUser(),
  })

  return (
    <SettingsSection title={t('settings.plan')}>
      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.planTitle')}</CardTitle>
            <CardDescription>{t('settings.planDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">{t('settings.freeTitle')}</p>
              <p className="text-muted-foreground">{t('settings.freeDescription')}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">{t('settings.paidTitle')}</p>
              <p className="text-muted-foreground">{t('settings.paidDescription')}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={user.plan === 'free' ? 'default' : 'outline'}
                onClick={() => planMutation.mutate('free')}
                disabled={planMutation.isPending}
              >
                {t('settings.useFree')}
              </Button>
              <Button
                variant={user.plan === 'paid' ? 'default' : 'outline'}
                onClick={() => planMutation.mutate('paid')}
                disabled={planMutation.isPending}
              >
                {t('settings.usePaid')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </SettingsSection>
  )
}
