-- Re-applies the final read-only public access rules when upgrading a database
-- where an earlier migration may already be recorded as applied.

alter table if exists public.clinical_studies enable row level security;

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

create index if not exists clinical_studies_publication_order_idx
  on public.clinical_studies (published_at desc, sort_order asc)
  where is_published = true;
