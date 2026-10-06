import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { euFingerprint, listDateFromVersion, prepareEuList } from './official-lists.ts'

const current = readFileSync(new URL('../../../../packages/domain/data/eu-annex-ii.csv', import.meta.url), 'utf8')

describe('official EU list refresh', () => {
  it('ignores the download date the Commission adds to every file', () => {
    const tomorrow = current.replace(/File creation date: \d{2}\/\d{2}\/\d{4}/, 'File creation date: 07/10/2026')
    expect(tomorrow).not.toBe(current)
    expect(euFingerprint(tomorrow)).toBe(euFingerprint(current))
  })

  it('sees a real change in the list', () => {
    const edited = current.replace('BUTYLPHENYL METHYLPROPIONAL', 'BUTYLPHENYL METHYLPROPIONAL X')
    expect(euFingerprint(edited)).not.toBe(euFingerprint(current))
  })

  it('tags every rule with the list date and fingerprint', () => {
    const list = prepareEuList(current)
    expect(listDateFromVersion(list.version)).toBe('2026-09-29')
    expect(list.rules.every((rule) => rule.version === list.version)).toBe(true)
  })

  it('rejects a file that is not the official export', () => {
    expect(() => prepareEuList('not,a,list\n')).toThrow(/Annex II/)
  })
})
