-- Crmeme: ruoli, score, trigger (attività, vincoli di stage, limiti)
-- Le chiamate senza utente (auth.uid() null: seed, editor SQL, job) saltano limiti e vincoli di stage.

-- ── Ruoli ───────────────────────────────────────────────────────────────
create function public.my_role() returns public.user_role
  language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and banned_at is null
$$;
create function public.is_member() returns boolean
  language sql stable set search_path = '' as $$ select public.my_role() is not null $$;
create function public.is_curator() returns boolean
  language sql stable set search_path = '' as $$ select coalesce(public.my_role() in ('curator','admin'), false) $$;
create function public.is_admin() returns boolean
  language sql stable set search_path = '' as $$ select coalesce(public.my_role() = 'admin', false) $$;

-- ── Score (FR-08) ───────────────────────────────────────────────────────
-- score = (w_net·(U−D) + w_recent·U7 + w_variants·V) / (t + age_offset)^gravity, t in settimane
create function public.compute_score(m public.memes) returns double precision
  language sql stable set search_path = '' as $$
  select ((c.w_net * (v.up - v.down) + c.w_recent * v.up_recent + c.w_variants * k.variants)
          / power(greatest(extract(epoch from now() - coalesce(m.first_seen_at::timestamptz, m.created_at)) / 604800, 0)
                  + c.age_offset, c.gravity))::double precision
  from public.score_config c,
       lateral (select count(*) filter (where value = 1)  as up,
                       count(*) filter (where value = -1) as down,
                       count(*) filter (where value = 1 and created_at > now() - make_interval(days => c.recent_days)) as up_recent
                from public.votes where meme_id = m.id) v,
       lateral (select count(*) as variants from public.memes where parent_meme_id = m.id and status = 'approved') k
$$;

create function public.refresh_score(p_meme bigint) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  old_up int;
  new_up int;
  milestone int;
begin
  select up_votes into old_up from public.memes where id = p_meme;
  update public.memes m
     set score      = public.compute_score(m),
         up_votes   = (select count(*) from public.votes where meme_id = m.id and value = 1),
         down_votes = (select count(*) from public.votes where meme_id = m.id and value = -1)
   where id = p_meme
  returning up_votes into new_up;

  -- B9: attività alla prima volta che si supera una soglia
  select max(t) into milestone from unnest(array[10, 50, 100, 500, 1000]) t where t > old_up and t <= new_up;
  if milestone is not null and not exists (
    select 1 from public.activities
     where meme_id = p_meme and type = 'voted_milestone' and (payload->>'up')::int = milestone
  ) then
    insert into public.activities (meme_id, type, payload) values (p_meme, 'voted_milestone', jsonb_build_object('up', milestone));
  end if;
end $$;
revoke execute on function public.refresh_score(bigint) from public, anon, authenticated;

-- ── Memes ───────────────────────────────────────────────────────────────
create function public.memes_before_insert() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  -- NFR-05: max 10 caricamenti in 24 ore
  if auth.uid() is not null and (
    select count(*) from public.memes where uploader_id = auth.uid() and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'rate_limit_uploads';
  end if;

  base := left(trim(both '-' from regexp_replace(lower(extensions.unaccent(new.title)), '[^a-z0-9]+', '-', 'g')), 80);
  base := coalesce(nullif(base, ''), 'meme');
  new.slug := case when exists (select 1 from public.memes where slug = base) then base || '-' || new.id else base end;
  return new;
end $$;

create function public.memes_after_insert() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activities (meme_id, actor_id, type, created_at) values (new.id, new.uploader_id, 'created', new.created_at);
  if new.status = 'approved' then  -- solo seed
    insert into public.activities (meme_id, type, created_at) values (new.id, 'approved', new.created_at);
    if new.parent_meme_id is not null then perform public.refresh_score(new.parent_meme_id); end if;
  end if;
  return null;
end $$;

create function public.memes_before_update() returns trigger
  language plpgsql set search_path = '' as $$
begin
  -- A7: solo lo stage successivo, solo su meme approvati
  if new.stage is distinct from old.stage and auth.uid() is not null then
    if old.status <> 'approved' then raise exception 'stage_change_not_approved'; end if;
    if new.stage <> public.next_stage(old.stage) then raise exception 'stage_transition_invalid'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create function public.memes_after_update() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status = 'approved' then
    insert into public.activities (meme_id, actor_id, type) values (new.id, auth.uid(), 'approved');
  end if;

  -- V nel punteggio del padre cambia se la variante entra/esce dagli approvati o cambia padre
  if (new.status = 'approved') <> (old.status = 'approved') or new.parent_meme_id is distinct from old.parent_meme_id then
    if new.parent_meme_id is not null then perform public.refresh_score(new.parent_meme_id); end if;
    if old.parent_meme_id is distinct from new.parent_meme_id and old.parent_meme_id is not null then
      perform public.refresh_score(old.parent_meme_id);
    end if;
  end if;

  if new.stage is distinct from old.stage then
    insert into public.activities (meme_id, actor_id, type, payload)
    values (new.id, auth.uid(), 'stage_changed', jsonb_build_object('from', old.stage, 'to', new.stage));
    -- B11: i suggerimenti aperti partivano dal vecchio stage, quindi sono superati
    update public.stage_suggestions
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where meme_id = new.id and status = 'open';
  end if;
  return null;
end $$;

create trigger memes_before_insert before insert on public.memes for each row execute function public.memes_before_insert();
create trigger memes_after_insert  after  insert on public.memes for each row execute function public.memes_after_insert();
create trigger memes_before_update before update on public.memes for each row execute function public.memes_before_update();
create trigger memes_after_update  after  update on public.memes for each row execute function public.memes_after_update();

-- ── Voti ────────────────────────────────────────────────────────────────
create function public.votes_before_write() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.memes where id = new.meme_id and uploader_id = new.user_id) then
    raise exception 'vote_own_meme';  -- B14
  end if;
  -- NFR-05: max 60 voti l'ora (anche i cambi di voto contano, B8)
  if auth.uid() is not null and (
    select count(*) from public.votes where user_id = auth.uid() and created_at > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'rate_limit_votes';
  end if;
  if tg_op = 'UPDATE' then new.created_at := now(); end if;
  return new;
end $$;

create function public.votes_after_write() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_score(coalesce(new.meme_id, old.meme_id));
  return null;
end $$;

create trigger votes_before_write before insert or update on public.votes for each row execute function public.votes_before_write();
create trigger votes_after_write  after insert or update or delete on public.votes for each row execute function public.votes_after_write();

-- ── Suggerimenti di stage ───────────────────────────────────────────────
create function public.suggestions_before_update() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;

-- Gira con i permessi del curatore: lo spostamento passa da RLS e dal vincolo A7
create function public.suggestions_after_update() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.status = 'accepted' and old.status = 'open' then
    update public.memes set stage = new.to_stage where id = new.meme_id and stage = new.from_stage;
  end if;
  return null;
end $$;

create trigger suggestions_before_update before update on public.stage_suggestions for each row execute function public.suggestions_before_update();
create trigger suggestions_after_update  after  update on public.stage_suggestions for each row execute function public.suggestions_after_update();
