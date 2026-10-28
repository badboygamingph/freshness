# Supabase + Vercel setup guide (Freshness Evaluator)

This app stores **all live data in Supabase**:

| Table | Purpose |
| --- | --- |
| `freshness_assessments` | Every evaluator swipe (Fresh / Semi-Fresh / Spoiled) |
| `dataset_items` | Food images shown in the swipe deck |
| `folders` | Admin folder tree |
| `evaluators` | Optional evaluator profiles |
| Storage bucket `dataset-images` | Uploaded image files (public URLs in `dataset_items`) |

Evaluators **insert** rows into `freshness_assessments` on each classification. Admins **insert/update** `dataset_items` and `folders`.

---

## Part 1 — Create and prepare Supabase

### 1. Open your Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open project **kejoyjmselrzkrbgisvu** (or create a new project and use its URL/keys instead).

### 2. Run the database setup SQL

1. In Supabase: **SQL Editor** → **New query**.
2. In this app: open **Administrator** → **Supabase / Database** (or copy SQL from `generateSupabaseSQLTable` in code).
3. Paste the full setup script (creates tables, sample rows, RLS policies, storage bucket).
4. Click **Run**.

If RLS policies are missing, the browser **anon** key cannot insert data—you will see empty decks or silent failures in the network tab.

### 3. Get API credentials

1. Supabase → **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL** → use as `VITE_SUPABASE_URL`
   - **anon public** key → use as `VITE_SUPABASE_ANON_KEY`

Use the **anon** key only (never put the **service_role** key in Vercel or in this frontend).

---

## Part 2 — Configure Vercel

### 1. Open environment variables

1. [vercel.com](https://vercel.com) → your **freshness** project.
2. **Settings** → **Environment Variables**.

### 2. Add these variables

Add **both** for **Production** and **Preview** (and **Development** if you use Vercel CLI):

| Name | Example value | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://kejoyjmselrzkrbgisvu.supabase.co` | Project URL from Supabase API settings |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | **anon public** key only |

Vite bakes `VITE_*` variables into the app **at build time**. After changing them, you **must redeploy**.

### 3. Redeploy

1. **Deployments** → latest deployment → **⋯** → **Redeploy**.
2. Or push a commit to GitHub if the project is connected to [badboygamingph/freshness](https://github.com/badboygamingph/freshness).

### 4. Confirm build settings

- **Framework:** Vite  
- **Root Directory:** repository root  
- **Build Command:** `npm run build`  
- **Output Directory:** `dist`  

(`vercel.json` in the repo already defines these.)

---

## Part 3 — Local development (optional)

1. Copy env template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_public_key
   ```

3. Run:

   ```bash
   npm install
   npm run dev
   ```

---

## Part 4 — Verify inserts work

### A. Connection test (admin)

1. Open `https://YOUR-VERCEL-URL/administrator`
2. Log in as admin.
3. Open the Supabase / database section.
4. Click **Test connection** — expect a success message for table `freshness_assessments`.

### B. Dataset images

1. In admin, upload or restore sample dataset images.
2. In Supabase → **Table Editor** → `dataset_items` — new rows should appear.

### C. Evaluator swipe → assessment insert

1. Open the main app URL (not admin).
2. Complete onboarding (evaluator name).
3. Swipe or tap **Fresh**, **Semi-Fresh**, or **Spoiled**.
4. In Supabase → **Table Editor** → `freshness_assessments` — a new row per swipe with `user_id`, `image_id`, `classification`, `assessed_at`.

### D. If rows do not appear

1. Browser **DevTools** → **Network** → filter `rest` or your Supabase host — check for `401`, `403`, or RLS errors.
2. Confirm RLS policies from the setup SQL were applied.
3. Confirm Vercel env vars are set and you **redeployed** after adding them.
4. Hard-refresh the site (Ctrl+F5) to load the latest JS bundle.

---

## Part 5 — How the app uses credentials

1. On load, `getSupabaseConfig()` reads **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** from the built bundle (from Vercel env).
2. When those are set, they **override** old values saved in the browser’s localStorage.
3. A **single shared Supabase client** talks to:
   - `freshness_assessments` — `upsert` on each classification
   - `dataset_items` / `folders` — admin CRUD and bulk import
   - Storage bucket `dataset-images` — admin image uploads

Default assessment table name: **`freshness_assessments`** (changeable in admin Supabase settings).

---

## Quick checklist

- [ ] SQL setup script executed in Supabase  
- [ ] RLS policies enabled for anon read/write on required tables  
- [ ] `VITE_SUPABASE_URL` set on Vercel  
- [ ] `VITE_SUPABASE_ANON_KEY` set on Vercel (anon key only)  
- [ ] Redeploy after env changes  
- [ ] Test connection in admin succeeds  
- [ ] Test swipe creates row in `freshness_assessments`  

For repo deployment basics, see the main [README.md](../README.md).
