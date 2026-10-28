// FR-01 home, FR-16 ricerca con filtri, FR-17 pagine community e tag: stesso elenco, filtri diversi
import { useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { CARD, PAGE, STAGES, loadTaxonomy, must, useData, useTitle, type Card, type Stage } from '../lib/data'
import { MemeCard, Status } from '../components/ui'
import { t } from '../locales/it'

const SORTS = Object.keys(t.catalog.sortBy) as (keyof typeof t.catalog.sortBy)[]

type Filters = { q: string; stage: string; language: string; sort: string; communityId?: number; tagId?: number }

export function Catalog() {
  const route = useParams()  // /community/:community, /tag/:tag
  const [params, setParams] = useSearchParams()
  const tax = useData(loadTaxonomy, [])
  const p = (k: string) => params.get(k) ?? ''

  const community = tax.data?.communities.find((c) => c.slug === (route.community ?? p('community')))
  const tag = tax.data?.tags.find((x) => x.slug === (route.tag ?? p('tag')))
  const heading = route.community ? community && t.catalog.communityTitle(community.name)
    : route.tag ? tag && t.catalog.tagTitle(tag.name) : t.catalog.title
  useTitle(heading)

  // NFR-02: la home non aspetta community e tag; servono solo per filtrare per uno di essi
  const needsTax = !!(route.community || route.tag || p('community') || p('tag'))
  if (needsTax && tax.error) return <Status error />
  if (needsTax && tax.loading) return <Status loading />
  if ((route.community && !community) || (route.tag && !tag)) return <Status empty={t.catalog.notFound} />

  const filters: Filters = {
    q: p('q'), stage: p('stage'), language: p('language'), sort: p('sort') || 'score',
    communityId: community?.id, tagId: tag?.id,
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = new URLSearchParams()
    for (const [k, v] of new FormData(e.currentTarget)) if (v) next.set(k, String(v))
    setParams(next)
  }

  const select = 'mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm'
  const autoSubmit = (e: { currentTarget: HTMLSelectElement }) => e.currentTarget.form?.requestSubmit()

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
      {route.community && community?.description && <p className="mt-1 text-slate-600">{community.description}</p>}

      <form key={params.toString() + !!tax.data} onSubmit={submit} aria-label={t.catalog.filters}
        className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="col-span-2 text-sm text-slate-700 sm:col-span-3 lg:col-span-2">
          {t.catalog.query}
          <input name="q" type="search" defaultValue={filters.q} placeholder={t.nav.searchPlaceholder} className={select} />
        </label>
        <label className="text-sm text-slate-700">{t.catalog.stage}
          <select name="stage" defaultValue={filters.stage} onChange={autoSubmit} className={select}>
            <option value="">{t.catalog.any}</option>
            {STAGES.map((s) => <option key={s} value={s}>{t.stage[s]}</option>)}
          </select>
        </label>
        {!route.tag && (
          <label className="text-sm text-slate-700">{t.catalog.tag}
            <select name="tag" defaultValue={tag?.slug ?? ''} onChange={autoSubmit} className={select}>
              <option value="">{t.catalog.any}</option>
              {tax.data?.tags.map((x) => <option key={x.id} value={x.slug}>#{x.name}</option>)}
            </select>
          </label>
        )}
        {!route.community && (
          <label className="text-sm text-slate-700">{t.catalog.community}
            <select name="community" defaultValue={community?.slug ?? ''} onChange={autoSubmit} className={select}>
              <option value="">{t.catalog.any}</option>
              {tax.data?.communities.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm text-slate-700">{t.catalog.language}
          <select name="language" defaultValue={filters.language} onChange={autoSubmit} className={select}>
            <option value="">{t.catalog.any}</option>
            {Object.entries(t.language).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-700">{t.catalog.sort}
          <select name="sort" defaultValue={filters.sort} onChange={autoSubmit} className={select}>
            {SORTS.map((s) => <option key={s} value={s}>{t.catalog.sortBy[s]}</option>)}
          </select>
        </label>
        <div className="col-span-2 flex items-end gap-3 sm:col-span-3 lg:col-span-6">
          <button className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">{t.catalog.apply}</button>
          {params.size > 0 && (
            <button type="button" onClick={() => setParams({})} className="text-sm text-slate-700 underline">{t.catalog.reset}</button>
          )}
        </div>
      </form>

      <Results key={JSON.stringify(filters)} filters={filters} />
    </>
  )
}

function Results({ filters }: { filters: Filters }) {
  const [limit, setLimit] = useState(PAGE)
  const { data, last, loading, error } = useData(async () => {
    let q = supabase.from('memes').select(CARD, { count: 'exact' }).eq('status', 'approved')
    if (filters.q) q = q.textSearch('search', filters.q, { config: 'italian', type: 'websearch' })
    if (filters.stage) q = q.eq('stage', filters.stage as Stage)
    if (filters.language) q = q.eq('language', filters.language)
    if (filters.communityId) q = q.eq('community_id', filters.communityId)
    if (filters.tagId) {
      // ponytail: elenco di id nella richiesta; passare a una funzione SQL se un tag supera qualche migliaio di meme
      const ids = must(await supabase.from('meme_tags').select('meme_id').eq('tag_id', filters.tagId)).map((r) => r.meme_id)
      q = q.in('id', ids)
    }
    if (filters.sort === 'recent') q = q.order('created_at', { ascending: false })
    if (filters.sort === 'stage') q = q.order('stage')
    const r = await q.order('score', { ascending: false }).order('id').range(0, limit - 1)
    return { rows: must(r) as Card[], count: r.count ?? 0 }
  }, [filters, limit])

  const shown = data ?? last
  if (error) return <div className="mt-6"><Status error /></div>
  if (!shown) return <div className="mt-6"><Status loading /></div>

  return (
    <section className="mt-6" aria-busy={loading}>
      <p className="mb-3 text-sm text-slate-600" aria-live="polite">{t.catalog.results(shown.count)}</p>
      {shown.count === 0 ? <Status empty={t.catalog.empty} /> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.rows.map((m, i) => <li key={m.id}><MemeCard meme={m} eager={i < 4} /></li>)}
        </ul>
      )}
      {shown.rows.length < shown.count && (
        <button onClick={() => setLimit(limit + PAGE)} disabled={loading}
          className="mx-auto mt-6 block rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
          {loading ? t.common.loading : t.catalog.more}
        </button>
      )}
    </section>
  )
}
