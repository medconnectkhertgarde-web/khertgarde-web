-- Add concise descriptions to interactive portfolio skills.
-- This migration only changes public.portfolio_skills. It does not touch
-- Google Drive studies, portfolio settings, comments, music, auth, or storage.

alter table public.portfolio_skills
  add column if not exists description text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'portfolio_skills_description_length_check'
      and conrelid = 'public.portfolio_skills'::regclass
  ) then
    alter table public.portfolio_skills
      add constraint portfolio_skills_description_length_check
      check (char_length(description) <= 320);
  end if;
end
$$;

with defaults(name, description) as (
  values
    ('Customer Service', 'Supporting customers through clear communication, active listening, issue resolution, and accurate documentation.'),
    ('Artificial Intelligence', 'Using AI tools to support research, productivity, content workflows, and practical project development.'),
    ('AI Prompt Engineering', 'Designing structured prompts and iterative instructions to produce more accurate and useful AI-assisted outputs.'),
    ('Python', 'Foundational Python for scripting, automation, data handling, and building practical tools and utilities.'),
    ('Cybersecurity', 'Foundational knowledge of security principles, safe system practices, common threats, and risk-aware troubleshooting.'),
    ('Networking', 'Foundational computer networking, connectivity setup, basic diagnostics, and troubleshooting of local network issues.'),
    ('Computer Systems Servicing', 'Computer setup, hardware and software maintenance, basic diagnostics, troubleshooting, and system support.'),
    ('ONSIT', 'Practical familiarity with ONSIT-related workflows and tasks included in my current technical skill set.'),
    ('Research', 'Independent research, evidence gathering, source review, structured synthesis, and turning complex topics into clear materials.'),
    ('Technical Support', 'Providing basic technical assistance, diagnosing common issues, and guiding users through practical solutions.'),
    ('Troubleshooting', 'Systematically identifying likely causes, testing fixes, and documenting solutions for technical problems.'),
    ('Systems Support', 'Supporting day-to-day computer systems, software setup, user needs, and reliable operation of basic IT environments.'),
    ('Communication', 'Clear written and verbal communication across customer service, technical support, research, and collaborative work.'),
    ('Data Organization', 'Structuring, labeling, and maintaining information so it stays accurate, usable, and easy to retrieve.')
)
update public.portfolio_skills as skill
set description = defaults.description,
    updated_at = now()
from defaults
where lower(skill.name) = lower(defaults.name)
  and btrim(coalesce(skill.description, '')) = '';
