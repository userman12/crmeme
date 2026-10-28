-- Crmeme: permessi (NFR-04)
-- RLS decide quali righe; i privilegi per colonna decidono quali campi un utente può scrivere.
-- status, stage, score, role, banned_at non sono scrivibili dagli utenti normali per costruzione.

revoke insert, update on public.memes, public.profiles, public.votes, public.stage_suggestions, public.reports
  from anon, authenticated;

grant insert (title, description, alt_text, image_path, thumb_path, image_sha256, format, language,
              parent_meme_id, community_id, first_seen_at)
  on public.memes to authenticated;
grant update (title, description, alt_text, format, language, stage, status, is_nsfw,
              parent_meme_id, community_id, first_seen_at, moderation_note)
  on public.memes to authenticated;                                   -- RLS: solo curatori
grant insert (id, username, terms_accepted_at), update (username) on public.profiles to authenticated;
grant insert (meme_id, value), update (value)                     on public.votes to authenticated;
grant insert (meme_id, from_stage, to_stage, reason), update (status) on public.stage_suggestions to authenticated;
grant update (status, resolution_note)                            on public.reports to authenticated;  -- RLS: curatori
-- L'invio delle segnalazioni (anche anonime) arriverà in Fase 5 tramite una funzione dedicata.

alter table public.profiles          enable row level security;
alter table public.communities       enable row level security;
alter table public.tags              enable row level security;
alter table public.memes             enable row level security;
alter table public.meme_tags         enable row level security;
alter table public.votes             enable row level security;
alter table public.stage_suggestions enable row level security;
alter table public.activities        enable row level security;
alter table public.reports           enable row level security;
alter table public.score_config      enable row level security;

-- profiles
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_signup on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_rename on public.profiles for update to authenticated using (id = auth.uid());

-- communities, tags, score_config: lettura pubblica, scrittura admin
create policy communities_read  on public.communities  for select using (true);
create policy communities_admin on public.communities  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tags_read         on public.tags         for select using (true);
create policy tags_admin        on public.tags         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy score_config_read  on public.score_config for select using (true);
create policy score_config_admin on public.score_config for update to authenticated using (public.is_admin());

-- memes: pubblici solo gli approvati (FR-13); niente delete, la rimozione è uno status
create policy memes_read   on public.memes for select
  using (status = 'approved' or uploader_id = auth.uid() or public.is_curator());
create policy memes_upload on public.memes for insert to authenticated
  with check (public.is_member() and uploader_id = auth.uid());
create policy memes_curate on public.memes for update to authenticated
  using (public.is_curator()) with check (public.is_curator());

-- meme_tags: visibili se il meme è visibile; li scrive chi carica (finché pending) o un curatore
create policy meme_tags_read   on public.meme_tags for select
  using (exists (select 1 from public.memes m where m.id = meme_id));
create policy meme_tags_insert on public.meme_tags for insert to authenticated
  with check (exists (select 1 from public.memes m where m.id = meme_id
              and ((m.uploader_id = auth.uid() and m.status = 'pending') or public.is_curator())));
create policy meme_tags_delete on public.meme_tags for delete to authenticated using (public.is_curator());

-- votes (FR-09): ognuno vede e modifica solo i propri, solo su meme approvati
create policy votes_mine on public.votes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member()
              and exists (select 1 from public.memes m where m.id = meme_id and m.status = 'approved'));

-- stage_suggestions (FR-10)
create policy suggestions_read    on public.stage_suggestions for select to authenticated
  using (user_id = auth.uid() or public.is_curator());
create policy suggestions_suggest on public.stage_suggestions for insert to authenticated
  with check (public.is_member() and user_id = auth.uid()
              and exists (select 1 from public.memes m where m.id = meme_id and m.status = 'approved' and m.stage = from_stage));
create policy suggestions_review  on public.stage_suggestions for update to authenticated
  using (public.is_curator() and status = 'open') with check (public.is_curator());

-- activities: scritte solo dai trigger; visibili se il meme è visibile (FR-04)
create policy activities_read on public.activities for select
  using (exists (select 1 from public.memes m where m.id = meme_id));

-- reports: solo i curatori leggono e risolvono (FR-19)
create policy reports_read    on public.reports for select to authenticated using (public.is_curator());
create policy reports_resolve on public.reports for update to authenticated using (public.is_curator());
