import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["index.html", "styles.css", "app.js"]) await cp(path.join(root, file), path.join(output, file));
console.log(`Droply Cloudflare build ready: ${output}`);
