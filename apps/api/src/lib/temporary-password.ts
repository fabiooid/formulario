const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const NUMBERS = '23456789'
const SPECIALS = '!@#$%&*'
const ALPHABET = `${LETTERS}${NUMBERS}${SPECIALS}`

function randomFrom(alphabet: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(1))
  return alphabet[bytes[0]! % alphabet.length]!
}

export function generateTemporaryPassword() {
  // Must satisfy passwordRejection: length, letter, number, special, no spaces.
  const characters = [randomFrom(LETTERS), randomFrom(NUMBERS), randomFrom(SPECIALS)]
  while (characters.length < 20) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    for (const byte of bytes) {
      characters.push(ALPHABET[byte % ALPHABET.length]!)
      if (characters.length === 20) break
    }
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = crypto.getRandomValues(new Uint8Array(1))[0]! % (index + 1)
    const current = characters[index]!
    characters[index] = characters[swap]!
    characters[swap] = current
  }
  return characters.join('')
}
