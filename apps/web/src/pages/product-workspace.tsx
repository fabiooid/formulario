import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppShell, PageHeader } from '@/components/layout'
import { useAgent } from '@/components/agent-provider'
import { EmptyState } from '@/components/empty-state'
import { WorkspaceBrief } from '@/components/workspace-brief'
import { WorkspaceFormula } from '@/components/workspace-formula'
import { WorkspaceRegulatory } from '@/components/workspace-regulatory'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PinButton, isProductPinned, usePinProduct } from '@/components/pin-button'
import { ProductActionsMenu, ProductArchivedNotice, isProductArchived } from '@/components/product-actions'
import {
  ApiError,
  api,
  type FormulaRow,
  type OlfactoryPyramid,
  type ProductSummary,
} from '@/lib/api'
import { useFormulaDrafts } from '@/lib/use-formula-drafts'
import { formulaContentEquals, type FormulaDraft } from '@/lib/formula-drafts'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'
import type { ProductClaim } from '@formulario/domain'

function hasCommittedRows(rows: FormulaRow[]) {
  return rows.some((row) => row.inci.trim())
}

export function ProductWorkspacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  if (!user || !id) return <Navigate to="/login" replace />
  const draftKey = `formula-drafts:${user.id}:${user.activeOrganizationId ?? ''}:${id}`
  return <ProductWorkspace key={draftKey} id={id} draftKey={draftKey} />
}

