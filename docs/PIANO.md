# Crmeme – Fase 1: Piano

Riferimento: *Crmeme – Scheda requisiti MVP* (28/10/2026). Nessun codice applicativo in questa fase.

## Decisioni prese (28/10/2026)

- **A1** Assunzioni confermate così come sono: è l'opzione più semplice da gestire.
- **A2** Test end-to-end **automatici** con Playwright. Il login nei test usa il link generato dall'API admin di Supabase (`generateLink`), quindi nessuna email reale. I test girano sul sito pubblicato collegato al progetto Supabase di sviluppo, non su quello di produzione.
- **A4, A5, A6, A8, A9** Accettati come proposti.
- **A10** Due progetti Supabase cloud gratuiti (dev, prod).
- **A11** Segnaposto evidenti per titolare e contatti, da sostituire prima del lancio.
- **A3** Dominio proprio + Resend (piano gratuito) come SMTP di Supabase Auth. Da configurare in Fase 4; fino ad allora basta l'SMTP incluso.
- **A7** Spostamenti **vincolati**: ogni stage ha un solo successore, in ciclo
  `spotted → rising → mainstream → saturated → cringe → dead → revival → rising`.
  Conseguenze:
  - il trigger sul database rifiuta qualsiasi altra mossa, anche per curatori e admin che passano dall'API;
  - un errore si corregge solo dall'editor SQL della dashboard Supabase, dove il vincolo non si applica (`auth.uid()` è null);
  - un suggerimento (FR-10) può proporre solo lo stage successivo;
  - nella kanban è attiva solo la colonna successiva, e su ogni card c'è un pulsante "Sposta a …" (tastiera e mobile);
  - B13 si semplifica: ogni `stage_changed` è una salita.

### Scostamenti emersi in Fase 2
- **Un solo progetto Supabase per ora.** Il piano gratuito ammette 2 progetti attivi e WatchNext ne occupa già uno. `crmeme-dev` serve per sviluppo e test; per la produzione bisogna mettere in pausa WatchNext o passare a un piano a pagamento. Da decidere prima del lancio.
- **B17: Vitest al posto di pgTAP.** `supabase test db` richiede Docker. I test di permessi e score sono in Vitest (`tests/db.test.ts`) e chiamano l'API pubblica come farebbe un attaccante, che è anche ciò che chiede il criterio di accettazione.
- **Segnalazioni:** l'invio (anche anonimo) passa da una funzione dedicata che restituisce il token di stato. Arriva in Fase 5; fino ad allora nessuno può inserire segnalazioni via API.

## 1. Dubbi e contraddizioni

### A. Da decidere prima della Fase 2 (bloccanti)

