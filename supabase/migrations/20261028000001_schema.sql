-- Crmeme: schema base (tipi, tabelle, indici)
create extension if not exists unaccent with schema extensions;

create type public.stage             as enum ('spotted','rising','mainstream','saturated','cringe','dead','revival');
create type public.meme_status       as enum ('pending','approved','rejected','removed');
create type public.user_role         as enum ('user','curator','admin');
create type public.suggestion_status as enum ('open','accepted','rejected');
create type public.activity_type     as enum ('created','approved','stage_changed','sighting_added','voted_milestone');
create type public.report_reason     as enum ('copyright','illegal','nsfw','harassment','spam','other');
create type public.report_status     as enum ('open','actioned','dismissed');

-- A7: ogni stage ha un solo successore, in ciclo (revival torna a rising)
create function public.next_stage(s public.stage) returns public.stage
  language sql immutable set search_path = '' as $$
  select case s
    when 'spotted'    then 'rising'
    when 'rising'     then 'mainstream'
    when 'mainstream' then 'saturated'
    when 'saturated'  then 'cringe'
    when 'cringe'     then 'dead'
    when 'dead'       then 'revival'
    when 'revival'    then 'rising'
  end::public.stage
$$;

-- "User": l'email resta in auth.users e non è mai leggibile dal pubblico (B2)
create table public.profiles (
  id                uuid primary key references auth.users on delete cascade,
  username          text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  role              public.user_role not null default 'user',
  terms_accepted_at timestamptz not null,                  -- CMP-01
  banned_at         timestamptz,
  created_at        timestamptz not null default now()
);

create table public.communities (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  url         text
);

create table public.tags (
  id   bigint generated always as identity primary key,
  name text not null,
  slug text not null unique
);

create table public.memes (
  id              bigint generated always as identity primary key,
  slug            text not null unique default '',         -- impostato da trigger
  title           text not null check (char_length(title) between 3 and 120),
  description     text not null default '' check (char_length(description) <= 2000),
  alt_text        text not null check (char_length(alt_text) between 5 and 300),   -- NFR-06
  image_path      text not null,
  thumb_path      text not null,                           -- NFR-01
  image_sha256    text not null unique check (image_sha256 ~ '^[0-9a-f]{64}$'),    -- FR-15
  format          text not null default 'image_macro'
                  check (format in ('image_macro','reaction','screenshot','comic','object_label','other')),  -- A8
  language        text not null default 'it' check (language ~ '^[a-z]{2}$'),
  stage           public.stage not null default 'spotted',
  status          public.meme_status not null default 'pending',   -- FR-13
  is_nsfw         boolean not null default false,          -- NFR-09
  parent_meme_id  bigint references public.memes on delete set null,
  community_id    bigint references public.communities on delete set null,
  uploader_id     uuid default auth.uid() references public.profiles on delete set null,  -- FR-24
  first_seen_at   date,
  score           double precision not null default 0,
  up_votes        int not null default 0,
  down_votes      int not null default 0,
  moderation_note text,                                    -- FR-14, FR-21
  search          tsvector generated always as (to_tsvector('italian', title || ' ' || description)) stored,  -- FR-16
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.memes using gin (search);
create index on public.memes (status, score desc);
create index on public.memes (status, stage, score desc);
create index on public.memes (parent_meme_id);
create index on public.memes (community_id);
create index on public.memes (uploader_id, created_at);

create table public.meme_tags (
  meme_id bigint references public.memes on delete cascade,
  tag_id  bigint references public.tags  on delete cascade,
  primary key (meme_id, tag_id)
);
create index on public.meme_tags (tag_id);

create table public.votes (
  user_id    uuid   default auth.uid() references public.profiles on delete cascade,   -- B4
  meme_id    bigint references public.memes on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),           -- aggiornato a ogni cambio (B8)
  primary key (user_id, meme_id)
);
create index on public.votes (meme_id, created_at);
create index on public.votes (user_id, created_at);

create table public.stage_suggestions (
  id          bigint generated always as identity primary key,
  meme_id     bigint not null references public.memes on delete cascade,
  user_id     uuid default auth.uid() references public.profiles on delete set null,
  from_stage  public.stage not null,
  to_stage    public.stage not null check (to_stage = public.next_stage(from_stage)),  -- A7
  reason      text not null check (char_length(reason) between 1 and 280),           -- FR-10
  status      public.suggestion_status not null default 'open',
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index on public.stage_suggestions (meme_id, user_id) where status = 'open';  -- B11

create table public.activities (
  id         bigint generated always as identity primary key,
  meme_id    bigint not null references public.memes on delete cascade,
  actor_id   uuid references public.profiles on delete set null,
  type       public.activity_type not null,
  payload    jsonb not null default '{}',  -- stage_changed {from,to} · sighting_added {url,seen_on} · voted_milestone {up}
  created_at timestamptz not null default now()
);
create index on public.activities (meme_id, created_at desc);
create index on public.activities (type, created_at);

create table public.reports (
  id              bigint generated always as identity primary key,
  meme_id         bigint not null references public.memes on delete cascade,
  reporter_id     uuid references public.profiles on delete set null,
  reporter_email  text check (reporter_email ~ '^[^@\s]+@[^@\s]+$'),
  reason          public.report_reason not null,
  details         text not null default '' check (char_length(details) <= 2000),
  status          public.report_status not null default 'open',
  resolution_note text,
  resolved_by     uuid references public.profiles on delete set null,
  status_token    uuid not null default gen_random_uuid() unique,   -- A4
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index on public.reports (status, created_at);
create index on public.reports (meme_id, created_at) where reporter_id is null;  -- NFR-05

-- FR-08: pesi e esponente fuori dal codice (una sola riga)
create table public.score_config (
  id          boolean primary key default true check (id),
  w_net       numeric not null default 1,
  w_recent    numeric not null default 2,
  w_variants  numeric not null default 3,
  age_offset  numeric not null default 2,
  gravity     numeric not null default 0.8,
  recent_days int     not null default 7
);
insert into public.score_config default values;
