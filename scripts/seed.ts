// Seed del progetto di sviluppo: utenti demo, community, tag, 30 meme segnaposto, voti, storico stage.
// Uso: npm run seed   (legge .env.local; richiede SUPABASE_SECRET_KEY, quindi solo in locale)
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { crc32, deflateSync } from 'node:zlib'
import type { Database } from '../src/lib/database.types.ts'

type Stage = Database['public']['Enums']['stage']

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('Servono VITE_SUPABASE_URL e SUPABASE_SECRET_KEY in .env.local')
const db = createClient<Database>(url, key, { auth: { persistSession: false } })

function ok<R extends { data: unknown; error: { message: string } | null }>(r: R): NonNullable<R['data']> {
  if (r.error) throw new Error(r.error.message)
  return r.data as NonNullable<R['data']>
}

// PRNG deterministico: lo stesso seed produce sempre gli stessi dati
let state = 42
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rand() * a.length)] as T
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000)

// ── PNG minimale (RGB 8 bit) con solo zlib di Node ─────────────────────────
function png(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3)
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}

// Segnaposto: fasce "didascalia" sopra e sotto, righe diagonali al centro
function placeholder(i: number, w: number, h: number): Buffer {
  const hue = (i * 47) % 360
  const stripe = 20 + (i % 5) * 8
  return png(w, h, (x, y) => {
    if (y < h * 0.15 || y > h * 0.85) return [30, 30, 30]
    return Math.floor((x + y * (i % 2 ? 1 : -1) + w) / stripe) % 2 ? hsl(hue, 0.6, 0.55) : hsl(hue, 0.5, 0.75)
  })
}

// ── Dati ───────────────────────────────────────────────────────────────────
const communities = [
  { name: 'Ufficio Open Space', slug: 'ufficio-open-space', description: 'Meme nati tra una call e l’altra.' },
  { name: 'Chat di Famiglia', slug: 'chat-di-famiglia', description: 'Buongiornissimo e dintorni.' },
  { name: 'Forum Retrocomputing', slug: 'forum-retrocomputing', description: 'Floppy, modem e nostalgia.' },
  { name: 'Curva Virtuale', slug: 'curva-virtuale', description: 'Calcio, rigori e VAR.' },
  { name: 'Aula Studio', slug: 'aula-studio', description: 'Esami, appunti e caffè.' },
]
const tags = ['lunedi', 'riunioni', 'smart-working', 'gatti', 'calcio', 'nonni', 'informatica', 'scuola', 'caffe', 'burocrazia']
const users = ['admin_demo', 'curatore_demo', 'utente_uno', 'utente_due', 'utente_tre', 'utente_quattro', 'utente_cinque', 'utente_sei']
const titles = [
  'Riunione che poteva essere una mail', 'Il caffè delle 15', 'Lunedì mattina in KPI', 'Il gatto approva il budget',
  'Nonna scopre gli sticker', 'Rigore al novantesimo', 'Il modem a 56k', 'Ultima pagina degli appunti',
  'Ticket chiuso senza risposta', 'Smart working dal divano', 'Il collega che risponde a tutti', 'Buongiornissimo aziendale',
  'Report trimestrale emotivo', 'Il VAR guarda ancora', 'Floppy da 1,44 MB', 'Sessione invernale',
  'Firma in tre copie', 'La stampante ha deciso di no', 'Venerdì alle 17:59', 'Gatto in call',
  'Il PDF scannerizzato storto', 'Pausa pranzo infinita', 'Excel con 40 fogli', 'Allenatore da divano',
  'Il prof che dice “è facile”', 'Badge dimenticato', 'Server in produzione di venerdì', 'Calendario pieno di call',
  'Modulo da compilare a mano', 'Riavvia e riprova',
]
const stagePath: Stage[] = ['spotted', 'rising', 'mainstream', 'saturated', 'cringe', 'dead', 'revival']
const formats = ['image_macro', 'reaction', 'screenshot', 'comic', 'object_label'] as const

async function userId(username: string, role: Database['public']['Enums']['user_role']) {
  const email = `${username}@example.com`
  const created = await db.auth.admin.createUser({ email, email_confirm: true })
  let id = created.data.user?.id
  if (!id) {
    const list = ok(await db.auth.admin.listUsers({ perPage: 1000 }))
    id = list.users.find((u) => u.email === email)?.id
    if (!id) throw new Error(created.error?.message ?? 'utente non creato')
  }
  ok(await db.from('profiles').upsert({ id, username, role, terms_accepted_at: new Date().toISOString() }))
  return id
}

