-- Optional YouTube music links for the portfolio profile.
-- Public visitors can read enabled tracks only. The existing password-authenticated
-- portfolio administrator can manage all rows.

create table if not exists public.portfolio_music (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Profile music' check (char_length(title) between 1 and 120),
  youtube_url text not null check (char_length(youtube_url) between 1 and 2048),
  youtube_video_id text not null unique check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_music_public_order_idx
  on public.portfolio_music (is_enabled, sort_order, created_at);

alter table public.portfolio_music enable row level security;

revoke all on table public.portfolio_music from anon, authenticated;
grant select on table public.portfolio_music to anon, authenticated;
grant insert, update, delete on table public.portfolio_music to authenticated;

drop policy if exists "Public can read enabled portfolio music" on public.portfolio_music;
create policy "Public can read enabled portfolio music"
  on public.portfolio_music
  for select
  to anon, authenticated
  using (is_enabled = true);

drop policy if exists "Admin can read all portfolio music" on public.portfolio_music;
create policy "Admin can read all portfolio music"
  on public.portfolio_music
  for select
  to authenticated
  using ((select private.is_portfolio_admin()));

drop policy if exists "Admin can insert portfolio music" on public.portfolio_music;
create policy "Admin can insert portfolio music"
  on public.portfolio_music
  for insert
  to authenticated
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can update portfolio music" on public.portfolio_music;
create policy "Admin can update portfolio music"
  on public.portfolio_music
  for update
  to authenticated
  using ((select private.is_portfolio_admin()))
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can delete portfolio music" on public.portfolio_music;
create policy "Admin can delete portfolio music"
  on public.portfolio_music
  for delete
  to authenticated
  using ((select private.is_portfolio_admin()));
