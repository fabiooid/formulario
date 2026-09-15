import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import type { IngredientStockStatus } from '@formulario/domain'

export type StockDisplayStatus = IngredientStockStatus | 'missing'

export function StockBadge({ status }: { status: StockDisplayStatus }) {
  const { t } = useLanguage()
  const variant =
    status === 'in_house' ? 'secondary' : status === 'low' ? 'outline' : 'destructive'

  return (
    <Badge variant={variant}>{t(`ingredients.stockStatus.${status}` as MessageKey)}</Badge>
  )
}
