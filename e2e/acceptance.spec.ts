// Criteri di accettazione della scheda MVP, eseguiti in un browser vero.
// Vanno lanciati contro il progetto Supabase di sviluppo: creano e poi cancellano utenti e meme di test.
import { expect, test, type Browser, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { placeholder } from '../scripts/png.ts'

const admin = createClient(process.env.VITE_SUPABASE_URL as string, process.env.SUPABASE_SECRET_KEY as string,
  { auth: { persistSession: false } })
const run = Math.random().toString(36).slice(2, 8)
const users: string[] = []
const image = { name: 'meme.png', mimeType: 'image/png', buffer: placeholder(1000 + Math.floor(Math.random() * 1e6), 640, 480) }
const title = `Collaudo ${run}`

/** Accesso con magic link: il link lo genera l'API admin, nessuna email reale. */
async function signIn(browser: Browser, name: string, baseURL: string, role?: 'curator') {
  const email = `e2e_${name}_${run}@example.com`
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (data.user) users.push(data.user.id)
  const page = await (await browser.newContext({ locale: 'it-IT' })).newPage()
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${baseURL}/` } })
  await page.goto(link.data.properties?.action_link ?? '')
  // primo accesso: username e termini
  await page.getByLabel('Username').fill(`e2e_${name}_${run}`)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Salva e continua' }).click()
  await expect(page.getByRole('link', { name: 'Il tuo profilo' })).toBeVisible()
  if (role) {
    await admin.from('profiles').update({ role }).eq('id', data.user?.id ?? '')
    await page.reload()
  }
  return page
}

async function upload(page: Page) {
  await page.goto('/carica')
  await page.getByLabel('Immagine').setInputFiles(image)
  await expect(page.getByText('Controllo duplicati…')).toBeHidden()
}

test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  for (const id of users) {
    const { data } = await admin.storage.from('memes').list(id)
    if (data?.length) await admin.storage.from('memes').remove(data.map((f) => `${id}/${f.name}`))
  }
  await admin.from('memes').delete().in('uploader_id', users)
  for (const id of users) await admin.auth.admin.deleteUser(id)
})

test('un visitatore apre la home, filtra per stage e apre una scheda', async ({ page }) => {
  await page.goto('/')
  await page.locator('select[name=stage]').selectOption('mainstream')
  await expect(page).toHaveURL(/stage=mainstream/)
  const card = page.locator('main ul li a').first()
  const name = await card.locator('p').first().textContent()
  await card.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name ?? '')
  await expect(page.locator('dl')).toContainText('Mainstream')
})

test('un visitatore prova a votare e viene mandato al login', async ({ page }) => {
  await page.goto('/')
  await page.locator('main ul li a').first().click()
  await page.getByRole('button', { name: /Voto positivo/ }).click()
  await expect(page).toHaveURL(/\/accedi\?next=%2Fmeme%2F/)
  await expect(page.getByRole('heading', { name: 'Accedi o registrati' })).toBeVisible()
})

let user: Page
let curator: Page

test('un utente si registra, carica un meme e lo vede in attesa nel profilo, non nel catalogo', async ({ browser, baseURL }) => {
  user = await signIn(browser, 'user', baseURL ?? '')
  await upload(user)
  await user.getByLabel('Titolo').fill(title)
  await user.getByLabel('Testo alternativo').fill('Righe diagonali colorate di prova')
  await user.getByRole('checkbox', { name: /Confermo di aver letto/ }).check()
  await user.getByRole('button', { name: 'Invia in moderazione' }).click()
  await expect(user).toHaveURL(/\/u\/e2e_user_/)
  await expect(user.getByRole('listitem').filter({ hasText: title })).toContainText('In attesa')
  const anon = await (await browser.newContext()).newPage()
  await anon.goto(`/?q=${encodeURIComponent(title)}`)
  await expect(anon.getByText('Nessun meme corrisponde ai filtri.')).toBeVisible()
})

test('caricando lo stesso file due volte compare l’avviso di duplicato', async () => {
  await upload(user)
  await expect(user.getByRole('alert')).toContainText('già stata caricata')
  await expect(user.getByRole('button', { name: 'Invia in moderazione' })).toBeDisabled()
})

test('un curatore approva il meme, che appare nel catalogo nello stage Avvistato', async ({ browser, baseURL }) => {
  curator = await signIn(browser, 'cur', baseURL ?? '', 'curator')
  await curator.goto('/moderazione')
  const item = curator.locator('form').filter({ hasText: 'e2e_user_' }).filter({ has: curator.locator(`input[value="${title}"]`) })
  await item.getByRole('button', { name: 'Approva' }).click()
  await expect(item).toBeHidden()
  await curator.goto(`/?q=${encodeURIComponent(title)}&stage=spotted`)
  await expect(curator.locator('main ul li')).toHaveCount(1)
  await expect(curator.locator('main ul li')).toContainText('Avvistato')
})

test('un utente propone un cambio di stage; il curatore accetta e lo stage cambia', async () => {
  await curator.locator('main ul li a').first().click()
  const memeUrl = curator.url()
  await user.goto(memeUrl)
  await user.getByText('Proponi un cambio di stage').click()
  await expect(user.getByText('Da Avvistato a In crescita')).toBeVisible()
  await user.getByLabel('Motivazione').fill('Lo vedo in tre gruppi diversi')
  await user.getByRole('button', { name: 'Invia proposta' }).click()
  await expect(user.getByRole('status')).toContainText('Proposta inviata')

  await curator.goto('/moderazione')
  await curator.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: 'Accetta' }).click()
  await expect(curator.getByText('Nessuna proposta aperta.')).toBeVisible()
  await curator.goto(memeUrl)
  await expect(curator.locator('dl')).toContainText('In crescita')
  await expect(curator.locator('ol')).toContainText('Stage: Avvistato → In crescita')
})

test('lo score cambia dopo un voto', async () => {
  const score = curator.locator('p.text-2xl')
  const before = await score.textContent()
  await curator.getByRole('button', { name: /Voto positivo/ }).click()
  await expect(curator.getByRole('button', { name: /Voto positivo/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(score).not.toHaveText(before ?? '')
  // chi ha caricato non può votare il proprio meme
  await user.reload()
  await expect(user.getByRole('button', { name: /Voto positivo/ })).toBeDisabled()
})
