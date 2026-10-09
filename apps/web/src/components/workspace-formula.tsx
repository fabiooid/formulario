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

function variantOptionLabel(label: string, isFinal: boolean, finalBadge: string) {
  return isFinal ? `${label} · ${finalBadge}` : label
}

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
  onSelectVariant,
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
  onCreateVariant,
  onDuplicateVariant,
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
  onSelectVariant: (variantId: string) => void
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
  onRenameVersion: (label: string) => void
  renameVersionSaving?: boolean
}) {
  const { t } = useLanguage()
  const isPerfume = product.type === 'perfume'
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
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
            {isPerfume ? (
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
            ) : null}
            {versionList.length > 0 ? (
              <Select
                value={viewedVersion?.id}
                onValueChange={(value) => value && onSelectVersion(value)}
              >
                <SelectTrigger aria-label={t('workspace.versions.select')} className="min-w-0 max-w-full bg-card">
                  <SelectValue>
                    {viewedVersion
                      ? versionOptionLabel(viewedVersion, t('workspace.versions.currentBadge'))
                      : t('workspace.versions.select')}
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
            ) : null}
            {viewedVersion ? (
              <VersionNameInput
                key={viewedVersion.id}
                name={versionDisplayLabel(viewedVersion)}
                saving={renameVersionSaving}
                onSave={onRenameVersion}
              />
            ) : null}
            {isPerfume ? (
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
            ) : null}
          </div>
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
      className="h-8 min-w-0 max-w-[10rem] rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:bg-muted/50 focus:border-input focus:bg-muted/50 focus:ring-2 focus:ring-ring/40 disabled:opacity-70 sm:max-w-[14rem]"
    />
  )
}
