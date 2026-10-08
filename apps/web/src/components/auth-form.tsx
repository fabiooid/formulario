import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthScreen } from '@/components/auth-screen'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'

export function AuthForm() {
  const { user, login } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from
  if (user?.mustChangePassword) return <Navigate to="/password" replace state={{ from }} />
  if (user) return <Navigate to={from && from.startsWith('/') ? from : '/'} replace />

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScreen title={t('auth.signInTitle')} description={t('auth.signInDescription')}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">{t('auth.email')}</FieldLabel>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 bg-background"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{t('auth.password')}</FieldLabel>
            <Input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 bg-background"
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading} className="h-10 w-full">
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </FieldGroup>
      </form>
    </AuthScreen>
  )
}
