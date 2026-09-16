create table if not exists public.portfolio_status (
  id smallint primary key default 1 check (id = 1),
  status_text text not null default '' check (char_length(status_text) <= 120),
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.portfolio_status (id, status_text, is_enabled)
values (1, '', false)
on conflict (id) do nothing;

alter table public.portfolio_status enable row level security;

drop policy if exists "portfolio status is publicly readable" on public.portfolio_status;
create policy "portfolio status is publicly readable"
on public.portfolio_status
for select
to anon, authenticated
using (true);

drop policy if exists "portfolio admin can update status" on public.portfolio_status;
create policy "portfolio admin can update status"
on public.portfolio_status
for update
to authenticated
using (private.is_portfolio_admin())
with check (private.is_portfolio_admin());

drop policy if exists "portfolio admin can insert status" on public.portfolio_status;
create policy "portfolio admin can insert status"
on public.portfolio_status
for insert
to authenticated
with check (private.is_portfolio_admin());

grant select on table public.portfolio_status to anon, authenticated;
grant insert, update on table public.portfolio_status to authenticated;
