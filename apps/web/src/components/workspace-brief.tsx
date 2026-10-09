import { useEffect, useState } from 'react'
import type { ProductClaim } from '@formulario/domain'
import { ClaimPicker } from '@/components/claim-picker'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { WorkspaceSection } from '@/components/workspace-section'
import { useLanguage } from '@/i18n/language-provider'

export function WorkspaceBrief({
  brief,
  saving,
  onSave,
  claims,
  onSaveClaims,
  claimsSaving,
}: {
  brief: string
  saving?: boolean
  onSave: (brief: string) => void
  claims: ProductClaim[]
  onSaveClaims: (claims: ProductClaim[]) => void
  claimsSaving?: boolean
}) {
  const { t } = useLanguage()
  const [value, setValue] = useState(brief)

  useEffect(() => {
    setValue(brief)
  }, [brief])

  function commit() {
    const next = value.trim()
    if (!next) {
      setValue(brief)
      return
    }
    if (next !== brief) onSave(next)
  }

  return (
    <WorkspaceSection
      title={t('workspace.brief.title')}
      description={t('workspace.brief.description')}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="product-brief" className="sr-only">
            {t('workspace.brief.title')}
          </FieldLabel>
          <Textarea
            id="product-brief"
            value={value}
            rows={4}
            disabled={saving}
            placeholder={t('workspace.brief.placeholder')}
            onChange={(event) => setValue(event.target.value)}
            onBlur={commit}
          />
        </Field>
        <Field>
          <FieldLabel>{t('products.claims')}</FieldLabel>
          <ClaimPicker
            value={claims}
            onChange={onSaveClaims}
            disabled={claimsSaving}
          />
          <FieldDescription>{t('claims.hint')}</FieldDescription>
        </Field>
      </FieldGroup>
    </WorkspaceSection>
  )
}
