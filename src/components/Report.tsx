// FR-18 pulsante "Segnala" (anche senza account), CMP-03 conferma con link di stato, CMP-05 copyright
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errorText, formatDate, useData, useTitle } from '../lib/data'
import type { Database } from '../lib/database.types'
import { ErrorText, Status, field, primary } from './ui'
import { t } from '../locales/it'

type Reason = Database['public']['Enums']['report_reason']

export function ReportForm({ memeId }: { memeId: number }) {
  const { session } = useAuth()
  const [reason, setReason] = useState<Reason>('copyright')
  const [token, setToken] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    const { data, error } = await supabase.rpc('submit_report', {
      p_meme: memeId, p_reason: reason, p_details: String(form.get('details') ?? ''), p_email: String(form.get('email') ?? ''),
    })
    setBusy(false)
    if (error) return setError(errorText(error))
    setToken(data)
  }

  return (
    <details className="rounded-md border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium text-rose-800">{t.report.open}</summary>
      {token ? (
        <p role="status" className="mt-2 text-sm text-emerald-900">
          {t.report.done} <Link className="break-all underline" to={`/segnalazione/${token}`}>{`${location.origin}/segnalazione/${token}`}</Link>
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <p className="text-sm text-slate-600">{t.report.intro}</p>
          <label className="block text-sm text-slate-700">{t.report.reason}
            <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className={field}>
              {Object.entries(t.report.reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {reason === 'copyright' && <p className="text-xs text-slate-500">{t.report.copyrightHint}</p>}
          <label className="block text-sm text-slate-700">{t.report.details} <span className="text-slate-400">{t.common.optional}</span>
            <textarea name="details" maxLength={2000} rows={3} className={field} />
          </label>
          {!session && (
            <label className="block text-sm text-slate-700">{t.report.email} <span className="text-slate-400">{t.common.optional}</span>
              <input name="email" type="email" autoComplete="email" className={field} />
            </label>
          )}
          <ErrorText>{error}</ErrorText>
          <button disabled={busy} className={primary}>{t.report.submit}</button>
        </form>
      )}
    </details>
  )
}

export function ReportStatus() {
  const { token = '' } = useParams()
  useTitle(t.report.statusTitle)
  const { data, loading, error } = useData(async () => {
    const { data, error } = await supabase.rpc('report_status', { p_token: token })
    if (error && error.code !== '22P02') throw error  // 22P02: token non valido
    return data?.[0] ?? null
  }, [token])
  if (error) return <Status error />
  if (loading) return <Status loading />
  if (!data) return <Status empty={t.report.statusNotFound} />
  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">{t.report.statusTitle}</h1>
      <dl className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm">
        {([
          [t.report.reason, t.report.reasons[data.reason]],
          [t.report.state, t.report.states[data.status]],
          [t.report.sentOn, formatDate(data.created_at)],
          ...(data.resolved_at ? [[t.report.resolvedOn, formatDate(data.resolved_at)]] : []),
          ...(data.resolution_note ? [[t.report.note, data.resolution_note]] : []),
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9rem_1fr] gap-2 px-3 py-2">
            <dt className="text-slate-500">{k}</dt><dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
