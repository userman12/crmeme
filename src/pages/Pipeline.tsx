// FR-05 kanban (sola lettura; drag and drop per i curatori in Fase 5), FR-07 lista per stage su mobile
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CARD, PAGE, STAGES, must, useData, useTitle, type Card, type Stage } from '../lib/data'
import { MemeCard, Status } from '../components/ui'
import { t } from '../locales/it'

export function Pipeline() {
  const [mobileStage, setMobileStage] = useState<Stage>('spotted')
  useTitle(t.pipeline.title)
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">{t.pipeline.title}</h1>
      <p className="mt-1 text-slate-600">{t.pipeline.intro}</p>
      <label className="mt-4 block text-sm text-slate-700 lg:hidden">
        {t.pipeline.pickStage}
        <select value={mobileStage} onChange={(e) => setMobileStage(e.target.value as Stage)}
          className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5">
          {STAGES.map((s) => <option key={s} value={s}>{t.stage[s]}</option>)}
        </select>
      </label>
      {/* Sotto lg si vede una sola colonna, scelta dal menu */}
      <div className="mt-4 lg:grid lg:grid-cols-7 lg:gap-3">
        {STAGES.map((s) => <Column key={s} stage={s} hiddenOnMobile={s !== mobileStage} />)}
      </div>
    </>
  )
}

function Column({ stage, hiddenOnMobile }: { stage: Stage; hiddenOnMobile: boolean }) {
  const [limit, setLimit] = useState(PAGE)
  const { data, last, loading, error } = useData(async () => {
    const r = await supabase.from('memes').select(CARD, { count: 'exact' })
      .eq('status', 'approved').eq('stage', stage)
      .order('score', { ascending: false }).order('id').range(0, limit - 1)
    return { rows: must(r) as Card[], count: r.count ?? 0 }
  }, [stage, limit])
  const shown = data ?? last

  return (
    <section aria-labelledby={`col-${stage}`}
      className={`${hiddenOnMobile ? 'hidden lg:block' : ''} rounded-md bg-slate-100 p-2`}>
      <h2 id={`col-${stage}`} className="flex items-baseline justify-between px-1 pb-2 text-sm font-semibold text-slate-800">
        {t.stage[stage]} <span className="font-normal text-slate-500 tabular-nums">{shown?.count ?? ''}</span>
      </h2>
      {error ? <Status error /> : !shown ? <Status loading /> : shown.count === 0 ? <Status empty={t.pipeline.empty} /> : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {shown.rows.map((m) => <li key={m.id}><MemeCard meme={m} compact /></li>)}
        </ul>
      )}
      {shown && shown.rows.length < shown.count && (
        <button onClick={() => setLimit(limit + PAGE)} disabled={loading}
          className="mt-2 w-full rounded border border-slate-300 bg-white py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
          {loading ? t.common.loading : t.catalog.more}
        </button>
      )}
    </section>
  )
}
