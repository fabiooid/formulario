import { FormulaBuilder } from '@/components/formula-builder'
import { InciPreview } from '@/components/inci-preview'
import { MacerationCard } from '@/components/maceration-card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  FormulaPatch,
  FormulaRow,
  FormulaVersionWorkspace,
  ProductSummary,
  VariantWorkspace,
} from '@/lib/api'
import { isPatchStale, proposedFormulaRows } from '@/lib/formula-proposal'
import { useLanguage } from '@/i18n/language-provider'
import { productTracksMaceration, versionDisplayLabel } from '@formulario/domain'

function versionOptionLabel(
  version: { label: string | null; versionNumber: number; isCurrent: boolean },
  currentBadge: string,
) {
  const name = versionDisplayLabel(version)
  return version.isCurrent ? `${name} · ${currentBadge}` : name
}

export function WorkspaceFormula({
  product,
  variants,
  selectedVariantId,
  selectedVersionId,
  onSelectVersion,
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
  onSetFinal,
  setFinalSaving,
  onMacerationSave,
  macerationSaving,
  onRenameVersion,
  renameVersionSaving,
}: {
  product: ProductSummary
  variants: VariantWorkspace[]
  selectedVariantId: string
  selectedVersionId: string | null
  onSelectVersion: (versionId: string) => void
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
  onSetFinal: () => void
  setFinalSaving?: boolean
  onMacerationSave: (input: {
    macerationStartedAt?: string | null
    macerationTargetAt?: string | null
    macerationNotes?: string | null
  }) => void
  macerationSaving?: boolean
  onRenameVersion: (label: string) => void
  renameVersionSaving?: boolean
}) {
  const { t } = useLanguage()
  const tracksMaceration = productTracksMaceration(product.type as 'skincare' | 'perfume' | 'hybrid')
  const selected = variants.find((v) => v.variant.id === selectedVariantId)
  const versionList = selected?.versions ?? []
  const viewedVersion: FormulaVersionWorkspace | null =
    versionList.find((version) => version.id === selectedVersionId) ??
    versionList.find((version) => version.isCurrent) ??
    versionList[0] ??
    null
  const viewingCurrent = !!viewedVersion?.isCurrent
  const committedRows = viewingCurrent ? (selected?.rows ?? []) : (viewedVersion?.rows ?? [])
  const currentVersionId = selected?.version?.id ?? null
  const reviewingPatch = viewingCurrent && !hasDraft && pendingPatches[0] ? pendingPatches[0] : null
  const reviewingStale = reviewingPatch ? isPatchStale(reviewingPatch, currentVersionId) : false
  const tableRows = reviewingPatch
    ? proposedFormulaRows(committedRows, reviewingPatch.operations)
    : viewingCurrent
      ? rows
      : (viewedVersion?.rows ?? [])
  const hasCommittedFormula = tableRows.some((r) => r.inci.trim())
  const extraPending =
    viewingCurrent && reviewingPatch ? pendingPatches.slice(1) : viewingCurrent ? pendingPatches : []
  const historyLocked = !viewingCurrent

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FormulaBuilder
        rows={tableRows}
        onChange={onRowsChange}
        onSave={onSave}
        saving={saving}
        hasChanges={hasChanges}
        locked={historyLocked}
        claims={product.claims ?? []}
        proposal={
          reviewingPatch
            ? {
                summary: reviewingPatch.summary,
                stale: reviewingStale,
                pending: patchPending,
                onAccept: () => onAcceptPatch(reviewingPatch.id),
                onReject: () => onRejectPatch(reviewingPatch.id),
              }
            : undefined
        }
        variantControls={
          versionList.length > 0 && viewedVersion ? (
            <div className="flex min-w-0 max-w-full items-center gap-1">
              {/* One visible name (rename). Compact select switches versions without a second “v1”. */}
              <VersionNameInput
                key={viewedVersion.id}
                name={versionDisplayLabel(viewedVersion)}
                saving={renameVersionSaving}
                onSave={onRenameVersion}
              />
              <Select
                value={viewedVersion.id}
                onValueChange={(value) => value && onSelectVersion(value)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={t('workspace.versions.select')}
                  className="w-8 shrink-0 bg-card px-1.5"
                >
                  <SelectValue className="sr-only">
                    {versionOptionLabel(viewedVersion, t('workspace.versions.currentBadge'))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {versionList.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {versionOptionLabel(version, t('workspace.versions.currentBadge'))}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null
        }
      />

      {historyLocked ? (
        <p className="text-sm text-muted-foreground">{t('workspace.versions.historyHint')}</p>
      ) : null}

      {hasDraft && pendingPatches.length > 0 && viewingCurrent ? (
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

      {viewingCurrent ? (
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
      ) : null}

      {tracksMaceration && viewedVersion ? (
        <>
          <Separator />
          <MacerationCard
            version={viewedVersion}
            onSave={onMacerationSave}
            saving={macerationSaving}
          />
        </>
      ) : null}
    </div>
  )
}

function VersionNameInput({
  name,
  saving,
  onSave,
}: {
  name: string
  saving?: boolean
  onSave: (name: string) => void
}) {
  const { t } = useLanguage()

  return (
    <input
      key={name}
      defaultValue={name}
      maxLength={80}
      disabled={saving}
      onBlur={(event) => {
        const next = event.currentTarget.value.trim()
        if (!next) {
          event.currentTarget.value = name
          return
        }
        if (next !== name) onSave(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          event.currentTarget.value = name
          event.currentTarget.blur()
        }
      }}
      aria-label={t('workspace.versions.rename')}
      title={t('workspace.versions.rename')}
      placeholder={t('workspace.versions.rename')}
      className="-mx-1 h-8 min-w-[4.5rem] max-w-[10rem] rounded-md bg-transparent px-1 text-sm outline-none hover:bg-muted/50 focus:bg-muted/50 focus:ring-2 focus:ring-ring/40 disabled:opacity-70"
    />
  )
}
