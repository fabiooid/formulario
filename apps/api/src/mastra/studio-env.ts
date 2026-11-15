/** True when Mastra Studio (and framework `/api/*`) are enabled for this process. */
export function isMastraStudioEnabled() {
  const value = process.env.MASTRA_STUDIO
  return value === '1' || value === 'true'
}

export const MASTRA_STUDIO_BASE = '/studio'

/** Public origin for Studio’s injected server URL (same host as the app). */
export function studioPublicOrigin(): {
  host: string
  protocol: 'http' | 'https'
  port: number
} | null {
  const raw = process.env.APP_PUBLIC_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    const protocol = url.protocol === 'https:' ? 'https' : 'http'
    const port = url.port
      ? Number(url.port)
      : protocol === 'https'
        ? 443
        : 80
    return { host: url.hostname, protocol, port }
  } catch {
    return null
  }
}
