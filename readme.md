# Izuwan Automobile Website

Static production website for Izuwan Automobile, ready for GitHub + Cloudflare Pages.

## Deploy target

- Hosting: Cloudflare Pages
- Framework preset: None
- Build command: leave blank
- Build output directory: `/`
- Production branch: `main`

## Main pages

- `index.html` — homepage
- `inventory.html` — ready stock inventory
- `events.html` — active events and campaigns
- `select-programme.html` — Japan sourcing programme
- `calculator.html` — loan / affordability calculator
- `otr.html` — OTR calculator
- `about.html` — company profile and story
- `contact.html` — HQ, WhatsApp and sales advisors
- `admin.html` — protected admin panel by direct URL

## Admin and database

The public website is static. Dynamic inventory, sales advisor, event banner and site settings are powered by Supabase.

Before using the latest admin features, open Supabase SQL Editor and run:

```text
supabase-schema.sql
```

Admin route:

```text
/admin.html
```

Supabase connection is configured in:

```text
config.js
```

The Supabase publishable key is safe to be public. Do not commit private service-role keys.

## Cloudflare Pages notes

After uploading this repo to GitHub:

1. Go to Cloudflare Dashboard.
2. Open Workers & Pages.
3. Create Pages project.
4. Connect GitHub repo.
5. Use the deploy settings above.
6. Add custom domains:
   - `izuwanautomobile.com`
   - `www.izuwanautomobile.com`

Keep email DNS records separate. Do not delete MX, SPF, DKIM, DMARC or GoDaddy email records unless email is intentionally being moved.

## Local preview

Open `index.html` directly in a browser, or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev-server.ps1
```

Then open:

```text
http://localhost:4173
```
