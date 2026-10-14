import{readFile}from'node:fs/promises';
import type{Library}from'../admin/shared/model';
import{validateLibrary}from'../admin/shared/validation';
const base='http://127.0.0.1:8788/api/library';
const response=await fetch(base);if(!response.ok)throw new Error('Start the explicitly local admin:api first.');
const{library}=await response.json()as{library:Library};
const preview=JSON.parse(await readFile('.artifacts/admin-migration/library.json','utf8'))as Library;
const additions=preview.works.filter(w=>!library.works.some(old=>old.id===w.id||old.project.slug===w.project.slug));
const offset=library.works.length;library.works.push(...additions.map(w=>({...w,order:offset+w.order})));
const errors=validateLibrary(library);if(errors.length)throw new Error(errors.join('\n'));
if(additions.length){const saved=await fetch(base,{method:'PUT',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5174','X-Fimel-CSRF':'1','If-Match':response.headers.get('etag')!},body:JSON.stringify(library)});if(!saved.ok)throw new Error(`Local seed failed: HTTP ${saved.status}`);}
console.log(`Local-only seed: added ${additions.length} works; kept all existing local records. No remote calls or production writes.`);
