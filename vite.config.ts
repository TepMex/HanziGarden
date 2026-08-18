import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'

/** Project Pages base, e.g. `/CloudAgenticCoding/rth-agriculture/` (see CI). */
const base = process.env.GH_PAGES_PUBLIC_PATH?.replace(/\/?$/, '/') ?? './'

export default defineConfig({
  plugins: [
    react(),
    {
      // PROTOTYPE — serve the supplied local grid only while Vite is running.
      // The debug route is DEV-only and this file is never copied into a build.
      name: 'garden-reveal-prototype-grid',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url !== '/__prototype/garden-grid.svg') return next()
          const svg = await readFile('/Users/tepmex/Downloads/Garden.svg')
          response.statusCode = 200
          response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(svg)
        })
      },
    },
  ],
  base,
})
