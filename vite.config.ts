import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync } from 'node:fs'
import { join, parse } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const MODEL_DIRS = ['starters', 'hair', 'garments', 'items', 'furniture', 'jewellery'] as const

/** Scan public/models and list every .glb/.gltf by folder and base name. */
function buildManifest(root: string) {
  const out: Record<string, Record<string, string>> = {}
  for (const dir of MODEL_DIRS) {
    out[dir] = {}
    const abs = join(root, 'public/models', dir)
    if (!existsSync(abs)) continue
    for (const file of readdirSync(abs)) {
      const { name, ext } = parse(file)
      if (ext === '.glb' || ext === '.gltf') out[dir][name] = `/models/${dir}/${file}`
    }
  }
  return out
}

/**
 * Drop-in 3D assets: serves /models/manifest.json in dev (always fresh) and
 * writes it into the build, so adding a GLB needs no code change.
 */
function modelManifest(): Plugin {
  let root = process.cwd()
  return {
    name: 'dollscene-model-manifest',
    configResolved(c) {
      root = c.root
    },
    configureServer(server) {
      server.middlewares.use('/models/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(JSON.stringify(buildManifest(root)))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'models/manifest.json', source: JSON.stringify(buildManifest(root), null, 2) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), modelManifest()],
  // Pre-bundle deps that only lazy routes use, so dev never re-optimises mid-session.
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'three-stdlib',
      'maath',
      'topojson-client',
      '@tanstack/react-virtual',
      'three/examples/jsm/loaders/KTX2Loader.js',
    ],
  },
  build: {
    // The 3D chunk (three + R3F) is lazy-loaded after first paint.
    chunkSizeWarningLimit: 1400,
  },
})
