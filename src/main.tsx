import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { supabase } from './lib/supabase'
import { t } from './locales/it'
import './index.css'

// Fase 2: verifica di connessione. Le pagine vere arrivano in Fase 3.
function Home() {
  const [count, setCount] = useState<number | null | 'error'>(null)
  useEffect(() => {
    supabase.from('memes').select('*', { count: 'exact', head: true })
      .then(({ count, error }) => setCount(error ? 'error' : (count ?? 0)))
  }, [])
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-semibold">{t.app.name}</h1>
      <p className="text-slate-600">{t.app.tagline}</p>
      <p className="mt-4">
        {count === null ? t.home.loading : count === 'error' ? t.home.error : t.home.approvedCount(count)}
      </p>
    </main>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
