// FR-05 kanban, FR-06 drag and drop per i curatori (solo verso lo stage successivo, A7), FR-07 lista per stage su mobile
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type Active, type Announcements, type Over,
} from '@dnd-kit/core'
import { supabase } from '../lib/supabase'
import { isCurator, useAuth } from '../lib/auth'
import { CARD, NEXT_STAGE, PAGE, STAGES, errorText, must, useData, useTitle, type Card, type Stage } from '../lib/data'
import { ErrorText, MemeCard, Status } from '../components/ui'
import { t } from '../locales/it'

// FR-07: il trascinamento c'è solo quando le colonne sono affiancate
const wideQuery = '(min-width: 1024px)'
const subscribe = (cb: () => void) => {
  const mq = matchMedia(wideQuery)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useWide = () => useSyncExternalStore(subscribe, () => matchMedia(wideQuery).matches)

// Al rilascio il browser genera anche un clic sul link della card. dnd-kit ne ferma la propagazione sul
// document, ma non la navigazione nativa del link: la blocchiamo su window, che viene prima.
let lastDragEnd = 0
const swallowClickAfterDrag = (e: Event) => {
  if (Date.now() - lastDragEnd < 300) e.preventDefault()
}

const cardOf = (a: Active | Over | null) => a?.data.current as Card | undefined
const announcements: Announcements = {
  onDragStart: ({ active }) => t.dnd.picked(cardOf(active)?.title ?? ''),
  onDragOver: ({ active, over }) => (over ? t.dnd.over(cardOf(active)?.title ?? '', t.stage[over.id as Stage]) : undefined),
  onDragEnd: ({ active, over }) => (over ? t.dnd.dropped(cardOf(active)?.title ?? '', t.stage[over.id as Stage]) : t.dnd.cancelled(cardOf(active)?.title ?? '')),
  onDragCancel: ({ active }) => t.dnd.cancelled(cardOf(active)?.title ?? ''),
}

export function Pipeline() {
  const { profile } = useAuth()
  const curator = isCurator(profile)
  const wide = useWide()
  const [mobileStage, setMobileStage] = useState<Stage>('spotted')
  const [version, setVersion] = useState(0)  // a ogni spostamento le colonne si ricaricano
  const [dragging, setDragging] = useState<Card>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    window.addEventListener('click', swallowClickAfterDrag, true)
    return () => window.removeEventListener('click', swallowClickAfterDrag, true)
  }, [])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))
  useTitle(t.pipeline.title)

  async function move(card: Card, to: Stage) {
    // il database rifiuta comunque ogni mossa che non sia verso lo stage successivo
    const { error } = await supabase.from('memes').update({ stage: to }).eq('id', card.id)
    setError(error ? errorText(error) : undefined)
    if (!error) setVersion((v) => v + 1)
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">{t.pipeline.title}</h1>
      <p className="mt-1 text-slate-600">{t.pipeline.intro}</p>
      {curator && <p className="mt-1 text-sm text-slate-500">{t.dnd.dragHint}</p>}
      <ErrorText>{error}</ErrorText>
      <label className="mt-4 block text-sm text-slate-700 lg:hidden">
        {t.pipeline.pickStage}
        <select value={mobileStage} onChange={(e) => setMobileStage(e.target.value as Stage)}
          className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5">
          {STAGES.map((s) => <option key={s} value={s}>{t.stage[s]}</option>)}
        </select>
      </label>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t.dnd.instructions } }}
        onDragStart={({ active }) => setDragging(cardOf(active))}
        onDragCancel={() => { lastDragEnd = Date.now(); setDragging(undefined) }}
        onDragEnd={({ active, over }) => {
          lastDragEnd = Date.now()
          const card = cardOf(active)
          setDragging(undefined)
          if (!card || !over || over.id === card.stage) return
          if (over.id === NEXT_STAGE[card.stage]) move(card, over.id as Stage)
          else setError(t.dnd.invalid)
        }}
      >
        {/* Sotto lg si vede una sola colonna, scelta dal menu */}
        <div className="mt-4 lg:grid lg:grid-cols-7 lg:gap-3">
          {STAGES.map((s) => (
            <Column key={s} stage={s} version={version} hiddenOnMobile={s !== mobileStage}
              target={!!dragging && NEXT_STAGE[dragging.stage] === s}
              curator={curator} draggable={curator && wide} onMove={move} />
          ))}
        </div>
      </DndContext>
    </>
  )
}

type ColumnProps = {
  stage: Stage; version: number; hiddenOnMobile: boolean; target: boolean
  curator: boolean; draggable: boolean; onMove: (card: Card, to: Stage) => void
}

function Column({ stage, version, hiddenOnMobile, target, curator, draggable, onMove }: ColumnProps) {
  const [limit, setLimit] = useState(PAGE)
  // tutte le colonne restano attive: dnd-kit misura le aree di rilascio all'inizio del trascinamento
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const { data, last, loading, error } = useData(async () => {
    const r = await supabase.from('memes').select(CARD, { count: 'exact' })
      .eq('status', 'approved').eq('stage', stage)
      .order('score', { ascending: false }).order('id').range(0, limit - 1)
    return { rows: must(r) as Card[], count: r.count ?? 0 }
  }, [stage, limit, version])
  const shown = data ?? last

  return (
    <section ref={setNodeRef} aria-labelledby={`col-${stage}`}
      className={`${hiddenOnMobile ? 'hidden lg:block' : ''} rounded-md p-2 ${
        target ? (isOver ? 'bg-emerald-100 ring-2 ring-emerald-600' : 'bg-emerald-50 outline-2 outline-dashed outline-emerald-500') : 'bg-slate-100'}`}>
      <h2 id={`col-${stage}`} className="flex items-baseline justify-between px-1 pb-2 text-sm font-semibold text-slate-800">
        {t.stage[stage]} <span className="font-normal text-slate-500 tabular-nums">{shown?.count ?? ''}</span>
      </h2>
      {error ? <Status error /> : !shown ? <Status loading /> : shown.count === 0 ? <Status empty={t.pipeline.empty} /> : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {shown.rows.map((m) => <PipelineCard key={m.id} meme={m} curator={curator} draggable={draggable} onMove={onMove} />)}
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

function PipelineCard({ meme, curator, draggable, onMove }: { meme: Card; curator: boolean; draggable: boolean; onMove: ColumnProps['onMove'] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: meme.id, data: meme, disabled: !draggable })
  const next = NEXT_STAGE[meme.stage]
  return (
    <li ref={setNodeRef} {...(draggable ? { ...attributes, ...listeners } : {})}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`${isDragging ? 'relative z-10 shadow-lg' : ''} ${draggable ? 'cursor-grab touch-none rounded-md focus-visible:outline-2 focus-visible:outline-indigo-600' : ''}`}>
      <MemeCard meme={meme} compact />
      {curator && (
        <button onClick={() => onMove(meme, next)}
          className="mt-1 w-full rounded border border-slate-300 bg-white py-0.5 text-xs font-medium hover:bg-slate-50">
          {t.dnd.move(t.stage[next])}
        </button>
      )}
    </li>
  )
}