| # | Punto | Problema | Proposta |
|---|-------|----------|----------|
| A1 | Assunzioni non spuntate | Tre assunzioni su quattro sono ancora "da confermare": stage deciso dal curatore, UI in italiano con testi separati, solo immagini statiche. | Confermarle così come sono. |
| A2 | Test end-to-end | I criteri di accettazione e la Fase 6 chiedono "test end-to-end sull'ambiente pubblicato"; lo stack dice "nessun test end-to-end automatico, criteri verificati a mano". | Checklist manuale in `docs/ACCETTAZIONE.md`, eseguita sul sito pubblicato. Playwright solo se lo vuoi automatico. |
| A3 | Magic link con Supabase gratuito | Il servizio email predefinito di Supabase manda email solo agli indirizzi del team e con limiti orari molto bassi: un sito pubblico non può registrare utenti senza un SMTP proprio. | SMTP gratuito (Resend o Brevo, piano free) configurato in Supabase Auth. Serve un dominio o un mittente verificato. |
| A4 | Conferma segnalazioni (CMP-03) | "Chi segnala riceve conferma" e il DSA chiede di comunicare la decisione a chi segnala, ma le notifiche email sono fuori MVP e non c'è backend. | A fine segnalazione mostro un link privato di stato (`/segnalazione/<token>`) con esito e motivazione. Va confermato da un legale. |
| A5 | GIF e compressione | NFR-01 dice di ricodificare tutto nel browser, ma ricodificare una GIF animata la riduce al primo fotogramma. | Le GIF si caricano così come sono (max 5 MB), la miniatura usa il primo fotogramma. JPG/PNG/WebP vengono ricodificati (EXIF rimosso). |
| A6 | Hash dei duplicati (FR-15) | La compressione nel browser non dà lo stesso risultato su browser diversi, quindi l'hash del file compresso non trova i duplicati. | Calcolo lo SHA-256 sul file **originale**, prima della compressione. |
| A7 | Transizioni di stage | "Ordine fisso; revival può tornare a rising", ma non dice se il curatore può saltare stage (Avvistato → Morto) o tornare indietro. | Il curatore può spostare verso qualsiasi stage (la kanban lo consente); l'ordine serve solo per colonne e per definire "salito". Revival → In crescita è permesso. |
| A8 | Campo `format` del Meme | Non è chiaro se indica il tipo di file (jpg/png) o il formato del meme (image macro, reaction, screenshot…). | Formato del meme, scelto da una lista fissa. Il tipo di file si ricava dal path. |
| A9 | Gestione admin | La tabella permessi dà all'admin utenti, ruoli, community e tag, ma nessun FR e nessuna fase prevedono queste pagine. Chi carica deve scegliere community e tag: chi li crea? | Nell'MVP l'admin lavora dalla dashboard di Supabase (seed iniziale di community e tag). Nel caricamento l'utente sceglie solo tra community e tag esistenti. |
| A10 | Ambiente di sviluppo | Supabase in locale (`supabase start`) richiede Docker, che qui non c'è. | Due progetti Supabase cloud gratuiti (dev e prod), migrazioni con `supabase db push`. In alternativa installi OrbStack/Docker e lavoriamo in locale. |
| A11 | Titolare e contatti (CMP-02, CMP-04) | Privacy e contatti richiedono nome del titolare ed email di contatto. | Mi servono nome (o pseudonimo + email) e un indirizzo di contatto. Altrimenti metto segnaposto evidenti. |

### B. Ambiguità minori (applico la proposta se non dici altro)

| # | Punto | Proposta |
|---|-------|----------|
| B1 | Campi mancanti nel modello dati: testo alternativo (NFR-06), flag NSFW (NFR-09), hash (FR-15), miniatura (NFR-01), motivo di rifiuto/rimozione (FR-14, FR-21), accettazione termini (CMP-01), conteggio voti per la scheda (FR-02). | Li aggiungo (vedi schema). |
| B2 | `email` nella tabella User: una tabella profili leggibile da tutti esporrebbe le email. | Email solo in `auth.users` di Supabase; `profiles` contiene username, ruolo, ban. |
| B3 | Username con magic link: la registrazione chiede solo l'email. | Al primo accesso l'utente sceglie username e accetta i termini; senza profilo non può scrivere. |
| B4 | Eliminazione account (FR-24) senza backend: il client non può cancellare utenti da Supabase Auth. | Funzione SQL `delete_my_account()` (security definer). I meme restano con `uploader_id = null` → "utente eliminato". I **voti vengono cancellati** (dato personale) e gli score ricalcolati. |
| B5 | Bucket pubblico: i file dei meme `pending` sono raggiungibili da chi conosce l'URL. | Path casuali (UUID); su rifiuto/rimozione il curatore cancella il file. |
| B6 | Pagina "Rimosso" (FR-20): la riga rimossa non deve essere leggibile per intero. | Funzione `meme_status(slug)` che restituisce solo lo stato; i dati del meme restano nascosti. |
| B7 | Score: `first_seen_at` è facoltativo, ma la formula usa l'età da lì; i pesi "in configurazione" vivono in SQL. | Uso `coalesce(first_seen_at, created_at)` con `t` in settimane decimali; pesi, offset (+2) ed esponente in una tabella `score_config` di una riga. Lo score si ricalcola anche quando una variante viene approvata. |
| B8 | Voto modificato e U₇ ("positivi degli ultimi 7 giorni"). | Cambiare voto aggiorna `created_at`, quindi conta come voto recente. Cambiare voto conta anche nel limite di 60/ora. |
| B9 | `voted_milestone`: soglie non definite. | Attività al raggiungimento di 10, 50, 100, 500, 1000 voti positivi. |
| B10 | Limiti NFR-05: "al giorno" | Finestra mobile di 24 ore. Oltre il limite di 20 segnalazioni anonime per meme, quelle anonime vengono rifiutate con un messaggio che rimanda alla pagina contatti, così un utente ostile non può bloccare le segnalazioni legittime. |
| B11 | Suggerimenti di stage | Massimo un suggerimento aperto per utente per meme. Se lo stage cambia prima della revisione, i suggerimenti aperti che partivano dal vecchio stage vengono chiusi come rifiutati. Accettare un suggerimento sposta il meme (trigger, operazione atomica). |
| B12 | Kanban con molti meme (NFR-02) | Ogni colonna mostra i primi 24 per score, con "Mostra altri". |
| B13 | Dashboard FR-25 | "Salito di stage" vuol dire passato a uno stage successivo nell'ordine, più Morto → Revival. Il tempo da Avvistato a Mainstream si misura dall'attività `approved` alla prima `stage_changed` verso mainstream. |
| B14 | Voto sul proprio meme | Non consentito. |
| B15 | Caricamenti di curatori/admin | Entrano anche loro in `pending` (FR-13 non fa eccezioni). Possono approvarli da soli. |
| B16 | Duplicato di un meme rifiutato o rimosso | L'indice univoco vale per tutti gli stati, quindi un contenuto rimosso non si può ricaricare. Se il meme esistente non è pubblico, l'avviso non mostra il link. |
| B17 | Test (NFR-11) | Permessi e formula vivono nel database: li testo con pgTAP (`supabase test db`). Vitest copre il codice frontend (hash, i18n, utility). |
| B18 | i18n | Un file `src/locales/it.ts` con un piccolo `t()` tipizzato, senza librerie. L'inglese arriverà come `en.ts`. |
| B19 | Hosting e analytics (NFR-10) | Cloudflare Pages + Cloudflare Web Analytics (senza cookie). Log errori: log di Supabase (sul piano gratuito restano 1 giorno) + `console.error`. Niente Sentry. |
| B20 | Costi (NFR-03) | Nota: i progetti Supabase gratuiti vanno in pausa dopo 7 giorni senza traffico. Il job pg_cron quotidiano non basta a evitarlo, perché conta solo il traffico API. |

