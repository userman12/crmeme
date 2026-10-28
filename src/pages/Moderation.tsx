// FR-14 coda caricamenti (approva, rifiuta con motivo, modifica metadati), FR-10 coda proposte di stage
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { errorText, formatDate, imageUrl, loadTaxonomy, must, useData, useTitle, type Stage } from '../lib/data'
import { ErrorText, Status, field, primary, secondary } from '../components/ui'
import { t } from '../locales/it'

export function Moderation() {
  useTitle(t.moderation.title)
  const queue = useData(async () => {
    const [memes, suggestions, reports, tax] = await Promise.all([
      supabase.from('memes')
        .select('*, meme_tags(tag_id), uploader:profiles!memes_uploader_id_fkey(username), parent:parent_meme_id(slug, title)')
        .eq('status', 'pending').order('created_at'),
      supabase.from('stage_suggestions')
        .select('id, from_stage, to_stage, reason, created_at, memes(slug, title), author:profiles!stage_suggestions_user_id_fkey(username)')
        .eq('status', 'open').order('created_at'),
      supabase.from('reports')
        .select('id, reason, details, reporter_email, created_at, memes(slug, title), reporter:profiles!reports_reporter_id_fkey(username)')
        .eq('status', 'open').order('created_at'),
      loadTaxonomy(),
    ])
    // CMP-05: copyright e contenuti illegali in cima alla coda
    const urgent = (r: { reason: string }) => (r.reason === 'copyright' || r.reason === 'illegal' ? 0 : 1)
    return { memes: must(memes), suggestions: must(suggestions), reports: must(reports).sort((a, b) => urgent(a) - urgent(b)), tax }
  }, [])

  if (queue.error) return <Status error />
  const data = queue.data ?? queue.last
  if (!data) return <Status loading />

  return (
    <>
      <h1 className="text-2xl font-semibold">{t.moderation.title}</h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t.moderation.reports(data.reports.length)}</h2>
        {data.reports.length === 0 ? <Status empty={t.moderation.emptyReports} /> : (
          <ul className="mt-3 space-y-3">
            {data.reports.map((r) => <li key={r.id}><ReportItem r={r} done={queue.reload} /></li>)}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.moderation.uploads(data.memes.length)}</h2>
        {data.memes.length === 0 ? <Status empty={t.moderation.emptyUploads} /> : (
          <ul className="mt-3 space-y-4">
            {data.memes.map((m) => <li key={m.id}><Pending meme={m} tax={data.tax} done={queue.reload} /></li>)}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.moderation.suggestions(data.suggestions.length)}</h2>
        {data.suggestions.length === 0 ? <Status empty={t.moderation.emptySuggestions} /> : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {data.suggestions.map((s) => <li key={s.id}><Suggestion s={s} done={queue.reload} /></li>)}
          </ul>
        )}
      </section>
    </>
  )
}

type Tax = Awaited<ReturnType<typeof loadTaxonomy>>
type PendingMeme = {
  id: number; title: string; description: string; alt_text: string; image_path: string; thumb_path: string
  format: string; language: string; community_id: number | null; first_seen_at: string | null; created_at: string
  meme_tags: { tag_id: number }[]; uploader: { username: string } | null; parent: { slug: string; title: string } | null
}

