import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Versión visible en Ajustes: commit y fecha del build, para saber qué tiene cada teléfono.
function version(): string {
  let commit = 'local'
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // Sin git (p. ej. un zip del código): queda "local".
  }
  const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })
  return `${commit} · ${fecha}`
}

export default defineConfig({
  // Rutas relativas: se puede servir desde la raíz de un dominio o desde una subcarpeta.
  base: './',
  define: { __VERSION__: JSON.stringify(process.env.VERSION_APP ?? version()) },
  // iPhone con iOS 15.4 o más nuevo (Vite por defecto exige 16.4).
  build: { target: ['chrome111', 'edge111', 'firefox114', 'safari15.4', 'ios15.4'] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Rutinas del gimnasio',
        short_name: 'Rutinas',
        description: 'Rutinas y progreso de los alumnos',
        lang: 'es-AR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f4f1',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
