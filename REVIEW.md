# Izuwan Automobile — November 2026 redesign

Prepared 11 November 2026 from repository commit 13ad797, on local branch codex/showroom-redesign. No push, production deployment, CMS write or test enquiry was performed.

## Review

Run npm run dev and open http://localhost:4173. The public site needs Node 20+ and no dependency installation. npm run build creates dist; npm start serves that build. responsive-review.html is an optional development-only viewport frame and is not included in the production build.

Representative screenshots are in review/: home-desktop.jpg (1440 × 1000 viewport), home-mobile.jpg (390 × 844), inventory-desktop.jpg, vehicle-mobile.jpg, select-desktop.jpg and deliveries-desktop.jpg.

## Creative direction

A confident Malaysian automotive showroom: expressive Saira Condensed headlines, readable Barlow interface text, clean white browsing surfaces, black editorial chapters and the established #C8102E brand red. A directional slash echoes the angle of the official IA logo. Authentic vehicle and delivery photos remain the visual content; no generated cars or invented testimonials were added.

The hero is one integrated photographic stage with a red headline panel, immediate stock and advisor actions, and a compact search directly below. The rest of the homepage alternates useful stock, a black sourcing chapter, budget planning, an asymmetric delivery-photo composition and a red showroom information panel.

## Audit and preserved contracts

- Public production is static HTML/CSS/JavaScript. The separate Next.js media utility is retained unchanged.
- _worker.js sanitizes the public inventory-sheet endpoint. data-service.js combines that public feed with Supabase-managed content. Neither layer, its API contracts, configuration, records nor privacy allowlist was modified.
- Existing clean routes and .html support, vehicle id/source query parameters, calculator price/car context, shared finance formula, advisor routing, event date gating, admin pages and schema remain in place.
- Homepage deliveries and active campaigns still come from managed data. The public feed showed 43 inventory choices during review; missing photos and prices are displayed honestly. Counts remain dynamic.
- Existing showroom address, hours and contact routing were retained from the project. No separate verified showroom exterior image was available; real managed delivery imagery supplies the showroom/human context.
- Existing enquiry tracking remains. Local preview explicitly disables real lead analytics. WhatsApp clicks and viewing handoffs are interactions, not confirmed leads, appointments or sales.

## UX and implementation

- Shared tokens, buttons, headers, cards, forms, secondary-page introductions and footers carry the same direction. Main journey headings and additional actions use Bahasa Malaysia.
- Inventory filter/search/sort state and load-more depth are encoded in the URL. Unrelated query parameters survive. Vehicle return links restore that URL and the previous inventory scroll position.
- A native mobile filter dialog moves the existing controls instead of duplicating data logic. Apply, Reset, Escape/cancel restoration and focus return are supported. Desktop retains its compact filter disclosure.
- Full vehicle price remains distinct from the monthly estimate and its deposit/term/rate assumptions. Missing-price units do not receive a fabricated estimate.
- Vehicle details retain real galleries and all available thumbnails, with pressed-state semantics, keyboard navigation, touch-swipe lightbox navigation and one mobile enquiry surface. Enquiry messages include the public vehicle link. Deposit values above the vehicle price are rejected.
- Three motion moments: coordinated 600–700 ms hero entrance, 280 ms result entrance and a 650 ms Select route-line reveal. Interface feedback uses 180 ms; native scrolling remains. Reduced-motion CSS disables animation, transitions and smooth scrolling. Editorial content is visible even without observers.
- Only two font families are requested, both with display=swap; no animation or framework dependencies were added. Hero is the existing 188 KB JPEG with explicit dimensions and priority loading. Cards have image dimensions and lazy loading. Failed remote images get a truthful text fallback.

## Reference research and translation

