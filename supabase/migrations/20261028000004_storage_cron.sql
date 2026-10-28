-- Crmeme: bucket immagini (NFR-01, NFR-04) e ricalcolo score giornaliero (FR-08)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memes', 'memes', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists memes_upload on storage.objects;
drop policy if exists memes_delete on storage.objects;
-- path: <auth.uid()>/<uuid>.<ext>; niente sovrascritture (nessuna policy di update)
create policy memes_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'memes' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy memes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'memes' and public.is_curator());

create extension if not exists pg_cron;
select cron.schedule('refresh-scores', '0 3 * * *',
  $$update public.memes m set score = public.compute_score(m) where status = 'approved'$$);
