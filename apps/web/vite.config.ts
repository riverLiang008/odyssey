import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 4173 },
  // Editor route tests load the vendor graph on first navigation. Bound worker
  // concurrency to avoid memory contention making those imports time out.
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', maxWorkers: 2, testTimeout: 20_000 },
})
