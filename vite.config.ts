import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''), // i test leggono anche le chiavi non VITE_ da .env.local
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}))