### C. Limiti già accettati nella scheda (nessuna azione)
Nessuna anteprima Open Graph per i singoli meme. Il tipo di file lo dichiara il browser. Hash calcolato nel client, quindi falsificabile da chi chiama l'API direttamente: l'indice univoco blocca solo i duplicati in buona fede.

## 2. Struttura delle cartelle

```
crmeme/
├── README.md                 avvio locale e deploy
├── .env.example              VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (+ SUPABASE_SERVICE_ROLE_KEY solo per lo script di seed)
├── index.html
├── package.json
├── vite.config.ts            React + Tailwind v4 (plugin Vite, nessun tailwind.config)
├── tsconfig.json             strict
├── eslint.config.js
├── public/_redirects         fallback SPA per Cloudflare Pages
├── docs/
│   ├── PIANO.md
│   └── ACCETTAZIONE.md       checklist criteri di accettazione
├── supabase/
│   ├── config.toml
│   ├── migrations/           un file per blocco: schema, rls, score, limiti, storage, cron
│   ├── seed.sql              community, tag, utenti demo
│   └── tests/                pgTAP: permessi, score, limiti
├── e2e/                      Playwright: criteri di accettazione
├── scripts/
│   └── seed-memes.ts         genera 30 PNG segnaposto e li carica (service role, solo in locale)
└── src/
    ├── main.tsx              router
    ├── lib/                  supabase.ts, auth.tsx, image.ts (hash + compressione), database.types.ts (generato)
    ├── locales/it.ts         tutti i testi UI, stage compresi
    ├── components/           Layout (header/footer legali), MemeCard, MemeGrid, StageBadge, VoteButtons, ReportDialog…
    └── pages/                Home, Meme, Removed, Pipeline, Search, Community, Tag, Profile, Upload, Login,
                              Dashboard, mod/{Queue,Suggestions,Reports}, legal/{Terms,Privacy,Contacts}, ReportStatus
```

Dipendenze runtime: `react`, `react-dom`, `react-router`, `@supabase/supabase-js`, `browser-image-compression`, `@dnd-kit/core`. SHA-256 con `crypto.subtle` (nativo).

## 3. Schema SQL (bozza)

