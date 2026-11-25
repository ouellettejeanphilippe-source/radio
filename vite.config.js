import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Shown in the settings panel, so a phone can tell which version it is running.
  define: { 'import.meta.env.VITE_BUILD': JSON.stringify(new Date().toISOString()) },
})
