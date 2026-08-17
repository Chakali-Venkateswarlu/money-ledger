# Money Ledger

A tiny daily expense tracker. Log what you spend each day, tag it with a
category (Food, Shopping, Travel, Bills, Entertainment, Health, Others),
and see where your money goes — today, this week, this month.

It's a static frontend (`index.html`, `style.css`, `app.js` — no build
step) backed by [Supabase](https://supabase.com) for auth and data sync,
so your ledger follows you across devices once you sign in.

## Features

- Sign up / sign in with email + password; your data is private to your account
- Add / edit / delete expenses (amount, category, date, note)
- Syncs across every device you sign into
- Today / this week / this month / daily average stat tiles
- Category breakdown bar chart, per month
- Transaction list grouped by day, with a category filter
- Month navigation (prev/next)
- Export to JSON or CSV, import from JSON
- Light & dark mode (follows your system setting)

## One-time setup: Supabase

The frontend is static, but it needs a Supabase project to store data and
handle login. This takes about 5 minutes and is free.

1. Create an account and a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your project's dashboard, paste in the contents
   of [`schema.sql`](schema.sql), and run it. This creates the
   `transactions` table with Row Level Security so each user can only
   ever see their own rows.
3. Open **Project Settings → API**. Copy the **Project URL** and the
   **`anon` `public`** key.
4. Paste them into [`config.js`](config.js):
   ```js
   window.SUPABASE_CONFIG = {
     url: "https://xxxxxxxx.supabase.co",
     anonKey: "eyJhbGciOi...",
   };
   ```
   The anon key is *meant* to be public — it's safe to commit and deploy.
   Access control comes from the Row Level Security policy in
   `schema.sql`, not from hiding this key.
5. By default Supabase requires email confirmation on sign-up. For a
   personal project you can turn that off in **Authentication →
   Providers → Email → Confirm email** (toggle off) so you can sign in
   immediately after creating your account. Leave it on if you'd rather
   confirm via the email link.

That's it — reload `index.html` and you should see a sign-in screen.

## Run it locally

Any static file server works:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Data & privacy

Transactions are stored in your Supabase project's Postgres database,
scoped to your account by Row Level Security — only you can read or
write your own rows, even though the `anon` key is public. Supabase's
free tier is generous enough for personal use indefinitely.

The currency symbol defaults to `₹`. Change `CURRENCY_SYMBOL` at the top
of `app.js` if you want a different one.

## Deploy

The frontend is static, so any static host works — Supabase handles the
backend. Push this folder to a Git repo first:

```bash
git add .
git commit -m "Configure Supabase"
```

Then pick one:

### GitHub Pages

1. Create a repo on GitHub and push:
   ```bash
   git remote add origin https://github.com/<you>/money-ledger.git
   git branch -M main
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source → Deploy from branch → main / (root)**.
3. Your site will be live at `https://<you>.github.io/money-ledger/`.

### Vercel

```bash
npx vercel
```
Follow the prompts (no build command needed — it's static). Or import
the GitHub repo at [vercel.com/new](https://vercel.com/new).

### Netlify

```bash
npx netlify-cli deploy --prod
```
Or drag-and-drop the project folder at [app.netlify.com/drop](https://app.netlify.com/drop).

Any of these give you a public HTTPS URL you can use from your phone —
sign in once per device and your ledger stays in sync.
