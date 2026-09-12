import { ChevronDownIcon } from 'lucide-react'
import { InciPreview } from '@/components/inci-preview'
import { StatusBadge } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EmptyState } from '@/components/empty-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OFFICIAL_LINKS, type RegulatoryCheck, type RegulatoryHit, type VariantWorkspace } from '@/lib/api'
import { useLanguage } from '@/i18n/language-provider'

export function WorkspaceRegulatory({
  variant,
  checks,
  pif,
}: {
  variant: VariantWorkspace
  checks: RegulatoryCheck[]
  pif: { markdown: string; generatedAt: string } | null
}) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-8">
      <InciPreview
        rows={variant.rows}
        preview={false}
        trailing={<Badge variant="secondary">{variant.variant.label}</Badge>}
      />

      <Tabs defaultValue="markets">
        <TabsList variant="line">
          <TabsTrigger value="markets">{t('workspace.tabMarkets')}</TabsTrigger>
          <TabsTrigger value="pif">{t('workspace.tabPif')}</TabsTrigger>
          <TabsTrigger value="refs">{t('workspace.tabRefs')}</TabsTrigger>
        </TabsList>
        <TabsContent value="markets" className="pt-4">
          <div className="flex flex-col">
            {checks.map((check, index) => (
              <div key={check.market}>
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-col gap-2 py-4 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-medium">{check.market}</h3>
                    <StatusBadge status={check.status} />
                  </div>
                  <MarketFindings hits={check.hits} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="pif" className="pt-4">
          {pif ? (
            <ScrollArea className="h-[420px]">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {pif.markdown}
              </div>
            </ScrollArea>
          ) : (
            <EmptyState title={t('workspace.noPifTitle')} description={t('workspace.noPifDescription')} />
          )}
        </TabsContent>
        <TabsContent value="refs" className="pt-4">
          <div className="flex flex-col gap-2">
            {OFFICIAL_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline"
              >
                {link.label}
              </a>
            ))}
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">{t('workspace.refsNote')}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}


const detailTriggerClass = 'group inline-flex min-h-8 items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'
const chevronClass = 'size-3.5 shrink-0 transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none'

function FindingSource({ hit }: { hit: RegulatoryHit }) {
  return (
    <a href={hit.citationUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-4">
      {hit.instrument}
    </a>
  )
}

function MarketFindings({ hits }: { hits: RegulatoryHit[] }) {
  const { t } = useLanguage()
  // The current API encodes unknown coverage as a relabel hit with this instrument.
  // Do not group genuine labelling requirements with unknown coverage.
  const unknown = hits.filter((hit) => hit.instrument === 'Seed rules (unknown)')
  const findings = hits.filter((hit) => hit.instrument !== 'Seed rules (unknown)')
    .sort((a, b) => {
      const rank = (hit: RegulatoryHit) => hit.effect === 'cannot_sell' ? 0 : hit.effect === 'reduce_percent' ? 1 : 2
      return rank(a) - rank(b)
    })
  const sources = unknown.filter((hit, index) =>
    unknown.findIndex((other) => other.citationUrl === hit.citationUrl && other.instrument === hit.instrument) === index,
  )

  if (!hits.length) return <p className="text-sm text-muted-foreground">{t('workspace.noHits')}</p>

  return (
    <div className="flex flex-col divide-y divide-border">
      {findings.map((hit, index) => {
        const blocking = hit.effect === 'cannot_sell' || hit.effect === 'reduce_percent'
        const action = hit.effect === 'cannot_sell' ? 'workspace.findings.banned'
          : hit.effect === 'reduce_percent' ? 'workspace.findings.reduce'
          : hit.effect === 'inci_wording' ? 'workspace.findings.wording'
          : 'workspace.findings.labelling'
        return (
          <div key={index} className="flex flex-col gap-1 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="min-w-0 break-words font-mono text-sm font-medium">{hit.inci}</h4>
              <Badge variant={hit.effect === 'cannot_sell' ? 'destructive' : 'secondary'}>{t(action)}</Badge>
            </div>
            {blocking ? <p className="text-sm">{hit.message}</p> : null}
            <Collapsible>
              <CollapsibleTrigger className={detailTriggerClass}>
                <ChevronDownIcon className={chevronClass} />
                {t(blocking ? 'workspace.findings.source' : 'workspace.findings.details')}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col items-start gap-2 pb-1">
                  {!blocking ? <p className="text-sm">{hit.message}</p> : null}
                  {hit.limit ? <p className="font-mono text-xs">{hit.limit}</p> : null}
                  <FindingSource hit={hit} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )
      })}
      {unknown.length ? (
        <Collapsible className="py-3">
          <CollapsibleTrigger className={detailTriggerClass}>
            <ChevronDownIcon className={chevronClass} />
            {t(unknown.length === 1 ? 'workspace.findings.unknownOne' : 'workspace.findings.unknownMany', { count: unknown.length })}
            <StatusBadge status="unknown" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col items-start gap-2 pt-2">
              <p className="text-sm text-muted-foreground">{t('workspace.findings.unknownDescription')}</p>
              <ul className="flex flex-col gap-1 font-mono text-sm">
                {unknown.map((hit, index) => <li key={index} className="break-words">{hit.inci}</li>)}
              </ul>
              {sources.map((hit, index) => <FindingSource key={index} hit={hit} />)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}
