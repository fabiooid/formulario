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
import { agentGateMiddleware, appRoutes, authRoutes, healthRoutes } from './routes/app-routes.js'
import {
  assertStudioEnv,
  createStudioApiMiddleware,
  createStudioConfig,
  isStudioAuthEnabled,
  studioServerHints,
} from './studio.js'
import { webStaticEnabled, webStaticMiddleware } from './web-static.js'
import { startRefreshSchedule } from '../services/refresh-schedule.js'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mastraDbUrl = `file:${path.join(apiRoot, 'data/mastra.db')}`
const observabilityDbPath = path.join(apiRoot, 'data/observability.duckdb')
const webOrigin = mcpConfig().web
const studioConfig = createStudioConfig()
const studioHints = studioServerHints()
const studioApiMiddleware = createStudioApiMiddleware(agentGateMiddleware)

assertStudioEnv()
if (isStudioAuthEnabled()) {
  console.info('[formulario] Mastra Studio is on at /studio. APIs need a Studio JWT. Do not set MASTRA_STUDIO.')
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
  studio: studioConfig,
  server: {
    port: Number(process.env.PORT ?? 4111),
    host: process.env.MASTRA_HOST ?? '0.0.0.0',
    studioBase: studioHints.studioBase,
    studioHost: studioHints.studioHost,
    studioProtocol: studioHints.studioProtocol,
    studioPort: studioHints.studioPort,
    mcpOptions: {
      serverless: true,
    },
    cors: {
      origin: [webOrigin],
      allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
    middleware: [
      {
        path: '/api/*',
        handler: studioApiMiddleware,
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
