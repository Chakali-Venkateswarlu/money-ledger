# Money Ledger

A tiny daily expense tracker. Log what you spend each day, tag it with a
category (Food, Shopping, Travel, Bills, Entertainment, Health, Others),
and see where your money goes — today, this week, this month.

No backend, no build step, no dependencies. It's three static files
(`index.html`, `style.css`, `app.js`) that store everything in the
browser's `localStorage`.

## Features

- Add / edit / delete expenses (amount, category, date, note)
- Today / this week / this month / daily average stat tiles
- Category breakdown bar chart, per month
- Transaction list grouped by day, with a category filter
- Month navigation (prev/next)
- Export to JSON or CSV, import from JSON (for backup/migration)
- Light & dark mode (follows your system setting)

## Run it locally

Any static file server works:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

or just double-click `index.html` — it works from the filesystem too.

## Data & privacy

All data lives only in your browser's `localStorage`, under the key
`money-ledger-transactions`. Nothing is sent to a server. This also means:

- Data is per-browser, per-device. It won't sync across devices.
- Clearing your browser's site data deletes your ledger. **Use the
  "Export JSON" button regularly to back up.**
- To move data to another browser/device, export JSON from the old one
  and use "Import JSON" on the new one.

The currency symbol defaults to `₹`. Change `CURRENCY_SYMBOL` at the top
of `app.js` if you want a different one.

## Deploy

Since this is a static site, any static host works. Push this folder to
a Git repo first:

```bash
git init
git add .
git commit -m "Initial commit"
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

Any of these give you a public HTTPS URL you can use from your phone.
