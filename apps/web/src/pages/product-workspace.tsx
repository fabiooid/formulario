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
import { api, type FormulaRow, type OlfactoryPyramid, type ProductSummary } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLanguage } from '@/i18n/language-provider'
import type { ProductClaim } from '@atelier/domain'

function hasCommittedRows(rows: FormulaRow[]) {
  return rows.some((row) => row.inci.trim())
}

export function ProductWorkspacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { setVariantId, ask, streaming } = useAgent()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [rows, setRows] = useState<FormulaRow[]>([])
  const [tab, setTab] = useState('workspace')

  const { data, isLoading } = useQuery({
    queryKey: ['workspace', id],
    queryFn: () => api.getWorkspace(id!),
    enabled: !!user && !!id,
  })

  useEffect(() => {
    setRows([])
    setSelectedVariantId(null)
  }, [id])

  useEffect(() => {
    if (!data) return
    const activeId = data.activeVariantId ?? data.variants[0]?.variant.id ?? null
    setSelectedVariantId(activeId)
    const activeVariant = data.variants.find((v) => v.variant.id === activeId)
    setRows(activeVariant?.rows ?? [])
  }, [data])

  useEffect(() => {
    setVariantId(selectedVariantId)
    return () => setVariantId(null)
  }, [selectedVariantId, setVariantId])

  const saveMutation = useMutation({
    mutationFn: () => api.saveFormula(id!, selectedVariantId!, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', id] })
    },
  })

  const patchMutation = useMutation({
    mutationFn: ({ patchId, action }: { patchId: string; action: 'accepted' | 'rejected' }) =>
      api.resolvePatch(id!, patchId, action),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      const active = result.workspace.variants.find(
        (v) => v.variant.id === selectedVariantId,
      )
      if (active) setRows(active.rows)
    },
  })

  const createVariantMutation = useMutation({
    mutationFn: (copyFromVariantId?: string) =>
      api.createVariant(id!, copyFromVariantId ? { copyFromVariantId } : {}),
    onSuccess: (result) => {
      queryClient.setQueryData(['workspace', id], result.workspace)
      setSelectedVariantId(result.variant.id)
      const created = result.workspace.variants.find((v) => v.variant.id === result.variant.id)
      setRows(created?.rows ?? [])
    },
  })

  const setFinalMutation = useMutation({
    mutationFn: () => api.setFinalVariant(id!, selectedVariantId!),
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
    const variant = data?.variants.find((v) => v.variant.id === variantId)
    setRows(variant?.rows ?? [])
  }

  function handleSetFinal() {
    saveMutation.mutate(undefined, {
      onSuccess: () => setFinalMutation.mutate(),
    })
  }

  function handleGenerateFinal() {
    if (!selectedVariantId) return
    setFinalMutation.mutate()
  }

  if (!user) return <Navigate to="/login" replace />
  if (isLoading || !data) {
    return (
      <AppShell title={t('workspace.product')}>
        <p className="text-sm text-muted-foreground">{t('workspace.loading')}</p>
      </AppShell>
    )
  }

  const pendingPatches = data.patches.filter((p) => p.status === 'pending')
  const finalWorkspace = data.variants.find((v) => v.variant.id === data.selectedFinalVariantId)
  const currentRowsCommitted = hasCommittedRows(rows)

  return (
    <AppShell
      title={data.product.name}
      wide
      breadcrumbAction={
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

        <Tabs value={tab} onValueChange={(value) => value && setTab(String(value))}>
          <TabsList variant="line">
            <TabsTrigger value="workspace">{t('workspace.tabs.workspace')}</TabsTrigger>
            <TabsTrigger value="regulatory">{t('workspace.tabs.regulatory')}</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="pt-6">
            <div className="flex min-w-0 flex-col gap-8">
              <WorkspaceBrief
                brief={data.product.brief}
                saving={briefMutation.isPending}
                generating={streaming}
                onSave={(brief) => briefMutation.mutate(brief)}
                onGenerate={(brief) =>
                  ask(t('workspace.brief.generateMessage', { brief }))
                }
              />
              <Separator />
              {selectedVariantId ? (
                <WorkspaceFormula
                  product={data.product}
                  variants={data.variants}
                  selectedVariantId={selectedVariantId}
                  onSelectVariant={selectVariant}
                  rows={rows}
                  onRowsChange={setRows}
                  onSave={() => saveMutation.mutate()}
                  saving={saveMutation.isPending}
                  pendingPatches={pendingPatches}
                  onAcceptPatch={(patchId) => patchMutation.mutate({ patchId, action: 'accepted' })}
                  onRejectPatch={(patchId) => patchMutation.mutate({ patchId, action: 'rejected' })}
                  onCreateVariant={() => createVariantMutation.mutate(undefined)}
                  onDuplicateVariant={() => createVariantMutation.mutate(selectedVariantId)}
                  onSetFinal={handleSetFinal}
                  setFinalSaving={saveMutation.isPending || setFinalMutation.isPending}
                  onMacerationSave={(input) => macerationMutation.mutate(input)}
                  macerationSaving={macerationMutation.isPending}
                  onSaveClaims={(claims) => claimsMutation.mutate(claims)}
                  claimsSaving={claimsMutation.isPending}
                  onSavePyramid={(pyramid) => pyramidMutation.mutate(pyramid)}
                  pyramidSaving={pyramidMutation.isPending}
                />
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="regulatory" className="pt-6">
            {finalWorkspace ? (
              <WorkspaceRegulatory
                variant={finalWorkspace}
                checks={data.checks}
                pif={data.pif}
              />
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
                      disabled={
                        !currentRowsCommitted ||
                        setFinalMutation.isPending
                      }
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
                    <p className="text-xs text-muted-foreground">{t('workspace.final.needCommit')}</p>
                  ) : null}
                </div>
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
