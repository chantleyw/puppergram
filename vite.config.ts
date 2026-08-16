import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `--mode desktop` builds the Tauri shell. The service worker is dropped
 * there: the desktop bundle is already local, and a worker registered on the
 * tauri:// protocol only gets in the way of updates.
 */
export default defineConfig(({ mode }) => {
  const desktop = mode === 'desktop';

  return {
    plugins: [
      react(),
      ...(desktop
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.svg', 'icons/*.png'],
              manifest: {
                name: 'Puppergram — Neonatal litter monitor',
                short_name: 'Puppergram',
                description:
                  'Gram by gram, day by day. Weight-led early warning for newborn puppies, birth to eight weeks.',
                theme_color: '#14100E',
                background_color: '#14100E',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                categories: ['health', 'productivity', 'utilities'],
                icons: [
                  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                  {
                    src: '/icons/icon-512-maskable.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                // The whelping box is often in an outbuilding with no signal, so
                // the shell is precached and navigation resolves from cache.
                navigateFallback: '/index.html',
                // The API proxies must never be served stale.
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                  {
                    urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'fonts',
                      expiration: {
                        maxEntries: 20,
                        maxAgeSeconds: 60 * 60 * 24 * 365,
                      },
                    },
                  },
                ],
              },
              devOptions: { enabled: false },
            }),
          ]),
    ],
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    server: {
      // Tauri points a webview at this during `tauri dev`.
      strictPort: true,
    },
  };
});
