# Supabase + Google Drive setup

## 1. Install dependencies

```bash
npm install
```

## 2. Frontend environment file

The finished ZIP already includes a git-ignored `.env.local` connected to the Supabase project from the uploaded source. If you ever rotate the publishable key or move to another project, update only:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLISHABLE_KEY
```

Use the Supabase **publishable** key. Never expose a secret/service-role key.

## 3. Apply the database schema using commands only

```bash
npx supabase@latest login
npx supabase@latest link --project-ref fdglnaxjyphpyhndakfi
npx supabase@latest migration list
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

`db push --dry-run` is intentionally included so you can see which migrations will run before any remote change is applied.

If the CLI reports that the remote database was modified manually and migration history is out of sync, do not reset the remote database. First use:

```bash
npx supabase@latest db pull
npx supabase@latest migration list
```

Review the generated migration, then run the dry-run and push commands again.

## 4. Prepare a Google Drive study

No Google Drive API key, OAuth client, or Google Cloud project is required for this implementation. It uses public Viewer links only.


1. Upload the study PDF to Google Drive.
2. Select the file and click **Share**.
3. Under **General access**, choose **Anyone with the link**.
4. Choose **Viewer**.
5. Open the Share **Settings** (gear) and make sure viewers/commenters are allowed to download, print, and copy if you want the portfolio Download button enabled.
6. Click **Copy link** and **Done**.
7. Confirm the link works in a private/incognito browser window before publishing it on the portfolio.

Example:

```text
https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing
```

The file ID is:

```text
1AbCdEfGhIjKlMnOpQrStUvWxYz
```

The application builds these URLs automatically:

```text
Preview:  https://drive.google.com/file/d/FILE_ID/preview
View:     https://drive.google.com/file/d/FILE_ID/view
Download: https://drive.usercontent.google.com/download?id=FILE_ID&export=download
```

## 5. Add a clinical study

Copy the example first so it remains reusable:

Windows Command Prompt:

```bat
copy supabase\examples\add-clinical-study.sql add-study.sql
```

PowerShell / macOS / Linux:

```bash
cp supabase/examples/add-clinical-study.sql add-study.sql
```

Edit `add-study.sql` and replace every placeholder.

The cleanest long-term workflow is to create a new migration for each metadata change:

```bash
npx supabase@latest migration new add_clinical_study
```

Paste the finished INSERT statement into the new SQL file, then deploy it:

```bash
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

To hide a study without deleting its metadata, create another migration containing:

```sql
update public.clinical_studies
set is_published = false
where slug = 'YOUR-STUDY-SLUG';
```

Then push that migration.

## 6. Run and test locally

```bash
npm run dev
```

Verify all of the following:

- the portfolio loads normally;
- a published study appears;
- **View study** opens the Drive preview;
- **Open in Drive** works;
- **Download** works;
- an unpublished study does not appear.

## 7. Deploy to Vercel

In the Vercel project, add these Environment Variables for Production and Preview:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Redeploy after adding or changing either variable.
