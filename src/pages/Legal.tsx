// CMP-01 termini, CMP-02 privacy, CMP-04 contatti
import { legalPages, t } from '../locales/it'
import { useTitle } from '../lib/data'

export function Legal({ page }: { page: keyof typeof legalPages }) {
  const { title, sections } = legalPages[page]
  useTitle(title)
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {t.legal.draft && <p role="note" className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">{t.legal.draft}</p>}
      {sections.map((s) => (
        <section key={s.h} className="mt-6">
          <h2 className="text-lg font-semibold">{s.h}</h2>
          {s.p.length > 1
            ? <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{s.p.map((x) => <li key={x}>{x}</li>)}</ul>
            : <p className="mt-2 text-slate-700">{s.p[0]}</p>}
        </section>
      ))}
      <p className="mt-8 text-sm text-slate-500">{t.legal.lastUpdate(t.legal.updated)}</p>
    </article>
  )
}
