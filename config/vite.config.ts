import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: {
    port: 1951,
    strictPort: true
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'fonts/**/*.{css,woff2,ttf}'],
      manifest: {
        name: 'Dictionario & Motor Morphologic de Interlingua (IALA)',
        short_name: 'DictionarioIALA',
        description: 'Dictionario electronic e motor morphologic de 51.500 parolas de Interlingua (IALA 1951). 100% Offline.',
        theme_color: '#008080',
        background_color: '#008080',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,json,woff2,ttf,webmanifest}'
        ],
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
      }
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});
