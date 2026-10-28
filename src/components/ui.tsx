import { Link } from 'react-router'
import { imageUrl, type Card, type Stage } from '../lib/data'
import { t } from '../locales/it'

const stageColor: Record<Stage, string> = {
  spotted: 'bg-sky-100 text-sky-900',
  rising: 'bg-emerald-100 text-emerald-900',
  mainstream: 'bg-indigo-100 text-indigo-900',
  saturated: 'bg-amber-100 text-amber-900',
  cringe: 'bg-rose-100 text-rose-900',
  dead: 'bg-slate-200 text-slate-800',
  revival: 'bg-fuchsia-100 text-fuchsia-900',
}

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${stageColor[stage]}`}>
      {t.stage[stage]}
    </span>
  )
}

export const score = (n: number) => n.toFixed(2)

/** Card per griglia e pipeline. NSFW sfocato (NFR-09). */
export function MemeCard({ meme, compact }: { meme: Card; compact?: boolean }) {
  return (
    <Link
      to={`/meme/${meme.slug}`}
      className="group block overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={imageUrl(meme.thumb_path)}
          alt={meme.is_nsfw ? t.meme.nsfw : meme.alt_text}
          loading="lazy"
          width={400}
          height={300}
          className={`h-full w-full object-cover ${meme.is_nsfw ? 'scale-110 blur-xl' : ''}`}
        />
        {meme.is_nsfw && (
          <span className="absolute inset-0 grid place-items-center text-sm font-medium text-white">{t.meme.nsfw}</span>
        )}
      </div>
      <div className={compact ? 'p-2' : 'p-3'}>
        <p className={`font-medium text-slate-900 group-hover:underline ${compact ? 'text-sm' : ''}`}>{meme.title}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
          {!compact && <StageBadge stage={meme.stage} />}
          <span className="tabular-nums" title={t.meme.score}>★ {score(meme.score)}</span>
        </div>
      </div>
    </Link>
  )
}

export function Status({ loading, error, empty }: { loading?: boolean; error?: boolean; empty?: string }) {
  if (error) return <p role="alert" className="text-rose-700">{t.common.error}</p>
  if (loading) return <p className="text-slate-500" aria-live="polite">{t.common.loading}</p>
  return empty ? <p className="text-slate-500">{empty}</p> : null
}
