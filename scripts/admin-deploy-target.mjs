import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
// Local packaging only. Domains/Access are managed separately from version uploads.
const sourcePath=resolve('admin/wrangler.jsonc');
const parsed=ts.parseConfigFileTextToJson(sourcePath,await readFile(sourcePath,'utf8'));
if(parsed.error)throw Error('Admin Wrangler configuration is invalid');
const source=parsed.config;
if(source.name!=='fimel-admin'||source.workers_dev!==false||source.preview_urls!==false||source.vars?.ADMIN_ORIGIN!=='https://admin.studiofimel.com')throw Error('Production Admin target mismatch');
const target={...source,account_id:'13d3ede85821bfcfb2ed2f452d64c8da',main:resolve('admin',source.main),assets:{...source.assets,directory:resolve('admin',source.assets.directory)},routes:[]};
delete target.$schema;
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/admin-deploy.json',JSON.stringify(target,null,2));
console.log('Prepared fimel-admin version-upload target locally; no Cloudflare changes.');
