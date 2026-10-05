import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('.');
const allowed=new Set(['/admin.html','/admin.css','/admin-overrides.css','/admin-workspace.css','/admin.js','/scripts/admin-demo.js','/assets/company-logo.png','/assets/company-logo-light.png','/favicon-16x16.png','/favicon-32x32.png']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const name=url.pathname==='/'?'/admin.html':url.pathname;
  if(!['GET','HEAD'].includes(req.method)||!allowed.has(name)){res.writeHead(403);res.end('Local admin preview: request blocked');return;}
  try {
    let body=await readFile(path.join(root,name));
    if(name==='/admin.html') body=Buffer.from(body.toString().replace(/<script src="(?:https:[^"]+|config\.js[^"]*|data-service\.js[^"]*|inventory\.js[^"]*)"><\/script>/g,'').replace('<script src="admin.js','<script src="scripts/admin-demo.js"></script><script src="admin.js'));
    res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'none'; img-src 'self' data:; script-src 'self'; style-src 'self'; font-src 'self'; form-action 'none'; object-src 'none'; base-uri 'none'"});
    res.end(req.method==='HEAD'?'':body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4174,'127.0.0.1',()=>console.log('Isolated admin demo: http://127.0.0.1:4174/admin.html — demo data, network and writes blocked'));
