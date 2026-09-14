-- Portfolio admin/content management patch.
-- Keeps the public portfolio lightweight while moving only editable text,
-- experiences, profile image URL, and moderation controls into Supabase.
-- Admin authorization is bound to one confirmed Supabase Auth email.
-- No password is stored in SQL or frontend source.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as u
    where u.id = (select auth.uid())
      and lower(coalesce(u.email, '')) = 'medconnect.khertgarde@gmail.com'
      and u.email_confirmed_at is not null
      and exists (
        select 1
        from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) as method
        where (
          case
            when jsonb_typeof(method) = 'string' then method #>> '{}'
            else method ->> 'method'
          end
        ) = 'password'
      )
  );
$$;

revoke all on function private.is_portfolio_admin() from public;
grant execute on function private.is_portfolio_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Public portfolio settings: one row, public read, admin-only update.
-- ---------------------------------------------------------------------------

create table if not exists public.portfolio_settings (
  id smallint primary key default 1 check (id = 1),
  display_name text not null check (char_length(display_name) between 1 and 100),
  eyebrow text not null default '' check (char_length(eyebrow) <= 160),
  role_primary text not null check (char_length(role_primary) between 1 and 100),
  role_secondary text not null default '' check (char_length(role_secondary) <= 120),
  hero_copy text not null check (char_length(hero_copy) between 1 and 1200),
  about_primary text not null check (char_length(about_primary) between 1 and 1600),
  about_secondary text not null default '' check (char_length(about_secondary) <= 1600),
  contact_intro text not null default '' check (char_length(contact_intro) <= 600),
  contact_email text not null default '' check (char_length(contact_email) <= 320),
  contact_phone text not null default '' check (char_length(contact_phone) <= 40),
  contact_phone_href text not null default '' check (char_length(contact_phone_href) <= 40),
  profile_image_url text check (profile_image_url is null or char_length(profile_image_url) <= 2048),
  updated_at timestamptz not null default now()
);

insert into public.portfolio_settings (
  id,
  display_name,
  eyebrow,
  role_primary,
  role_secondary,
  hero_copy,
  about_primary,
  about_secondary,
  contact_intro,
  contact_email,
  contact_phone,
  contact_phone_href,
  profile_image_url
)
values (
  1,
  'Khert Laguna Garde',
  'Independent researcher · Philippines',
  'Independent Researcher',
  'Medicine · Clinical Studies',
  'Independent researcher with a strong interest in medicine and clinical studies. I explore medical conditions, diagnostic approaches, disease mechanisms, treatment principles, and clinical scenarios through structured independent research and study.',
  'I’m an independent researcher with a growing focus on medicine and clinical studies. My work centers on understanding diseases, clinical presentation, diagnostic reasoning, treatment principles, and evidence-based approaches to patient scenarios.',
  'I enjoy turning complex medical topics into structured and understandable study materials while continuously expanding my knowledge across different areas of medicine.',
  'For research-related inquiries, professional opportunities, and other communications.',
  'medconnect.khertgarde@gmail.com',
  '09307732588',
  '+639307732588',
  null
)
on conflict (id) do nothing;

alter table public.portfolio_settings enable row level security;

revoke all on table public.portfolio_settings from anon, authenticated;
grant select on table public.portfolio_settings to anon, authenticated;
grant update on table public.portfolio_settings to authenticated;

drop policy if exists "Public can read portfolio settings" on public.portfolio_settings;
create policy "Public can read portfolio settings"
  on public.portfolio_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can update portfolio settings" on public.portfolio_settings;
create policy "Admin can update portfolio settings"
  on public.portfolio_settings
  for update
  to authenticated
  using ((select private.is_portfolio_admin()))
  with check ((select private.is_portfolio_admin()));

-- ---------------------------------------------------------------------------
-- Work experiences: public read, admin CRUD.
-- ---------------------------------------------------------------------------

