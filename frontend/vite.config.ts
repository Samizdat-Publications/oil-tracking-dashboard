import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// The share text in index.html is read by crawlers that never run the page, so
// its moving figures are filled from the same V5 data at build time. Typed in,
// they said "Diesel $5.60" and "to 4" for two refreshes after both had moved.
function ogFigures(): Plugin {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`./public/v5/${f}`, import.meta.url), 'utf-8'))
  return {
    name: 'og-figures',
    transformIndexHtml(html) {
      const prices = read('prices-data.json'), globe = read('globe-data.json'), bill = read('bill-data.json')
      const fig: Record<string, string> = {
        diesel: '$' + prices.diesel.latest.value.toFixed(2),
        diesel_record: prices.diesel.record?.is_record ? ', a record' : '',
        hormuz_now: String(Math.round(globe.items.hormuz.recent.mean7_total)),
        jobs_now: (Math.round(bill.jobs.curr.mean_monthly / 1000) * 1000).toLocaleString('en-US'),
      }
      return html.replace(/\{\{og\.(\w+)\}\}/g, (_, k: string) => {
        if (!(k in fig)) throw new Error(`og-figures: no figure named ${k}`)
        return fig[k]
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ogFigures()],
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
