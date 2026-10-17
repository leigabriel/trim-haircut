/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    env: {
      VITE_SUPABASE_URL: 'https://stub.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_stub',
    },
  }
})