Principio: i permessi stanno nel database. RLS decide **quali righe**; i privilegi per colonna (`grant insert (col…)`) decidono **quali campi** può scrivere un utente. Così nessuno può impostare `status`, `stage` o `score` chiamando l'API direttamente, e non servono trigger di guardia.

```sql
-- ── Tipi ────────────────────────────────────────────────────────────────
create type stage           as enum ('spotted','rising','mainstream','saturated','cringe','dead','revival');
create type meme_status     as enum ('pending','approved','rejected','removed');
create type user_role       as enum ('user','curator','admin');
create type suggestion_status as enum ('open','accepted','rejected');
create type activity_type   as enum ('created','approved','stage_changed','sighting_added','voted_milestone');
create type report_reason   as enum ('copyright','illegal','nsfw','harassment','spam','other');
create type report_status   as enum ('open','actioned','dismissed');

-- ── Tabelle ─────────────────────────────────────────────────────────────
create table profiles (                                   -- "User"; email resta in auth.users
  id                uuid primary key references auth.users on delete cascade,
  username          text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  role              user_role not null default 'user',
  terms_accepted_at timestamptz not null,                 -- CMP-01
  banned_at         timestamptz,
  created_at        timestamptz not null default now()
);

create table communities (
  id bigint generated always as identity primary key,
  name text not null, slug text not null unique, description text not null default '', url text
);

create table tags (
  id bigint generated always as identity primary key,
  name text not null, slug text not null unique
);

create table memes (
  id              bigint generated always as identity primary key,
  slug            text not null unique,                   -- generato da trigger sul titolo
  title           text not null check (char_length(title) between 3 and 120),
  description     text not null default '' check (char_length(description) <= 2000),
  alt_text        text not null check (char_length(alt_text) between 5 and 300),   -- NFR-06
  image_path      text not null,
  thumb_path      text not null,                          -- NFR-01, 400 px
  image_sha256    text not null unique check (image_sha256 ~ '^[0-9a-f]{64}$'),    -- FR-15
  format          text not null default 'image_macro',    -- A8
  language        text not null default 'it',
  stage           stage not null default 'spotted',
  status          meme_status not null default 'pending', -- FR-13
  is_nsfw         boolean not null default false,         -- NFR-09
  parent_meme_id  bigint references memes on delete set null,
  community_id    bigint references communities on delete set null,
  uploader_id     uuid default auth.uid() references profiles on delete set null,  -- FR-24
  first_seen_at   date,
  score           double precision not null default 0,
  up_votes        int not null default 0,
  down_votes      int not null default 0,
  moderation_note text,                                   -- motivo rifiuto / rimozione (FR-14, FR-21)
  search          tsvector generated always as
                    (to_tsvector('italian', title || ' ' || description)) stored,  -- FR-16
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on memes using gin (search);
create index on memes (status, score desc);
create index on memes (status, stage, score desc);
create index on memes (parent_meme_id);
create index on memes (community_id);
create index on memes (uploader_id, created_at);

create table meme_tags (
  meme_id bigint references memes on delete cascade,
  tag_id  bigint references tags  on delete cascade,
  primary key (meme_id, tag_id)
);
create index on meme_tags (tag_id);

create table votes (
  user_id    uuid   references profiles on delete cascade,  -- B4
  meme_id    bigint references memes    on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),             -- aggiornato a ogni cambio (B8)
  primary key (user_id, meme_id)
);
create index on votes (meme_id, created_at);
create index on votes (user_id, created_at);

create table stage_suggestions (
  id          bigint generated always as identity primary key,
  meme_id     bigint not null references memes on delete cascade,
  user_id     uuid default auth.uid() references profiles on delete set null,
  from_stage  stage not null,
  to_stage    stage not null check (to_stage <> from_stage),
  reason      text not null check (char_length(reason) between 1 and 280),  -- FR-10
  status      suggestion_status not null default 'open',
  reviewed_by uuid references profiles on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index on stage_suggestions (meme_id, user_id) where status = 'open';  -- B11

create table activities (
  id         bigint generated always as identity primary key,
  meme_id    bigint not null references memes on delete cascade,
  actor_id   uuid references profiles on delete set null,
  type       activity_type not null,
  payload    jsonb not null default '{}',  -- stage_changed: {from,to} · sighting_added: {url,seen_on} · voted_milestone: {up}
  created_at timestamptz not null default now()
);
create index on activities (meme_id, created_at desc);
create index on activities (type, created_at);               -- dashboard

create table reports (
  id              bigint generated always as identity primary key,
  meme_id         bigint not null references memes on delete cascade,
  reporter_id     uuid references profiles on delete set null,
  reporter_email  text check (reporter_email ~ '^[^@\s]+@[^@\s]+$'),
  reason          report_reason not null,
  details         text not null default '' check (char_length(details) <= 2000),
  status          report_status not null default 'open',
  resolution_note text,
  resolved_by     uuid references profiles on delete set null,
  status_token    uuid not null default gen_random_uuid() unique,   -- A4: link di stato per chi segnala
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index on reports (status, created_at);
create index on reports (meme_id, created_at) where reporter_id is null;  -- NFR-05

create table score_config (                                 -- FR-08: pesi fuori dal codice
  id          boolean primary key default true check (id),  -- una sola riga
  w_net       numeric not null default 1,
  w_recent    numeric not null default 2,
  w_variants  numeric not null default 3,
  age_offset  numeric not null default 2,
  gravity     numeric not null default 0.8,
  recent_days int     not null default 7
);
insert into score_config default values;

-- ── Helper ruoli ────────────────────────────────────────────────────────
create function my_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and banned_at is null
$$;
create function is_member()  returns boolean language sql stable as $$ select my_role() is not null $$;
create function is_curator() returns boolean language sql stable as $$ select coalesce(my_role() in ('curator','admin'), false) $$;
create function is_admin()   returns boolean language sql stable as $$ select coalesce(my_role() = 'admin', false) $$;

-- ── Score (FR-08) ───────────────────────────────────────────────────────
-- score = (w_net·(U−D) + w_recent·U7 + w_variants·V) / (t + age_offset)^gravity
create function compute_score(m memes) returns double precision
  language sql stable as $$
  select ( c.w_net * (v.up - v.down) + c.w_recent * v.up_recent + c.w_variants * k.variants )
         / power(greatest(extract(epoch from now() - coalesce(m.first_seen_at::timestamptz, m.created_at)) / 604800, 0)
                 + c.age_offset, c.gravity)
  from score_config c,
       lateral (select count(*) filter (where value = 1) up,
                       count(*) filter (where value = -1) down,
                       count(*) filter (where value = 1 and created_at > now() - make_interval(days => c.recent_days)) up_recent
                from votes where meme_id = m.id) v,
       lateral (select count(*) variants from memes where parent_meme_id = m.id and status = 'approved') k
$$;

-- refresh_score(meme_id): security definer, aggiorna score/up_votes/down_votes e crea voted_milestone (B9).
-- Trigger: after insert/update/delete on votes; after update of status on memes (per il padre).
-- Job: select cron.schedule('scores', '0 3 * * *', $$ update memes m set score = compute_score(m) where status = 'approved' $$);

-- ── Altri trigger (corpo in Fase 2) ─────────────────────────────────────
-- memes  before insert          : genera slug univoco, controlla limite 10/24h (NFR-05), attività 'created'
-- memes  after update of status : 'approved' → attività; ricalcolo score del padre
-- memes  after update of stage  : attività 'stage_changed' {from,to}; chiude i suggerimenti obsoleti (B11)
-- votes  before insert/update   : limite 60/h, niente voto sul proprio meme (B14), created_at = now()
-- stage_suggestions after update: se accepted → aggiorna stage del meme
-- reports before insert         : limite 20 anonime/24h per meme (B10)

-- ── Privilegi per colonna ───────────────────────────────────────────────
revoke insert, update on memes, profiles, votes, stage_suggestions, reports from anon, authenticated;
grant insert (title, description, alt_text, image_path, thumb_path, image_sha256, format, language,
              parent_meme_id, community_id, first_seen_at)            on memes to authenticated;
grant update (title, description, alt_text, format, language, stage, status, is_nsfw,
              parent_meme_id, community_id, first_seen_at, moderation_note) on memes to authenticated; -- RLS: solo curatori
grant insert (id, username, terms_accepted_at)                        on profiles to authenticated;
grant update (username)                                               on profiles to authenticated;
grant insert (user_id, meme_id, value), update (value)                on votes to authenticated;
grant insert (meme_id, from_stage, to_stage, reason)                  on stage_suggestions to authenticated;
grant update (status)                                                 on stage_suggestions to authenticated; -- RLS: curatori
grant insert (meme_id, reason, details, reporter_email)               on reports to anon, authenticated;
grant update (status, resolution_note)                                on reports to authenticated;           -- RLS: curatori
-- reporter_id, resolved_by, reviewed_by, resolved_at, reviewed_at: impostati da trigger con auth.uid()/now()
-- score, up_votes, down_votes, role, banned_at: nessun grant → solo funzioni definer o dashboard admin

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table profiles, communities, tags, memes, meme_tags, votes,
            stage_suggestions, activities, reports, score_config enable row level security;  -- (una per tabella)

-- profiles
create policy read   on profiles for select using (true);
create policy signup on profiles for insert with check (id = auth.uid());
create policy rename on profiles for update using (id = auth.uid());

-- communities, tags, score_config: lettura pubblica, scrittura admin
create policy read  on communities for select using (true);
create policy admin on communities for all using (is_admin()) with check (is_admin());
-- (idem tags, score_config)

-- memes
create policy read   on memes for select using (status = 'approved' or uploader_id = auth.uid() or is_curator());
create policy upload on memes for insert with check (is_member() and uploader_id = auth.uid());
create policy curate on memes for update using (is_curator()) with check (is_curator());
-- nessun delete: la rimozione è status = 'removed'

-- meme_tags
create policy read on meme_tags for select using (exists (select 1 from memes m where m.id = meme_id));  -- eredita RLS di memes
create policy own  on meme_tags for insert with check (exists (select 1 from memes m where m.id = meme_id
                     and ((m.uploader_id = auth.uid() and m.status = 'pending') or is_curator())));
create policy curate on meme_tags for delete using (is_curator());

-- votes (FR-09)
create policy mine on votes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_member()
              and exists (select 1 from memes m where m.id = meme_id and m.status = 'approved'));

-- stage_suggestions (FR-10)
create policy read    on stage_suggestions for select using (user_id = auth.uid() or is_curator());
create policy suggest on stage_suggestions for insert with check (is_member() and user_id = auth.uid()
                        and exists (select 1 from memes m where m.id = meme_id and m.status = 'approved' and m.stage = from_stage));
create policy review  on stage_suggestions for update using (is_curator() and status = 'open');

-- activities: scritte solo da trigger e da add_sighting()
create policy read on activities for select using (exists (select 1 from memes m where m.id = meme_id));

-- reports (FR-18, FR-19)
create policy report  on reports for insert with check (exists (select 1 from memes m where m.id = meme_id and m.status = 'approved'));
create policy curate  on reports for select using (is_curator());
create policy resolve on reports for update using (is_curator());

-- ── Funzioni RPC (security definer) ─────────────────────────────────────
-- meme_status(slug)            → status            FR-20: pagina "Rimosso" senza esporre la riga
-- find_duplicate(sha256)       → slug | null, status   FR-15
-- add_sighting(meme_id, url, seen_on)              FR-11
-- report_status(token)         → status, resolution_note   CMP-03
-- my_removed_memes()           → titolo, motivo     FR-21 (anche via RLS uploader)
-- delete_my_account()          → delete from auth.users where id = auth.uid()   FR-24
-- export_my_data()             → jsonb               CMP-06
-- dashboard()                  → jsonb con le 4 metriche   FR-25

-- ── Storage (NFR-01, NFR-04) ────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memes', 'memes', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']);
-- path: <auth.uid()>/<uuid>.<ext> e <auth.uid()>/<uuid>_thumb.webp
create policy upload on storage.objects for insert to authenticated
  with check (bucket_id = 'memes' and (storage.foldername(name))[1] = auth.uid()::text and is_member());
create policy curate on storage.objects for delete to authenticated
  using (bucket_id = 'memes' and is_curator());
```

## 4. Prossimo passo
Dopo le tue risposte ai punti **A1–A11** (e a eventuali punti B che vuoi cambiare) passo alla Fase 2: progetto Vite + React, migrazioni, RLS, ruoli, seed con 30 meme segnaposto.
