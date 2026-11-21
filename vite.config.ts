// ABOUTME: Vite build configuration for the shelf-life SPA.
// ABOUTME: Configures React, Tailwind CSS, and Vitest.

/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: './src/test/setup.ts',
  },
})
