import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout'
import { EmptyState } from '@/components/empty-state'
import { StockBadge } from '@/components/stock-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/i18n/language-provider'
import { api, type Supplier, type SupplierInput } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatEur } from '@/lib/format'
import type { IngredientStockStatus } from '@formulario/domain'

const emptyForm: SupplierInput = {
  name: '',
  website: '',
  notes: '',
  contactEmail: '',
}

function toForm(supplier?: Supplier | null): SupplierInput {
  if (!supplier) return emptyForm
  return {
    name: supplier.name,
    website: supplier.website ?? '',
    notes: supplier.notes ?? '',
    contactEmail: supplier.contactEmail ?? '',
  }
}

function hrefFor(url?: string | null) {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function SuppliersPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.listSuppliers(),
    enabled: !!user,
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      editing ? api.updateSupplier(editing.id, form) : api.createSupplier(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      closeForm()
    },
    onError: (error: Error) => {
      setFormError(
        error.message.toLowerCase().includes('already')
          ? t('suppliers.alreadyExists')
          : error.message,
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (supplierId: string) => api.deleteSupplier(supplierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      setDeleting(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier)
    setForm(toForm(supplier))
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

  const suppliers = data?.suppliers ?? []

  return (
    <AppShell title={t('nav.suppliers')}>
      <PageHeader
        title={t('suppliers.title')}
        description={t('suppliers.subtitle')}
        actions={
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            {t('suppliers.add')}
          </Button>
        }
      />

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('suppliers.dialogEdit') : t('suppliers.dialogCreate')}
            </DialogTitle>
            <DialogDescription>{t('suppliers.dialogHint')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('suppliers.name')}</FieldLabel>
              <Input
                value={form.name}
                maxLength={120}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t('suppliers.namePlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('suppliers.website')}</FieldLabel>
              <Input
                value={form.website ?? ''}
                maxLength={500}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                placeholder={t('suppliers.websitePlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('suppliers.contactEmail')}</FieldLabel>
              <Input
                type="email"
                value={form.contactEmail ?? ''}
                maxLength={200}
                onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                placeholder={t('suppliers.contactEmailPlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('suppliers.notes')}</FieldLabel>
              <Textarea
                value={form.notes ?? ''}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder={t('suppliers.notesPlaceholder')}
                rows={3}
              />
            </Field>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              {t('suppliers.cancel')}
            </Button>
            <Button
              disabled={!form.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? t('suppliers.saving') : t('suppliers.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('suppliers.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('suppliers.deleteDescription', { name: deleting?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('suppliers.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {t('suppliers.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('suppliers.loading')}</p>
      ) : !suppliers.length ? (
        <EmptyState
          title={t('suppliers.emptyTitle')}
          description={t('suppliers.emptyDescription')}
        >
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            {t('suppliers.add')}
          </Button>
        </EmptyState>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {suppliers.map((supplier) => {
            const website = hrefFor(supplier.website)
            return (
              <Card key={supplier.id} className="min-w-0">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-col gap-1">
                    <CardTitle className="truncate">{supplier.name}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {website ? (
                        <a
                          href={website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                        >
                          {supplier.website}
                          <ExternalLinkIcon className="size-3.5" />
                        </a>
                      ) : (
                        <span>{t('suppliers.noWebsite')}</span>
                      )}
                      {supplier.contactEmail ? (
                        <a
                          href={`mailto:${supplier.contactEmail}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {supplier.contactEmail}
                        </a>
                      ) : null}
                    </CardDescription>
                    {supplier.notes ? (
                      <p className="text-sm text-muted-foreground">{supplier.notes}</p>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" />}
                      aria-label={t('suppliers.actionsFor', { name: supplier.name })}
                    >
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(supplier)}>
                        <PencilIcon />
                        {t('suppliers.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleting(supplier)}>
                        <Trash2Icon />
                        {t('suppliers.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  {!supplier.ingredients.length ? (
                    <p className="text-sm text-muted-foreground">{t('suppliers.noIngredients')}</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border">
                      {supplier.ingredients.map((item) => {
                        const productUrl = hrefFor(item.supplierProductUrl)
                        return (
                          <div
                            key={item.id}
                            className="flex min-w-0 flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 flex flex-col gap-1">
                              <p className="min-w-0 break-words font-medium tracking-tight">
                                {item.inci}
                              </p>
                              {item.tradeName ? (
                                <p className="text-sm text-muted-foreground">{item.tradeName}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {item.pricePerKg != null ? (
                                <p className="font-mono text-sm tabular-nums tracking-tight">
                                  {formatEur(item.pricePerKg, language)}
                                  <span className="ml-1 font-sans text-muted-foreground">
                                    {t('ingredients.priceUnit')}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">{t('home.purchase.noPrice')}</p>
                              )}
                              <StockBadge status={item.stockStatus as IngredientStockStatus} />
                              {productUrl ? (
                                <a
                                  href={productUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-4 hover:underline"
                                >
                                  {t('suppliers.productLink')}
                                  <ExternalLinkIcon className="size-3.5" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="mt-3">
                    <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/ingredients" />}>
                      {t('suppliers.linkFromIngredients')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
