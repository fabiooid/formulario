const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateTemporaryPassword() {
  const characters: string[] = []
  while (characters.length < 20) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    for (const byte of bytes) {
      // 256 divides evenly by 32, so every character is equally likely.
      characters.push(ALPHABET[byte % ALPHABET.length]!)
      if (characters.length === 20) break
    }
  }
  return characters.join('')
}
