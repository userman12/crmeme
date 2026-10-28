// NFR-11: permessi e formula dello score, verificati contro il progetto Supabase di sviluppo.
// Ogni client usa l'API pubblica come farebbe chiunque, senza passare dall'interfaccia.
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../src/lib/database.types'

type Db = SupabaseClient<Database>
const url = process.env.VITE_SUPABASE_URL as string
const pub = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin: Db = createClient<Database>(url, process.env.SUPABASE_SECRET_KEY as string, opts)
const anon: Db = createClient<Database>(url, pub, opts)

const run = Math.random().toString(36).slice(2, 8)
const createdUsers: string[] = []
const createdMemes: number[] = []

// Login con magic link senza email: il link lo genera l'API admin (A2)
async function member(name: string, role: Database['public']['Enums']['user_role'] = 'user') {
  const email = `test_${name}_${run}@example.com`
  const { data: u, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  createdUsers.push(u.user.id)
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const client = createClient<Database>(url, pub, opts)
  const { error: otpError } = await client.auth.verifyOtp({ token_hash: link.data.properties?.hashed_token ?? '', type: 'email' })
  if (otpError) throw otpError
  const p = await client.from('profiles').insert({ id: u.user.id, username: `t_${name}_${run}`, terms_accepted_at: new Date().toISOString() })
  if (p.error) throw p.error
  if (role !== 'user') await admin.from('profiles').update({ role }).eq('id', u.user.id)
  return { client, id: u.user.id }
}

const fakeMeme = (n: number) => ({
  title: `Test ${run} ${n}`,
  alt_text: 'Immagine di test',
  image_path: 'test/x.png',
  thumb_path: 'test/x_thumb.png',
  image_sha256: createHash('sha256').update(`${run}:${n}`).digest('hex'),
})

async function insertMeme(client: Db, n: number) {
  const { data, error } = await client.from('memes').insert(fakeMeme(n)).select('id, status, stage').single()
  if (error) throw error
  createdMemes.push(data.id)
  return data
}

let user: Awaited<ReturnType<typeof member>>
let curator: Awaited<ReturnType<typeof member>>
let memeId: number

beforeAll(async () => {
  user = await member('user')
  curator = await member('cur', 'curator')
  memeId = (await insertMeme(user.client, 0)).id
})

afterAll(async () => {
  if (createdMemes.length) await admin.from('memes').delete().in('id', createdMemes)
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id)
})

describe('lettura pubblica', () => {
  it('un visitatore vede solo meme approvati', async () => {
    const { data } = await anon.from('memes').select('status')
    expect(data?.length).toBeGreaterThan(0)
    expect(new Set(data?.map((m) => m.status))).toEqual(new Set(['approved']))
  })

  it('un visitatore non vede email né voti altrui', async () => {
    const { data } = await anon.from('votes').select('*')
    expect(data).toEqual([])
  })
})

describe('caricamento (FR-13)', () => {
  it('entra pending in Avvistato, visibile al proprietario ma non al pubblico', async () => {
    const { data: own } = await user.client.from('memes').select('status, stage').eq('id', memeId).single()
    expect(own).toEqual({ status: 'pending', stage: 'spotted' })
    const { data: pub } = await anon.from('memes').select('id').eq('id', memeId)
    expect(pub).toEqual([])
  })

  it('un utente non può impostare status o score', async () => {
    const { error } = await user.client.from('memes').insert({ ...fakeMeme(99), status: 'approved' })
    expect(error?.code).toBe('42501')
    const { error: e2 } = await user.client.from('memes').insert({ ...fakeMeme(98), score: 1000 })
    expect(e2?.code).toBe('42501')
  })

  it('un visitatore non può caricare', async () => {
    const { error } = await anon.from('memes').insert(fakeMeme(97))
    expect(error).not.toBeNull()
  })
})

describe('pipeline (A7)', () => {
  it('il curatore approva; un utente non cambia stage nemmeno via API', async () => {
    expect((await curator.client.from('memes').update({ status: 'approved' }).eq('id', memeId)).error).toBeNull()
    const { data } = await user.client.from('memes').update({ stage: 'rising' }).eq('id', memeId).select()
    expect(data).toEqual([])
    const { data: m } = await admin.from('memes').select('stage').eq('id', memeId).single()
    expect(m?.stage).toBe('spotted')
  })

  it('il curatore non può saltare stage', async () => {
    const { error } = await curator.client.from('memes').update({ stage: 'mainstream' }).eq('id', memeId)
    expect(error?.message).toBe('stage_transition_invalid')
  })

  it('spostamento valido registra stage_changed nella timeline', async () => {
    expect((await curator.client.from('memes').update({ stage: 'rising' }).eq('id', memeId)).error).toBeNull()
    const { data } = await anon.from('activities').select('type, payload').eq('meme_id', memeId).eq('type', 'stage_changed')
    expect(data).toEqual([{ type: 'stage_changed', payload: { from: 'spotted', to: 'rising' } }])
  })

  it('suggerimento accettato dal curatore sposta il meme', async () => {
    const bad = await user.client.from('stage_suggestions').insert({ meme_id: memeId, from_stage: 'rising', to_stage: 'dead', reason: 'no' })
    expect(bad.error).not.toBeNull()
    const { data: s, error } = await user.client.from('stage_suggestions')
      .insert({ meme_id: memeId, from_stage: 'rising', to_stage: 'mainstream', reason: 'Ovunque nei gruppi' }).select('id').single()
    expect(error).toBeNull()
    expect((await user.client.from('stage_suggestions').update({ status: 'accepted' }).eq('id', s?.id ?? 0).select()).data).toEqual([])
    expect((await curator.client.from('stage_suggestions').update({ status: 'accepted' }).eq('id', s?.id ?? 0)).error).toBeNull()
    const { data: m } = await anon.from('memes').select('stage').eq('id', memeId).single()
    expect(m?.stage).toBe('mainstream')
  })
})

