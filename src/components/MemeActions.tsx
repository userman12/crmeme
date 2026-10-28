// FR-09 voti, FR-10 proposta di stage, FR-11 avvistamenti
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { NEXT_STAGE, errorText, useData, type Stage } from '../lib/data'
import { ErrorText, field, primary, score } from './ui'
import { t } from '../locales/it'

type Meme = { id: number; uploader_id: string | null; stage: Stage; score: number; up_votes: number; down_votes: number }

/** Manda al login chi non è registrato, poi riporta a questa pagina. */
function useRequireLogin() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return () => {
    if (session) return true
    navigate(`/accedi?next=${encodeURIComponent(pathname)}`)
    return false
  }
}

export function VoteBox({ meme, onChange }: { meme: Meme; onChange: () => void }) {
  const { session } = useAuth()
  const requireLogin = useRequireLogin()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const uid = session?.user.id
  const mine = useData(async () => {
    if (!uid) return 0
    const { data } = await supabase.from('votes').select('value').eq('meme_id', meme.id).eq('user_id', uid).maybeSingle()
    return data?.value ?? 0
  }, [meme.id, uid])
  const current = mine.data ?? mine.last ?? 0
  const own = !!uid && uid === meme.uploader_id

  async function vote(value: 1 | -1) {
    if (!requireLogin() || !uid) return
    setBusy(true)
    setError(undefined)
    const votes = supabase.from('votes')
    // stesso voto = lo tolgo; voto diverso = lo cambio
    const { error } = current === value ? await votes.delete().eq('meme_id', meme.id).eq('user_id', uid)
      : current ? await votes.update({ value }).eq('meme_id', meme.id).eq('user_id', uid)
      : await votes.insert({ meme_id: meme.id, value })
    setBusy(false)
    if (error) return setError(errorText(error))
    mine.reload()
    onChange()
  }

  const button = (value: 1 | -1, label: string, count: number, symbol: string) => (
    <button onClick={() => vote(value)} disabled={busy || own} aria-pressed={current === value} aria-label={`${label}: ${count}`}
      className={`flex items-center gap-1 rounded border px-3 py-1.5 text-sm font-medium tabular-nums disabled:opacity-50 ${
        current === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
      <span aria-hidden>{symbol}</span> {count}
    </button>
  )

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <p className="text-xs text-slate-500">{t.meme.score}</p>
          <p className="text-2xl font-semibold tabular-nums">{score(meme.score)}</p>
        </div>
        {button(1, t.vote.up, meme.up_votes, '▲')}
        {button(-1, t.vote.down, meme.down_votes, '▼')}
      </div>
      {own && <p className="mt-2 text-xs text-slate-500">{t.vote.own}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

export function SuggestStage({ meme }: { meme: Meme }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>()
  const [length, setLength] = useState(0)
  const to = NEXT_STAGE[meme.stage]

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const reason = String(new FormData(e.currentTarget).get('reason')).trim()
    const { error } = await supabase.from('stage_suggestions').insert({ meme_id: meme.id, from_stage: meme.stage, to_stage: to, reason })
    if (error) setError(errorText(error, t.suggest.exists))
    else setDone(true)
  }

  return (
    <details className="rounded-md border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium">{t.suggest.title}</summary>
      {done ? <p role="status" className="mt-2 text-sm text-emerald-800">{t.suggest.done}</p> : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <p className="text-sm text-slate-700">{t.suggest.fromTo(t.stage[meme.stage], t.stage[to])}</p>
          <label className="block text-sm text-slate-700">{t.suggest.reason}
            <textarea name="reason" required maxLength={280} rows={3} onChange={(e) => setLength(e.target.value.length)}
              aria-describedby={`counter-${meme.id}`} className={field} />
          </label>
          <p id={`counter-${meme.id}`} className="text-right text-xs text-slate-500">{t.suggest.counter(length)}</p>
          <ErrorText>{error}</ErrorText>
          <button className={primary}>{t.suggest.submit}</button>
        </form>
      )}
    </details>
  )
}

export function AddSighting({ meme, onAdded }: { meme: Meme; onAdded: () => void }) {
  const [error, setError] = useState<string>()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const { error } = await supabase.rpc('add_sighting', {
      p_meme: meme.id, p_url: String(data.get('url')).trim(), p_seen_on: String(data.get('seen_on')),
    })
    if (error) return setError(errorText(error))
    setError(undefined)
    form.reset()
    onAdded()
  }
  return (
    <details className="rounded-md border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium">{t.sighting.title}</summary>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <p className="text-sm text-slate-600">{t.sighting.intro}</p>
        <label className="block text-sm text-slate-700">{t.sighting.url}
          <input name="url" type="url" required maxLength={500} className={field} />
        </label>
        <label className="block text-sm text-slate-700">{t.sighting.date}
          <input name="seen_on" type="date" required max={new Date().toISOString().slice(0, 10)} className={field} />
        </label>
        <ErrorText>{error}</ErrorText>
        <button className={primary}>{t.sighting.submit}</button>
      </form>
    </details>
  )
}
