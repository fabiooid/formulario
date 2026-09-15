import type { ReactNode } from 'react'
import { generateInciList } from '@formulario/domain'
import { EmptyState } from '@/components/empty-state'
import type { FormulaRow } from '@/lib/api'
import { useLanguage } from '@/i18n/language-provider'

export function InciPreview({
  rows,
  preview = true,
  trailing,
}: {
  rows: FormulaRow[]
  preview?: boolean
  trailing?: ReactNode
}) {
  const { t } = useLanguage()
  const inci = generateInciList(rows)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-medium">
          {preview ? t('workspace.inciPreview') : t('workspace.finalInci')}
        </h3>
        {trailing}
      </div>
      {inci ? (
        <p className="font-mono text-sm leading-relaxed">{inci}</p>
      ) : (
        <EmptyState
          title={t('workspace.noInciTitle')}
          description={t('workspace.noInciDescription')}
        />
      )}
    </div>
  )
}
