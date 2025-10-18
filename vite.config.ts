import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    adonisjs({
      /**
       * Entrypoints of your application. Each entrypoint will
       * result in a separate bundle.
       */
      entrypoints: ['inertia/app/app.tsx'],

      /**
       * Paths to watch and reload the browser on file change
       */
      reload: ['resources/views/**/*.edge'],
    }),
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./inertia', import.meta.url)),
      '~': fileURLToPath(new URL('./inertia', import.meta.url)),
    },
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@inertiajs/react',
      'react-router-dom',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'apexcharts',
      'react-apexcharts',
    ],
  },
})
