import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const alias = {
  '@': path.resolve(__dirname, 'src/frontend'),
  '@electron': path.resolve(__dirname, 'src/electron'),
}

export default defineConfig({
  root: path.resolve(__dirname, 'src/frontend'),
  publicDir: path.resolve(__dirname, 'public'),
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: path.resolve(__dirname, 'src/electron/main.ts'),
        vite: {
          resolve: { alias },
          build: {
            outDir: path.resolve(__dirname, 'dist/electron'),
            rollupOptions: {
              output: {
                format: 'esm',
                entryFileNames: '[name].mjs',
              },
            },
          },
        },
      },
      preload: {
        input: path.resolve(__dirname, 'src/electron/preload.ts'),
        vite: {
          resolve: { alias },
          build: {
            outDir: path.resolve(__dirname, 'dist/electron'),
            rollupOptions: {
              output: {
                format: 'esm',
                entryFileNames: '[name].mjs',
              },
            },
          },
        },
      },
      renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    }),
  ],
  resolve: { alias },
  build: {
    outDir: path.resolve(__dirname, 'dist/frontend'),
    rollupOptions: {
      output: {
        format: 'esm',
        entryFileNames: '[name].mjs',
      },
    },
  },
})
