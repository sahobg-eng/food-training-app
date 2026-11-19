import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

// Shown in Settings so it's easy to see which version the phone is running.
const APP_VERSION = `${new Date().toISOString().slice(0, 10)} · ${gitSha()}`;

// Relative base + hash routing: the build works from any static-host sub-path
// (e.g. https://<user>.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    preact(),
    VitePWA({
      // 'prompt': a new version waits for the user to tap Update (see src/ui/update.ts).
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        id: './',
        name: 'Food & Training',
        short_name: 'Train',
        description: 'Personal training, body measurement and macro log.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
