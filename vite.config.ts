import { defineConfig } from 'vite';

export default defineConfig({
  // Changes on every build, so browsers fetch fresh sprites instead of cached ones.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  server: { host: true },
});
