import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { ADMIN_CSP } from '../admin/shared/security';
import type { Library, Work } from '../admin/shared/model';

// Local browser fixture: production bundle and CSP, no Cloudflare calls or real identity.
const root = resolve('admin/dist');
const library:Library={schemaVersion:1,works:[]};
const mime: Record<string,string> = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff':'font/woff', '.woff2':'font/woff2' };
createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', ADMIN_CSP);
  response.setHeader('Cache-Control', 'no-store');
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  if (path === '/api/session') { response.setHeader('Content-Type','application/json');response.end(JSON.stringify({authenticated:true,username:'预览账号',actorId:'preview'}));return; }
  if (path === '/api/import-source') {response.setHeader('Content-Type','application/json');response.end(JSON.stringify({library:JSON.parse(await readFile(resolve(root,'migration/library.json'),'utf8')),source:'现有官网作品快照'}));return;}
  if(/^\/api\/works\/[a-zA-Z0-9-]+$/.test(path)&&request.method==='PUT'){
    const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));const input=JSON.parse(Buffer.concat(chunks).toString())as{work:Work};const index=library.works.findIndex(w=>w.id===input.work.id);if(index<0)library.works.push(input.work);else library.works[index]=input.work;
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify({saved:true,etag:'"preview"',library,public:{schemaVersion:2,publicationId:'empty',projects:[],releases:{}},publicEtag:'"empty"'}));return;
  }
  if (path === '/api/library') {
    for await (const chunk of request) void chunk;
    response.setHeader('Content-Type','application/json'); response.setHeader('ETag','W/"preview"');
    if (request.method === 'PUT' && request.headers['if-match'] !== '"preview"') { response.statusCode=409;response.end(JSON.stringify({error:'Storage revision mismatch'}));return; }
    response.end(JSON.stringify(request.method === 'PUT' ? { saved:true,etag:'"preview"' } : {
      etag:'"preview"',
      library, public:{schemaVersion:2,publicationId:'empty',projects:[],releases:{}}, publicEtag:'"empty"',
    })); return;
  }
  try {
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : decodeURIComponent(path)));
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.statusCode=404; response.end('Not found'); }
}).listen(4177,'127.0.0.1',()=>console.log('Local Admin production bundle/CSP preview: 127.0.0.1:4177'));
