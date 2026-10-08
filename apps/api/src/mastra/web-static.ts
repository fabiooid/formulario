import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getMimeType } from 'hono/utils/mime'

// In production the API serves the built web app, so browser, API and MCP share one origin.
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const webDist = path.resolve(process.env.WEB_DIST_DIR ?? path.join(apiRoot, '../web/dist'))
const indexPath = path.join(webDist, 'index.html')

// Everything under these prefixes belongs to the API and must never fall back to index.html.
const apiPrefixes = ['/api', '/auth', '/app', '/mcp', '/oauth', '/.well-known', '/healthz']

export const webStaticEnabled = process.env.NODE_ENV === 'production' && existsSync(indexPath)

function isApiPath(pathname: string) {
  return apiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function fileResponse(filePath: string, cacheControl: string) {
  return new Response(readFileSync(filePath), {
    headers: {
      'Content-Type': getMimeType(filePath) ?? 'application/octet-stream',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function indexResponse() {
  const response = fileResponse(indexPath, 'no-cache')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

// Structural type: Mastra bundles its own Hono, so its Context is not this package's.
type StaticContext = {
  req: { method: string; url: string }
  text: (text: string, status?: 400 | 404) => Response
}

export async function webStaticMiddleware(c: StaticContext, next: () => Promise<void>) {
  const method = c.req.method
  const pathname = new URL(c.req.url).pathname
  if ((method !== 'GET' && method !== 'HEAD') || isApiPath(pathname)) return next()

  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return c.text('Bad request', 400)
  }
  const filePath = path.join(webDist, decoded)
  // path.join normalizes "..", so anything outside the dist folder is a traversal attempt.
  if (filePath.startsWith(webDist + path.sep) && existsSync(filePath) && statSync(filePath).isFile()) {
    // Vite fingerprints everything in /assets, so those files never change.
    const cache = decoded.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
    return fileResponse(filePath, cache)
  }
  // A missing script or stylesheet must fail loudly, not load the HTML shell as JavaScript.
  if (decoded.startsWith('/assets/')) return c.text('Not found', 404)
  // Client-side routes (/products/123, /settings/account) get the app shell.
  return indexResponse()
}
