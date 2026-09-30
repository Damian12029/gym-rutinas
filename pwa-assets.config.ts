import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Íconos de la app a partir de public/logo.svg: `npx pwa-assets-generator`.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.25, resizeOptions: { background: '#2a78d6' } },
    apple: { ...minimal2023Preset.apple, padding: 0.2, resizeOptions: { background: '#2a78d6' } },
  },
  images: ['public/logo.svg'],
})
