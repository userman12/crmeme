// FR-25: meme per stage, top 10, saliti negli ultimi 30 giorni, tempo medio Avvistato → Mainstream
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { STAGES, formatDate, must, useData, useTitle, type Card, type Stage } from '../lib/data'
import { MemeCard, Status } from '../components/ui'
import { t } from '../locales/it'

type Stats = {
  per_stage: Partial<Record<Stage, number>>
  top: Card[]
  risen_count: number
  risen: { slug: string; title: string; from: Stage; to: Stage; at: string }[]
  avg_days_to_mainstream: number | null
  reached_mainstream: number
}

export function Dashboard() {
  useTitle(t.dashboard.title, t.dashboard.intro)
  const { data, error } = useData(async () => must(await supabase.rpc('dashboard')) as unknown as Stats, [])
  if (error) return <Status error />
  if (!data) return <Status loading />
  const max = Math.max(1, ...STAGES.map((s) => data.per_stage[s] ?? 0))
  const tile = 'rounded-md border border-slate-200 bg-white p-4'

  return (
    <>
      <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>
      <p className="mt-1 text-slate-600">{t.dashboard.intro}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className={tile}>
          <h2 className="text-sm text-slate-600">{t.dashboard.risen}</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{t.dashboard.risenCount(data.risen_count)}</p>
        </section>
        <section className={tile}>
          <h2 className="text-sm text-slate-600">{t.dashboard.avg}</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {data.avg_days_to_mainstream == null ? '—' : t.dashboard.avgValue(data.avg_days_to_mainstream)}
          </p>
          <p className="text-xs text-slate-500">{t.dashboard.avgBase(data.reached_mainstream)}</p>
        </section>
      </div>

      <section className={`${tile} mt-4`}>
        <h2 className="font-semibold">{t.dashboard.perStage}</h2>
        {/* una sola serie: un colore, valore scritto accanto alla barra, nessuna legenda */}
        <ul className="mt-3 space-y-0.5">
          {STAGES.map((s) => {
            const n = data.per_stage[s] ?? 0
            return (
              <li key={s} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 rounded px-1 py-1 text-sm hover:bg-slate-50"
                title={t.dashboard.perStageCount(t.stage[s], n)}>
                <span className="text-slate-700">{t.stage[s]}</span>
                <span className="flex items-center gap-2">
                  <span className="h-3 rounded-r bg-slate-700" style={{ width: `${(n / max) * 85}%` }} aria-hidden />
                  <span className="tabular-nums text-slate-900">{n}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t.dashboard.top}</h2>
        {data.top.length === 0 ? <Status empty={t.dashboard.none} /> : (
          <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.top.map((m) => <li key={m.id}><MemeCard meme={m} compact /></li>)}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t.dashboard.risen}</h2>
        {data.risen.length === 0 ? <Status empty={t.dashboard.none} /> : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm">
            {data.risen.map((r) => (
              <li key={r.slug} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
                <Link to={`/meme/${r.slug}`} className="font-medium underline">{r.title}</Link>
                <span className="text-slate-700">{t.dashboard.move(t.stage[r.from], t.stage[r.to])}</span>
                <span className="ml-auto text-slate-500">{formatDate(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
