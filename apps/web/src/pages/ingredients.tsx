import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout'
import { EmptyState } from '@/components/empty-state'
import { StockBadge } from '@/components/stock-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import { api, type IngredientInput, type InventoryIngredient } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatEur, formatGrams } from '@/lib/format'
import type {
  IngredientCategory,
  IngredientOriginType,
  IngredientStockStatus,
  TriStateFlag,
} from '@formulario/domain'

const CATEGORIES: IngredientCategory[] = [
  'solvent',
  'emollient',
  'fragrance',
  'preservative',
  'antioxidant',
  'carrier',
  'active',
  'other',
]

const STOCK_STATUSES: IngredientStockStatus[] = ['in_house', 'low', 'to_buy']
const TRI_STATES: TriStateFlag[] = ['yes', 'no', 'unknown']
const ORIGIN_TYPES: IngredientOriginType[] = ['natural', 'synthetic', 'unknown']

type StockFilter = 'all' | IngredientStockStatus

const emptyForm: IngredientInput = {
  inci: '',
  tradeName: '',
  cas: '',
  category: 'other',
  stockStatus: 'in_house',
  animalDerived: 'unknown',
  originType: 'unknown',
  organicCertified: 'unknown',
  pricePerKg: null,
  onHandGrams: null,
  notes: '',
}

function toForm(ingredient?: InventoryIngredient | null): IngredientInput {
  if (!ingredient) return emptyForm
  return {
    inci: ingredient.inci,
    tradeName: ingredient.tradeName ?? '',
    cas: ingredient.cas ?? '',
    category: ingredient.category,
    stockStatus: ingredient.stockStatus,
    animalDerived: ingredient.animalDerived ?? 'unknown',
    originType: ingredient.originType ?? 'unknown',
    organicCertified: ingredient.organicCertified ?? 'unknown',
    pricePerKg: ingredient.pricePerKg ?? null,
    onHandGrams: ingredient.onHandGrams ?? null,
    notes: ingredient.notes ?? '',
  }
}

