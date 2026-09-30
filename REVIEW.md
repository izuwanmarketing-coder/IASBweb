# Izuwan Automobile redesign preview

Prepared from repository commit `f3ab687` on 30 September 2026. This is a local review build; it has not been pushed, merged, or deployed.

## What changed

- A quieter ivory, charcoal and red identity with a split photographic homepage hero, clear Malay-first messaging and a consistent navigation bar
- Redesigned collection, Japan sourcing, finance and showroom sections; real inventory photos and data retained
- Compact inner-page introductions, distinct card buttons, more useful vehicle facts and a smaller desktop contact affordance
- Vehicle details now present key facts, price and enquiry actions before the longer source description
- Search covers all active inventory; category filters compose correctly; shared loads and clear retry/empty states replace endless loading
- Default inventory ranking prioritizes available photographic stock; explicit price and mileage sorts remain available
- Card status aliases, photo counts, finance assumptions, pagination and custom-select reset behavior corrected
- Static site build is now the default. The unrelated Next.js utility remains available under the `media:*` scripts

## Run the preview

Node.js 20+ is required. There are no additional packages needed to build or serve the public website.

```sh
npm run lint
npm test
npm run build
npm start
```

Open `http://localhost:4173`. The preview reads the existing sanitized public stock endpoint and retains the existing managed data fallback. It does not publish the site. Local preview lead analytics are disabled. Do not submit test enquiries to real advisors.

## Validation

- 32 focused regression tests passed before visual review
- Public JavaScript syntax, local links/assets and duplicate HTML ID validation passed
- Static build passed
- Visual desktop/mobile browser QA is pending in the desktop review environment

## Source data requiring owner review

The live source includes a grade displayed as `54`, a model string `JIMNY MOMADE FC`, and at least one photo/colour mismatch. These are preserved rather than guessed. Missing photos, missing prices and missing evidence are stated honestly. Availability and prices should be confirmed with the team before a purchase.

## Production boundaries

No inventory records, Supabase configuration, Cloudflare worker privacy filtering, admin behavior or production hosting were changed. External enquiry and sign-in destinations remain real, so avoid sending test messages or submitting personal information during QA.
