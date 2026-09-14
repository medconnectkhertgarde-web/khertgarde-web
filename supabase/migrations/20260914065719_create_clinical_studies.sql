-- Clinical studies metadata only. The actual study files remain in Google Drive.
-- Safe to run on a fresh project and intentionally idempotent for an existing table.

create table if not exists public.clinical_studies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  summary text not null default '',
  category text not null default '',
  published_at timestamptz,
  gdrive_file_id text,
  filename text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Keep existing installations compatible if the table was created before this migration.
alter table public.clinical_studies add column if not exists title text;
alter table public.clinical_studies add column if not exists slug text;
alter table public.clinical_studies add column if not exists summary text not null default '';
alter table public.clinical_studies add column if not exists category text not null default '';
alter table public.clinical_studies add column if not exists published_at timestamptz;
alter table public.clinical_studies add column if not exists gdrive_file_id text;
alter table public.clinical_studies add column if not exists filename text;
alter table public.clinical_studies add column if not exists is_published boolean not null default false;
alter table public.clinical_studies add column if not exists sort_order integer not null default 0;
alter table public.clinical_studies add column if not exists created_at timestamptz not null default now();

create unique index if not exists clinical_studies_slug_unique_idx
  on public.clinical_studies (slug);

create index if not exists clinical_studies_publication_order_idx
  on public.clinical_studies (published_at desc, sort_order asc)
  where is_published = true;

alter table public.clinical_studies enable row level security;

-- Browser visitors only need SELECT. Remove all mutation privileges explicitly.
grant usage on schema public to anon, authenticated;
revoke all on table public.clinical_studies from anon, authenticated;
grant select on table public.clinical_studies to anon, authenticated;
grant all on table public.clinical_studies to service_role;

drop policy if exists "Published clinical studies are publicly readable"
  on public.clinical_studies;

create policy "Published clinical studies are publicly readable"
  on public.clinical_studies
  for select
  to anon, authenticated
  using (is_published = true);

comment on table public.clinical_studies is
  'Public metadata for clinical study documents stored in Google Drive.';
