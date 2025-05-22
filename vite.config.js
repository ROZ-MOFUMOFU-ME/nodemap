import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env file
function loadEnvVariables(envPath = '.env') {
  try {
    const envConfig = {}
    const data = fs.readFileSync(path.resolve(__dirname, envPath), 'utf8')
    data.split('\n').forEach(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) return
      const [key, value] = trimmedLine.split('=')
      if (key && value) {
        envConfig[key.trim()] = value.trim()
      }
    })
    return envConfig
  } catch (error) {
    console.error('Failed to read .env file:', error.message)
    return {}
  }
}

const env = loadEnvVariables()
const PORT = env.PORT || '3000'
const VITE_PORT = env.VITE_DEV_PORT || '5173'

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: parseInt(VITE_PORT, 10),
    proxy: {
      '/peer-locations': {
        target: `http://localhost:${PORT}`,
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client')
    }
  }
})