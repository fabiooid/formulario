import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PreferenceControls } from '@/components/preference-controls'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'
import { AppBrandMark } from '@/components/app-brand-mark'

export function AuthForm({
  mode,
}: {
  mode: 'login' | 'register'
}) {
  const { user, login, register } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const [email, setEmail] = useState(mode === 'login' ? 'demo@local.test' : '')
  const [password, setPassword] = useState(mode === 'login' ? 'demo' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isLogin = mode === 'login'

  // Sent here from a signed-in page? Go back there after signing in.
  const from = (location.state as { from?: string } | null)?.from
  if (user) return <Navigate to={from && from.startsWith('/') ? from : '/'} replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isLogin) await login(email, password)
      else await register(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t(isLogin ? 'auth.loginFailed' : 'auth.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-grid relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <AppBrandMark />
          <span className="text-sm font-semibold tracking-normal">{t('appName')}</span>
        </div>
        <PreferenceControls />
      </header>

      <div className="flex flex-1 items-center justify-center p-4 pb-16">
        <Card className="w-full max-w-[400px] border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight">
              {t(isLogin ? 'auth.signInTitle' : 'auth.registerTitle')}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t(isLogin ? 'auth.signInDescription' : 'auth.registerDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">{t('auth.email')}</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 bg-background"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">{t('auth.password')}</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 bg-background"
                  />
                </Field>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={loading} className="h-10 w-full">
                  {loading
                    ? t(isLogin ? 'auth.signingIn' : 'auth.creating')
                    : t(isLogin ? 'auth.signIn' : 'auth.createAccount')}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {isLogin ? (
                    <>
                      {t('auth.noAccount')}{' '}
                      <Link to="/register" className="text-foreground underline underline-offset-4 hover:opacity-80">
                        {t('auth.registerLink')}
                      </Link>
                    </>
                  ) : (
                    <>
                      {t('auth.haveAccount')}{' '}
                      <Link to="/login" className="text-foreground underline underline-offset-4 hover:opacity-80">
                        {t('auth.signInLink')}
                      </Link>
                    </>
                  )}
                </p>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
