# Crmeme

Il CRM per i meme: catalogo, pipeline di ciclo di vita, voti e caricamento moderato.
App statica React (Vite, TypeScript strict, Tailwind) che parla direttamente con Supabase.
Permessi, limiti e calcolo dello score vivono nel database (`supabase/migrations`).

Requisiti e decisioni: `docs/PIANO.md`.

## Avvio locale

Servono Node 22.18+ e la [Supabase CLI](https://supabase.com/docs/guides/cli).
Docker non serve: lo sviluppo usa il progetto cloud `crmeme-dev`.

```bash
npm install
cp .env.example .env.local      # poi compila i valori (vedi sotto)
supabase link --project-ref <project-ref>
npm run db:push                 # applica le migrazioni
npm run seed                    # 30 meme segnaposto + utenti demo (una sola volta)
npm run dev                     # http://localhost:5173
```

Valori di `.env.local` (Dashboard Supabase → Project Settings → API Keys):

| Variabile | Dove serve |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend (pubbliche) |
| `SUPABASE_SECRET_KEY` | solo seed e test, **mai nel frontend**. Chiave segreta o legacy `service_role` |
| `SUPABASE_DB_PASSWORD` | CLI (`db push`) |

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | typecheck + build statica in `dist/` |
| `npm run lint` | ESLint |
| `npm test` | test su permessi, score, limiti e storage contro il progetto di sviluppo |
| `npm run e2e` | criteri di accettazione in un browser vero (Playwright). Avvia da solo il server locale; con `E2E_BASE_URL=https://…` gira sul sito pubblicato |
| `npm run db:push` | applica le nuove migrazioni |
| `npm run db:types` | rigenera `src/lib/database.types.ts` dopo una migrazione |
| `npm run seed` | popola il progetto di sviluppo (salta se ci sono già meme) |

I test creano utenti temporanei, li cancellano alla fine e non vanno lanciati sul progetto di produzione.
Per accedere non usano email reali: il magic link lo genera l'API admin di Supabase.
La prima volta serve `npx playwright install chromium`.

## Accesso (magic link)

In sviluppo basta il servizio email incluso in Supabase, che però consegna solo agli indirizzi dei membri
del progetto e poche email l'ora. Per il sito pubblico (decisione A3):

1. Dominio proprio + account Resend (piano gratuito), con il dominio verificato.
2. Supabase → Authentication → Emails → SMTP Settings: host `smtp.resend.com`, porta 465, utente `resend`, password = API key di Resend.
3. Supabase → Authentication → URL Configuration: Site URL = dominio pubblico, Redirect URLs = `https://<dominio>/**`.

## Ruoli

Ogni nuovo profilo ha ruolo `user`. Per promuovere qualcuno a `curator` o `admin`:
Dashboard Supabase → Table Editor → `profiles` → colonna `role`.
Gli utenti demo del seed (`*@example.com`) servono solo come dati; non ricevono email.

Un meme spostato per errore nella pipeline si corregge dall'editor SQL della dashboard:
lì il vincolo "solo lo stage successivo" non si applica.

## Deploy (Cloudflare Pages)

1. Collega il repository GitHub a Cloudflare Pages.
2. Build command `npm run build`, output directory `dist`.
3. Variabili d'ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` del progetto di produzione.
4. In Supabase → Authentication → URL Configuration, imposta il dominio pubblico come Site URL.

`public/_redirects` fa servire `index.html` per ogni percorso (URL come `/meme/<slug>`).
