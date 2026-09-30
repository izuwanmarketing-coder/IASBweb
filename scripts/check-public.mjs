import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const entries = await readdir('.');
let failures = 0;
for (const file of entries.filter(file => file.endsWith('.js'))) {
  if (file === '_worker.js') continue;
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status) { console.error(check.stderr); failures++; }
}
for (const file of entries.filter(file => file.endsWith('.html') && !file.startsWith('.') && file !== 'admin.html')) {
  const source = await readFile(file, 'utf8');
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) { console.error(`${file}: duplicate ID`); failures++; }
  for (const [, ref] of source.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
    if (/^(?:https?:|tel:|mailto:|data:|\/\/)/.test(ref)) continue;
    const local = ref === '/' ? 'index.html' : ref.replace(/^\//, '');
    const target = local.includes('.') ? local : `${local}.html`;
    if (!target) continue;
    try { await access(target); } catch { console.error(`${file}: missing local target ${ref}`); failures++; }
  }
}
if (failures) process.exitCode = 1;
else console.log('Public JavaScript syntax, HTML IDs and local links/assets passed.');
