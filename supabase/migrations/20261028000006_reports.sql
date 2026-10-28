-- Crmeme: segnalazioni e rimozione (FR-18–FR-21, CMP-03, CMP-05), export dati (CMP-06)

-- FR-18: chiunque segnala, anche senza account. Restituisce il token del link di stato (A4).
create or replace function public.submit_report(p_meme bigint, p_reason public.report_reason, p_details text, p_email text)
  returns uuid language plpgsql security definer set search_path = '' as $$
declare
  reporter uuid := (select id from public.profiles where id = auth.uid());
  token uuid;
begin
  if not exists (select 1 from public.memes where id = p_meme and status = 'approved') then raise exception 'not_found'; end if;
  -- NFR-05 / B10: max 20 segnalazioni anonime in 24 ore per meme; oltre si rimanda ai contatti
  if reporter is null and (
    select count(*) from public.reports where meme_id = p_meme and reporter_id is null and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'rate_limit_reports';
  end if;
  insert into public.reports (meme_id, reporter_id, reporter_email, reason, details)
  values (p_meme, reporter, nullif(trim(p_email), ''), p_reason, left(coalesce(p_details, ''), 2000))
  returning status_token into token;
  return token;
end $$;

-- CMP-03: chi segnala vede l'esito e la motivazione dal link privato
create or replace function public.report_status(p_token uuid)
  returns table (reason public.report_reason, status public.report_status, resolution_note text,
                 created_at timestamptz, resolved_at timestamptz)
  language sql stable security definer set search_path = '' as $$
  select reason, status, resolution_note, created_at, resolved_at from public.reports where status_token = p_token
$$;

-- FR-19: rimuovi (chiude tutte le segnalazioni aperte del meme) o archivia, sempre con nota (CMP-05).
-- Restituisce i file da cancellare dal bucket quando il contenuto viene rimosso.
create or replace function public.resolve_report(p_report bigint, p_remove boolean, p_note text)
  returns table (image_path text, thumb_path text)
  language plpgsql security definer set search_path = '' as $$
declare target bigint;
begin
  if not public.is_curator() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;
  select meme_id into target from public.reports where id = p_report and status = 'open';
  if target is null then raise exception 'not_found'; end if;

  if p_remove then
    -- FR-21: la nota è anche il motivo che vede chi ha caricato
    update public.memes set status = 'removed', moderation_note = p_note where id = target;
    update public.reports set status = 'actioned', resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now()
     where meme_id = target and status = 'open';
    return query select m.image_path, m.thumb_path from public.memes m where m.id = target;
  else
    update public.reports set status = 'dismissed', resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now()
     where id = p_report;
  end if;
end $$;
revoke execute on function public.resolve_report(bigint, boolean, text) from public, anon;

-- FR-20: per un meme rimosso si mostra la pagina di rimozione, senza esporre il resto della riga
create or replace function public.meme_status(p_slug text)
  returns public.meme_status language sql stable security definer set search_path = '' as $$
  select status from public.memes where slug = p_slug and status in ('approved', 'removed')
$$;

-- CMP-06: tutti i dati personali dell'utente in un unico JSON
create or replace function public.export_my_data()
  returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at)
                from auth.users u where u.id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'memes', coalesce((select jsonb_agg(to_jsonb(m) - 'search') from public.memes m where m.uploader_id = auth.uid()), '[]'),
    'votes', coalesce((select jsonb_agg(to_jsonb(v)) from public.votes v where v.user_id = auth.uid()), '[]'),
    'stage_suggestions', coalesce((select jsonb_agg(to_jsonb(s)) from public.stage_suggestions s where s.user_id = auth.uid()), '[]'),
    'activities', coalesce((select jsonb_agg(to_jsonb(a)) from public.activities a where a.actor_id = auth.uid()), '[]'),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) - 'status_token') from public.reports r where r.reporter_id = auth.uid()), '[]')
  )
  where auth.uid() is not null
$$;
revoke execute on function public.export_my_data() from public, anon;
