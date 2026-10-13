/// <reference types="vitest/config" />
/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // e2e and screenshots point this at their own backend (scripts/e2e-servers.sh); the dev server keeps 8080.
      '/api': process.env.API_TARGET ?? 'http://localhost:8080',
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
