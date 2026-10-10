import { useEffect, useRef, useState } from 'react'
import { PencilIcon } from 'lucide-react'
import { FormulaBuilder } from '@/components/formula-builder'
import { InciPreview } from '@/components/inci-preview'
import { MacerationCard } from '@/components/maceration-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  version: { label: string | null; versionNumber: number; isFinal: boolean },
  finalBadge: string,
) {
  const name = versionDisplayLabel(version)
  return version.isFinal ? `${name} · ${finalBadge}` : name
}

export function WorkspaceFormula({
  product,
  variants,
  selectedVariantId,
  selectedVersionId,
  onSelectVersion,
  rows,
  onRowsChange,
  autosaving,
  rowsSynced,
  pendingPatches,
  onAcceptPatch,
  onRejectPatch,
  patchPending,
  onCreateVersion,
  createVersionPending,
  onDeleteVersion,
  deleteVersionPending,
  onSetFinalVersion,
  setFinalVersionPending,
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
  autosaving?: boolean
  rowsSynced?: boolean
  pendingPatches: FormulaPatch[]
  onAcceptPatch: (patchId: string) => void
  onRejectPatch: (patchId: string) => void
  patchPending?: boolean
  onCreateVersion: (copyFromVersionId: string | null) => void
  createVersionPending?: boolean
  onDeleteVersion: (versionId: string) => void
  deleteVersionPending?: boolean
  onSetFinalVersion: (versionId: string) => void
  setFinalVersionPending?: boolean
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
    versionList.find((version) => version.isFinal) ??
    versionList[0] ??
    null
  const committedRows = viewedVersion?.rows ?? []
  const synced = rowsSynced ?? true
  const reviewingPatch = synced && !autosaving && pendingPatches[0] ? pendingPatches[0] : null
  const reviewingStale = reviewingPatch ? isPatchStale(reviewingPatch, viewedVersion?.id) : false
  const tableRows = reviewingPatch
    ? proposedFormulaRows(committedRows, reviewingPatch.operations)
    : rows
  const extraPending = reviewingPatch ? pendingPatches.slice(1) : pendingPatches
  const canDelete = versionList.length > 1
  const hasIngredients = tableRows.some((r) => r.inci.trim())

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FormulaBuilder
        rows={tableRows}
        onChange={onRowsChange}
        autosaving={autosaving}
        productId={product.id}
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
        variantControls={
          versionList.length > 0 && viewedVersion ? (
            <VersionControls
              versions={versionList}
              viewed={viewedVersion}
              saving={renameVersionSaving}
              onSelect={onSelectVersion}
              onRename={onRenameVersion}
              onCreateVersion={onCreateVersion}
              createPending={createVersionPending}
              onDelete={() => onDeleteVersion(viewedVersion.id)}
              deletePending={deleteVersionPending}
              canDelete={canDelete}
              onSetFinal={() => onSetFinalVersion(viewedVersion.id)}
              setFinalPending={setFinalVersionPending}
              hasIngredients={hasIngredients}
            />
          ) : null
        }
      />

      {!synced && pendingPatches.length > 0 ? (
        <p className="text-sm text-muted-foreground">{t('workspace.waitForAutosave')}</p>
      ) : null}

      {extraPending.length > 0 && synced ? (
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

function VersionControls({
  versions,
  viewed,
  saving,
  onSelect,
  onRename,
  onCreateVersion,
  createPending,
  onDelete,
  deletePending,
  canDelete,
  onSetFinal,
  setFinalPending,
  hasIngredients,
}: {
  versions: FormulaVersionWorkspace[]
  viewed: FormulaVersionWorkspace
  saving?: boolean
  onSelect: (versionId: string) => void
  onRename: (name: string) => void
  onCreateVersion: (copyFromVersionId: string | null) => void
  createPending?: boolean
  onDelete: () => void
  deletePending?: boolean
  canDelete: boolean
  onSetFinal: () => void
  setFinalPending?: boolean
  hasIngredients: boolean
}) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [newVersionOpen, setNewVersionOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copyFromVersionId, setCopyFromVersionId] = useState<string | null>(null)
  const finalBadge = t('workspace.versions.finalBadge')

  if (editing) {
    return (
      <VersionNameInput
        key={viewed.id}
        name={versionDisplayLabel(viewed)}
        saving={saving}
        onSave={onRename}
        onClose={() => setEditing(false)}
      />
    )
  }

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select value={viewed.id} onValueChange={(value) => value && onSelect(value)}>
          <SelectTrigger
            size="sm"
            aria-label={t('workspace.versions.select')}
            className="w-44 bg-card"
          >
            <SelectValue>{versionOptionLabel(viewed, finalBadge)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              {versions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {versionOptionLabel(version, finalBadge)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('workspace.versions.renameAction')}
          title={t('workspace.versions.renameAction')}
          disabled={saving}
          onClick={() => setEditing(true)}
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant={viewed.isFinal ? 'secondary' : 'outline'}
          size="sm"
          disabled={!hasIngredients || setFinalPending || viewed.isFinal}
          onClick={onSetFinal}
        >
          {viewed.isFinal ? t('workspace.versions.finalBadge') : t('workspace.versions.chooseFinal')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={createPending}
          onClick={() => {
            setCopyFromVersionId(null)
            setNewVersionOpen(true)
          }}
        >
          {t('workspace.versions.newVersion')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canDelete || deletePending}
          onClick={() => setDeleteOpen(true)}
        >
          {t('workspace.versions.delete')}
        </Button>
      </div>

      <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workspace.versions.newVersionTitle')}</DialogTitle>
            <DialogDescription>{t('workspace.versions.newVersionDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              disabled={createPending}
              onClick={() => {
                onCreateVersion(null)
                setNewVersionOpen(false)
              }}
            >
              {t('workspace.versions.startEmpty')}
            </Button>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t('workspace.versions.copyFrom')}</p>
              <Select
                value={copyFromVersionId ?? ''}
                onValueChange={(value) => setCopyFromVersionId(value || null)}
              >
                <SelectTrigger size="sm" className="bg-card">
                  <SelectValue placeholder={t('workspace.versions.copyPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {versionOptionLabel(version, finalBadge)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                disabled={!copyFromVersionId || createPending}
                onClick={() => {
                  onCreateVersion(copyFromVersionId)
                  setNewVersionOpen(false)
                }}
              >
                {t('workspace.versions.createCopy')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workspace.versions.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('workspace.versions.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('products.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deletePending}
              onClick={() => {
                onDelete()
                setDeleteOpen(false)
              }}
            >
              {t('workspace.versions.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function VersionNameInput({
  name,
  saving,
  onSave,
  onClose,
}: {
  name: string
  saving?: boolean
  onSave: (name: string) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const closed = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit(raw: string) {
    if (closed.current) return
    closed.current = true
    const next = raw.trim()
    if (next && next !== name) onSave(next)
    onClose()
  }

  return (
    <Input
      ref={inputRef}
      defaultValue={name}
      maxLength={80}
      disabled={saving}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit(event.currentTarget.value)
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          commit(name)
        }
      }}
      aria-label={t('workspace.versions.rename')}
      placeholder={t('workspace.versions.rename')}
      className="h-8 w-44"
    />
  )
}
