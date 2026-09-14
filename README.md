# Khert Laguna Garde — Portfolio

A lightweight React/Vite portfolio for Khert Laguna Garde, focused on independent medical research and clinical studies.

## Stack

- React + TypeScript + Vite
- Plain responsive CSS (no UI framework runtime)
- Supabase for published study metadata
- Google Drive for document storage, preview, and downloads
- Vercel-compatible static deployment

## Local development

```bash
npm install
npm run dev
```

The delivered ZIP already contains a git-ignored `.env.local` using the browser-safe Supabase connection from the uploaded project. If that file is missing in a future Git checkout, copy `.env.example` to `.env.local` first.

The frontend uses only these two browser-safe values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLISHABLE_KEY
```

Never put a Supabase secret key or service-role key in a `VITE_*` variable.

## Database deployment with Supabase CLI

The schema is stored in `supabase/migrations/`.

```bash
npm install
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest migration list
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

Do not use `db reset --linked` on the production project because it is destructive.

## Profile photo

Replace the included neutral placeholder at `public/profile.jpg` with your real portrait, keeping the same filename. If the file is removed, the interface falls back to a text placeholder.

## Google Drive

1. Upload the final PDF to Google Drive.
2. Open **Share**.
3. Under **General access**, choose **Anyone with the link**.
4. Set the role to **Viewer**.
5. Keep download permission enabled if you want the Download button to work.
6. Copy the file link.
7. From a link such as `https://drive.google.com/file/d/FILE_ID/view`, copy `FILE_ID`.
8. Insert the study metadata into `public.clinical_studies`. A template is provided in `supabase/examples/add-clinical-study.sql`.

The home page never preloads Drive documents. The Drive iframe is created only after a visitor selects **View study**.

## Production build

```bash
npm run typecheck
npm run lint
npm run build
```

For Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's Environment Variables and redeploy.
