// FR-22 accesso con magic link, B3 username e accettazione termini (CMP-01) al primo accesso
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errorText, useTitle } from '../lib/data'
import { ErrorText, Status, field, primary, safeNext } from '../components/ui'
import { t } from '../locales/it'

export function Login() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { session } = useAuth()
  const [sent, setSent] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  useTitle(t.login.title)
  if (session) return <Navigate to={next} replace />

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email'))
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + next } })
    setBusy(false)
    if (error) setError(error.status === 429 ? t.login.tooMany : t.errors.generic)
    else setSent(email)
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">{t.login.title}</h1>
      {sent ? <p role="status" className="mt-4 rounded bg-emerald-50 p-3 text-emerald-900">{t.login.sent(sent)}</p> : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="text-slate-600">{t.login.intro}</p>
          <label className="block text-sm text-slate-700">{t.login.email}
            <input name="email" type="email" required autoComplete="email" className={field} />
          </label>
          <ErrorText>{error}</ErrorText>
          <button disabled={busy} className={primary}>{t.login.submit}</button>
        </form>
      )}
    </section>
  )
}

export function Welcome() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { session, profile, reloadProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  useTitle(t.welcome.title)
  if (session === null) return <Navigate to="/accedi" replace />
  if (profile === undefined || !session) return <Status loading />
  if (profile) return <Navigate to={next} replace />

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      username: String(new FormData(e.currentTarget).get('username')).trim(),
      terms_accepted_at: new Date().toISOString(),
    })
    if (error) {
      setBusy(false)
      return setError(errorText(error, t.welcome.taken))
    }
    await reloadProfile()
    navigate(next, { replace: true })
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">{t.welcome.title}</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <p className="text-slate-600">{t.welcome.intro}</p>
        <label className="block text-sm text-slate-700">{t.welcome.username}
          <input name="username" required pattern="[a-z0-9_]{3,24}" autoComplete="username"
            aria-describedby="username-hint" className={field} />
        </label>
        <p id="username-hint" className="text-xs text-slate-500">{t.welcome.usernameHint}</p>
        <label className="flex gap-2 text-sm text-slate-700">
          <input type="checkbox" required className="mt-0.5" />
          <span>
            {t.welcome.terms} <Link to="/termini" target="_blank" className="underline">{t.welcome.termsLink}</Link>{' '}
            {t.welcome.and} <Link to="/privacy" target="_blank" className="underline">{t.welcome.privacyLink}</Link>
          </span>
        </label>
        <ErrorText>{error}</ErrorText>
        <button disabled={busy} className={primary}>{busy ? t.common.saving : t.welcome.submit}</button>
      </form>
    </section>
  )
}
