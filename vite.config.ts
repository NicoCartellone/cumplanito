import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icon.svg'],
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
