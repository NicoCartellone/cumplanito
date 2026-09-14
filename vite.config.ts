import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false, // main.tsx registra via virtual:pwa-register
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icon.svg'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Cumpleañito',
        short_name: 'Cumpleaños',
        description: 'Recordatorio de cumpleaños de amigos',
        theme_color: '#1a0a2e',
        background_color: '#1a0a2e',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'es',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})