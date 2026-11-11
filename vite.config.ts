import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Short hash of the commit being built, or "dev" outside a git checkout. Marked "+" if there are uncommitted changes. */
function gitCommit(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return dirty ? `${hash}+` : hash;
  } catch {
    return 'dev';
  }
}

export default defineConfig(({ command }) => ({
  define: {
    // Changes on every build, so browsers fetch fresh sprites instead of cached ones.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
    // Shown in the corner of the screen, e.g. "v0.1.0 · 1a2b3c4" (or "… dev" from the dev server).
    __VERSION__: JSON.stringify(`v${version} · ${gitCommit()}${command === 'serve' ? ' dev' : ''}`),
  },
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  server: { host: true },
}));
