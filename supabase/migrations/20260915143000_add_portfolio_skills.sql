-- Lightweight interactive skills for the public portfolio.
-- Public visitors can read enabled skills only. The existing password-authenticated
-- portfolio administrator can manage the list. No realtime subscription is used.

create table if not exists public.portfolio_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 64),
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portfolio_skills_name_ci_idx
  on public.portfolio_skills (lower(name));

create index if not exists portfolio_skills_public_order_idx
  on public.portfolio_skills (is_enabled, sort_order, created_at);

insert into public.portfolio_skills (name, sort_order, is_enabled)
values
  ('Customer Service', 10, true),
  ('Artificial Intelligence', 20, true),
  ('AI Prompt Engineering', 30, true),
  ('Python', 40, true),
  ('Cybersecurity', 50, true),
  ('Networking', 60, true),
  ('Computer Systems Servicing', 70, true),
  ('ONSIT', 80, true),
  ('Research', 90, true),
  ('Technical Support', 100, true),
  ('Troubleshooting', 110, true),
  ('Systems Support', 120, true),
  ('Communication', 130, true),
  ('Data Organization', 140, true)
on conflict do nothing;

alter table public.portfolio_skills enable row level security;

revoke all on table public.portfolio_skills from anon, authenticated;
grant select on table public.portfolio_skills to anon, authenticated;
grant insert, update, delete on table public.portfolio_skills to authenticated;

drop policy if exists "Public can read enabled portfolio skills" on public.portfolio_skills;
create policy "Public can read enabled portfolio skills"
  on public.portfolio_skills
  for select
  to anon, authenticated
  using (is_enabled = true);

drop policy if exists "Admin can read all portfolio skills" on public.portfolio_skills;
create policy "Admin can read all portfolio skills"
  on public.portfolio_skills
  for select
  to authenticated
  using ((select private.is_portfolio_admin()));

drop policy if exists "Admin can insert portfolio skills" on public.portfolio_skills;
create policy "Admin can insert portfolio skills"
  on public.portfolio_skills
  for insert
  to authenticated
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can update portfolio skills" on public.portfolio_skills;
create policy "Admin can update portfolio skills"
  on public.portfolio_skills
  for update
  to authenticated
  using ((select private.is_portfolio_admin()))
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can delete portfolio skills" on public.portfolio_skills;
create policy "Admin can delete portfolio skills"
  on public.portfolio_skills
  for delete
  to authenticated
  using ((select private.is_portfolio_admin()));
