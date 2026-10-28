// Tutti i testi dell'interfaccia. Per l'inglese: en.ts con lo stesso tipo (typeof it).
import type { Database } from '../lib/database.types'

type Stage = Database['public']['Enums']['stage']

export const it = {
  app: { name: 'Crmeme', tagline: 'Il CRM per i meme' },
  stage: {
    spotted: 'Avvistato',
    rising: 'In crescita',
    mainstream: 'Mainstream',
    saturated: 'Saturo',
    cringe: 'Cringe',
    dead: 'Morto',
    revival: 'Revival',
  } satisfies Record<Stage, string>,
  home: {
    approvedCount: (n: number) => `${n} meme approvati in archivio`,
    loading: 'Caricamento…',
    error: 'Impossibile contattare il database.',
  },
}

export const t = it
