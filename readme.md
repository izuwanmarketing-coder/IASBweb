# Izuwan Automobile Website

Static production website for Izuwan Automobile, ready for GitHub + Cloudflare Pages.

## Cloudflare Pages settings

Use these exact settings:

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

This repo includes a tiny build script that copies the public website files into `dist/`, so Cloudflare Pages has a clean output folder to publish.

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

## DNS reminder

When Cloudflare Pages custom domains are added, remove old website A records for:

- `izuwanautomobile.com`
- `www.izuwanautomobile.com`

Do not delete email records:

- MX
- SPF TXT
- DKIM TXT / CNAME
- DMARC TXT
- email/autodiscover records

For email records, keep them as DNS only / grey cloud.
