-- TEMPLATE ONLY. Replace every value before running it.
-- gdrive_file_id accepts the raw Drive file ID. The frontend can also parse a normal Drive file URL.

insert into public.clinical_studies (
  title,
  slug,
  summary,
  category,
  published_at,
  gdrive_file_id,
  filename,
  is_published,
  sort_order
)
values (
  'REPLACE WITH STUDY TITLE',
  'replace-with-study-slug',
  'Replace with a short public summary.',
  'REPLACE WITH CATEGORY',
  now(),
  'REPLACE_WITH_GOOGLE_DRIVE_FILE_ID',
  'replace-with-filename.pdf',
  true,
  0
);
