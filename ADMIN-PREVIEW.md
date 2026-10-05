# Izuwan admin review — 5 October 2026

Local reconstruction from clean `bb2decccd03b3a3a2355b61074f7372f50ee6de4` on DESKTOP-6OSDUSM. No previous uncommitted cloud changes were available or reused. Nothing pushed or deployed. No production database writes, sheet reads, sharing changes or source cutover performed.

## Preview

From this checkout run `node scripts/admin-preview.mjs`, then open <http://127.0.0.1:4174/admin.html>.

This dedicated server binds only to loopback, serves an explicit asset allowlist, removes production configuration and Supabase scripts, supplies synthetic demo records, blocks all mutation methods, and sends a `connect-src 'none'` content security policy. Demo scripts are excluded from the static build. Use the banner links for empty, unavailable, failed-settings and login states. `?state=slow` simulates slower reads; `?state=denied` simulates a non-admin login. Do not use the general public-site preview server for isolated admin QA.

## Review scope

- Official Izuwan logo; dark sidebar and light workspace; responsive cards/tables/dialogs; keyboard-accessible mobile drawer.
- Overview, stock, click analytics, events, deliveries, sales team, dedicated pricelist import, and settings.
- Existing auth/admin membership and editing/upload/bulk workflows retained. Demo actions cannot persist.
- Loaded counts, zero-data versus failed-read messages, retry, 15-second read timeout, refresh coalescing, login submit protection, history navigation, stock and click filters.
- Settings saving is locked after failed reads. Pricelist imports cannot write settings when that read failed.
- Click analytics is explicitly the latest 200 loaded clicks, not confirmed leads or unique visitors. Managed Supabase inventory may differ from the website's sheet feed.

## Validation

`node scripts/check-public.mjs` passed. `node --test tests/*.test.cjs` passed 57 tests: 32 baseline + 12 new admin + 13 new public-feed tests. `node build.mjs` built 63 assets. `git diff --check` passed. Build regenerates tracked dist files, including baseline public source/dist differences; no deploy command was run.

Chrome visual QA at desktop 1440x1000 and mobile 390x844: overview, stock filters and editing dialog, mobile drawer, settings read failure (save disabled), analytics and pricelist. Mobile document width equalled viewport content width (375px including scrollbar deduction), with no horizontal page overflow. Native controls and successful saving against a real database were not exercised, by design.

Screenshots are in the sibling `preview-evidence` directory and saved to Library: admin-desktop.jpg, admin-mobile.jpg, admin-mobile-drawer.jpg, admin-dialog.jpg, admin-settings-error.jpg. The Windows runtime cannot attach Library xattrs; retain the separate identity manifest in that directory.

## Feed remediation staged locally

`_worker.js` accepts an explicitly separate `INVENTORY_PUBLIC_SHEET_ID`, optional `INVENTORY_PUBLIC_SHEET_NAME`, and optional validated `INVENTORY_PUBLIC_PRICELIST_DATE`. The replacement sheet must contain exactly these 16 headers (order is flexible):

`NO, BONDED, STOCK NO, LOT NO, Y, M, D, MODEL, CHASSIS NO, S, COLOUR, MILEAGE, SPECS, STATUS, SELLING PRICE, GRADE`

An optional `PRICELIST DATE` column is allowed. Unexpected columns, duplicates, missing headers, malformed quoting, invalid dates and ragged rows fail closed. Output retains the existing 43-column browser CSV layout. Once configured, replacement failures never consult the original source. The old route remains until explicit configuration to prevent an accidental outage.

The original public-sheet exposure remains unresolved in production. Later remediation requires a verified sanitized replacement sheet, explicit cutover configuration, deployment approval after this preview, and separately authorized owner sharing changes. Do not treat this local patch as closure of the exposure.
