import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'

/**
 * DollScene Beauty Studio, Lagos Life (Vatar Games) edition: a separate, lean build of
 * just the studio (no landing, sign-up, Firebase client or the rest of the game).
 *   npm run dev            → http://localhost:5174/ (the full game: npm run dev:app)
 *   npm run build          → dist-studio/ (deploy with firebase.json "studio" hosting target)
 */
/** On this branch the studio IS the app: "/" (and any route) serves studio.html. */
function studioAtRoot(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const url = req.url ?? '/'
    const path = url.split('?')[0]
    if (req.method === 'GET' && (path === '/' || (!path.includes('.') && !path.startsWith('/@') && !path.startsWith('/api/') && !path.startsWith('/rt/')))) {
      req.url = '/studio.html' + url.slice(path.length)
    }
    next()
  }
  return {
    name: 'dollscene-studio-at-root',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  }
}

/**
 * The realtime server (server/realtime: presence, chat, accounts) runs inside the dev and preview
 * servers on the game's own origin: WebSocket at /realtime, HTTP (accounts, counts) under /rt.
 * Production deploys run server/realtime on its own and set VITE_REALTIME_URL.
 */
function realtimeOnSameOrigin(): Plugin {
  type Rt = { attach: (s: unknown) => void; handleHttp: (req: unknown, res: unknown) => void }
  const mount = async (server: { httpServer: unknown; middlewares: Connect.Server }) => {
    process.env.ALLOW_GUESTS ??= '1'
    process.env.ACCOUNTS_FILE ??= '.data/accounts.json'
    process.env.NAMES_FILE ??= '.data/names.json'
    const rt = (await import(/* @vite-ignore */ new URL('./server/realtime/index.mjs', import.meta.url).href)) as Rt
    if (server.httpServer) rt.attach(server.httpServer)
    server.middlewares.use('/rt', (req, res) => rt.handleHttp(req, res))
  }
  return {
    name: 'dollscene-realtime',
    configureServer: (server) => mount(server),
    configurePreviewServer: (server) => mount(server),
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), studioAtRoot(), realtimeOnSameOrigin()],
  server: { port: 5174, open: '/' },
  preview: { port: 5175 },
  optimizeDeps: {
    entries: ['studio.html'],
    include: ['three', '@react-three/fiber', '@react-three/drei', 'three-stdlib'],
  },
  build: {
    outDir: 'dist-studio',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: 'studio.html',
      // The 3D runtime changes rarely; split it so UI deploys don't re-download it.
      output: { manualChunks: (id) => (/node_modules\/(three|three-stdlib|@react-three)\//.test(id) ? 'three' : undefined) },
    },
  },
})
