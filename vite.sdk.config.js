import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve('src/recorderSdk.js'),
      name: 'InsightUXRecorder',
      formats: ['iife'],
      fileName: () => 'insightux-recorder.js'
    },
    rollupOptions: {
      output: { extend: true }
    }
  }
})

