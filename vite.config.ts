import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load PORT / VITE_DEV_PORT from .env so the dev proxy targets the API server.
function loadEnvVariables(envPath = '.env'): Record<string, string> {
  try {
    const env: Record<string, string> = {}
    const data = fs.readFileSync(path.resolve(__dirname, envPath), 'utf8')
    for (const line of data.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return env
  } catch {
    return {}
  }
}

const env = loadEnvVariables()
const PORT = env.PORT || '3000'
const VITE_PORT = env.VITE_DEV_PORT || '5173'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // No static public assets — the favicon is an inline data URI in index.html.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: Number(VITE_PORT),
    proxy: {
      '/peer-locations': {
        target: `http://localhost:${PORT}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
