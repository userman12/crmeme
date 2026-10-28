import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Database } from './database.types'
import { t } from '../locales/it'

export type Stage = Database['public']['Enums']['stage']
export const STAGES = Object.keys(t.stage) as Stage[]
// A7: stesso ciclo di public.next_stage(); il database resta l'unico arbitro
export const NEXT_STAGE: Record<Stage, Stage> = {
  spotted: 'rising', rising: 'mainstream', mainstream: 'saturated', saturated: 'cringe',
  cringe: 'dead', dead: 'revival', revival: 'rising',
}

// Campi minimi per card e liste (NFR-02: niente dati superflui)
export const CARD = 'id, slug, title, alt_text, thumb_path, stage, score, is_nsfw'
export type Card = Pick<Database['public']['Tables']['memes']['Row'],
  'id' | 'slug' | 'title' | 'alt_text' | 'thumb_path' | 'stage' | 'score' | 'is_nsfw'>

export const PAGE = 24

export const imageUrl = (path: string) => supabase.storage.from('memes').getPublicUrl(path).data.publicUrl
export const formatDate = (d: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(d))

/** Le query Supabase non lanciano eccezioni: questa le trasforma in errori. */
export function must<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error || r.data == null) throw r.error ?? new Error('not found')
  return r.data as NonNullable<T>
}

/** Carica dati quando cambiano le dipendenze; ignora le risposte arrivate in ritardo. */
export function useData<T>(load: () => PromiseLike<T>, deps: unknown[]) {
  const [version, setVersion] = useState(0)
  const key = JSON.stringify([deps, version])
  const [state, setState] = useState<{ key: string; data?: T; error?: true }>()
  useEffect(() => {
    let live = true
    load().then((data) => live && setState({ key, data }), () => live && setState({ key, error: true }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la chiave serializza già le dipendenze
  }, [key])
  const current = state?.key === key
  // last: dati della richiesta precedente, utili per non svuotare una lista mentre se ne carica la pagina successiva
  return {
    data: current ? state.data : undefined, last: state?.data, error: current && !!state.error, loading: !current,
    reload: () => setVersion(version + 1),
  }
}

// NFR-08: titolo della pagina aggiornato lato client
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${t.app.name}` : `${t.app.name} · ${t.app.tagline}`
  }, [title])
}

type Taxonomy = {
  communities: { id: number; name: string; slug: string; description: string; url: string | null }[]
  tags: { id: number; name: string; slug: string }[]
}
let taxonomy: Promise<Taxonomy> | undefined
/** Community e tag cambiano di rado: una sola richiesta per sessione. */
export const loadTaxonomy = () => (taxonomy ??= Promise.all([
  supabase.from('communities').select('id, name, slug, description, url').order('name'),
  supabase.from('tags').select('id, name, slug').order('name'),
]).then(([c, tg]) => ({ communities: must(c), tags: must(tg) })))

/** Testo leggibile per un errore Supabase; `duplicate` copre le violazioni di unicità (23505). */
export function errorText(e: unknown, duplicate?: string): string {
  const err = (e ?? {}) as { message?: string; code?: string }
  if (err.code === '23505' && duplicate) return duplicate
  return (err.message && t.errors[err.message]) || t.errors.generic || ''
}
