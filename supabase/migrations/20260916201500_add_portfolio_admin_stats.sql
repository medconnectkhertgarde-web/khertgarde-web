-- Live admin statistics for the portfolio dashboard.
-- Read-only aggregate function. Does not modify studies, Drive, SEO, or public content.

create or replace function public.get_portfolio_admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not coalesce((select private.is_portfolio_admin()), false) then
    raise exception 'Portfolio admin authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'settings_present', exists(select 1 from public.portfolio_settings where id = 1),
    'settings_updated_at', (select updated_at from public.portfolio_settings where id = 1),
    'profile_image_custom', coalesce((select profile_image_url is not null and btrim(profile_image_url) <> '' from public.portfolio_settings where id = 1), false),
    'status_present', exists(select 1 from public.portfolio_status where id = 1),
    'status_enabled', coalesce((select is_enabled from public.portfolio_status where id = 1), false),
    'status_updated_at', (select updated_at from public.portfolio_status where id = 1),
    'experiences_total', (select count(*) from public.portfolio_experiences),
    'skills_total', (select count(*) from public.portfolio_skills),
    'skills_enabled', (select count(*) from public.portfolio_skills where is_enabled = true),
    'music_total', (select count(*) from public.portfolio_music),
    'music_enabled', (select count(*) from public.portfolio_music where is_enabled = true),
    'current_work_total', (select count(*) from public.portfolio_current_work),
    'current_work_active', (select count(*) from public.portfolio_current_work where is_visible = true and expires_at > now()),
    'comments_active', (select count(*) from public.portfolio_comments where expires_at > now()),
    'ratings_total', (select count(*) from public.portfolio_ratings),
    'rating_average', coalesce((select round(avg(rating)::numeric, 2) from public.portfolio_ratings), 0),
    'ratings_five_star', (select count(*) from public.portfolio_ratings where rating = 5)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_portfolio_admin_stats() from public;
grant execute on function public.get_portfolio_admin_stats() to authenticated;
