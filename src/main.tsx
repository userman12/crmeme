import { StrictMode, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router'
import { Catalog } from './pages/Catalog'
import { MemePage } from './pages/MemePage'
import { Pipeline } from './pages/Pipeline'
import { Status } from './components/ui'
import { t } from './locales/it'
import './index.css'

function Layout() {
  const navigate = useNavigate()
  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')
    navigate(q ? `/?q=${encodeURIComponent(String(q))}` : '/')
  }
  const nav = ({ isActive }: { isActive: boolean }) => `px-2 py-1 rounded ${isActive ? 'bg-slate-700' : 'hover:bg-slate-800'}`
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight">
            {t.app.name} <span className="font-normal text-slate-400">· {t.app.tagline}</span>
          </Link>
          <nav aria-label={t.nav.main} className="flex gap-1 text-sm">
            <NavLink to="/" end className={nav}>{t.nav.catalog}</NavLink>
            <NavLink to="/pipeline" className={nav}>{t.nav.pipeline}</NavLink>
          </nav>
          <form role="search" onSubmit={search} className="ml-auto w-full sm:w-64">
            <input name="q" type="search" aria-label={t.nav.search} placeholder={t.nav.searchPlaceholder}
              className="w-full rounded bg-slate-800 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:bg-white focus:text-slate-900" />
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6"><Outlet /></main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">{t.app.name}</footer>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Catalog />} />
          <Route path="community/:community" element={<Catalog />} />
          <Route path="tag/:tag" element={<Catalog />} />
          <Route path="meme/:slug" element={<MemePage />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="*" element={<Status empty={t.common.notFound} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
