import path from 'path'
import { defineConfig } from 'vitest/config'

// Domain + data tests run in Node — no browser needed.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    include: ['src/domain/**/*.test.ts', 'src/data/**/*.test.ts'],
    environment: 'node',
  },
})
