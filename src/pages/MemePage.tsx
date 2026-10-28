// FR-02 scheda, FR-03 padre e varianti, FR-04 timeline
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { CARD, formatDate, imageUrl, must, useData, useTitle, type Card, type Stage } from '../lib/data'
import { MemeCard, StageBadge, Status, score } from '../components/ui'
import { t } from '../locales/it'

type Payload = { from?: Stage; to?: Stage; up?: number; url?: string; seen_on?: string }

export function MemePage() {
  const { slug = '' } = useParams()
  const [showNsfw, setShowNsfw] = useState(false)
  const { data, loading, error } = useData(async () => {
    const r = await supabase.from('memes')
      .select('*, communities(name, slug), tags(name, slug), uploader:profiles!memes_uploader_id_fkey(username)')
      .eq('slug', slug).maybeSingle()
    if (r.error) throw r.error
    const m = r.data
    if (!m) return null
    const [parent, variants, activities] = await Promise.all([
      m.parent_meme_id ? supabase.from('memes').select('slug, title').eq('id', m.parent_meme_id).maybeSingle() : null,
      supabase.from('memes').select(CARD).eq('parent_meme_id', m.id).eq('status', 'approved').order('score', { ascending: false }),
      supabase.from('activities').select('id, type, payload, created_at, profiles(username)')
        .eq('meme_id', m.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50),
    ])
    return { m, parent: parent?.data, variants: must(variants) as Card[], activities: must(activities) }
  }, [slug])
  useTitle(data?.m.title)

  if (error) return <Status error />
  if (loading) return <Status loading />
  if (!data) return <Status empty={t.meme.notFound} />
  const { m, parent, variants, activities } = data
  const hidden = m.is_nsfw && !showNsfw

  const rows: [string, ReactNode][] = [
    [t.meme.stage, <StageBadge stage={m.stage} />],
    [t.meme.score, <span className="tabular-nums">{score(m.score)}</span>],
    [t.meme.votes, `${t.meme.up(m.up_votes)} · ${t.meme.down(m.down_votes)}`],
    [t.meme.community, m.communities ? <Link className="underline" to={`/community/${m.communities.slug}`}>{m.communities.name}</Link> : '—'],
    [t.meme.tags, m.tags.length ? (
      <span className="flex flex-wrap gap-1">
        {m.tags.map((x) => <Link key={x.slug} to={`/tag/${x.slug}`} className="rounded bg-slate-100 px-1.5 text-sm hover:underline">#{x.name}</Link>)}
      </span>
    ) : '—'],
    [t.meme.format, t.format[m.format] ?? m.format],
    [t.meme.language, t.language[m.language] ?? m.language],
    [t.meme.firstSeen, m.first_seen_at ? formatDate(m.first_seen_at) : t.meme.unknown],
    [t.meme.uploadedBy, m.uploader?.username ?? t.meme.deletedUser],
  ]

  return (
    <article>
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          <img src={imageUrl(m.image_path)} alt={hidden ? t.meme.nsfw : m.alt_text} fetchPriority="high"
            className={`mx-auto max-h-[70vh] w-auto object-contain ${hidden ? 'scale-110 blur-2xl' : ''}`} />
          {hidden && (
            <button onClick={() => setShowNsfw(true)}
              className="absolute inset-0 m-auto h-fit w-fit rounded bg-slate-900/80 px-4 py-2 text-sm font-medium text-white">
              {t.meme.showNsfw}
            </button>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{m.title}</h1>
          {m.description && <p className="mt-2 whitespace-pre-line text-slate-700">{m.description}</p>}
          <dl className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-2 px-3 py-2">
                <dt className="text-slate-500">{k}</dt><dd className="text-slate-900">{v}</dd>
              </div>
            ))}
            {parent && (
              <div className="grid grid-cols-[9rem_1fr] gap-2 px-3 py-2">
                <dt className="text-slate-500">{t.meme.parent}</dt>
                <dd><Link className="underline" to={`/meme/${parent.slug}`}>{parent.title}</Link></dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">{t.meme.variants}</h2>
        {variants.length ? (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {variants.map((v) => <li key={v.id}><MemeCard meme={v} compact /></li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-500">{t.meme.noVariants}</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">{t.meme.timeline}</h2>
        <ol className="mt-3 border-l-2 border-slate-200">
          {activities.map((a) => {
            const p = a.payload as Payload
            const label = a.type === 'stage_changed' && p.from && p.to ? t.activity.stage_changed(t.stage[p.from], t.stage[p.to])
              : a.type === 'voted_milestone' ? t.activity.voted_milestone(p.up ?? 0)
              : t.activity[a.type as 'created' | 'approved' | 'sighting_added']
            return (
              <li key={a.id} className="relative py-2 pl-4 text-sm">
                <span className="absolute top-3.5 -left-[5px] h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                <span className="text-slate-900">{label}</span>
                {a.type === 'sighting_added' && p.url && (
                  <> · <a className="underline" href={p.url} rel="nofollow noopener noreferrer" target="_blank">{new URL(p.url).hostname}</a></>
                )}
                <span className="block text-slate-500">
                  {formatDate(a.created_at)}{a.profiles?.username && ` · ${a.profiles.username}`}
                </span>
              </li>
            )
          })}
        </ol>
      </section>
    </article>
  )
}