export function IngredientsPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryIngredient | null>(null)
  const [form, setForm] = useState<IngredientInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<InventoryIngredient | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => api.listIngredients(),
    enabled: !!user,
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? api.updateIngredient(editing.id, form)
        : api.createIngredient(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      closeForm()
    },
    onError: (error: Error) => {
      setFormError(
        error.message.toLowerCase().includes('already')
          ? t('ingredients.alreadyExists')
          : error.message,
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (ingredientId: string) => api.deleteIngredient(ingredientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      setDeleting(null)
    },
  })

  const ingredients = useMemo(() => data?.ingredients ?? [], [data])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return ingredients.filter((item) => {
      if (stockFilter !== 'all' && item.stockStatus !== stockFilter) return false
      if (!query) return true
      return (
        item.inci.toLowerCase().includes(query) ||
        (item.tradeName ?? '').toLowerCase().includes(query) ||
        (item.cas ?? '').toLowerCase().includes(query)
      )
    })
  }, [ingredients, search, stockFilter])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(ingredient: InventoryIngredient) {
    setEditing(ingredient)
    setForm(toForm(ingredient))
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <AppShell title={t('nav.ingredients')} wide>
      <PageHeader
        title={t('ingredients.title')}
        description={t('ingredients.subtitle')}
        actions={
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            {t('ingredients.add')}
          </Button>
        }
      />

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 bg-background">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('ingredients.dialogEdit') : t('ingredients.dialogCreate')}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('ingredients.inci')}</FieldLabel>
              <Input
                value={form.inci}
                maxLength={120}
                onChange={(event) => setForm({ ...form, inci: event.target.value })}
                placeholder="Squalane"
              />
            </Field>
            <Field>
              <FieldLabel>{t('ingredients.tradeName')}</FieldLabel>
              <Input
                value={form.tradeName ?? ''}
                maxLength={120}
                onChange={(event) => setForm({ ...form, tradeName: event.target.value })}
                placeholder={t('ingredients.tradeNamePlaceholder')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t('ingredients.category')}</FieldLabel>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    value && setForm({ ...form, category: value as IngredientCategory })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`ingredients.categories.${form.category}` as MessageKey)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {t(`ingredients.categories.${category}` as MessageKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('ingredients.stock')}</FieldLabel>
                <Select
                  value={form.stockStatus}
                  onValueChange={(value) =>
                    value && setForm({ ...form, stockStatus: value as IngredientStockStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`ingredients.stockStatus.${form.stockStatus}` as MessageKey)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`ingredients.stockStatus.${status}` as MessageKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t('ingredients.pricePerKg')}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="font-mono tabular-nums"
                    value={form.pricePerKg ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      const next = Number(raw)
                      setForm({
                        ...form,
                        pricePerKg: raw === '' || !Number.isFinite(next) ? null : next,
                      })
                    }}
                    placeholder={t('ingredients.pricePlaceholder')}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">{t('ingredients.priceUnit')}</span>
                </div>
                <FieldDescription>{t('ingredients.priceHint')}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{t('ingredients.onHand')}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    className="font-mono tabular-nums"
                    value={form.onHandGrams ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      const next = Number(raw)
                      setForm({
                        ...form,
                        onHandGrams: raw === '' || !Number.isFinite(next) ? null : next,
                      })
                    }}
                    placeholder={t('ingredients.onHandPlaceholder')}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">{t('ingredients.onHandUnit')}</span>
                </div>
                <FieldDescription>{t('ingredients.onHandHint')}</FieldDescription>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>{t('ingredients.animalDerived')}</FieldLabel>
                <Select
                  value={form.animalDerived}
                  onValueChange={(value) =>
                    value && setForm({ ...form, animalDerived: value as TriStateFlag })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`ingredients.flags.${form.animalDerived}` as MessageKey)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TRI_STATES.map((flag) => (
                      <SelectItem key={flag} value={flag}>
                        {t(`ingredients.flags.${flag}` as MessageKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('ingredients.originType')}</FieldLabel>
                <Select
                  value={form.originType}
                  onValueChange={(value) =>
                    value && setForm({ ...form, originType: value as IngredientOriginType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`ingredients.origin.${form.originType}` as MessageKey)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGIN_TYPES.map((origin) => (
                      <SelectItem key={origin} value={origin}>
                        {t(`ingredients.origin.${origin}` as MessageKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('ingredients.organicCertified')}</FieldLabel>
                <Select
                  value={form.organicCertified}
                  onValueChange={(value) =>
                    value && setForm({ ...form, organicCertified: value as TriStateFlag })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {t(`ingredients.flags.${form.organicCertified}` as MessageKey)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TRI_STATES.map((flag) => (
                      <SelectItem key={flag} value={flag}>
                        {t(`ingredients.flags.${flag}` as MessageKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <FieldDescription>{t('ingredients.flagsHint')}</FieldDescription>
            <Field>
              <FieldLabel>{t('ingredients.cas')}</FieldLabel>
              <Input
                value={form.cas ?? ''}
                maxLength={40}
                onChange={(event) => setForm({ ...form, cas: event.target.value })}
                placeholder={t('ingredients.casPlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('ingredients.notes')}</FieldLabel>
              <Textarea
                value={form.notes ?? ''}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder={t('ingredients.notesPlaceholder')}
                rows={3}
              />
            </Field>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.inci.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? t('ingredients.saving') : t('ingredients.save')}
            </Button>
          </FieldGroup>
        </DialogContent>
      </Dialog>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('ingredients.searchPlaceholder')}
          aria-label={t('ingredients.search')}
          className="max-w-sm"
        />
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[stockFilter]}
          onValueChange={(next) => {
            const value = next[0]
            if (value === 'all' || value === 'in_house' || value === 'low' || value === 'to_buy') {
              setStockFilter(value)
            }
          }}
          aria-label={t('ingredients.filterGroup')}
        >
          <ToggleGroupItem value="all">{t('ingredients.filterAll')}</ToggleGroupItem>
          {STOCK_STATUSES.map((status) => (
            <ToggleGroupItem key={status} value={status}>
              {t(`ingredients.stockStatus.${status}` as MessageKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('ingredients.loading')}</p>
      ) : !ingredients.length ? (
        <EmptyState title={t('ingredients.emptyTitle')} description={t('ingredients.emptyDescription')} />
      ) : !filtered.length ? (
        <EmptyState
          title={t('ingredients.emptyFilterTitle')}
          description={t('ingredients.emptyFilterDescription')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft">
          <Table className="table-fixed">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('ingredients.inci')}</TableHead>
                <TableHead className="hidden w-32 sm:table-cell">{t('ingredients.price')}</TableHead>
                <TableHead className="hidden w-28 md:table-cell">{t('ingredients.onHand')}</TableHead>
                <TableHead className="w-24 sm:w-28">{t('ingredients.stock')}</TableHead>
                <TableHead className="w-12"><span className="sr-only">{t('ingredients.actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ingredient) => (
                <TableRow key={ingredient.id}>
                  <TableCell className="whitespace-normal">
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <p className="font-mono font-medium">{ingredient.inci}</p>
                      {ingredient.tradeName ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">{ingredient.tradeName}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {ingredient.pricePerKg != null ? (
                      <p className="font-mono tabular-nums tracking-tight">
                        {formatEur(ingredient.pricePerKg, language)}
                        <span className="ml-1 font-sans text-muted-foreground">{t('ingredients.priceUnit')}</span>
                      </p>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden font-mono tabular-nums md:table-cell">
                    {ingredient.onHandGrams != null ? (
                      formatGrams(ingredient.onHandGrams, language)
                    ) : (
                      <span className="font-sans text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StockBadge status={ingredient.stockStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                        aria-label={t('ingredients.actionsFor', { name: ingredient.inci })}
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEdit(ingredient)}>
                          <PencilIcon />
                          {t('ingredients.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(ingredient)}>
                          <Trash2Icon />
                          {t('ingredients.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="border-border/80 bg-background">
          <DialogHeader>
            <DialogTitle>{t('ingredients.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('ingredients.deleteDescription', { name: deleting?.inci ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('ingredients.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
            >
              {t('ingredients.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
