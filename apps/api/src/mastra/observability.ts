import { MastraPlatformExporter, MastraStorageExporter } from '@mastra/observability'

/** Mastra EU ingest. Used when `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` is empty. */
export const MASTRA_PLATFORM_EU_ENDPOINT = 'https://observability.eu.mastra.ai'

/**
 * Default `SensitiveDataFilter` fields. Passing `sensitiveFields` replaces this
 * list, so keep every default when adding app keys.
 * @see https://mastra.ai/reference/observability/tracing/processors/sensitive-data-filter
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'apikey',
  'auth',
  'authorization',
  'bearer',
  'bearertoken',
  'jwt',
  'credential',
  'clientsecret',
  'privatekey',
  'refresh',
  'ssn',
] as const

/** App field names that do not match a default after normalization. */
export const APP_SENSITIVE_FIELDS = [
  'email',
  'contactEmail',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'temporaryPassword',
  'accessToken',
  'refreshToken',
  'codeVerifier',
  'cookie',
  'openaiApiKey',
  'geminiApiKey',
  'jwtSecret',
] as const

export const sensitiveFields = [...DEFAULT_SENSITIVE_FIELDS, ...APP_SENSITIVE_FIELDS]

export const sensitiveDataFilterOptions = {
  sensitiveFields: [...sensitiveFields],
}

/**
 * Local DuckDB storage plus hosted Mastra Platform (EU).
 * `MastraPlatformExporter` is a no-op when `MASTRA_PLATFORM_ACCESS_TOKEN` is unset.
 */
export function observabilityExporters() {
  return [
    new MastraStorageExporter(),
    new MastraPlatformExporter({
      endpoint: process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT || MASTRA_PLATFORM_EU_ENDPOINT,
    }),
  ]
}
