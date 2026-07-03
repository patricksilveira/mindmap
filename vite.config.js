import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleMapsApi, getDataDir } from './mapStore.js'

// Serves the same disk-backed /api/maps store in `npm run dev` that server.js
// serves in the packaged app, so maps persist to ./data in both.
function mapsApiPlugin() {
  const dataDir = getDataDir(process.cwd())
  return {
    name: 'maps-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleMapsApi(req, res, dataDir).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mapsApiPlugin()],
})
