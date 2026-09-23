import { defineConfig, type Plugin, type Rolldown } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// The share text in index.html is read by crawlers that never run the page, so
// its moving figures are filled from the same V5 data at build time. Typed in,
// they said "Diesel $5.60" and "to 4" for two refreshes after both had moved.
// The JSON-LD block and the static summary inside #root use the same holes, so
// what a crawler or a no-JS reader sees is the current refresh too.
function ogFigures(): Plugin {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`./public/v5/${f}`, import.meta.url), 'utf-8'))
  const thousands = (n: number) => (Math.round(n / 1000) * 1000).toLocaleString('en-US')
  return {
    name: 'og-figures',
    transformIndexHtml(html) {
      const prices = read('prices-data.json'), globe = read('globe-data.json'), bill = read('bill-data.json'),
        crude = read('crude-data.json')
      const hormuz = globe.items.hormuz, war = bill.war_cost
      const fig: Record<string, string> = {
        diesel: '$' + prices.diesel.latest.value.toFixed(2),
        diesel_record: prices.diesel.record?.is_record ? ', a record' : '',
        hormuz_now: String(Math.round(hormuz.recent.mean7_total)),
        hormuz_base: String(Math.round(hormuz.baseline.total_per_day)),
        jobs_now: thousands(bill.jobs.curr.mean_monthly),
        jobs_prev: thousands(bill.jobs.prev.mean_monthly),
        // The rest mirror the block 09 share card (cardItems() in TheBill.jsx).
        crude_start: '$' + Math.round(crude.observations[0][1]),
        crude_peak: '$' + Math.round(crude.peak.value),
        receipt_month: '$' + Math.round(prices.receipt.monthly_usd),
        receipt_total: '$' + Math.round(prices.receipt.cumulative_usd).toLocaleString('en-US'),
        us_killed: String(war.casualties.us_killed),
        aircraft: String(war.aircraft.total_lost_or_damaged),
        dod_bn: '$' + war.dod_cost.usd_bn + 'bn',
        gold_out: bill.gold.tonnes_out.toFixed(0),
        // The refresh date; the page's own card reads the same field.
        date_modified: globe.as_of,
      }
      return html.replace(/\{\{og\.(\w+)\}\}/g, (_, k: string) => {
        if (!(k in fig)) throw new Error(`og-figures: no figure named ${k}`)
        return fig[k]
      })
    },
  }
}

// V5 is its own chunk (its CSS styles html/body globally and must not reach
// ?view=ledger; see main.tsx), so by default the browser only finds it after
// the entry has downloaded and run: a waterfall in front of first paint. This
// writes preload hints for the V5 chunk and its CSS into index.html, behind a
// ?view check so the ledger does not fetch them. That check is why they are an
// inline script and not static <link> tags.
//
// The body face (Source Serif 4, 120 KB) is deliberately NOT preloaded: it
// competes with the JS for bandwidth and measured 30-300 ms later to first
// paint on every throttled profile tried, since the text paints in the
// fallback face first anyway (font-display: swap).
function v5Preload(): Plugin {
  type Chunk = Rolldown.OutputChunk
  let base = '/'
  const isChunk = (c: unknown): c is Chunk => (c as Chunk | undefined)?.type === 'chunk'
  return {
    name: 'v5-preload',
    apply: 'build',
    configResolved(c) { base = c.base },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle || !ctx.chunk) return html
        const v5 = Object.values(bundle).find(
          (c): c is Chunk => isChunk(c) && !!c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/pages/TheBillPage.tsx'))
        if (!v5) throw new Error('v5-preload: TheBillPage chunk not found')

        // Everything the V5 chunk pulls in statically, less what the entry
        // already loads.
        const have = new Set([ctx.chunk.fileName, ...ctx.chunk.imports])
        const seen = new Set<string>(), js: string[] = [], css = new Set<string>()
        const walk = (name: string) => {
          const c = bundle[name]
          if (!isChunk(c) || seen.has(name)) return
          seen.add(name)
          if (!have.has(name)) js.push(name)
          c.viteMetadata?.importedCss.forEach((f) => css.add(f))
          c.imports.forEach(walk)
        }
        walk(v5.fileName)
        // crossorigin matches what Vite's own preload helper sets, so the
        // stylesheet link it inserts later is served from this fetch.
        const links = [
          ...js.map((f) => ['modulepreload', f, '']),
          ...[...css].map((f) => ['preload', f, 'style']),
        ].map(([rel, f, as]) => [rel, base + f, as])
        const script =
          `<script>/* V5 preload hints and ground: see v5Preload in vite.config.ts */` +
          `if(new URLSearchParams(location.search).get('view')!=='ledger'){` +
          `${JSON.stringify(links)}.forEach(function(a){var l=document.createElement('link');` +
          `l.rel=a[0];l.href=a[1];if(a[2])l.as=a[2];l.crossOrigin='';document.head.appendChild(l)});` +
          // Nothing render-blocking is left in the head, so without this the
          // first paint is white until the V5 CSS arrives.
          `var s=document.createElement('style');s.textContent='html,body{margin:0;background:#0B1E3F}';` +
          `document.head.appendChild(s)}</script>`
        return html.replace('</title>', '</title>\n    ' + script)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ogFigures(), v5Preload()],
  server: {
    proxy: {
      '/api': {
        // Only V4's `SOURCE = 'api'` switch (src/v4/data.ts) reads this.
        // Override when 8000 is taken:  BACKEND_PORT=8010 npx vite
        target: `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
        changeOrigin: true,
      },
    },
  },
})
