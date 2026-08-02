import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('plotly.js-dist-min') || id.includes('plotly.js')) {
            return 'plotly';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        // Defaults to the usual backend port. Override when 8000 is already
        // taken by another process:  BACKEND_PORT=8010 npx vite
        target: `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
        changeOrigin: true,
      },
    },
  },
})