function ProductWorkspace({ id, draftKey }: { id: string; draftKey: string }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { setVariantId } = useAgent()
  const [selectedId, setSelectedVariantId] = useState<string | null>(null)
  const { drafts, edit, discard, saved } = useFormulaDrafts(draftKey)
  const [tab, setTab] = useState('workspace')
  const [discardVariantId, setDiscardVariantId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workspace', id],
    queryFn: () => api.getWorkspace(id!),
    enabled: !!user && !!id,
    // Pick up MCP proposals while the product stays open; drafts stay in local storage.
    refetchInterval: 10_000,
  })

  const selectedVariantId =
    selectedId ?? data?.activeVariantId ?? data?.variants[0]?.variant.id ?? null
  const selected = data?.variants.find((v) => v.variant.id === selectedVariantId)
  const draft = selectedVariantId ? drafts[selectedVariantId] : undefined
  const rows = draft?.rows ?? selected?.rows ?? []
  const baseVersionId = draft ? draft.baseVersionId : (selected?.version?.id ?? null)
  const dirty = !!draft

  function setRows(next: FormulaRow[]) {
    if (!selectedVariantId) return
    const committed = selected?.rows ?? []
    const versionMatches = baseVersionId === (selected?.version?.id ?? null)
    if (!saveMutation.isPending && versionMatches && formulaContentEquals(next, committed)) {
      if (draft) discard(selectedVariantId)
      return
    }
    edit(selectedVariantId, { rows: next, baseVersionId })
  }

  useEffect(() => {
    setVariantId(selectedVariantId)
    return () => setVariantId(null)
  }, [selectedVariantId, setVariantId])

  useEffect(() => {
    if (!selectedVariantId || !selected) return
    const leftover = drafts[selectedVariantId]
    if (!leftover) return
    if (leftover.baseVersionId !== (selected.version?.id ?? null)) return
    if (!formulaContentEquals(leftover.rows, selected.rows)) return
    discard(selectedVariantId)
  }, [selectedVariantId, selected, drafts, discard])

  const saveMutation = useMutation({
    mutationFn: (input: { variantId: string; draft: FormulaDraft }) =>
      api.saveFormula(id, input.variantId, input.draft.rows, input.draft.baseVersionId),
    onSuccess: (result, input) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      saved(input.variantId, input.draft, result.versionId)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })

  const patchMutation = useMutation({
    mutationFn: ({ patchId, action }: { patchId: string; action: 'accepted' | 'rejected' }) =>
      api.resolvePatch(id!, patchId, action),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })

  const createVariantMutation = useMutation({
    mutationFn: (copyFromVariantId?: string) =>
      api.createVariant(id!, copyFromVariantId ? { copyFromVariantId } : {}),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      setSelectedVariantId(result.variant.id)
    },
  })

  const setFinalMutation = useMutation({
    mutationFn: (variantId: string) => api.setFinalVariant(id, variantId),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      setTab('regulatory')
    },
  })

  const macerationMutation = useMutation({
    mutationFn: (input: {
      macerationStartedAt?: string | null
      macerationTargetAt?: string | null
      macerationNotes?: string | null
    }) => api.updateVariant(id!, selectedVariantId!, input),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
    },
  })

  const pyramidMutation = useMutation({
    mutationFn: (pyramid: OlfactoryPyramid) => api.saveOlfactoryPyramid(id!, pyramid),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
    },
  })

  const claimsMutation = useMutation({
    mutationFn: (claims: ProductClaim[]) => api.updateProductClaims(id!, claims),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const pinMutation = usePinProduct()

  const briefMutation = useMutation({
    mutationFn: (brief: string) => api.updateProductBrief(id!, brief),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      queryClient.setQueryData<{ products: ProductSummary[] }>(['products'], (current) =>
        current
          ? {
              ...current,
              products: current.products.map((product) =>
                product.id === result.workspace.product.id
                  ? { ...product, brief: result.workspace.product.brief }
                  : product,
              ),
            }
          : current,
      )
    },
  })

  const renameMutation = useMutation({
    mutationFn: (name: string) => api.updateProductName(id!, name),
    onSuccess: (result) => {
      const name = result.workspace.product.name
      queryClient.setQueryData(['workspace', id], result.workspace)
      queryClient.setQueryData<{ products: ProductSummary[] }>(['products'], (current) =>
        current
          ? {
              ...current,
              products: current.products.map((product) =>
                product.id === result.workspace.product.id ? { ...product, name } : product,
              ),
            }
          : current,
      )
    },
  })

  function selectVariant(variantId: string) {
    setSelectedVariantId(variantId)
  }

  function commitFormula(makeFinal = false) {
    if (!selectedVariantId) return
    const variantId = selectedVariantId
    saveMutation.mutate(
      { variantId, draft: { rows, baseVersionId } },
      {
        onSuccess: () => {
          if (makeFinal) setFinalMutation.mutate(variantId)
        },
      },
    )
  }

  function handleSetFinal() {
    commitFormula(true)
  }
  function handleGenerateFinal() {
    commitFormula(true)
  }

  if (!user) return <Navigate to="/login" replace />
  if (isError && !data) {
    return (
      <AppShell title={t('workspace.product')}>
        <EmptyState
          title={t('workspace.loadFailedTitle')}
          description={t('workspace.loadFailedDescription')}
        >
          <Button variant="outline" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </EmptyState>
      </AppShell>
    )
  }
  if (isLoading || !data) {
    return (
      <AppShell title={t('workspace.product')}>
        <p className="text-sm text-muted-foreground">{t('workspace.loading')}</p>
      </AppShell>
    )
  }

  const pendingPatches = data.patches.filter(
    (p) => p.status === 'pending' && p.variantId === selectedVariantId,
  )
  const finalWorkspace = data.variants.find((v) => v.variant.id === data.selectedFinalVariantId)
  const currentRowsCommitted = hasCommittedRows(rows)
  const actionError =
    saveMutation.error ??
    patchMutation.error ??
    setFinalMutation.error ??
    createVariantMutation.error ??
    claimsMutation.error ??
    briefMutation.error ??
    renameMutation.error ??
    macerationMutation.error ??
    pyramidMutation.error
  const writingFormula =
    saveMutation.isPending || patchMutation.isPending || setFinalMutation.isPending

  return (
    <AppShell
      title={data.product.name}
      wide
      breadcrumbAction={
        <div className="flex items-center">
          {isProductArchived(data.product) ? null : (
            <PinButton
              className="shrink-0"
              pinned={isProductPinned(data.product)}
              onToggle={() =>
                pinMutation.mutate({
                  productId: data.product.id,
                  pinned: !isProductPinned(data.product),
                })
              }
            />
          )}
          <ProductActionsMenu product={data.product} />
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <PageHeader
          className="mb-0"
          title={
            <ProductNameInput
              name={data.product.name}
              saving={renameMutation.isPending}
              onSave={(name) => renameMutation.mutate(name)}
            />
          }
        />

        <ProductArchivedNotice product={data.product} />

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('workspace.actionFailed')}</AlertTitle>
            <AlertDescription>
              {t(
                actionError instanceof ApiError && actionError.code === 'formula_conflict'
                  ? 'workspace.formulaConflict'
                  : 'common.saveFailed',
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={tab} onValueChange={(value) => value && setTab(String(value))}>
          <TabsList variant="line">
            <TabsTrigger value="workspace">{t('workspace.tabs.workspace')}</TabsTrigger>
            <TabsTrigger value="regulatory">{t('workspace.tabs.regulatory')}</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="pt-4">
            <div className="flex min-w-0 flex-col gap-4">
              <WorkspaceBrief
                key={data.product.id + selectedVariantId}
                hasFormula={hasCommittedRows(selected?.rows ?? [])}
                brief={data.product.brief}
                saving={briefMutation.isPending}
                onSave={(brief) => briefMutation.mutate(brief)}
                claims={data.product.claims ?? []}
                onSaveClaims={(claims) => claimsMutation.mutate(claims)}
                claimsSaving={claimsMutation.isPending}
              />
              <Separator />
              {dirty ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <p>{t('workspace.unsavedDraft')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={writingFormula}
                    onClick={() => setDiscardVariantId(selectedVariantId)}
                  >
                    {t('workspace.discardDraft')}
                  </Button>
                </div>
              ) : null}
              {selectedVariantId ? (
                <WorkspaceFormula
                  product={data.product}
                  variants={data.variants}
                  selectedVariantId={selectedVariantId}
                  onSelectVariant={selectVariant}
                  rows={rows}
                  onRowsChange={setRows}
                  onSave={() => commitFormula()}
                  saving={writingFormula}
                  pendingPatches={pendingPatches}
                  onAcceptPatch={(patchId) => {
                    if (!dirty && !writingFormula)
                      patchMutation.mutate({ patchId, action: 'accepted' })
                  }}
                  patchPending={writingFormula}
                  hasDraft={dirty}
                  hasChanges={dirty && JSON.stringify(rows) !== JSON.stringify(selected?.rows ?? [])}
                  onRejectPatch={(patchId) => {
                    if (!writingFormula) patchMutation.mutate({ patchId, action: 'rejected' })
                  }}
                  onCreateVariant={() => createVariantMutation.mutate(undefined)}
                  onDuplicateVariant={() => createVariantMutation.mutate(selectedVariantId)}
                  onSetFinal={handleSetFinal}
                  setFinalSaving={writingFormula}
                  onMacerationSave={(input) => macerationMutation.mutate(input)}
                  macerationSaving={macerationMutation.isPending}
                  onSavePyramid={(pyramid) => pyramidMutation.mutate(pyramid)}
                  pyramidSaving={pyramidMutation.isPending}
                />
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="regulatory" className="pt-6">
            {finalWorkspace ? (
              <WorkspaceRegulatory variant={finalWorkspace} checks={data.checks} />
            ) : (
              <EmptyState
                title={t('workspace.final.lockedTitle')}
                description={t('workspace.final.lockedDescription')}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleGenerateFinal}
                      disabled={!currentRowsCommitted || writingFormula}
                    >
                      {setFinalMutation.isPending
                        ? t('workspace.final.generating')
                        : t('workspace.final.generateCta')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTab('workspace')}>
                      {t('workspace.final.editFormula')}
                    </Button>
                  </div>
                  {!currentRowsCommitted ? (
                    <p className="text-xs text-muted-foreground">
                      {t('workspace.final.needCommit')}
                    </p>
                  ) : null}
                </div>
              </EmptyState>
            )}
          </TabsContent>
        </Tabs>
        <Dialog
          open={discardVariantId !== null}
          onOpenChange={(open) => {
            if (!open) setDiscardVariantId(null)
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('workspace.discardDraft')}</DialogTitle>
              <DialogDescription>{t('workspace.confirmDiscard')}</DialogDescription>
            </DialogHeader>
            <Button
              onClick={() => {
                if (discardVariantId) discard(discardVariantId)
                setDiscardVariantId(null)
                saveMutation.reset()
                patchMutation.reset()
                void refetch()
              }}
            >
              {t('workspace.discardDraft')}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}

function ProductNameInput({
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
      maxLength={120}
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
      aria-label={t('workspace.rename')}
      className="-mx-1 w-full min-w-0 rounded-md bg-transparent px-1 py-0.5 font-[inherit] text-[inherit] leading-[inherit] tracking-[inherit] outline-none hover:bg-muted/50 focus:bg-muted/50 focus:ring-2 focus:ring-ring/40 disabled:opacity-70"
    />
  )
}
