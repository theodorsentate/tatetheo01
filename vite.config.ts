import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:demo` produces one self-contained HTML file (hash routing,
// everything inlined) that can be hosted anywhere or sent as a link.
export default defineConfig(({ mode }) => {
  const single = mode === 'demo'
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: !single }),
      react(),
      tailwindcss(),
      ...(single ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    build: single ? { outDir: 'dist-demo', chunkSizeWarningLimit: 4000 } : undefined,
  }
})
