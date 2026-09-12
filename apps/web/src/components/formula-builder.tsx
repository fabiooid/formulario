import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDownIcon, GripVerticalIcon, LockIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StockBadge } from '@/components/stock-badge'
import type { FormulaRow } from '@/lib/api'
import { api } from '@/lib/api'
import {
  collectPurchaseSuggestions,
  evaluateClaimHits,
  findInventoryMatch,
  formulaPercentTotal,
  isPercentBalanced,
  type ProductClaim,
} from '@atelier/domain'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import { cn } from '@/lib/utils'

export function FormulaBuilder({
  rows,
  onChange,
  onSave,
  saving,
  hasChanges,
  variantControls,
  claims = [],
}: {
  rows: FormulaRow[]
  onChange: (rows: FormulaRow[]) => void
  onSave: () => void
  saving?: boolean
  hasChanges: boolean
  variantControls?: ReactNode
  claims?: ProductClaim[]
}) {
  const { t } = useLanguage()
  const total = formulaPercentTotal(rows)
  const balanced = isPercentBalanced(rows)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const { data: inventoryData } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => api.listIngredients(),
  })
  const inventory = inventoryData?.ingredients ?? []
  const purchaseHints = collectPurchaseSuggestions(
    rows.filter((row) => row.inci.trim()).map((row) => ({ inci: row.inci, productName: 'formula' })),
    inventory,
    { includeUnused: false },
  )
  const claimHits = evaluateClaimHits({
    claims,
    rows: rows.filter((row) => row.inci.trim()),
    inventory,
  })
  const hasClaimBlock = claimHits.some((hit) => hit.severity === 'block')

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
        locked: false,
        sortOrder: rows.length,
      },
    ])
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id || row.locked))
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-normal">{t('formula.title')}</h2>
            {variantControls}
          </div>
          <p className="text-xs text-muted-foreground">{t('formula.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('font-mono text-sm tabular-nums', !balanced && 'text-amber-600')}>
            {t('formula.total', { percent: total })} {!balanced ? t('formula.totalWarn') : ''}
          </span>
          <Button variant="outline" size="sm" onClick={addRow}>
            <PlusIcon data-icon="inline-start" />
            {t('formula.addRow')}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || !hasChanges}>
            {saving ? t('formula.saving') : t('formula.commit')}
          </Button>
        </div>
      </div>

      {claimHits.length ? (
        <Alert variant={hasClaimBlock ? 'destructive' : 'default'}>
          <AlertTitle>
            {hasClaimBlock ? t('claims.formulaBlockTitle') : t('claims.formulaTitle')}
          </AlertTitle>
          <AlertDescription>
            <p>{t('claims.formulaDescription')}</p>
            <ul className="mt-2 list-disc pl-4">
              {claimHits.map((hit) => (
                <li key={`${hit.inci}-${hit.claim}-${hit.reason}`}>
                  {t(`claims.hit.${hit.reason}` as MessageKey, { inci: hit.inci })}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {inventoryData && purchaseHints.length ? (
        <Collapsible>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <CollapsibleTrigger className="group flex min-h-8 items-center gap-1.5 rounded-md text-left text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              <ChevronDownIcon className="size-3.5 shrink-0 transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none" />
              {t(purchaseHints.length === 1 ? 'formula.purchaseCountOne' : 'formula.purchaseCount', { count: purchaseHints.length })}
            </CollapsibleTrigger>
            <Link to="/ingredients" className="inline-flex min-h-8 items-center rounded-md font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              {t('formula.openInventory')}
            </Link>
          </div>
          <CollapsibleContent>
            <ul className="flex flex-col divide-y divide-border pt-1 text-sm">
              {purchaseHints.map((hint) => (
                <li key={hint.inci} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-words">{hint.inci}</span>
                  <StockBadge status={hint.reason} />
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
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
              <TableHead className="w-20 border-r border-border text-center text-xs tracking-wide text-muted-foreground uppercase">
                {t('formula.lock')}
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDragOverId(row.id)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const sourceId = event.dataTransfer.getData('text/plain') || draggingId
                  if (sourceId) moveRow(sourceId, row.id)
                  setDraggingId(null)
                  setDragOverId(null)
                }}
                className={`h-12 hover:bg-muted/30 ${
                  draggingId === row.id ? 'opacity-40' : ''
                } ${dragOverId === row.id && draggingId !== row.id ? 'bg-muted/60' : ''}`}
              >
                <TableCell className="border-r border-border bg-muted/20 p-0 text-muted-foreground">
                  <div className="flex h-12 items-center justify-center gap-1">
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
                    <span className="font-mono text-xs">{index + 1}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal border-r border-border p-0">
                  <div className="flex h-12 items-center gap-2 pr-2">
                    {row.locked ? (
                      <LockIcon className="ml-3 size-3 shrink-0 text-muted-foreground" />
                    ) : null}
                    <Input
                      className="h-12 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:bg-background focus-visible:ring-0 dark:bg-transparent"
                      value={row.inci}
                      list="inventory-incis"
                      onChange={(e) => updateRow(row.id, { inci: e.target.value })}
                      disabled={row.locked}
                    />
                    {row.inci.trim() ? (
                      <StockBadge
                        status={
                          findInventoryMatch(row.inci, inventory)?.stockStatus ?? 'missing'
                        }
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="border-r border-border p-0">
                  <Input
                    className="h-12 rounded-none border-0 bg-transparent px-3 text-right font-mono tabular-nums shadow-none focus-visible:bg-background focus-visible:ring-0 dark:bg-transparent"
                    type="number"
                    step="0.01"
                    value={row.percent}
                    onChange={(e) => updateRow(row.id, { percent: Number(e.target.value) })}
                    disabled={row.locked}
                  />
                </TableCell>
                <TableCell className="border-r border-border text-center">
                  <Switch
                    checked={row.locked}
                    onCheckedChange={(checked) => updateRow(row.id, { locked: checked })}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRow(row.id)}
                    disabled={row.locked}
                  >
                    <Trash2Icon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <datalist id="inventory-incis">
          {inventory.map((ingredient) => (
            <option key={ingredient.id} value={ingredient.inci}>
              {ingredient.tradeName ? `${ingredient.inci} · ${ingredient.tradeName}` : ingredient.inci}
            </option>
          ))}
        </datalist>
      </div>
    </div>
  )
}
