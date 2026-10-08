import { describe, expect, it } from 'vitest'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordRejection } from './password.ts'

const passphrase = 'quiet lab notebook notes'

describe('password rules', () => {
  it('accepts a long passphrase with spaces', () => {
    expect(passwordRejection(passphrase, 'person@example.com')).toBeNull()
  })

  it('rejects short, long, common, repeated, and personal passwords', () => {
    expect(passwordRejection('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe('too_short')
    expect(passwordRejection('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('too_long')
    expect(passwordRejection('b'.repeat(PASSWORD_MIN_LENGTH))).toBe('common')
    expect(passwordRejection('password123456789')).toBe('common')
    expect(passwordRejection('Formulario notebook')).toBe('context')
    expect(passwordRejection('person keeps a notebook', 'person@example.com')).toBe('context')
    expect(passwordRejection(passphrase, 'person@example.com')).toBeNull()
  })
})
