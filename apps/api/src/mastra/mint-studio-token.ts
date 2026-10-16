import { SignJWT } from 'jose'

function usage() {
  return `Mint a Bearer token for self-hosted Mastra Studio.

Usage:
  npm run studio:token
  npm run studio:token -- --sub fabio --days 90

Set MASTRA_STUDIO_JWT_SECRET first. Paste the token in Studio:
Settings > Headers > Authorization: Bearer <token>

This secret is not the Formulario login secret (MASTRA_JWT_SECRET).`
}

function readArg(argv: string[], flag: string) {
  const index = argv.indexOf(flag)
  if (index === -1) return undefined
  return argv[index + 1]
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }

  const secret = process.env.MASTRA_STUDIO_JWT_SECRET?.trim()
  if (!secret) {
    console.error('Set MASTRA_STUDIO_JWT_SECRET first.\n\n' + usage())
    process.exitCode = 1
    return
  }
  if (secret === process.env.MASTRA_JWT_SECRET?.trim()) {
    console.error('MASTRA_STUDIO_JWT_SECRET must not reuse MASTRA_JWT_SECRET.')
    process.exitCode = 1
    return
  }

  const argv = process.argv.slice(2)
  const sub = readArg(argv, '--sub')?.trim() || 'studio-admin'
  const daysValue = readArg(argv, '--days')
  const days = daysValue ? Number(daysValue) : 90
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    console.error('--days must be a number from 1 to 365.\n\n' + usage())
    process.exitCode = 1
    return
  }

  const token = await new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${Math.round(days)}d`)
    .sign(new TextEncoder().encode(secret))

  console.log(token)
}

await main()
