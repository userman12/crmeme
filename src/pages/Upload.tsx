// FR-12 form, FR-13 pending, FR-15 duplicati, NFR-01 compressione, NFR-06 testo alternativo
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errorText, loadTaxonomy, useData, useTitle } from '../lib/data'
import { ALLOWED, MAX_BYTES, extension, resize, sha256 } from '../lib/image'
import { ErrorText, Status, field, primary } from '../components/ui'
import { t } from '../locales/it'

type Picked = { file: File; hash: string; preview: string; duplicate?: { slug: string | null } }

export function Upload() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tax = useData(loadTaxonomy, [])
  const [picked, setPicked] = useState<Picked>()
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  useTitle(t.upload.title)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]
    setPicked(undefined)
    setError(undefined)
    if (!file) return
    if (!ALLOWED.includes(file.type)) return setError(t.upload.badType)
    if (file.type === 'image/gif' && file.size > MAX_BYTES) return setError(t.upload.tooBig)
    setChecking(true)
    const hash = await sha256(file)
    const { data } = await supabase.rpc('find_duplicate', { p_sha256: hash })
    setChecking(false)
    setPicked({ file, hash, preview: URL.createObjectURL(file), duplicate: data?.[0] })
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!picked || picked.duplicate || !profile) return
    const form = new FormData(e.currentTarget)
    const text = (k: string) => String(form.get(k) ?? '').trim()
    setBusy(true)
    setError(undefined)
    try {
      let parentId: number | null = null
      const parent = text('parent').split('/meme/').pop()?.replace(/[/?#].*$/, '')
      if (parent) {
        const { data } = await supabase.from('memes').select('id').eq('slug', parent).eq('status', 'approved').maybeSingle()
        if (!data) throw new Error(t.upload.parentNotFound)
        parentId = data.id
      }

      // A5: le GIF restano originali per non perdere l'animazione; la miniatura usa il primo fotogramma
      const image = picked.file.type === 'image/gif' ? picked.file : await resize(picked.file, 1600)
      const thumb = await resize(picked.file, 400)
      if (image.size > MAX_BYTES) throw new Error(t.upload.tooBig)
      const base = `${profile.id}/${crypto.randomUUID()}`
      const imagePath = `${base}.${extension(image.type)}`
      const thumbPath = `${base}_thumb.${extension(thumb.type)}`
      for (const [path, blob] of [[imagePath, image], [thumbPath, thumb]] as const) {
        // ponytail: se un passo successivo fallisce i file restano orfani nel bucket; pulizia manuale dalla dashboard
        const { error } = await supabase.storage.from('memes').upload(path, blob, { contentType: blob.type })
        if (error) throw new Error(t.errors.generic)
      }

      const { data: meme, error } = await supabase.from('memes').insert({
        title: text('title'),
        description: text('description'),
        alt_text: text('alt_text'),
        image_path: imagePath,
        thumb_path: thumbPath,
        image_sha256: picked.hash,
        format: text('format'),
        language: text('language'),
        community_id: Number(text('community')) || null,
        parent_meme_id: parentId,
        first_seen_at: text('first_seen_at') || null,
      }).select('id').single()
      if (error) throw new Error(errorText(error, t.upload.duplicateHidden))

      const tags = form.getAll('tag').map((id) => ({ meme_id: meme.id, tag_id: Number(id) }))
      if (tags.length) await supabase.from('meme_tags').insert(tags)
      navigate(`/u/${profile.username}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic)
      setBusy(false)
    }
  }

  if (tax.error) return <Status error />
  if (!tax.data) return <Status loading />
  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{t.upload.title}</h1>
      <p className="mt-1 text-slate-600">{t.upload.intro}</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-md border border-slate-200 bg-white p-4">
        <label className="block text-sm text-slate-700">{t.upload.image}
          <input name="image" type="file" required accept={ALLOWED.join(',')} onChange={pick}
            aria-describedby="image-hint" className={field} />
        </label>
        <p id="image-hint" className="text-xs text-slate-500">{t.upload.imageHint}</p>
        {checking && <p aria-live="polite" className="text-sm text-slate-500">{t.upload.checking}</p>}
        {picked?.duplicate && (
          <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">
            {picked.duplicate.slug ? <>{t.upload.duplicate} <Link className="underline" to={`/meme/${picked.duplicate.slug}`}>{t.upload.duplicateLink}</Link></>
              : t.upload.duplicateHidden}
          </p>
        )}
        {picked && !picked.duplicate && (
          <img src={picked.preview} alt="" className="max-h-64 rounded border border-slate-200" />
        )}

        <label className="block text-sm text-slate-700">{t.upload.titleField}
          <input name="title" required minLength={3} maxLength={120} className={field} />
        </label>
        <label className="block text-sm text-slate-700">{t.upload.description} <span className="text-slate-500">{t.common.optional}</span>
          <textarea name="description" maxLength={2000} rows={3} className={field} />
        </label>
        <label className="block text-sm text-slate-700">{t.upload.altText}
          <input name="alt_text" required minLength={5} maxLength={300} aria-describedby="alt-hint" className={field} />
        </label>
        <p id="alt-hint" className="-mt-3 text-xs text-slate-500">{t.upload.altHint}</p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm text-slate-700">{t.upload.format}
            <select name="format" className={field}>
              {Object.entries(t.format).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">{t.upload.language}
            <select name="language" className={field}>
              {Object.entries(t.language).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">{t.upload.community}
            <select name="community" className={field}>
              <option value="">{t.upload.none}</option>
              {tax.data.communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="text-sm text-slate-700">{t.upload.tags} <span className="text-slate-500">{t.common.optional}</span></legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {tax.data.tags.map((x) => (
              <label key={x.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="tag" value={x.id} /> #{x.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700">{t.upload.parent} <span className="text-slate-500">{t.common.optional}</span>
            <input name="parent" defaultValue={params.get('parent') ?? ''} aria-describedby="parent-hint" className={field} />
            <span id="parent-hint" className="mt-1 block text-xs text-slate-500">{t.upload.parentHint}</span>
          </label>
          <label className="text-sm text-slate-700">{t.upload.firstSeen} <span className="text-slate-500">{t.common.optional}</span>
            <input name="first_seen_at" type="date" max={today} className={field} />
          </label>
        </div>

        <label className="flex gap-2 text-sm text-slate-700">
          <input type="checkbox" required className="mt-0.5" />
          <span>{t.upload.rules} <Link to="/termini" target="_blank" className="underline">{t.upload.rulesLink}</Link> {t.upload.rulesTail}</span>
        </label>
        <ErrorText>{error}</ErrorText>
        <button disabled={busy || checking || !!picked?.duplicate} className={primary}>
          {busy ? t.common.saving : t.upload.submit}
        </button>
      </form>
    </section>
  )
}
