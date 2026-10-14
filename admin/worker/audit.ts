import type { Library, Work } from '../shared/model';
import type { AuditChange, AuditEvent, AuditFeed } from '../shared/audit';
import { localizedText } from '../../src/content/projects';
import { validateLibrary } from '../shared/validation';
import { ApiError, putJson, readJson } from './http';
import { libraryState } from './storage';
import type { ServerSecrets } from './auth';

export async function actorKey(email:string):Promise<string> {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
function redactLinks(value:unknown):unknown {
  if(typeof value==='string'&&/^https:\/\//.test(value)){const url=new URL(value);return url.origin+url.pathname;}
  if(Array.isArray(value))return value.map(redactLinks);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,redactLinks(item)]));
  return value;
}
function summary(value:unknown):string {
  if(value===undefined)return '未设置';
  if(typeof value==='string'&&/^https:\/\//.test(value)){const url=new URL(value);return (url.origin+url.pathname).slice(0,180);}
  return (typeof value==='string'?value:JSON.stringify(redactLinks(value))).slice(0,180);
}
export function libraryChanges(before:Library,after:Library):AuditChange[] {
  const fields=(old:Work|undefined,current:Work|undefined)=>{
    const output:AuditChange['fields']=[];const record=(name:string,a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))output.push({name,before:summary(a),after:summary(b)});};
    const names:Record<string,string>={title:'作品名称',summary:'简短介绍',status:'发行状态',tags:'用途标签',platform:'游戏平台',creators:'作者',image:'封面地址',version:'版本号',size:'文件大小',published:'首次发布日期',updated:'更新日期',download:'下载地址',downloadUrl:'公开下载地址',store:'商店链接',repository:'仓库链接',issues:'反馈链接'};
    for(const key of new Set([...Object.keys(old?.project??{}),...Object.keys(current?.project??{})]))record(names[key]??key,old?.project[key as keyof Work['project']],current?.project[key as keyof Work['project']]);
    record('编辑状态',old?.workflow,current?.workflow);record('列表顺序',old?.order,current?.order);record('选中的封面',old?.coverId,current?.coverId);
    for(const tab of ['description','changelog','versions']as const)for(const locale of ['zh','en','ja']as const){const a=old?.markdown[tab][locale],b=current?.markdown[tab][locale];if(a!==b)record(`${{description:'正文介绍',changelog:'更新日志',versions:'版本正文'}[tab]} · ${locale}`,a===undefined?undefined:`${a.length} 字符`,b===undefined?undefined:`${b.length} 字符`);}
    record('截图集',old?.gallery.map(a=>a.displayName??a.name),current?.gallery.map(a=>a.displayName??a.name));
    const releases=(work:Work|undefined)=>work?.versions.map(v=>({version:v.label,status:v.status,date:v.date,gameVersions:v.gameVersions,files:v.files.map(a=>({name:a.displayName??a.name,size:a.size,primary:!!a.primary})),changelogLength:JSON.stringify(v.changelog).length}));
    record('发行版本与文件',releases(old),releases(current));return output.slice(0,100);
  };
  const output:AuditChange[]=[];
  for(const id of new Set([...before.works.map(w=>w.id),...after.works.map(w=>w.id)])){
    const old=before.works.find(w=>w.id===id),current=after.works.find(w=>w.id===id);if(JSON.stringify(old)===JSON.stringify(current))continue;const work=current??old!;
    const changed=fields(old,current);if(old&&current&&!changed.length)continue;
    output.push({workId:id,slug:work.project.slug,title:localizedText(work.project.title,'zh'),action:!old?'created':!current?'removed':'updated',fields:changed});
  }
  return output;
}
function operation(request:Request):string|undefined {
  const p=new URL(request.url).pathname.split('/').filter(Boolean).slice(1);
  if(p[0]==='library'&&p.length===1&&request.method==='PUT')return 'save-library';
  if(['publish','unpublish','restore'].includes(p[0])&&request.method==='POST')return p[0]==='restore'?`restore-${p[1]}`:p[0];
  if(p[0]==='uploads'&&!(p[2]==='parts')){if(p[1]==='cleanup'&&request.method==='POST')return 'cleanup-temporary';if(p.length===1&&request.method==='POST')return 'start-upload';if(p[2]==='complete'&&request.method==='POST')return 'complete-upload';if(p.length===2&&request.method==='DELETE')return 'cancel-upload';}
}
export async function runAudited(request:Request,bucket:R2Bucket,email:string,run:()=>Promise<Response>):Promise<Response> {
  const op=operation(request);if(!op)return run();
  const source=await libraryState(bucket);const p=new URL(request.url).pathname.split('/').filter(Boolean).slice(1);
  const changes:AuditChange[]=[];if(op==='save-library'){const candidate=await readJson(request.clone());if(validateLibrary(candidate).length===0)changes.push(...libraryChanges(source.value,candidate as Library));}
  if(op==='restore-library'&&/^[a-zA-Z0-9-]{1,80}$/.test(p[2]??'')){const stored=await bucket.get(`backups/library/${p[2]}.json`);if(stored){const snapshot=await stored.json<{value:Library}>();if(validateLibrary(snapshot.value).length===0)changes.push(...libraryChanges(source.value,snapshot.value));}}
  let workId=['publish','unpublish'].includes(op)?p[1]:undefined;const uploadId=p[0]==='uploads'&&p[1]!=='cleanup'?p[1]:undefined;
  if(op==='start-upload'){const input=await readJson(request.clone(),4096) as {workId?:string};if(source.value.works.some(w=>w.id===input.workId))workId=input.workId;}
  if(uploadId&&/^[a-zA-Z0-9-]{1,80}$/.test(uploadId)){const stored=await bucket.get(`uploads/sessions/${uploadId}.json`);if(stored)workId=(await stored.json<{workId:string}>()).workId;}
  const time=new Date().toISOString(),id=crypto.randomUUID();const key=`audit/${time.slice(0,10)}/${time.replaceAll(':','-')}-${id}.json`;
  const event:AuditEvent={schemaVersion:2,id,actorId:await actorKey(email),operation:op,time,status:'prepared',changes,...(workId?{workId}:{}),...(uploadId?{uploadId}:{}),beforeEtag:source.etag};
  const stored=await putJson(bucket,key,event);
  const finish=async(status:AuditEvent['status'],httpStatus:number,afterEtag?:string)=>{
    try{await putJson(bucket,key,{...event,status,httpStatus,finishedAt:new Date().toISOString(),...(afterEtag?{afterEtag}:{})},stored.httpEtag);return true;}
    catch{console.error(JSON.stringify({operation:'audit-finalize-failed',requestId:id}));return false;}
  };
  try{const response=await run();const confirmed=await finish(response.ok?'success':'failed',response.status,response.headers.get('etag')??undefined);if(!confirmed)response.headers.set('X-Fimel-Audit-Pending','1');return response;}
  catch(error){await finish('failed',error instanceof ApiError?error.status:503);throw error;}
}
export async function auditFeed(request:Request,bucket:R2Bucket,env:ServerSecrets,email:string):Promise<AuditFeed> {
  const days=Number(new URL(request.url).searchParams.get('days')??7);if(![1,7,30].includes(days))throw new ApiError(422,'日志范围仅支持 1、7 或 30 天。');
  const keys:R2Object[]=[];let truncated=false;
  for(let day=0;day<days;day++){const date=new Date(Date.now()-day*86400000).toISOString().slice(0,10);let cursor:string|undefined;do{const page=await bucket.list({prefix:`audit/${date}/`,limit:1000,cursor});keys.push(...page.objects);cursor=page.truncated?page.cursor:undefined;if(keys.length>=5000){truncated=true;break;}}while(cursor);if(truncated)break;}
  keys.sort((a,b)=>b.uploaded.getTime()-a.uploaded.getTime());if(keys.length>200)truncated=true;
  const events:AuditFeed['events']=[];for(const object of keys.slice(0,200)){const value=await bucket.get(object.key);if(value)events.push(await value.json());}
  const actors:Record<string,string>={};for(const address of env.ADMIN_EMAILS?.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)??[]){const[user,domain]=address.split('@');actors[await actorKey(address)]=`${user.slice(0,3)}…@${domain}`;}
  return{events,actors,currentActorId:await actorKey(email),truncated};
}
