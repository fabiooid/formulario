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
import { FormularioSessionAuth } from './auth/formulario-session-auth.js'
import { decideApiGate, decideStudioPageGate } from './middleware/api-gate.js'
import { agentGateMiddleware, appRoutes, authRoutes, healthRoutes } from './routes/app-routes.js'
import { isMastraStudioEnabled, MASTRA_STUDIO_BASE, studioPublicOrigin } from './studio-env.js'
import { webStaticEnabled, webStaticMiddleware } from './web-static.js'
import { startRefreshSchedule } from '../services/refresh-schedule.js'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mastraDbUrl = `file:${path.join(apiRoot, 'data/mastra.db')}`
const observabilityDbPath = path.join(apiRoot, 'data/observability.duckdb')
const studioEnabled = isMastraStudioEnabled()
const webOrigin = mcpConfig().web
const corsOrigins = studioEnabled
  ? [webOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000']
  : [webOrigin]
const publicOrigin = studioPublicOrigin()

if (studioEnabled) {
  console.info(
    `[formulario] Mastra Studio enabled at ${MASTRA_STUDIO_BASE}. Framework /api/* requires a Formulario session (server.auth).`,
  )
}

if (process.env.NODE_ENV === 'production') startRefreshSchedule()

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
    // Mastra Studio under /studio so the Formulario SPA keeps /.
    studioBase: '/studio',
    studioHost: publicOrigin?.host,
    studioProtocol: publicOrigin?.protocol,
    studioPort: publicOrigin?.port,
    // When Studio is on, Mastra server.auth locks Studio + built-in /api/* (docs/server/auth).
    auth: studioEnabled ? new FormularioSessionAuth() : undefined,
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
        path: '/studio',
        handler: async (c, next) => {
          if (decideStudioPageGate(studioEnabled) === 'not_found') {
            return c.json({ error: 'Not found' }, 404)
          }
          return next()
        },
      },
      {
        path: '/studio/*',
        handler: async (c, next) => {
          if (decideStudioPageGate(studioEnabled) === 'not_found') {
            return c.json({ error: 'Not found' }, 404)
          }
          return next()
        },
      },
      {
        path: '/api/*',
        handler: async (c, next) => {
          const decision = decideApiGate(c.req.path, studioEnabled)
          if (decision === 'not_found') return c.json({ error: 'Not found' }, 404)
          if (decision === 'agent_gate') return agentGateMiddleware(c, next)
          // Studio on: Mastra server.auth already required a Formulario session.
          return next()
        },
      },
      ...(webStaticEnabled ? [{ path: '*', handler: webStaticMiddleware }] : []),
    ],
    apiRoutes: [...healthRoutes, ...authRoutes, ...appRoutes, ...mcpRoutes],
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
  },
})