async function main() {
  const { count } = await db.from('memes').select('*', { count: 'exact', head: true })
  if (count) return console.log(`Già presenti ${count} meme: seed saltato.`)

  const communityIds = ok(await db.from('communities').upsert(communities, { onConflict: 'slug' }).select('id')).map((c) => c.id)
  const tagIds = ok(await db.from('tags').upsert(tags.map((s) => ({ name: s.replace('-', ' '), slug: s })), { onConflict: 'slug' }).select('id')).map((t) => t.id)

  const ids: string[] = []
  for (const [i, u] of users.entries()) ids.push(await userId(u, i === 0 ? 'admin' : i === 1 ? 'curator' : 'user'))
  const uploaders = ids.slice(2)

  const memeIds: number[] = []
  for (const [i, title] of titles.entries()) {
    const status = i < 26 ? 'approved' : i < 28 ? 'pending' : i === 28 ? 'rejected' : 'removed'
    const stage: Stage = status === 'approved' ? (stagePath[i % stagePath.length] as Stage) : 'spotted'
    const uploader = pick(uploaders)
    const createdAt = daysAgo(5 + Math.floor(rand() * 115))
    const image = placeholder(i, 800, 600)
    const file = `${uploader}/${randomUUID()}`
    for (const [path, body] of [[`${file}.png`, image], [`${file}_thumb.png`, placeholder(i, 400, 300)]] as const)
      ok(await db.storage.from('memes').upload(path, body, { contentType: 'image/png' }))

    const meme = ok(await db.from('memes').insert({
      title,
      description: `Scheda di esempio n. ${i + 1}. Contenuto segnaposto generato per lo sviluppo.`,
      alt_text: `Immagine segnaposto a righe colorate per “${title}”`,
      image_path: `${file}.png`,
      thumb_path: `${file}_thumb.png`,
      image_sha256: createHash('sha256').update(image).digest('hex'),
      format: pick(formats),
      language: i % 6 === 5 ? 'en' : 'it',
      stage,
      status,
      is_nsfw: i === 12,
      parent_meme_id: i >= 5 && i < 10 ? memeIds[i - 5] : null, // varianti dei primi 5 template
      community_id: pick(communityIds),
      uploader_id: uploader,
      first_seen_at: rand() < 0.5 ? daysAgo(5 + Math.floor(rand() * 200)).toISOString().slice(0, 10) : null,
      moderation_note: status === 'rejected' ? 'Duplicato di un formato già in archivio.' :
        status === 'removed' ? 'Rimosso a seguito di segnalazione per copyright.' : null,
      created_at: createdAt.toISOString(),
    }).select('id').single()).id
    memeIds.push(meme)

    ok(await db.from('meme_tags').insert([...new Set([pick(tagIds), pick(tagIds), pick(tagIds)])].map((tag_id) => ({ meme_id: meme, tag_id }))))

    // Storico stage retrodatato, per la timeline e la dashboard
    const steps = stagePath.indexOf(stage)
    if (steps > 0) {
      const span = Date.now() - createdAt.getTime()
      ok(await db.from('activities').insert(stagePath.slice(0, steps).map((from, s) => ({
        meme_id: meme, actor_id: ids[1], type: 'stage_changed' as const,
        payload: { from, to: stagePath[s + 1] },
        created_at: new Date(createdAt.getTime() + (span * (s + 1)) / (steps + 1)).toISOString(),
      }))))
    }

    if (status === 'approved') {
      const votes = ids.filter((u) => u !== uploader && rand() < 0.7).map((user_id) => ({
        user_id, meme_id: meme, value: rand() < 0.8 ? 1 : -1,
        created_at: new Date(createdAt.getTime() + rand() * (Date.now() - createdAt.getTime())).toISOString(),
      }))
      if (votes.length) ok(await db.from('votes').insert(votes))
    }

    if (status === 'removed') ok(await db.from('reports').insert({
      meme_id: meme, reason: 'copyright', details: 'Segnalazione di esempio.', status: 'actioned',
      resolution_note: 'Contenuto rimosso su richiesta del titolare dei diritti.', resolved_by: ids[1],
      resolved_at: new Date().toISOString(),
    }))
    process.stdout.write('.')
  }
  console.log(`\nSeed completato: ${memeIds.length} meme, ${ids.length} utenti (${users.join(', ')}).`)
}

await main()
