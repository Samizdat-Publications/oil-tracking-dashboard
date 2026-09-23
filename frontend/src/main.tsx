import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// V5 ("The Bill") is the default. The V4 ledger stays reachable at
// ?view=ledger (and frozen at trumps-economy-ledger-v4.pages.dev).
// V1 (?view=dashboard), V2 (?view=broadsheet), V3 (?view=receipt) and the
// chart lab were retired on 2026-09-23: all four read a FastAPI backend that
// the static Pages deploy does not have, so they rendered empty. Their old
// links now land on V5.
//
// Each page is its own chunk so neither one's CSS reaches the other: the-bill.css
// styles html/body/a globally, and LedgerPage brings index.css (Tailwind
// preflight plus the legacy reset). The build preloads the V5 chunk from
// index.html (v5Preload in vite.config.ts).
//
// The chunk is awaited before the first render rather than going through
// lazy() + Suspense. Suspense commits its fallback first, and React then holds
// the real page back for its 300 ms fallback throttle: measured, that cost
// more than the preload saved.
const view = new URLSearchParams(window.location.search).get('view')
const page = view === 'ledger' ? import('./pages/LedgerPage') : import('./pages/TheBillPage')

page.then(({ default: Page }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App page={Page} />
    </StrictMode>,
  )
}, (err) => {
  // The page chunk failed to load: leave the static summary from index.html
  // readable rather than a blank screen.
  console.error('Page failed to load:', err)
  const summary = document.querySelector('.seo-summary')
  summary?.removeAttribute('class')
  summary?.setAttribute('style', 'max-width:40rem;margin:0 auto;padding:48px 20px;font:18px/1.5 Georgia,serif;color:#F7F5F0;background:#0B1E3F')
})
