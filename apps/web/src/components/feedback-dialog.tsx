import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useLanguage } from '@/i18n/language-provider'

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sendMutation = useMutation({
    mutationFn: () => api.sendFeedback(message.trim()),
    onSuccess: () => {
      setMessage('')
      setError(null)
      onOpenChange(false)
    },
    onError: () => {
      setError(t('feedback.error'))
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setMessage('')
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('feedback.title')}</DialogTitle>
          <DialogDescription>{t('feedback.description')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (message.trim()) sendMutation.mutate()
          }}
        >
          <FieldGroup>
            <Field>
              <Textarea
                value={message}
                maxLength={2000}
                rows={4}
                aria-label={t('feedback.title')}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t('feedback.placeholder')}
              />
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={!message.trim() || sendMutation.isPending}>
              {sendMutation.isPending ? t('feedback.sending') : t('feedback.send')}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
