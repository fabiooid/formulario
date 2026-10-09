import { CopyIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { FormulaBuilder } from '@/components/formula-builder'
import { InciPreview } from '@/components/inci-preview'
import { MacerationCard } from '@/components/maceration-card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FormulaPatch, FormulaRow, ProductSummary, VariantWorkspace } from '@/lib/api'
import { isPatchStale, proposedFormulaRows } from '@/lib/formula-proposal'
import { useLanguage } from '@/i18n/language-provider'

function variantOptionLabel(label: string, isFinal: boolean, finalBadge: string) {
  return isFinal ? `${label} · ${finalBadge}` : label
}

export function WorkspaceFormula({
  product,
  variants,
  selectedVariantId,
  onSelectVariant,
  rows,
  onRowsChange,
  onSave,
  saving,
  pendingPatches,
  onAcceptPatch,
  onRejectPatch,
  patchPending,
  hasDraft,
  hasChanges,
  onCreateVariant,
  onDuplicateVariant,
  onSetFinal,
  setFinalSaving,
  onMacerationSave,
  macerationSaving,
}: {
  product: ProductSummary
  variants: VariantWorkspace[]
  selectedVariantId: string
  onSelectVariant: (variantId: string) => void
  rows: FormulaRow[]
  onRowsChange: (rows: FormulaRow[]) => void
  onSave: () => void
  saving?: boolean
  pendingPatches: FormulaPatch[]
  onAcceptPatch: (patchId: string) => void
  onRejectPatch: (patchId: string) => void
  patchPending?: boolean
  hasDraft?: boolean
  hasChanges: boolean
  onCreateVariant: () => void
  onDuplicateVariant: () => void
  onSetFinal: () => void
  setFinalSaving?: boolean
  onMacerationSave: (input: {
    macerationStartedAt?: string | null
    macerationTargetAt?: string | null
    macerationNotes?: string | null
  }) => void
  macerationSaving?: boolean
}) {
  const { t } = useLanguage()
  const isPerfume = product.type === 'perfume'
  const selected = variants.find((v) => v.variant.id === selectedVariantId)
  const committedRows = selected?.rows ?? []
  const currentVersionId = selected?.version?.id ?? null
  const reviewingPatch = !hasDraft && pendingPatches[0] ? pendingPatches[0] : null
  const reviewingStale = reviewingPatch ? isPatchStale(reviewingPatch, currentVersionId) : false
  const tableRows = reviewingPatch
    ? proposedFormulaRows(committedRows, reviewingPatch.operations)
    : rows
  const hasCommittedFormula = tableRows.some((r) => r.inci.trim())
  const extraPending = reviewingPatch ? pendingPatches.slice(1) : pendingPatches

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FormulaBuilder
        rows={tableRows}
        onChange={onRowsChange}
        onSave={onSave}
        saving={saving}
        hasChanges={hasChanges}
        claims={product.claims ?? []}
        proposal={
          reviewingPatch
            ? {
                stale: reviewingStale,
                pending: patchPending,
                onAccept: () => onAcceptPatch(reviewingPatch.id),
                onReject: () => onRejectPatch(reviewingPatch.id),
              }
            : undefined
        }
        variantControls={isPerfume ? (
          <div className="flex min-w-0 max-w-full items-center gap-1">
            <Select
              value={selectedVariantId}
              onValueChange={(value) => value && onSelectVariant(value)}
            >
              <SelectTrigger aria-label={t('workspace.variants.select')} className="min-w-0 max-w-full bg-card">
                <SelectValue>
                  {selected
                    ? variantOptionLabel(
                        selected.variant.label,
                        selected.variant.isSelectedFinal,
                        t('workspace.variants.finalBadge'),
                      )
                    : t('workspace.variants.select')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {variants.map(({ variant }) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variantOptionLabel(
                        variant.label,
                        variant.isSelectedFinal,
                        t('workspace.variants.finalBadge'),
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" />}
                aria-label={t('workspace.variants.actions')}
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onCreateVariant}>
                  <PlusIcon />
                  {t('workspace.variants.new')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicateVariant}>
                  <CopyIcon />
                  {t('workspace.variants.duplicate')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      />

      {hasDraft && pendingPatches.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-medium">{t('workspace.pendingPatches')}</h3>
          <p className="text-sm text-muted-foreground">{t('workspace.saveBeforePatch')}</p>
          {pendingPatches.map((patch, index) => (
            <div key={patch.id} className="flex flex-col gap-2">
              {index > 0 ? <Separator /> : null}
              <p className="text-sm">{patch.summary}</p>
              <p className="text-xs text-muted-foreground">
                {t('workspace.operations', { count: patch.operations.length })}
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled onClick={() => onAcceptPatch(patch.id)}>
                  {t('workspace.accept')}
                </Button>
                <Button size="sm" variant="outline" disabled={patchPending} onClick={() => onRejectPatch(patch.id)}>
                  {t('workspace.reject')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {extraPending.length > 0 && !hasDraft ? (
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-medium">{t('workspace.pendingPatches')}</h3>
          {extraPending.map((patch, index) => (
            <div key={patch.id} className="flex flex-col gap-2">
              {index > 0 ? <Separator /> : null}
              <p className="text-sm">{patch.summary}</p>
              <p className="text-xs text-muted-foreground">
                {t('workspace.operations', { count: patch.operations.length })}
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={patchPending} onClick={() => onAcceptPatch(patch.id)}>
                  {t('workspace.accept')}
                </Button>
                <Button size="sm" variant="outline" disabled={patchPending} onClick={() => onRejectPatch(patch.id)}>
                  {t('workspace.reject')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Separator />

      <InciPreview rows={tableRows} preview />

      <div className="flex">
        <Button
          variant="outline"
          size="sm"
          onClick={onSetFinal}
          disabled={!hasCommittedFormula || hasDraft || !!reviewingPatch || setFinalSaving}
        >
          {setFinalSaving ? t('workspace.final.generating') : t('workspace.variants.setFinal')}
        </Button>
      </div>

      {isPerfume && selected ? (
        <>
          <Separator />
          <MacerationCard
            variant={selected.variant}
            onSave={onMacerationSave}
            saving={macerationSaving}
          />
        </>
      ) : null}
    </div>
  )
}
