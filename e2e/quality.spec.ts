// NFR-06 accessibilità (WCAG 2.1 AA con axe) e NFR-07 utilizzabile da 360 px
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const pages = ['/', '/?stage=mainstream', '/meme/il-collega-che-risponde-a-tutti', '/pipeline', '/dashboard',
  '/accedi', '/tag/gatti', '/community/aula-studio', '/termini', '/privacy', '/contatti']

for (const width of [1280, 360]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 800 } })
    for (const path of pages) {
      test(path, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByText('Caricamento…')).toHaveCount(0)
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([])
        // nessuno scroll orizzontale
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      })
    }
  })
}

// Pagine riservate, viste dal curatore demo del seed
test.describe('pagine riservate', () => {
  for (const width of [1280, 360]) {
    test(`${width} px`, async ({ browser }) => {
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(process.env.VITE_SUPABASE_URL as string, process.env.SUPABASE_SECRET_KEY as string, { auth: { persistSession: false } })
      const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage()
      const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'curatore_demo@example.com' })
      await page.goto(link.data.properties?.action_link ?? '')
      await expect(page.getByRole('link', { name: 'Il tuo profilo' })).toBeVisible()
      for (const path of ['/carica', '/moderazione', '/u/curatore_demo', '/pipeline', '/meme/il-collega-che-risponde-a-tutti']) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByText('Caricamento…')).toHaveCount(0)
        for (const d of await page.locator('details').all()) await d.evaluate((el) => { (el as HTMLDetailsElement).open = true })
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(violations.map((v) => `${path} ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width)
      }
    })
  }
})