- [Team Mavin on Dribbble](https://dribbble.com/shots/27686397-Automotive-Car-Inventory-Website-UI-UX-Design): viewed the presentation and read its description. Adopted immediate discovery and informative cards; did not copy its price treatment or assets.
- [six2eight on Dribbble](https://dribbble.com/shots/27394358-Automotive-Car-Inventory-Website-UI-UX-Design): viewed the presentation video/frame and read the case description. Adopted consistent hero/search/card hierarchy across pages; this was not a live dealership interaction test.
- [Spyker / The Brink Agency](https://www.thebrinkagency.com/work/spyker-cars-an-exclusive-driving-experience-brought-to-life-online): read the case study, not the live configurator. Adapted the wide-shot/detail storytelling principle through photography and short transitions.
- [Forge Automotive on Awwwards](https://www.awwwards.com/sites/forge-automotive): inspected the award listing, followed its live site and tested the entry interaction. Its staged type and deliberate contrast informed the editorial rhythm. Izuwan has no entry gate, WebGL sequence or scroll hijacking.
- Font licences: [Saira Condensed](https://raw.githubusercontent.com/google/fonts/main/ofl/sairacondensed/OFL.txt) and [Barlow](https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt), SIL Open Font License 1.1.

## Verification

- 59 automated tests pass, including two new regression tests for URL restoration, retained pagination, invalid enums and preservation of unrelated query parameters. Existing inventory/privacy/admin/finance tests remain passing.
- Public JavaScript syntax, HTML IDs and local link/asset validation pass.
- Static build passes.
- Browser review at 360, 390, 768 and 1440 px, plus 360 × 560 for the filter sheet. Initially a fixed-width frame was used; final captures and later checks use actual browser viewport overrides.
- No horizontal overflow on the checked public pages at 360 px: homepage, inventory, vehicle detail, Find My Car, Select, calculator, OTR, about, contact, events, model guides, privacy, terms and 404.
- Main journey tested against real public stock: home → inventory → Honda / price-low filters → Civic detail → enlarged gallery → return to the filtered results. Gallery mouse next, keyboard arrows and close checked. Empty search and reset checked. Mobile filter apply and Escape cancel checked, including short viewport actions.
- Mobile menu open/Escape checked; fixed inherited bottom positioning that previously clipped the menu. Removed a generic pressed-button transform that displaced the gallery arrow during clicks.
- Calculator price/car query context checked: RM150,000 at 10% / 9 years / 3.2% gives RM1,610; changing the price to RM200,000 gives RM2,147. Excessive detail-page deposit produces Semak input. A past viewing date fails browser validity. Wizard required-brand validation checked without submission.
- WhatsApp destination and decoded vehicle context inspected, without following through to messaging. Existing advisor confirmation wording is retained for viewing requests.

## Limits

- Production deployment requested on 11 November 2026; release verification is recorded below. No live backend write verification. Existing tests cover admin and feed contracts; no live admin mutation was attempted.
- Reduced-motion behavior was inspected in CSS/JS, not emulated in the device settings. Touch swipe is implemented but was not exercised on physical hardware.
- No Lighthouse/Core Web Vitals or throttled-network measurements were taken. No performance score is claimed.
- Some inventory rows have no published photos, price or complete documentation. Upstream content anomalies remain unchanged. Remote photos/fonts and the live feed remain external dependencies.
- Browser logs showed no new local-page JavaScript errors in the inspected journey. The research tab had unrelated Google sign-in diagnostics from Dribbble; these were not local-site failures.

## Dunia Auto and release

- Added /news with search, source filter, 12-item pagination and an explicit empty state. Homepage shows only three headlines, favouring source diversity.
- Public /api/automotive-news combines allowlisted official Toyota Global, Stellantis and Mazda USA RSS feeds. Cached for 15 minutes at the edge, with bounded timeouts and partial-source recovery. No API key or scheduled job required.
- Headline, publication date and source link only; no copied article bodies or unlicensed news photography. Identified as manufacturer newsroom releases, not independent reporting. Initial fetch: 46 articles across three sources.
- A dated news-snapshot.json is the explicitly labelled fallback if the live endpoint fails. News arrives on page access after cache expiry; stored fallback is refreshed when rebuilding the release snapshot.
- Four additional tests cover attribution/decoding, unsafe URLs and invalid dates, partial failures/deduplication, and total outage without touching inventory. 63 tests pass, syntax/link checks and 66-file build pass.
- Browser checked search, source filter, empty state, reset and load more (12 to 24), plus 390 px overflow.
- Production release 40a51c1 pushed to main. Cloudflare Pages deployment 6fc65d99-8d12-42c8-92ce-a65d9b430a92 succeeded. Both apex and www serve the new design; /news and /api/automotive-news return 200 with 46 articles and all three sources. /api/inventory-sheet still returns 200. Live news search returns the expected Mazda3 result.
- The separate Workers Builds check failed; the domain-serving Cloudflare Pages deployment succeeded. No hosting migration was performed.
- Final accessibility correction: skip link uses the actual main element ID, including pages that already define their own ID.
