import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

// Two production builds:
//   npm run build          -> dist/          normal multi-file build for hosting as an installable PWA
//   npm run build:offline  -> dist-offline/  one self-contained index.html you can double-click
//                                            (Chrome/Edge refuse to run <script type="module" src>
//                                            over file://, so everything is inlined instead)
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline'
  return {
    // Relative base so the build works from any URL path (GitHub Pages subfolder, etc.) or from disk.
    base: './',
    plugins: [react(), tailwindcss(), ...(offline ? [viteSingleFile()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
    },
    build: {
      outDir: offline ? 'dist-offline' : 'dist',
      ...(offline ? { cssCodeSplit: false, assetsInlineLimit: 100_000_000 } : {}),
    },
  }
})
