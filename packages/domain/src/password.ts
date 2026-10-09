/**
 * Password rules for Formulario (chosen passwords on first sign-in and account change).
 * Minimum eight characters, no spaces, and at least one letter, one number, and one special character.
 * Do not require a specific case mix beyond “has a letter”.
 * Block common passwords, and passwords that use the person's email or the product name.
 * Callers must not trim or cut a password short.
 */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export type PasswordCriterion = 'min_length' | 'no_spaces' | 'has_letter' | 'has_number' | 'has_special'

export type PasswordRejection =
  | 'too_short'
  | 'too_long'
  | 'has_space'
  | 'needs_letter'
  | 'needs_number'
  | 'needs_special'
  | 'common'
  | 'context'

const COMMON_PASSWORDS = new Set(
  `123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon
  123123 baseball abc123 football monkey letmein shadow master 666666 qwertyuiop
  123321 mustang 1234567890 michael 654321 superman 1qaz2wsx 7777777 121212 000000
  qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer
  harley batman andrew tigger sunshine iloveyou charlie robert thomas hockey ranger
  daniel starwars 112233 george computer michelle jessica pepper zxcvbn 555555
  11111111 131313 freedom 777777 pass maggie 159753 ginger princess joshua cheese
  amanda summer love ashley nicole chelsea biteme matthew access yankees 987654321
  dallas austin thunder taylor matrix william olivia daniel bailey welcome welcome1
  password1 password123 passw0rd admin admin123 changeme letmein1 qwerty123 secret
  secret123 temporary temp1234 iloveyou1 princess1 sunshine1 football1 baseball1
  abc12345 abc123456 trustno1 1q2w3e4r 1q2w3e 1q2w3e4r5t qwerty12345 qwerty123456
  passw0rd1 p@ssw0rd p@ssword login welcome123 changeme123 password1234 password12345
  admin1234 admin12345 root root123 guest guest123 test test123 test1234 default
  default123 letmein123 monkey123 dragon123 master123 shadow123 michael1 jessica1
  ashley1 bailey1 daniel1 andrew1 thomas1 robert1 charlie1 liverpool chelsea1
  arsenal manchester barcelona realmadrid pokemon minecraft whatever whatever1
  internet google facebook twitter instagram youtube linkedin amazon apple samsung
  qwertyuiopasdfgh 12341234 12344321 00000000 1111111111 12121212 696969 55555555
  66666666 77777777 88888888 99999999 12345678910 123456789012345 azerty azerty123
  bonjour soleil amour motdepasse motdepasse123 ciao amore password! password1!
  formulario`
    .split(/\s+/)
    .filter(Boolean),
)

function lengthOf(password: string) {
  return Array.from(password).length
}

export function passwordCriteria(password: string): Record<PasswordCriterion, boolean> {
  return {
    min_length: lengthOf(password) >= PASSWORD_MIN_LENGTH,
    no_spaces: !/\s/u.test(password),
    has_letter: /\p{L}/u.test(password),
    has_number: /\p{N}/u.test(password),
    has_special: /[^\p{L}\p{N}\s]/u.test(password),
  }
}

export function passwordRejection(password: string, email?: string): PasswordRejection | null {
  const length = lengthOf(password)
  if (length < PASSWORD_MIN_LENGTH) return 'too_short'
  if (length > PASSWORD_MAX_LENGTH) return 'too_long'

  const checks = passwordCriteria(password)
  if (!checks.no_spaces) return 'has_space'
  if (!checks.has_letter) return 'needs_letter'
  if (!checks.has_number) return 'needs_number'
  if (!checks.has_special) return 'needs_special'

  const normalized = password.normalize('NFKC').toLowerCase()
  const characters = Array.from(normalized)
  if (characters.length > 0 && characters.every((character) => character === characters[0])) return 'common'
  if (COMMON_PASSWORDS.has(normalized)) return 'common'
  const withoutTrailingDigits = normalized.replace(/\d+$/, '')
  if (
    withoutTrailingDigits.length >= 4 &&
    withoutTrailingDigits !== normalized &&
    COMMON_PASSWORDS.has(withoutTrailingDigits)
  ) {
    return 'common'
  }

  if (normalized.includes('formulario')) return 'context'
  if (!email) return null
  const foldedEmail = email.normalize('NFKC').trim().toLowerCase()
  if (!foldedEmail) return null
  if (normalized === foldedEmail || normalized.includes(foldedEmail)) return 'context'
  const localPart = foldedEmail.split('@')[0] ?? ''
  if (localPart.length >= 4 && normalized.includes(localPart)) return 'context'
  return null
}
