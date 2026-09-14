import { useEffect, useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useLanguage } from '@/i18n/language-provider'

export function WorkspaceBrief({
  brief,
  hasFormula,
  saving,
  onSave,
}: {
  brief: string
  hasFormula: boolean
  saving?: boolean
  onSave: (brief: string) => void
}) {
  const { t } = useLanguage()
  const [value, setValue] = useState(brief)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setValue(brief)
  }, [brief])

  function commit() {
    const next = value.trim()
    if (!next) {
      setValue(brief)
      return
    }
    if (next !== brief) onSave(next)
  }

  return (
    <Collapsible open={!hasFormula || expanded} onOpenChange={setExpanded}>
      <h2>
        <CollapsibleTrigger
          disabled={!hasFormula}
          className="group flex w-full items-center gap-2 rounded-md py-1 text-left text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"
        >
          {t('workspace.brief.title')}
          {hasFormula ? (
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none" />
          ) : null}
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>
        <p className="mt-1 text-sm text-muted-foreground">{t('workspace.brief.description')}</p>
        <FieldGroup className="mt-3 gap-3">
          <Field>
            <FieldLabel htmlFor="product-brief" className="sr-only">
              {t('workspace.brief.title')}
            </FieldLabel>
            <Textarea
              id="product-brief"
              value={value}
              rows={4}
              disabled={saving}
              placeholder={t('workspace.brief.placeholder')}
              onChange={(event) => setValue(event.target.value)}
              onBlur={commit}
            />
          </Field>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
