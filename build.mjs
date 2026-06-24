import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const dist = new URL("./dist/", import.meta.url);
const files = [
  "_headers",
  "_redirects",
  "404.html",
  "about.html",
  "admin-overrides.css",
  "admin.css",
  "admin.html",
  "admin.js",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "apple-touch-icon.png",
  "calculator-page.js",
  "calculator.html",
  "car-page.js",
  "car.html",
  "car-photos.js",
  "config.js",
  "contact-page.js",
  "contact.html",
  "data-service.js",
  "delivered-page.js",
  "events-page.js",
  "events.html",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "find-car-page.js",
  "find-car.html",
  "home-page.js",
  "index.html",
  "inventory-page.js",
  "inventory.html",
  "inventory.js",
  "lead-tracker.js",
  "model-guides.html",
  "otr-page.js",
  "otr.html",
  "photo-curation.js",
  "privacy.html",
  "robots.txt",
  "select-programme.html",
  "site.js",
  "site.webmanifest",
  "sitemap.xml",
  "styles.css",
  "terms.html"
];

if (existsSync(dist)) {
  await rm(dist, { recursive: true, force: true });
}

await mkdir(dist, { recursive: true });

for (const file of files) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url), { recursive: true });
}

console.log(`Built ${files.length} files into dist/`);
