import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mastra } from '@mastra/core/mastra'
import { MastraCompositeStore } from '@mastra/core/storage'
import { DuckDBStore } from '@mastra/duckdb'
import { LibSQLStore } from '@mastra/libsql'
import { Observability, MastraStorageExporter } from '@mastra/observability'
import { mcpConfig, mcpRoutes } from '../mcp/routes.js'
import { assistantAgent } from './agents/assistant-agent.js'
import { agentGateMiddleware, appRoutes, authRoutes } from './routes/app-routes.js'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mastraDbUrl = `file:${path.join(apiRoot, 'data/mastra.db')}`
const observabilityDbPath = path.join(apiRoot, 'data/observability.duckdb')

export const mastra = new Mastra({
  agents: {
    assistantAgent,
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
    cors: {
      origin: [mcpConfig().web],
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
    middleware: [
      {
        path: '/api/*',
        handler: async (c, next) => {
          // The MVP exposes no generic framework tool, memory or editor endpoints.
          if (c.req.path !== '/api/agents/assistantAgent/stream') return c.json({ error: 'Not found' }, 404)
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
