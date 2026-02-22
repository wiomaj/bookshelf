import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the @/* path alias from tsconfig.json
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    // Prevent Next.js internals from running in the test process
    server: {
      deps: {
        // Inline everything so path aliases resolve correctly
        inline: ['@supabase/ssr'],
      },
    },
  },
})
