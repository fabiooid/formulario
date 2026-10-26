import { afterEach, describe, expect, it } from 'vitest'
import type { AnySpan } from '@mastra/core/observability'
import { MastraPlatformExporter, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability'
import {
  APP_SENSITIVE_FIELDS,
  DEFAULT_SENSITIVE_FIELDS,
  observabilityExporters,
  sensitiveDataFilterOptions,
  sensitiveFields,
} from './observability.js'

function filterSpan(input: Record<string, unknown>) {
  const filter = new SensitiveDataFilter(sensitiveDataFilterOptions)
  return filter.process({ input } as AnySpan)
}

describe('sensitive field list', () => {
  it('keeps every default field and adds the app-specific keys', () => {
    for (const field of DEFAULT_SENSITIVE_FIELDS) {
      expect(sensitiveFields).toContain(field)
    }
    for (const field of APP_SENSITIVE_FIELDS) {
      expect(sensitiveFields).toContain(field)
    }
  })

  it('redacts default and app keys, and leaves ordinary fields alone', () => {
    const { input } = filterSpan({
      password: 'hunter2',
      authorization: 'Bearer abc',
      email: 'person@example.com',
      contactEmail: 'lab@example.com',
      passwordHash: 'bcrypt',
      currentPassword: 'old-pass',
      newPassword: 'new-pass',
      access_token: 'mcp-access',
      refresh_token: 'mcp-refresh',
      code_verifier: 'pkce',
      openaiApiKey: 'sk-test',
      userId: 'user-1',
      productId: 'product-1',
      promptTokens: 42,
    })

    expect(input).toMatchObject({
      password: '[REDACTED]',
      authorization: '[REDACTED]',
      email: '[REDACTED]',
      contactEmail: '[REDACTED]',
      passwordHash: '[REDACTED]',
      currentPassword: '[REDACTED]',
      newPassword: '[REDACTED]',
      access_token: '[REDACTED]',
      refresh_token: '[REDACTED]',
      code_verifier: '[REDACTED]',
      openaiApiKey: '[REDACTED]',
      userId: 'user-1',
      productId: 'product-1',
      promptTokens: 42,
    })
  })
})

describe('Mastra platform exporter', () => {
  const tokenKeys = ['MASTRA_PLATFORM_ACCESS_TOKEN', 'MASTRA_CLOUD_ACCESS_TOKEN'] as const
  const previous = Object.fromEntries(tokenKeys.map((key) => [key, process.env[key]]))

  afterEach(() => {
    for (const key of tokenKeys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  })

  it('keeps local storage and is a no-op without a platform token', () => {
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN
    delete process.env.MASTRA_CLOUD_ACCESS_TOKEN

    const [storage, platform] = observabilityExporters()
    expect(storage).toBeInstanceOf(MastraStorageExporter)
    expect(platform).toBeInstanceOf(MastraPlatformExporter)
    expect(platform.isDisabled).toBe(true)
  })
})
