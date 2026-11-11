import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('Read-only preview'); return; }
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/automotive-news') {
      const workerSource = await readFile(new URL('../_worker.js', import.meta.url), 'utf8');
      const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'));
      const result = await worker.fetch(new Request('http://localhost:4173/api/automotive-news'), {});
      res.writeHead(result.status, { 'Content-Type': 'application/json' }); res.end(await result.text()); return;
    }
    if (url.pathname === '/api/inventory-sheet') {
      // Read the existing public, sanitized endpoint. Never query the private sheet.
      const data = await fetch('https://izuwanautomobile.com/api/inventory-sheet', { signal: AbortSignal.timeout(12000) });
      res.writeHead(data.status, { 'Content-Type': data.headers.get('content-type') || 'text/csv', 'X-Inventory-Pricelist-Date': data.headers.get('x-inventory-pricelist-date') || '', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? '' : Buffer.from(await data.arrayBuffer())); return;
    }
    let name = decodeURIComponent(url.pathname);
    if (name.endsWith('/')) name += 'index.html';
    if (!path.extname(name)) name += '.html';
    const filename = path.resolve(root, '.' + name);
    if (!filename.startsWith(root + path.sep) || name.split('/').some(s => s.startsWith('.')) || !['.html', '.css', '.js', '.png', '.jpg', '.svg', '.json', '.webmanifest'].includes(path.extname(filename))) { res.writeHead(403); res.end('Not a public asset'); return; }
    let body = await readFile(filename);
    if (filename.endsWith('.html')) body = Buffer.from(body.toString().replace('<head>', '<head><script>window.IASB_PREVIEW=true;</script>'));
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? '' : body);
  } catch (error) { res.writeHead(url.pathname.startsWith('/api/') ? 502 : 404, { 'Content-Type': 'text/plain' }); res.end(url.pathname.startsWith('/api/') ? 'Public inventory unavailable; the site can fall back to managed inventory.' : 'Page not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Read-only public-site preview: http://localhost:${port}`));
