import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  type ProductSummary,
} from '@/lib/api'
import { formulaContentEquals } from '@/lib/formula-drafts'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'
import { versionDisplayLabel, type ProductClaim } from '@formulario/domain'

function hasIngredients(rows: FormulaRow[]) {
  return rows.some((row) => row.inci.trim())
}

export function ProductWorkspacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  if (!user || !id) return <Navigate to="/login" replace />
  return <ProductWorkspace id={id} />
}

function ProductWorkspace({ id }: { id: string }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { setVariantId, setVersionId } = useAgent()
  const versionFromUrl = searchParams.get('version')
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(versionFromUrl)
  const [tab, setTab] = useState('workspace')
  const [rows, setRows] = useState<FormulaRow[]>([])
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const saveFnRef = useRef<
    (input: { variantId: string; versionId: string; rows: FormulaRow[] }) => Promise<unknown>
  >(async () => undefined)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workspace', id],
    queryFn: () => api.getWorkspace(id!),
    enabled: !!user && !!id,
    refetchInterval: 10_000,
  })

  useEffect(() => {
    if (versionFromUrl) setSelectedVersionId(versionFromUrl)
  }, [versionFromUrl])

  const selectedVariantId = data?.activeVariantId ?? data?.variants[0]?.variant.id ?? null
  const selected = data?.variants.find((v) => v.variant.id === selectedVariantId)
  const resolvedVersionId =
    selectedVersionId && selected?.versions.some((version) => version.id === selectedVersionId)
      ? selectedVersionId
      : (selected?.versions.find((version) => version.isFinal)?.id ??
        selected?.version?.id ??
        selected?.versions[0]?.id ??
        null)
  const viewedVersion =
    selected?.versions.find((version) => version.id === resolvedVersionId) ?? null
  const viewedRef = useRef(viewedVersion)
  viewedRef.current = viewedVersion
  const variantRef = useRef(selectedVariantId)
  variantRef.current = selectedVariantId

  const saveMutation = useMutation({
    mutationFn: (input: { variantId: string; versionId: string; rows: FormulaRow[] }) =>
      api.saveFormula(id, input.variantId, input.versionId, input.rows),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
    },
  })
  saveFnRef.current = saveMutation.mutateAsync

  useEffect(() => {
    setRows(viewedVersion?.rows ?? [])
  }, [viewedVersion?.id])

  useEffect(() => {
    setVariantId(selectedVariantId)
    setVersionId(resolvedVersionId)
    return () => {
      setVariantId(null)
      setVersionId(null)
    }
  }, [selectedVariantId, resolvedVersionId, setVariantId, setVersionId])

  const flushSave = useCallback(async () => {
    const version = viewedRef.current
    const variantId = variantRef.current
    if (!version || !variantId) return
    const pending = rowsRef.current
    if (formulaContentEquals(pending, version.rows)) return
    await saveFnRef.current({ variantId, versionId: version.id, rows: pending })
  }, [])

  useEffect(() => {
    if (!viewedVersion || formulaContentEquals(rows, viewedVersion.rows)) return
    const timer = setTimeout(() => {
      void flushSave()
    }, 600)
    return () => clearTimeout(timer)
  }, [rows, viewedVersion?.id, flushSave])

  useEffect(() => {
    return () => {
      void flushSave()
    }
  }, [flushSave])

  const patchMutation = useMutation({
    mutationFn: ({ patchId, action }: { patchId: string; action: 'accepted' | 'rejected' }) =>
      api.resolvePatch(id!, patchId, action),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })

  const createVersionMutation = useMutation({
    mutationFn: async (input: { copyFromVersionId?: string | null }) => {
      if (!selectedVariantId) throw new Error('No version')
      await flushSave()
      return api.createFormulaVersion(id, selectedVariantId, input)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      setSelectedVersionId(result.versionId)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => api.deleteFormulaVersion(id, versionId),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      const next = result.workspace.variants.find((v) => v.variant.id === selectedVariantId)
      setSelectedVersionId(next?.version?.id ?? null)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })

  const setFinalVersionMutation = useMutation({
    mutationFn: (versionId: string) => api.setFinalVersion(id, versionId),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })

  const macerationMutation = useMutation({
    mutationFn: (input: {
      macerationStartedAt?: string | null
      macerationTargetAt?: string | null
      macerationNotes?: string | null
    }) => {
      if (!resolvedVersionId) throw new Error('No version selected')
      return api.updateVersion(id!, resolvedVersionId, input)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
    },
  })

  const renameVersionMutation = useMutation({
    mutationFn: (label: string) => {
      if (!resolvedVersionId) throw new Error('No version selected')
      return api.updateVersion(id!, resolvedVersionId, { label })
    },
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

  function selectVersion(versionId: string) {
    void flushSave().then(() => {
      setSelectedVersionId(versionId)
      const next = new URLSearchParams(searchParams)
      next.set('version', versionId)
      setSearchParams(next, { replace: true })
    })
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
    (p) =>
      p.status === 'pending' &&
      p.variantId === selectedVariantId &&
      p.baseVersionId === resolvedVersionId,
  )
  const finalVariantWorkspace = data.selectedFinalVersionId
    ? data.variants.find((v) =>
        v.versions.some((version) => version.id === data.selectedFinalVersionId),
      )
    : null
  const finalVersionWorkspace = finalVariantWorkspace?.versions.find(
    (v) => v.id === data.selectedFinalVersionId,
  )
  const rowsSynced =
    !!viewedVersion &&
    !saveMutation.isPending &&
    formulaContentEquals(rows, viewedVersion.rows)
  const actionError =
    saveMutation.error ??
    patchMutation.error ??
    createVersionMutation.error ??
    deleteVersionMutation.error ??
    setFinalVersionMutation.error ??
    claimsMutation.error ??
    briefMutation.error ??
    renameMutation.error ??
    renameVersionMutation.error ??
    macerationMutation.error
  const writingFormula =
    saveMutation.isPending ||
    patchMutation.isPending ||
    createVersionMutation.isPending ||
    deleteVersionMutation.isPending ||
    setFinalVersionMutation.isPending

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
                hasFormula={hasIngredients(viewedVersion?.rows ?? selected?.rows ?? [])}
                brief={data.product.brief}
                saving={briefMutation.isPending}
                onSave={(brief) => briefMutation.mutate(brief)}
                claims={data.product.claims ?? []}
                onSaveClaims={(claims) => claimsMutation.mutate(claims)}
                claimsSaving={claimsMutation.isPending}
              />
              <Separator />
              {selectedVariantId ? (
                <WorkspaceFormula
                  product={data.product}
                  variants={data.variants}
                  selectedVariantId={selectedVariantId}
                  selectedVersionId={resolvedVersionId}
                  onSelectVersion={selectVersion}
                  rows={rows}
                  onRowsChange={setRows}
                  autosaving={saveMutation.isPending}
                  rowsSynced={rowsSynced}
                  pendingPatches={pendingPatches}
                  onAcceptPatch={(patchId) => {
                    if (rowsSynced && !writingFormula)
                      patchMutation.mutate({ patchId, action: 'accepted' })
                  }}
                  patchPending={writingFormula}
                  onRejectPatch={(patchId) => {
                    if (!writingFormula) patchMutation.mutate({ patchId, action: 'rejected' })
                  }}
                  onCreateVersion={(copyFromVersionId) =>
                    createVersionMutation.mutate({ copyFromVersionId })
                  }
                  createVersionPending={createVersionMutation.isPending}
                  onDeleteVersion={(versionId) => deleteVersionMutation.mutate(versionId)}
                  deleteVersionPending={deleteVersionMutation.isPending}
                  onSetFinalVersion={(versionId) => setFinalVersionMutation.mutate(versionId)}
                  setFinalVersionPending={setFinalVersionMutation.isPending}
                  onMacerationSave={(input) => macerationMutation.mutate(input)}
                  macerationSaving={macerationMutation.isPending}
                  onRenameVersion={(label) => renameVersionMutation.mutate(label)}
                  renameVersionSaving={renameVersionMutation.isPending}
                />
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="regulatory" className="pt-6">
            {finalVariantWorkspace && finalVersionWorkspace ? (
              <WorkspaceRegulatory
                variant={{
                  ...finalVariantWorkspace,
                  rows: finalVersionWorkspace.rows,
                  version: finalVersionWorkspace,
                }}
                checks={data.checks}
              />
            ) : (
              <EmptyState
                title={t('workspace.final.lockedTitle')}
                description={
                  viewedVersion && hasIngredients(viewedVersion.rows)
                    ? t('workspace.final.lockedDescriptionNamed', {
                        version: versionDisplayLabel(viewedVersion),
                      })
                    : t('workspace.final.lockedDescription')
                }
              >
                {viewedVersion && hasIngredients(viewedVersion.rows) ? (
                  <Button
                    size="sm"
                    disabled={setFinalVersionMutation.isPending || !rowsSynced}
                    onClick={() => setFinalVersionMutation.mutate(viewedVersion.id)}
                  >
                    {t('workspace.versions.chooseFinal')}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setTab('workspace')}>
                    {t('workspace.final.editFormula')}
                  </Button>
                )}
              </EmptyState>
            )}
          </TabsContent>
        </Tabs>
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
