-- Portfolio engagement patch: current-work updates + authenticated visitor ratings.
-- Intentionally isolated from Google Drive studies, storage, SEO, and other portfolio tables.

-- ---------------------------------------------------------------------------
-- Current work updates: public can read visible updates; admin manages all.
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_current_work (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 600),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_current_work_public_idx
  on public.portfolio_current_work (created_at desc)
  where is_visible = true;

alter table public.portfolio_current_work enable row level security;

revoke all on table public.portfolio_current_work from anon, authenticated;
grant select on table public.portfolio_current_work to anon, authenticated;
grant insert, update, delete on table public.portfolio_current_work to authenticated;

drop policy if exists "Public can read visible current work" on public.portfolio_current_work;
create policy "Public can read visible current work"
  on public.portfolio_current_work
  for select
  to anon, authenticated
  using (is_visible = true);

drop policy if exists "Admin can read all current work" on public.portfolio_current_work;
create policy "Admin can read all current work"
  on public.portfolio_current_work
  for select
  to authenticated
  using ((select private.is_portfolio_admin()));

drop policy if exists "Admin can insert current work" on public.portfolio_current_work;
create policy "Admin can insert current work"
  on public.portfolio_current_work
  for insert
  to authenticated
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can update current work" on public.portfolio_current_work;
create policy "Admin can update current work"
  on public.portfolio_current_work
  for update
  to authenticated
  using ((select private.is_portfolio_admin()))
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can delete current work" on public.portfolio_current_work;
create policy "Admin can delete current work"
  on public.portfolio_current_work
  for delete
  to authenticated
  using ((select private.is_portfolio_admin()));

-- ---------------------------------------------------------------------------
-- Portfolio ratings: one rating per authenticated visitor.
-- Individual ratings are private to their owner; public sees aggregate only.
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_ratings enable row level security;

revoke all on table public.portfolio_ratings from anon, authenticated;
grant select on table public.portfolio_ratings to authenticated;

drop policy if exists "Users can read their own portfolio rating" on public.portfolio_ratings;
create policy "Users can read their own portfolio rating"
  on public.portfolio_ratings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.rate_portfolio(stars smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  visitor_id uuid := (select auth.uid());
begin
  if visitor_id is null then
    raise exception 'Authentication required';
  end if;

  if stars is null or stars < 1 or stars > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  insert into public.portfolio_ratings (user_id, rating, created_at, updated_at)
  values (visitor_id, stars, now(), now())
  on conflict (user_id) do update
    set rating = excluded.rating,
        updated_at = now();
end;
$$;

revoke all on function public.rate_portfolio(smallint) from public;
grant execute on function public.rate_portfolio(smallint) to authenticated;

create or replace function public.get_portfolio_rating_summary()
returns table (average_rating numeric, rating_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(round(avg(r.rating)::numeric, 2), 0::numeric) as average_rating,
    count(*)::bigint as rating_count
  from public.portfolio_ratings as r;
$$;

revoke all on function public.get_portfolio_rating_summary() from public;
grant execute on function public.get_portfolio_rating_summary() to anon, authenticated;
