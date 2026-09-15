-- Incremental engagement refinement only:
-- 1) richer aggregate rating statistics
-- 2) six-month retention for current-work updates
-- Intentionally does not touch studies, Google Drive, SEO, storage, or other portfolio systems.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Current-work retention: every update is visible for at most six months.
-- Existing rows inherit an expiry exactly six months after their creation time.
-- ---------------------------------------------------------------------------
alter table public.portfolio_current_work
  add column if not exists expires_at timestamptz;

update public.portfolio_current_work
set expires_at = created_at + interval '6 months'
where expires_at is null;

alter table public.portfolio_current_work
  alter column expires_at set default (now() + interval '6 months'),
  alter column expires_at set not null;

create index if not exists portfolio_current_work_expires_at_idx
  on public.portfolio_current_work (expires_at);

-- Expired entries are hidden immediately, even before the daily purge runs.
drop policy if exists "Public can read visible current work" on public.portfolio_current_work;
create policy "Public can read visible current work"
  on public.portfolio_current_work
  for select
  to anon, authenticated
  using (is_visible = true and expires_at > now());

-- Remove anything that is already past retention at migration time.
delete from public.portfolio_current_work
where expires_at <= now();

-- Keep exactly one tiny daily purge job if the migration is retried manually.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'portfolio-current-work-retention'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end
$$;

select cron.schedule(
  'portfolio-current-work-retention',
  '23 3 * * *',
  $$delete from public.portfolio_current_work where expires_at <= now()$$
);

-- ---------------------------------------------------------------------------
-- Rating statistics: one aggregate RPC returns average, total, and 1–5 counts.
-- This preserves privacy: individual visitors' ratings are never exposed.
-- ---------------------------------------------------------------------------
create or replace function public.get_portfolio_rating_stats()
returns table (
  average_rating numeric,
  rating_count bigint,
  five_star_count bigint,
  four_star_count bigint,
  three_star_count bigint,
  two_star_count bigint,
  one_star_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(round(avg(r.rating)::numeric, 2), 0::numeric) as average_rating,
    count(*)::bigint as rating_count,
    count(*) filter (where r.rating = 5)::bigint as five_star_count,
    count(*) filter (where r.rating = 4)::bigint as four_star_count,
    count(*) filter (where r.rating = 3)::bigint as three_star_count,
    count(*) filter (where r.rating = 2)::bigint as two_star_count,
    count(*) filter (where r.rating = 1)::bigint as one_star_count
  from public.portfolio_ratings as r;
$$;

revoke all on function public.get_portfolio_rating_stats() from public;
grant execute on function public.get_portfolio_rating_stats() to anon, authenticated;
