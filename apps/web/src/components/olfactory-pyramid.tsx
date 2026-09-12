import { useState } from 'react'
import { ChevronDownIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/i18n/language-provider'
import type { OlfactoryPyramid } from '@/lib/api'

const NOTE_FAMILIES = {
  top: {
    citrus: ['Bergamot', 'Lemon', 'Mandarin'],
    fresh: ['Bergamot', 'Green leaves', 'Pink pepper'],
    fruity: ['Pear', 'Blackcurrant', 'Mandarin'],
    aromatic: ['Lavender', 'Bergamot', 'Juniper'],
    spicy: ['Pink pepper', 'Cardamom', 'Bergamot'],
  },
  heart: {
    floral: ['Jasmine', 'Rose', 'Orange blossom'],
    white: ['Jasmine', 'Tuberose', 'Orange blossom'],
    green: ['Violet leaf', 'Geranium', 'Tea'],
    spicy: ['Cardamom', 'Cinnamon', 'Geranium'],
    aromatic: ['Lavender', 'Clary sage', 'Geranium'],
    fruity: ['Fig', 'Peach', 'Jasmine'],
  },
  base: {
    woody: ['Cedarwood', 'Sandalwood', 'Vetiver'],
    amber: ['Amber', 'Labdanum', 'Benzoin'],
    musky: ['White musk', 'Ambrette', 'Cashmere wood'],
    gourmand: ['Vanilla', 'Tonka bean', 'Benzoin'],
    smoky: ['Incense', 'Guaiac wood', 'Vetiver'],
    earthy: ['Patchouli', 'Vetiver', 'Oakmoss'],
  },
} as const

function unique(values: string[]) {
  return [...new Set(values)].slice(0, 4)
}

function suggestNotes(direction: string): OlfactoryPyramid {
  const words = direction.toLowerCase()
  const pick = (level: keyof typeof NOTE_FAMILIES, fallback: string[]) => {
    const matches = Object.entries(NOTE_FAMILIES[level])
      .filter(([family]) => words.includes(family))
      .flatMap(([, notes]) => [...notes])
    return unique(matches.length ? matches : fallback)
  }

  return {
    direction,
    top: pick('top', ['Bergamot', 'Mandarin', 'Pink pepper']),
    heart: pick('heart', ['Jasmine', 'Geranium', 'Orange blossom']),
    base: pick('base', ['Cedarwood', 'White musk', 'Sandalwood']),
  }
}

function joinNotes(notes: string[]) {
  return notes.join(', ')
}

function splitNotes(value: string) {
  return value
    .split(',')
    .map((note) => note.trim())
    .filter(Boolean)
}

function emptyPyramid(direction: string): OlfactoryPyramid {
  return { direction, top: [], heart: [], base: [] }
}

export function OlfactoryPyramidGenerator({
  initialValue,
  brief,
  onSave,
  saving,
}: {
  initialValue?: OlfactoryPyramid | null
  brief: string
  onSave: (pyramid: OlfactoryPyramid) => void
  saving?: boolean
}) {
  const { t } = useLanguage()
  const [direction, setDirection] = useState(initialValue?.direction || brief)
  const [pyramid, setPyramid] = useState<OlfactoryPyramid>(
    initialValue ?? emptyPyramid(brief),
  )
  const hasNotes = pyramid.top.length + pyramid.heart.length + pyramid.base.length > 0

  // Reset the editor only when the *saved* pyramid really changed —
  // compared by content, so a background refetch does not wipe unsaved edits.
  const savedKey = JSON.stringify(initialValue ?? null)
  const [seenKey, setSeenKey] = useState(savedKey)
  if (seenKey !== savedKey) {
    setSeenKey(savedKey)
    setDirection(initialValue?.direction || brief)
    setPyramid(initialValue ?? emptyPyramid(brief))
  }

  // Until a pyramid is saved, the direction follows the brief — but only while it is untouched.
  const [seenBrief, setSeenBrief] = useState(brief)
  if (seenBrief !== brief) {
    setSeenBrief(brief)
    if (!initialValue && direction === seenBrief) setDirection(brief)
  }

  function generate() {
    setPyramid(suggestNotes(direction))
  }

  function updateLevel(level: 'top' | 'heart' | 'base', value: string) {
    setPyramid((current) => ({
      ...current,
      direction,
      [level]: splitNotes(value),
    }))
  }

  return (
    <Collapsible render={<Card />} >
      <CardHeader>
        <CardTitle>
          <CollapsibleTrigger className="group flex min-h-8 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <ChevronDownIcon className="size-4 transition-transform group-aria-expanded:rotate-180" />
            {t('olfactory.title')}
          </CollapsibleTrigger>
        </CardTitle>
        <CardDescription>{t('olfactory.purpose')}</CardDescription>
      </CardHeader>
      <CollapsibleContent keepMounted>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generate}
              disabled={!direction.trim()}
            >
              <SparklesIcon data-icon="inline-start" />
              {hasNotes ? t('olfactory.regenerate') : t('olfactory.generate')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onSave({ ...pyramid, direction })}
              disabled={saving || !hasNotes}
            >
              {saving ? t('olfactory.saving') : t('olfactory.save')}
            </Button>
          </div>
        </div>

        <Input
          aria-label={t('olfactory.placeholder')}
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
          placeholder={t('olfactory.placeholder')}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PyramidLevel
            id="pyramid-top"
            label={t('olfactory.top')}
            value={joinNotes(pyramid.top)}
            onChange={(value) => updateLevel('top', value)}
          />
          <PyramidLevel
            id="pyramid-heart"
            label={t('olfactory.heart')}
            value={joinNotes(pyramid.heart)}
            onChange={(value) => updateLevel('heart', value)}
          />
          <PyramidLevel
            id="pyramid-base"
            label={t('olfactory.base')}
            value={joinNotes(pyramid.base)}
            onChange={(value) => updateLevel('base', value)}
          />
        </div>
      </CardContent>
      </CollapsibleContent>
    </Collapsible>
  )
}

function PyramidLevel({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useLanguage()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('olfactory.notesPlaceholder')}
      />
    </Field>
  )
}
