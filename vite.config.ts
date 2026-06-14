import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'client',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared/src'),
    },
  },
  server: { port: 5180, strictPort: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
