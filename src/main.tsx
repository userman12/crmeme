import { StrictMode, Suspense, lazy, type ComponentType, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AuthProvider, RequireMember, isCurator, useAuth } from './lib/auth'
import { Catalog } from './pages/Catalog'
import { MemePage } from './pages/MemePage'

// NFR-02: home e scheda nel bundle iniziale, il resto si carica quando serve
const page = <K extends string>(load: () => Promise<Record<K, ComponentType<never>>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType })))
const Login = page(() => import('./pages/Account'), 'Login')
const Welcome = page(() => import('./pages/Account'), 'Welcome')
const Moderation = page(() => import('./pages/Moderation'), 'Moderation')
const Profile = page(() => import('./pages/Profile'), 'Profile')
const Upload = page(() => import('./pages/Upload'), 'Upload')
const Pipeline = page(() => import('./pages/Pipeline'), 'Pipeline')
const Dashboard = page(() => import('./pages/Dashboard'), 'Dashboard')
const ReportStatus = page(() => import('./components/Report'), 'ReportStatus')
const Legal = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Legal })))
import { Status } from './components/ui'
import { t } from './locales/it'
import './index.css'

function Layout() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const { pathname, search: query } = useLocation()
  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')
    navigate(q ? `/?q=${encodeURIComponent(String(q))}` : '/')
  }
  const nav = ({ isActive }: { isActive: boolean }) => `px-2 py-1 rounded ${isActive ? 'bg-slate-700' : 'hover:bg-slate-800'}`
  // B3: chi ha appena fatto il primo accesso sceglie username e accetta i termini prima di tutto il resto
  const open = ['/benvenuto', '/termini', '/privacy', '/contatti']
  if (session && profile === null && !open.includes(pathname)) {
    return <Navigate to={`/benvenuto?next=${encodeURIComponent(pathname + query)}`} replace />
  }
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight">
            {t.app.name} <span className="font-normal text-slate-400">· {t.app.tagline}</span>
          </Link>
          <nav aria-label={t.nav.main} className="flex flex-wrap gap-1 text-sm">
            <NavLink to="/" end className={nav}>{t.nav.catalog}</NavLink>
            <NavLink to="/pipeline" className={nav}>{t.nav.pipeline}</NavLink>
            <NavLink to="/dashboard" className={nav}>{t.dashboard.nav}</NavLink>
            {profile && <NavLink to="/carica" className={nav}>{t.nav2.upload}</NavLink>}
            {isCurator(profile) && <NavLink to="/moderazione" className={nav}>{t.nav2.moderation}</NavLink>}
          </nav>
          <div className="ml-auto text-sm">
            {profile ? <NavLink to={`/u/${profile.username}`} aria-label={`${t.nav2.account}: ${profile.username}`} className={nav}>{profile.username}</NavLink>
              : session === null && <NavLink to={`/accedi?next=${encodeURIComponent(pathname + query)}`} className={nav}>{t.nav2.signIn}</NavLink>}
          </div>
          <form role="search" onSubmit={search} className="w-full sm:w-64">
            <input name="q" type="search" aria-label={t.nav.search} placeholder={t.nav.searchPlaceholder}
              className="w-full rounded bg-slate-800 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:bg-white focus:text-slate-900" />
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<Status loading />}><Outlet /></Suspense>
      </main>
      <footer className="border-t border-slate-200 py-4 text-xs text-slate-500">
        <nav aria-label={t.footer.legal} className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-4 gap-y-1 px-4">
          <span>{t.app.name}</span>
          <Link to="/termini" className="underline">{t.footer.terms}</Link>
          <Link to="/privacy" className="underline">{t.footer.privacy}</Link>
          <Link to="/contatti" className="underline">{t.footer.contacts}</Link>
        </nav>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Catalog />} />
          <Route path="community/:community" element={<Catalog />} />
          <Route path="tag/:tag" element={<Catalog />} />
          <Route path="meme/:slug" element={<MemePage />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accedi" element={<Login />} />
          <Route path="benvenuto" element={<Welcome />} />
          <Route path="u/:username" element={<Profile />} />
          <Route path="carica" element={<RequireMember><Upload /></RequireMember>} />
          <Route path="moderazione" element={<RequireMember curator><Moderation /></RequireMember>} />
          <Route path="termini" element={<Legal page="terms" />} />
          <Route path="privacy" element={<Legal page="privacy" />} />
          <Route path="contatti" element={<Legal page="contacts" />} />
          <Route path="segnalazione/:token" element={<ReportStatus />} />
          <Route path="*" element={<Status empty={t.common.notFound} />} />
        </Route>
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
