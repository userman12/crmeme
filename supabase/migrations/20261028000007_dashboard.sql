-- Crmeme: metriche della dashboard pubblica (FR-25), in una sola chiamata
-- B13 + A7: ogni stage_changed è una salita; il tempo Avvistato → Mainstream va dall'approvazione
-- al primo arrivo in mainstream.
create or replace function public.dashboard()
  returns jsonb language sql stable set search_path = '' as $$
  with approved as (
    select id, slug, title, alt_text, thumb_path, stage, score, is_nsfw from public.memes where status = 'approved'
  ),
  risen as (
    select distinct on (a.meme_id) a.meme_id, a.payload, a.created_at
    from public.activities a join approved m on m.id = a.meme_id
    where a.type = 'stage_changed' and a.created_at > now() - interval '30 days'
    order by a.meme_id, a.created_at desc
  ),
  to_mainstream as (
    select
      (select min(created_at) from public.activities x
        where x.meme_id = m.id and x.type = 'stage_changed' and x.payload->>'to' = 'mainstream')
      - (select min(created_at) from public.activities x where x.meme_id = m.id and x.type = 'approved') as took
    from approved m
  )
  select jsonb_build_object(
    'per_stage', coalesce((select jsonb_object_agg(stage, n) from (select stage, count(*) as n from approved group by stage) s), '{}'),
    'top', coalesce((select jsonb_agg(to_jsonb(t)) from (select * from approved order by score desc, id limit 10) t), '[]'),
    'risen_count', (select count(*) from risen),
    'risen', coalesce((select jsonb_agg(jsonb_build_object('slug', m.slug, 'title', m.title,
                 'from', r.payload->>'from', 'to', r.payload->>'to', 'at', r.created_at) order by r.created_at desc)
               from (select * from risen order by created_at desc limit 20) r join approved m on m.id = r.meme_id), '[]'),
    'avg_days_to_mainstream', (select round((extract(epoch from avg(took)) / 86400)::numeric, 1) from to_mainstream where took > interval '0'),
    'reached_mainstream', (select count(*) from to_mainstream where took > interval '0')
  )
$$;
