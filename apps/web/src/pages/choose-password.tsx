import { Navigate, useLocation } from 'react-router-dom'
import { AuthScreen } from '@/components/auth-screen'
import { PasswordForm } from '@/components/password-form'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'

export function ChoosePasswordPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (!user) return <Navigate to="/login" replace />
  if (!user.mustChangePassword) {
    const next = from && from.startsWith('/') && !from.startsWith('/password') ? from : '/'
    return <Navigate to={next} replace />
  }

  return (
    <AuthScreen title={t('auth.choosePasswordTitle')} description={t('auth.choosePasswordDescription')}>
      <PasswordForm mode="first" />
    </AuthScreen>
  )
}
