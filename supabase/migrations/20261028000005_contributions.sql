-- Crmeme: funzioni per i contributi degli utenti (Fase 4)

-- FR-15: un utente non vede i meme pending/rifiutati altrui, quindi il controllo passa da qui.
-- B16: lo slug si restituisce solo se il meme è pubblico.
create or replace function public.find_duplicate(p_sha256 text)
  returns table (slug text, status public.meme_status)
  language sql stable security definer set search_path = '' as $$
  select case when m.status = 'approved' then m.slug end, m.status
  from public.memes m where m.image_sha256 = lower(p_sha256)
$$;
revoke execute on function public.find_duplicate(text) from public, anon;

-- FR-11: avvistamento = attività sighting_added con URL e data
create or replace function public.add_sighting(p_meme bigint, p_url text, p_seen_on date)
  returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then raise exception 'not_member'; end if;
  if p_url !~ '^https?://[^\s]+$' or char_length(p_url) > 500 then raise exception 'invalid_url'; end if;
  if p_seen_on > current_date then raise exception 'invalid_date'; end if;
  if not exists (select 1 from public.memes where id = p_meme and status = 'approved') then raise exception 'not_found'; end if;
  insert into public.activities (meme_id, actor_id, type, payload)
  values (p_meme, auth.uid(), 'sighting_added', jsonb_build_object('url', p_url, 'seen_on', p_seen_on));
end $$;
revoke execute on function public.add_sighting(bigint, text, date) from public, anon;

-- FR-24: il profilo sparisce a cascata; i meme restano con uploader_id null ("utente eliminato"),
-- i voti vengono cancellati e gli score ricalcolati dal trigger (B4).
create or replace function public.delete_my_account()
  returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid()
$$;
revoke execute on function public.delete_my_account() from public, anon;