describe('voti e score (FR-08, FR-09)', () => {
  it('un visitatore non può votare', async () => {
    expect((await anon.from('votes').insert({ meme_id: memeId, value: 1 })).error).not.toBeNull()
  })

  it('non si vota il proprio meme', async () => {
    expect((await user.client.from('votes').insert({ meme_id: memeId, value: 1 })).error?.message).toBe('vote_own_meme')
  })

  it('lo score segue la formula dopo un voto', async () => {
    expect((await curator.client.from('votes').insert({ meme_id: memeId, value: 1 })).error).toBeNull()
    const { data: m } = await anon.from('memes').select('score, up_votes, created_at, first_seen_at').eq('id', memeId).single()
    const { data: c } = await anon.from('score_config').select('*').single()
    if (!m || !c) throw new Error('dati mancanti')
    const weeks = (Date.now() - new Date(m.created_at).getTime()) / 604_800_000
    const expected = (c.w_net * 1 + c.w_recent * 1 + c.w_variants * 0) / (weeks + c.age_offset) ** c.gravity
    expect(m.up_votes).toBe(1)
    expect(m.score).toBeCloseTo(expected, 4)
  })

  it('togliere il voto riporta lo score a zero', async () => {
    expect((await curator.client.from('votes').delete().eq('meme_id', memeId)).error).toBeNull()
    const { data: m } = await anon.from('memes').select('score').eq('id', memeId).single()
    expect(m?.score).toBe(0)
  })
})

describe('limiti (NFR-05)', () => {
  it('massimo 10 caricamenti in 24 ore', async () => {
    for (let n = 1; n < 10; n++) await insertMeme(user.client, n)  // 1 già caricato in beforeAll
    const { error } = await user.client.from('memes').insert(fakeMeme(10))
    expect(error?.message).toBe('rate_limit_uploads')
  })
})

describe('storage (NFR-01, NFR-04)', () => {
  it('rifiuta file oltre 5 MB e tipi non ammessi', async () => {
    const bucket = user.client.storage.from('memes')
    const big = await bucket.upload(`${user.id}/big.png`, new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }))
    expect(big.error).not.toBeNull()
    const txt = await bucket.upload(`${user.id}/x.txt`, new Blob(['ciao'], { type: 'text/plain' }))
    expect(txt.error).not.toBeNull()
    const other = await bucket.upload(`${curator.id}/x.png`, new Blob(['x'], { type: 'image/png' }))
    expect(other.error).not.toBeNull()  // solo nella propria cartella
  })
})

describe('contributi (FR-11, FR-15, FR-24)', () => {
  it('find_duplicate: il visitatore non può usarlo, l’utente sì; lo slug solo se pubblico', async () => {
    const { data: approved } = await admin.from('memes').select('slug, image_sha256').eq('status', 'approved').limit(1).single()
    const { data: pending } = await admin.from('memes').select('image_sha256').eq('status', 'pending').limit(1).single()
    expect((await anon.rpc('find_duplicate', { p_sha256: approved?.image_sha256 ?? '' })).error).not.toBeNull()
    expect((await user.client.rpc('find_duplicate', { p_sha256: approved?.image_sha256 ?? '' })).data)
      .toEqual([{ slug: approved?.slug, status: 'approved' }])
    expect((await user.client.rpc('find_duplicate', { p_sha256: pending?.image_sha256 ?? '' })).data)
      .toEqual([{ slug: null, status: 'pending' }])
    expect((await user.client.rpc('find_duplicate', { p_sha256: 'f'.repeat(64) })).data).toEqual([])
  })

  it('add_sighting registra un’attività e rifiuta URL non validi', async () => {
    const ok = await user.client.rpc('add_sighting', { p_meme: memeId, p_url: 'https://example.com/post/1', p_seen_on: '2026-10-01' })
    expect(ok.error).toBeNull()
    const bad = await user.client.rpc('add_sighting', { p_meme: memeId, p_url: 'javascript:alert(1)', p_seen_on: '2026-10-01' })
    expect(bad.error?.message).toBe('invalid_url')
    expect((await anon.rpc('add_sighting', { p_meme: memeId, p_url: 'https://example.com', p_seen_on: '2026-10-01' })).error).not.toBeNull()
    const { data } = await anon.from('activities').select('payload').eq('meme_id', memeId).eq('type', 'sighting_added')
    expect(data).toEqual([{ payload: { url: 'https://example.com/post/1', seen_on: '2026-10-01' } }])
  })

  it('delete_my_account: i meme restano a "utente eliminato", i voti spariscono', async () => {
    const leaving = await member('leaving')
    const target = (await admin.from('memes').select('id, up_votes').eq('status', 'approved')
      .neq('uploader_id', leaving.id).limit(1).single()).data
    if (!target) throw new Error('nessun meme')
    expect((await leaving.client.from('votes').insert({ meme_id: target.id, value: 1 })).error).toBeNull()
    const mine = await insertMeme(leaving.client, 50)
    expect((await leaving.client.rpc('delete_my_account')).error).toBeNull()
    const { data: m } = await admin.from('memes').select('uploader_id').eq('id', mine.id).single()
    expect(m?.uploader_id).toBeNull()
    const { data: after } = await admin.from('memes').select('up_votes').eq('id', target.id).single()
    expect(after?.up_votes).toBe(target.up_votes)
    expect((await admin.auth.admin.getUserById(leaving.id)).data.user).toBeNull()
  })
})
