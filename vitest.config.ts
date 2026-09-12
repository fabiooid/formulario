import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/domain/src/**/*.test.ts', 'apps/api/src/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
  },
})
