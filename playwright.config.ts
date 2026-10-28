import { defineConfig } from '@playwright/test'
import { loadEnv } from 'vite'

// Chiavi da .env.local (servono a creare utenti di test e link di accesso)
Object.assign(process.env, loadEnv('', process.cwd(), ''))
const external = process.env.E2E_BASE_URL  // es. l'URL di Cloudflare Pages; altrimenti server locale

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: external ?? 'http://localhost:5173', locale: 'it-IT' },
  webServer: external ? undefined : { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
})
