import { defineConfig } from 'vite';

// Content scripts must stay import-free classic scripts (MV3).
// Each entry here must not share modules with another entry, so Rollup
// inlines everything and emits one self-contained file per entry.
// (Entry paths are relative to the project root — kept node:path/__dirname-free
// so `tsc --noEmit` passes without @types/node.)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: 'src/content/index.ts',
        background: 'src/background/index.ts',
        dashboard: 'dashboard.html',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
