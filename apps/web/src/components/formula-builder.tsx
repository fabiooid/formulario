import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { GripVerticalIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StockBadge } from '@/components/stock-badge'
import type { FormulaRow } from '@/lib/api'
import { api } from '@/lib/api'
import {
  evaluateClaimHits,
  findInventoryMatch,
  formulaPercentTotal,
  isPercentBalanced,
  normalizeInci,
  type ClaimHit,
  type ProductClaim,
} from '@formulario/domain'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import { cn } from '@/lib/utils'

export function FormulaBuilder({
  rows,
  onChange,
  autosaving,
  variantControls,
  claims = [],
  proposal,
}: {
  rows: FormulaRow[]
  onChange: (rows: FormulaRow[]) => void
  autosaving?: boolean
  variantControls?: ReactNode
  claims?: ProductClaim[]
  /** When set, the table shows a read-only proposed formula with accept/reject. */
  proposal?: {
    stale?: boolean
    pending?: boolean
    onAccept: () => void
    onReject: () => void
  }
}) {
  const { t } = useLanguage()
  const readOnly = !!proposal
  const total = formulaPercentTotal(rows)
  const balanced = isPercentBalanced(rows)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const { data: inventoryData } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => api.listIngredients(),
  })
  const inventory = inventoryData?.ingredients ?? []
  const claimHits = evaluateClaimHits({
    claims,
    rows: rows.filter((row) => row.inci.trim()),
    inventory,
  })
  const claimHitsByInci = new Map<string, ClaimHit[]>()
  for (const hit of claimHits) {
    const key = normalizeInci(hit.inci)
    if (!key) continue
    const list = claimHitsByInci.get(key) ?? []
    list.push(hit)
    claimHitsByInci.set(key, list)
  }

  function updateRow(id: string, patch: Partial<FormulaRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addRow() {
    onChange([
      ...rows,
      {
        id: crypto.randomUUID(),
        inci: '',
        function: '',
        phase: 'A',
        percent: 0,
        sortOrder: rows.length,
      },
    ])
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id))
  }

  function moveRow(sourceId: string, targetId: string) {
    if (sourceId === targetId) return

    const sourceIndex = rows.findIndex((row) => row.id === sourceId)
    const targetIndex = rows.findIndex((row) => row.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const nextRows = [...rows]
    const [movedRow] = nextRows.splice(sourceIndex, 1)
    nextRows.splice(targetIndex, 0, movedRow)
    onChange(nextRows.map((row, index) => ({ ...row, sortOrder: index })))
  }

  return (
    <TooltipProvider delay={200}>
      <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {variantControls}
          {proposal ? (
            <p className="mt-1 text-xs text-muted-foreground">{t('formula.proposalSubtitle')}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('font-mono text-sm tabular-nums', !balanced && 'text-amber-600')}>
            {t('formula.total', { percent: total })} {!balanced ? t('formula.totalWarn') : ''}
          </span>
          {proposal ? (
            <>
              <Button
                size="sm"
                disabled={proposal.pending || proposal.stale}
                onClick={proposal.onAccept}
              >
                {t('workspace.accept')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={proposal.pending}
                onClick={proposal.onReject}
              >
                {t('workspace.reject')}
              </Button>
            </>
          ) : (
            <>
              {autosaving ? (
                <span className="text-xs text-muted-foreground">{t('formula.saving')}</span>
              ) : null}
              <Button variant="outline" size="sm" onClick={addRow} disabled={autosaving}>
                <PlusIcon data-icon="inline-start" />
                {t('formula.addRow')}
              </Button>
            </>
          )}
        </div>
      </div>

      {proposal?.stale ? (
        <p className="text-sm text-muted-foreground">{t('workspace.formulaConflict')}</p>
      ) : null}

      <div className="min-w-0 overflow-x-auto rounded-lg border border-border bg-card">
        <Table className="min-w-[36rem] table-fixed">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 border-r border-border text-center text-xs text-muted-foreground">
                #
              </TableHead>
              <TableHead className="border-r border-border text-xs tracking-wide text-muted-foreground uppercase">
                {t('formula.inci')}
              </TableHead>
              <TableHead className="w-28 border-r border-border text-right text-xs tracking-wide text-muted-foreground uppercase">
                {t('formula.percent')}
              </TableHead>
              {readOnly ? null : <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={readOnly ? 3 : 4}
                  className="h-12 px-3 text-sm text-muted-foreground"
                >
                  {t('formula.emptyProposal')}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row, index) => {
              const rowHits = row.inci.trim()
                ? (claimHitsByInci.get(normalizeInci(row.inci)) ?? [])
                : []
              const showWarning = rowHits.length > 0
              return (
              <TableRow
                key={row.id}
                onDragOver={
                  readOnly
                    ? undefined
                    : (event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                        setDragOverId(row.id)
                      }
                }
                onDrop={
                  readOnly
                    ? undefined
                    : (event) => {
                        event.preventDefault()
                        const sourceId = event.dataTransfer.getData('text/plain') || draggingId
                        if (sourceId) moveRow(sourceId, row.id)
                        setDraggingId(null)
                        setDragOverId(null)
                      }
                }
                className={cn(
                  'h-12',
                  readOnly ? 'bg-muted/20 hover:bg-muted/20' : 'hover:bg-muted/30',
                  !readOnly && draggingId === row.id ? 'opacity-40' : '',
                  !readOnly && dragOverId === row.id && draggingId !== row.id ? 'bg-muted/60' : '',
                )}
              >
                <TableCell className="border-r border-border bg-muted/20 p-0 text-muted-foreground">
                  <div className="flex h-12 items-center justify-center gap-1">
                    {readOnly ? null : (
                      <button
                        type="button"
                        draggable
                        aria-label={`Move ingredient ${index + 1}`}
                        className="cursor-grab touch-none rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                        onDragStart={(event) => {
                          setDraggingId(row.id)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', row.id)
                        }}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setDragOverId(null)
                        }}
                      >
                        <GripVerticalIcon className="size-3.5" />
                      </button>
                    )}
                    <span className="font-mono text-xs">{index + 1}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal border-r border-border p-0">
                  <div className="flex h-12 items-center gap-1 pr-2">
                    <div
                      className={cn(
                        'flex min-w-0 items-center gap-1',
                        showWarning ? 'shrink-0' : 'flex-1',
                      )}
                    >
                      {readOnly ? (
                        <span className="min-w-0 flex-1 truncate px-3 font-mono text-sm">
                          {row.inci || '—'}
                        </span>
                      ) : (
                        <Input
                          className={cn(
                            'h-12 min-w-0 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:bg-background focus-visible:ring-0 dark:bg-transparent',
                            showWarning
                              ? 'w-auto field-sizing-content flex-none pr-1'
                              : 'flex-1',
                          )}
                          value={row.inci}
                          list="inventory-incis"
                          onChange={(e) => updateRow(row.id, { inci: e.target.value })}
                        />
                      )}
                      {showWarning ? <ClaimRowWarning hits={rowHits} /> : null}
                    </div>
                    {row.inci.trim() ? (
                      <div className="ml-auto shrink-0">
                        <StockBadge
                          status={
                            findInventoryMatch(row.inci, inventory)?.stockStatus ?? 'missing'
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="border-r border-border p-0">
                  {readOnly ? (
                    <span className="flex h-12 items-center justify-end px-3 font-mono text-sm tabular-nums">
                      {row.percent}
                    </span>
                  ) : (
                    <Input
                      className="h-12 rounded-none border-0 bg-transparent px-3 text-right font-mono tabular-nums shadow-none focus-visible:bg-background focus-visible:ring-0 dark:bg-transparent"
                      type="number"
                      step="0.01"
                      value={row.percent}
                      onChange={(e) => updateRow(row.id, { percent: Number(e.target.value) })}
                    />
                  )}
                </TableCell>
                {readOnly ? null : (
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {readOnly ? null : (
          <datalist id="inventory-incis">
            {inventory.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.inci}>
                {ingredient.tradeName ? `${ingredient.inci} · ${ingredient.tradeName}` : ingredient.inci}
              </option>
            ))}
          </datalist>
        )}
      </div>
      </div>
    </TooltipProvider>
  )
}

function ClaimRowWarning({ hits }: { hits: ClaimHit[] }) {
  const { t } = useLanguage()
  if (!hits.length) return null

  const blocked = hits.some((hit) => hit.severity === 'block')
  const messages = hits.map((hit) => t(`claims.hit.${hit.reason}` as MessageKey, { inci: hit.inci }))

  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={t('claims.rowWarning')}
      >
        <TriangleAlertIcon className={cn('size-3.5', blocked && 'text-destructive')} />
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="text-left">
        {messages.length === 1 ? (
          messages[0]
        ) : (
          <ul className="space-y-1">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
