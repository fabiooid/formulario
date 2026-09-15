import { PRODUCT_CLAIMS, normalizeProductClaims, type ProductClaim } from '@formulario/domain'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'

const NO_CLAIMS_VALUE = 'none'

export function ClaimPicker({
  value,
  onChange,
  disabled,
}: {
  value: ProductClaim[]
  onChange: (claims: ProductClaim[]) => void
  disabled?: boolean
}) {
  const { t } = useLanguage()
  const pickerValue = value.length ? value : [NO_CLAIMS_VALUE]

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      multiple
      disabled={disabled}
      value={pickerValue}
      onValueChange={(next) => {
        const selectedClaims = next.filter((item) => item !== NO_CLAIMS_VALUE)
        if (next.includes(NO_CLAIMS_VALUE) && value.length > 0) {
          onChange([])
          return
        }
        onChange(normalizeProductClaims(selectedClaims))
      }}
      aria-label={t('claims.group')}
      className="!w-fit max-w-full flex-wrap"
    >
      <ToggleGroupItem value={NO_CLAIMS_VALUE}>
        {t('claims.none')}
      </ToggleGroupItem>
      {PRODUCT_CLAIMS.map((claim) => (
        <ToggleGroupItem key={claim} value={claim}>
          {t(`claims.${claim}` as MessageKey)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
