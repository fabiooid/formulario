import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mastra } from '@mastra/core/mastra'
import { MastraCompositeStore } from '@mastra/core/storage'
import { DuckDBStore } from '@mastra/duckdb'
import { LibSQLStore } from '@mastra/libsql'
import { Observability, MastraStorageExporter } from '@mastra/observability'
import { mcpConfig, mcpRoutes } from '../mcp/routes.js'
import { formularioMcpServer } from '../mcp/tools.js'
import { assistantAgent } from './agents/assistant-agent.js'
import { agentGateMiddleware, appRoutes, authRoutes } from './routes/app-routes.js'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mastraDbUrl = `file:${path.join(apiRoot, 'data/mastra.db')}`
const observabilityDbPath = path.join(apiRoot, 'data/observability.duckdb')
const studioEnabled = process.env.MASTRA_STUDIO === '1' || process.env.MASTRA_STUDIO === 'true'
const webOrigin = mcpConfig().web
const corsOrigins = studioEnabled
  ? [webOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000']
  : [webOrigin]

if (studioEnabled) {
  console.warn('[formulario] Mastra Studio APIs are open for local use. Do not use this flag in production.')
}

export const mastra = new Mastra({
  agents: {
    assistantAgent,
  },
  mcpServers: {
    formulario: formularioMcpServer,
  },
  storage: new MastraCompositeStore({
    id: 'formulario-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: mastraDbUrl,
    }),
    domains: {
      observability: new DuckDBStore({
        id: 'formulario-observability',
        path: observabilityDbPath,
      }).observability,
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'formulario',
        exporters: [new MastraStorageExporter()],
      },
    },
  }),
  server: {
    port: Number(process.env.PORT ?? 4111),
    host: process.env.MASTRA_HOST ?? '0.0.0.0',
    mcpOptions: {
      serverless: true,
    },
    cors: {
      origin: corsOrigins,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
    middleware: [
      {
        path: '/api/*',
        handler: async (c, next) => {
          const isAssistantStream = c.req.path === '/api/agents/assistantAgent/stream'
          if (!isAssistantStream) {
            return studioEnabled ? next() : c.json({ error: 'Not found' }, 404)
          }
          // Studio has no app token. App chat still uses the paid-plan gate.
          if (studioEnabled && !c.req.header('authorization')) return next()
          return agentGateMiddleware(c, next)
        },
      },
    ],
    apiRoutes: [...authRoutes, ...appRoutes, ...mcpRoutes],
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
  },
})
