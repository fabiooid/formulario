import { useState } from 'react'
import { CheckIcon } from 'lucide-react'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordCriteria,
  passwordRejection,
  type PasswordCriterion,
  type PasswordRejection,
} from '@formulario/domain'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const rejectionKey: Record<PasswordRejection | 'same' | 'wrong_current', MessageKey> = {
  too_short: 'auth.passwordTooShort',
  too_long: 'auth.passwordTooLong',
  has_space: 'auth.passwordHasSpace',
  needs_letter: 'auth.passwordNeedsLetter',
  needs_number: 'auth.passwordNeedsNumber',
  needs_special: 'auth.passwordNeedsSpecial',
  common: 'auth.passwordCommon',
  context: 'auth.passwordContext',
  same: 'auth.passwordSame',
  wrong_current: 'auth.wrongPassword',
}

const checklistItems: { id: PasswordCriterion; label: MessageKey }[] = [
  { id: 'min_length', label: 'auth.passwordRuleMinLength' },
  { id: 'no_spaces', label: 'auth.passwordRuleNoSpaces' },
  { id: 'has_letter', label: 'auth.passwordRuleLetter' },
  { id: 'has_number', label: 'auth.passwordRuleNumber' },
  { id: 'has_special', label: 'auth.passwordRuleSpecial' },
]

export function PasswordForm({ mode }: { mode: 'first' | 'account' }) {
  const { user, changePassword, logout } = useAuth()
  const { t } = useLanguage()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const lengthVars = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }
  const checks = passwordCriteria(newPassword)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaved(false)
    setError('')
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }
    const rejection = passwordRejection(newPassword, user?.email)
    if (rejection) {
      setError(t(rejectionKey[rejection], lengthVars))
      return
    }
    setLoading(true)
    try {
      await changePassword({
        currentPassword: mode === 'account' ? currentPassword : undefined,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      if (mode === 'account') setSaved(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      const code = err instanceof ApiError ? err.code : undefined
      const key = code && code in rejectionKey ? rejectionKey[code as keyof typeof rejectionKey] : null
      setError(key ? t(key, lengthVars) : err instanceof Error ? err.message : t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        {mode === 'account' ? (
          <Field>
            <FieldLabel htmlFor="current-password">{t('auth.currentPassword')}</FieldLabel>
            <Input
              id="current-password"
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="h-10 bg-background"
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="new-password">{t('auth.newPassword')}</FieldLabel>
          <Input
            id="new-password"
            type="password"
            name="new-password"
            autoComplete="new-password"
            spellCheck={false}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-10 bg-background"
          />
          <ul className="flex flex-col gap-1.5" aria-live="polite">
            {checklistItems.map((item) => {
              const met = checks[item.id]
              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2 text-xs transition-colors duration-150',
                    met ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                      met ? 'border-foreground bg-foreground text-background' : 'border-border',
                    )}
                    aria-hidden
                  >
                    {met ? <CheckIcon className="size-2.5" /> : null}
                  </span>
                  <span>{t(item.label, lengthVars)}</span>
                </li>
              )
            })}
          </ul>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">{t('auth.confirmPassword')}</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            spellCheck={false}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10 bg-background"
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-muted-foreground">{t('auth.passwordUpdated')}</p> : null}
        <Button type="submit" disabled={loading} className="h-10 w-full">
          {loading ? t('auth.savingPassword') : t(mode === 'first' ? 'auth.continue' : 'auth.savePassword')}
        </Button>
        {mode === 'first' ? (
          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={logout}
              className="text-foreground underline underline-offset-4 hover:opacity-80"
            >
              {t('auth.differentAccount')}
            </button>
          </p>
        ) : null}
      </FieldGroup>
    </form>
  )
}
