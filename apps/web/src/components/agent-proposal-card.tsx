import { FlaskConicalIcon, LayoutGridIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/language-provider'
import type { MessageKey } from '@/i18n/catalogs'
import type {
  AgentProposal,
  IngredientInput,
  InventoryProposalPayload,
  ProductProposalPayload,
} from '@/lib/api'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function inventoryPayload(proposal: AgentProposal): InventoryProposalPayload | null {
  if (proposal.kind !== 'inventory_create' && proposal.kind !== 'inventory_update') return null
  if (!isRecord(proposal.payload) || !isRecord(proposal.payload.ingredient)) return null
  return proposal.payload as unknown as InventoryProposalPayload
}

function productPayload(proposal: AgentProposal): ProductProposalPayload | null {
  if (proposal.kind !== 'product_create') return null
  if (!isRecord(proposal.payload) || typeof proposal.payload.name !== 'string') return null
  const formula = proposal.payload.formula
  return {
    ...(proposal.payload as unknown as ProductProposalPayload),
    formula: Array.isArray(formula) ? formula : undefined,
  }
}

function stockLine(ingredient: IngredientInput, t: (key: MessageKey) => string) {
  const statusKey = `ingredients.stockStatus.${ingredient.stockStatus}` as MessageKey
  const parts = [t(statusKey)]
  if (ingredient.onHandGrams != null) parts.push(`${ingredient.onHandGrams} g`)
  if (ingredient.pricePerKg != null) parts.push(`${ingredient.pricePerKg} €/kg`)
  return parts.join(' · ')
}

export function AgentProposalCard({
  proposal,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: {
  proposal: AgentProposal
  onAccept: () => void
  onReject: () => void
  accepting?: boolean
  rejecting?: boolean
}) {
  const { t } = useLanguage()
  const stock = inventoryPayload(proposal)
  const product = productPayload(proposal)
  const busy = Boolean(accepting || rejecting)

  const title =
    proposal.kind === 'inventory_create'
      ? t('agent.proposalAddStock')
      : proposal.kind === 'inventory_update'
        ? t('agent.proposalEditStock')
        : t('agent.proposalNewProduct')

  const name = stock?.ingredient.inci ?? product?.name ?? proposal.summary
  const description = stock
    ? stockLine(stock.ingredient, t)
    : product
      ? [
          t(`productType.${product.type}` as MessageKey),
          product.brief,
          product.formula?.length
            ? t('agent.proposalFormulaRows', { count: product.formula.length })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : proposal.summary

  return (
    <Attachment className="w-full max-w-full" state="done">
      <AttachmentMedia variant="icon">
        {proposal.kind === 'product_create' ? <LayoutGridIcon /> : <FlaskConicalIcon />}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{title}</AttachmentTitle>
        <AttachmentDescription>
          {name}
          {description ? ` · ${description}` : ''}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <Button size="sm" variant="outline" disabled={busy} onClick={onReject}>
          {rejecting ? t('agent.saving') : t('workspace.reject')}
        </Button>
        <Button size="sm" disabled={busy} onClick={onAccept}>
          {accepting
            ? t('agent.saving')
            : proposal.kind === 'product_create'
              ? t('agent.createProduct')
              : t('workspace.accept')}
        </Button>
      </AttachmentActions>
    </Attachment>
  )
}

export function AgentProposalLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
      {label}
    </Link>
  )
}
