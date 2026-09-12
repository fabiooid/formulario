import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mastra } from '@mastra/core/mastra'
import { MastraCompositeStore } from '@mastra/core/storage'
import { DuckDBStore } from '@mastra/duckdb'
import { MastraEditor } from '@mastra/editor'
import { LibSQLStore } from '@mastra/libsql'
import { Observability, MastraStorageExporter } from '@mastra/observability'
import { assistantAgent } from './agents/assistant-agent.js'
import { assistantTools } from './tools/assistant-tools.js'
import { delegateFormulationTool } from './tools/delegate-formulation.js'
import { formulatorAgent } from './agents/formulator-agent.js'
import { agentGateMiddleware, appRoutes, authRoutes } from './routes/app-routes.js'
import { formulatorScorers } from './scorers/formulator-scorers.js'
import { formulatorTools } from './tools/formulator-tools.js'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mastraDbUrl = `file:${path.join(apiRoot, 'data/mastra.db')}`
const observabilityDbPath = path.join(apiRoot, 'data/observability.duckdb')

export const mastra = new Mastra({
  agents: {
    assistantAgent,
    formulatorAgent,
  },
  tools: { ...formulatorTools, ...assistantTools, delegate_formulation: delegateFormulationTool },
  scorers: formulatorScorers,
  storage: new MastraCompositeStore({
    id: 'atelier-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: mastraDbUrl,
    }),
    domains: {
      observability: new DuckDBStore({
        id: 'atelier-observability',
        path: observabilityDbPath,
      }).observability,
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'atelier',
        exporters: [new MastraStorageExporter()],
      },
    },
  }),
  editor: new MastraEditor(),
  server: {
    port: Number(process.env.PORT ?? 4111),
    host: process.env.MASTRA_HOST ?? '0.0.0.0',
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
    middleware: [
      {
        path: '/api/agents/assistantAgent/*',
        handler: agentGateMiddleware,
      },
      {
        path: '/api/agents/formulatorAgent/*',
        handler: agentGateMiddleware,
      },
    ],
    apiRoutes: [...authRoutes, ...appRoutes],
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
  },
})