create table if not exists public.portfolio_experiences (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 1 and 160),
  role text not null check (char_length(role) between 1 and 180),
  description text not null check (char_length(description) between 1 and 1800),
  note text check (note is null or char_length(note) <= 1200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.portfolio_experiences (
  id,
  company,
  role,
  description,
  note,
  sort_order
)
values
(
  'c5a84ca8-1f3c-4d0f-b5ba-f06221488e21'::uuid,
  'Concentrix',
  'Customer Service Representative',
  'Handled customer inquiries and service concerns while providing clear, professional, and timely support. The role involved understanding customer needs, explaining information accurately, resolving concerns when possible, documenting interactions, following account procedures, and escalating complex issues when necessary.',
  'A Customer Service Representative serves as a primary point of contact between a company and its customers, helping answer questions, resolve concerns, provide information, and maintain a positive customer experience.',
  10
),
(
  '7d1cc034-cb69-4d94-881a-1e4d12cb25d1'::uuid,
  'Sutherland Global Services',
  'Business Process Outsourcing — Healthcare Account',
  'Worked within a healthcare-focused BPO account supporting account operations and customer interactions according to established company and account procedures.',
  null,
  20
)
on conflict (id) do nothing;

create index if not exists portfolio_experiences_sort_idx
  on public.portfolio_experiences (sort_order, created_at);

alter table public.portfolio_experiences enable row level security;

revoke all on table public.portfolio_experiences from anon, authenticated;
grant select on table public.portfolio_experiences to anon, authenticated;
grant insert, update, delete on table public.portfolio_experiences to authenticated;

drop policy if exists "Public can read portfolio experiences" on public.portfolio_experiences;
create policy "Public can read portfolio experiences"
  on public.portfolio_experiences
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can insert portfolio experiences" on public.portfolio_experiences;
create policy "Admin can insert portfolio experiences"
  on public.portfolio_experiences
  for insert
  to authenticated
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can update portfolio experiences" on public.portfolio_experiences;
create policy "Admin can update portfolio experiences"
  on public.portfolio_experiences
  for update
  to authenticated
  using ((select private.is_portfolio_admin()))
  with check ((select private.is_portfolio_admin()));

drop policy if exists "Admin can delete portfolio experiences" on public.portfolio_experiences;
create policy "Admin can delete portfolio experiences"
  on public.portfolio_experiences
  for delete
  to authenticated
  using ((select private.is_portfolio_admin()));

-- ---------------------------------------------------------------------------
-- Comment deletion:
-- 1) signed-in visitors may delete only their own comments;
-- 2) the portfolio administrator may delete any active comment.
-- Existing read/post/retention behavior remains unchanged.
-- ---------------------------------------------------------------------------

grant delete on table public.portfolio_comments to authenticated;

drop policy if exists "Users can delete their own portfolio comments" on public.portfolio_comments;
create policy "Users can delete their own portfolio comments"
  on public.portfolio_comments
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Admin can delete portfolio comments" on public.portfolio_comments;
create policy "Admin can delete portfolio comments"
  on public.portfolio_comments
  for delete
  to authenticated
  using ((select private.is_portfolio_admin()));

-- ---------------------------------------------------------------------------
-- One tiny public bucket for the public portfolio profile image.
-- Public reads are intentional; only the administrator can write/delete.
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portfolio-assets',
  'portfolio-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin can read portfolio asset metadata" on storage.objects;
create policy "Admin can read portfolio asset metadata"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'portfolio-assets'
    and (select private.is_portfolio_admin())
  );

drop policy if exists "Admin can upload portfolio assets" on storage.objects;
create policy "Admin can upload portfolio assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-assets'
    and (select private.is_portfolio_admin())
  );

drop policy if exists "Admin can update portfolio assets" on storage.objects;
create policy "Admin can update portfolio assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'portfolio-assets'
    and (select private.is_portfolio_admin())
  )
  with check (
    bucket_id = 'portfolio-assets'
    and (select private.is_portfolio_admin())
  );

drop policy if exists "Admin can delete portfolio assets" on storage.objects;
create policy "Admin can delete portfolio assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'portfolio-assets'
    and (select private.is_portfolio_admin())
  );
