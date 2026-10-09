import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordCriteria,
  passwordRejection,
} from './password.ts'

const valid = 'QuietLab9!'

describe('password rules', () => {
  it('accepts a password with letters, numbers, and a special character', () => {
    expect(passwordRejection(valid, 'person@example.com')).toBeNull()
    expect(passwordCriteria(valid)).toEqual({
      min_length: true,
      no_spaces: true,
      has_letter: true,
      has_number: true,
      has_special: true,
    })
  })

  it('rejects short, spaced, incomplete, common, and personal passwords', () => {
    expect(passwordRejection('Ab1!xyz')).toBe('too_short')
    expect(passwordRejection(`${'a'.repeat(PASSWORD_MAX_LENGTH)}1!`)).toBe('too_long')
    expect(passwordRejection('Quiet Lab9!')).toBe('has_space')
    expect(passwordRejection('12345678!')).toBe('needs_letter')
    expect(passwordRejection('QuietLab!')).toBe('needs_number')
    expect(passwordRejection('QuietLab9')).toBe('needs_special')
    expect(passwordRejection('b'.repeat(PASSWORD_MIN_LENGTH))).toBe('needs_number')
    expect(passwordRejection('password1!')).toBe('common')
    expect(passwordRejection('Formulario9!')).toBe('context')
    expect(passwordRejection('personKeeps9!', 'person@example.com')).toBe('context')
  })

  it('reports live criteria as the person types', () => {
    expect(passwordCriteria('')).toEqual({
      min_length: false,
      no_spaces: true,
      has_letter: false,
      has_number: false,
      has_special: false,
    })
    expect(passwordCriteria('Quiet 1!')).toMatchObject({
      min_length: true,
      no_spaces: false,
      has_letter: true,
      has_number: true,
      has_special: true,
    })
  })
})