function Pending({ meme: m, tax, done }: { meme: PendingMeme; tax: Tax; done: () => void }) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const id = `p${m.id}`

  async function act(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const text = (k: string) => String(form.get(k) ?? '').trim()
    const approve = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'approve'
    if (!approve && !text('note')) return setError(t.moderation.rejectHint)
    setBusy(true)
    const tags = form.getAll('tag').map(Number)
    const { error } = approve
      ? await supabase.from('memes').update({
          title: text('title'), description: text('description'), alt_text: text('alt_text'),
          format: text('format'), language: text('language'), community_id: Number(text('community')) || null,
          first_seen_at: text('first_seen_at') || null, is_nsfw: form.has('nsfw'),
          status: 'approved', moderation_note: null,
        }).eq('id', m.id)
      : await supabase.from('memes').update({ status: 'rejected', moderation_note: text('note') }).eq('id', m.id)
    if (!error && approve) {
      await supabase.from('meme_tags').delete().eq('meme_id', m.id)
      if (tags.length) await supabase.from('meme_tags').insert(tags.map((tag_id) => ({ meme_id: m.id, tag_id })))
    }
    // B5: un contenuto rifiutato non deve restare raggiungibile dal bucket pubblico
    if (!error && !approve) await supabase.storage.from('memes').remove([m.image_path, m.thumb_path])
    if (error) {
      setBusy(false)
      return setError(errorText(error))
    }
    done()
  }

  const has = new Set(m.meme_tags.map((x) => x.tag_id))
  return (
    <form onSubmit={act} aria-labelledby={id} className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[16rem_1fr]">
      <a href={imageUrl(m.image_path)} target="_blank" rel="noreferrer">
        <img src={imageUrl(m.thumb_path)} alt={m.alt_text} className="w-full rounded border border-slate-200" />
      </a>
      <div className="space-y-3">
        <p id={id} className="text-sm text-slate-500">
          {t.moderation.by(m.uploader?.username ?? t.meme.deletedUser, formatDate(m.created_at))}
          {m.parent && <> · {t.moderation.parent} <Link className="underline" to={`/meme/${m.parent.slug}`}>{m.parent.title}</Link></>}
        </p>
        <label className="block text-sm text-slate-700">{t.upload.titleField}
          <input name="title" defaultValue={m.title} required minLength={3} maxLength={120} className={field} />
        </label>
        <label className="block text-sm text-slate-700">{t.upload.description}
          <textarea name="description" defaultValue={m.description} rows={2} maxLength={2000} className={field} />
        </label>
        <label className="block text-sm text-slate-700">{t.upload.altText}
          <input name="alt_text" defaultValue={m.alt_text} required minLength={5} maxLength={300} className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm text-slate-700">{t.upload.format}
            <select name="format" defaultValue={m.format} className={field}>
              {Object.entries(t.format).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">{t.upload.language}
            <select name="language" defaultValue={m.language} className={field}>
              {Object.entries(t.language).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">{t.upload.community}
            <select name="community" defaultValue={m.community_id ?? ''} className={field}>
              <option value="">{t.upload.none}</option>
              {tax.communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">{t.upload.firstSeen}
            <input name="first_seen_at" type="date" defaultValue={m.first_seen_at ?? ''} className={field} />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm text-slate-700">{t.upload.tags}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {tax.tags.map((x) => (
              <label key={x.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="tag" value={x.id} defaultChecked={has.has(x.id)} /> #{x.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="nsfw" /> {t.moderation.nsfw}
        </label>
        <label className="block text-sm text-slate-700">{t.moderation.rejectReason}
          <input name="note" maxLength={500} aria-describedby={`${id}-hint`} className={field} />
          <span id={`${id}-hint`} className="mt-1 block text-xs text-slate-500">{t.moderation.rejectHint}</span>
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-3">
          <button name="action" value="approve" disabled={busy} className={primary}>{t.moderation.approve}</button>
          <button name="action" value="reject" disabled={busy} formNoValidate className={secondary}>{t.moderation.reject}</button>
        </div>
      </div>
    </form>
  )
}

type SuggestionRow = {
  id: number; from_stage: Stage; to_stage: Stage; reason: string; created_at: string
  memes: { slug: string; title: string } | null; author: { username: string } | null
}

function Suggestion({ s, done }: { s: SuggestionRow; done: () => void }) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  async function review(status: 'accepted' | 'rejected') {
    setBusy(true)
    const { error } = await supabase.from('stage_suggestions').update({ status }).eq('id', s.id)
    if (error) {
      setBusy(false)
      return setError(errorText(error))
    }
    done()
  }
  return (
    <div className="flex flex-wrap items-start gap-3 px-3 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p>
          {s.memes && <Link className="font-medium underline" to={`/meme/${s.memes.slug}`}>{s.memes.title}</Link>}
          {' · '}{t.suggest.fromTo(t.stage[s.from_stage], t.stage[s.to_stage])}
        </p>
        <p className="mt-1 text-slate-700">“{s.reason}”</p>
        <p className="mt-1 text-xs text-slate-500">{t.moderation.by(s.author?.username ?? t.meme.deletedUser, formatDate(s.created_at))}</p>
        <ErrorText>{error}</ErrorText>
      </div>
      <button disabled={busy} onClick={() => review('accepted')} className={primary}>{t.moderation.accept}</button>
      <button disabled={busy} onClick={() => review('rejected')} className={secondary}>{t.moderation.refuse}</button>
    </div>
  )
}

type ReportRow = {
  id: number; reason: string; details: string; reporter_email: string | null; created_at: string
  memes: { slug: string; title: string } | null; reporter: { username: string } | null
}

// FR-19: rimuovi il contenuto o archivia la segnalazione, sempre con una nota
function ReportItem({ r, done }: { r: ReportRow; done: () => void }) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const id = `r${r.id}`

  async function act(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const remove = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'remove'
    setBusy(true)
    const { data, error } = await supabase.rpc('resolve_report', {
      p_report: r.id, p_remove: remove, p_note: String(new FormData(e.currentTarget).get('note') ?? ''),
    })
    if (error) {
      setBusy(false)
      return setError(errorText(error))
    }
    // B5: il file non deve restare raggiungibile dal bucket pubblico
    const files = (data ?? []).flatMap((f) => [f.image_path, f.thumb_path])
    if (files.length) await supabase.storage.from('memes').remove(files)
    done()
  }

  const urgent = r.reason === 'copyright' || r.reason === 'illegal'
  return (
    <form onSubmit={act} aria-labelledby={id} className="rounded-md border border-slate-200 bg-white p-4 text-sm">
      <p id={id} className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${urgent ? 'bg-rose-100 text-rose-900' : 'bg-slate-100 text-slate-800'}`}>
          {t.report.reasons[r.reason]}
        </span>
        {r.memes && <Link className="font-medium underline" to={`/meme/${r.memes.slug}`}>{r.memes.title}</Link>}
      </p>
      {r.details && <p className="mt-2 whitespace-pre-line text-slate-700">{r.details}</p>}
      <p className="mt-2 text-xs text-slate-500">
        {t.moderation.by(r.reporter?.username ?? r.reporter_email ?? t.moderation.anonymous, formatDate(r.created_at))}
      </p>
      <label className="mt-3 block text-slate-700">{t.moderation.decision}
        <textarea name="note" required maxLength={1000} rows={2} aria-describedby={`${id}-hint`} className={field} />
        <span id={`${id}-hint`} className="mt-1 block text-xs text-slate-500">{t.moderation.decisionHint}</span>
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex flex-wrap gap-3">
        <button name="action" value="remove" disabled={busy} className={`${primary} bg-rose-700 hover:bg-rose-600`}>{t.moderation.remove}</button>
        <button name="action" value="dismiss" disabled={busy} className={secondary}>{t.moderation.dismiss}</button>
      </div>
    </form>
  )
}
