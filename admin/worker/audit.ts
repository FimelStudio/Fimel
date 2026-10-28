import type { Library, Work } from '../shared/model';
import type { AuditChange, AuditEvent, AuditFeed } from '../shared/audit';
import { localizedText } from '../../src/content/projects';
import { validateLibrary } from '../shared/validation';
import { ApiError, putJson, readJson } from './http';
import { libraryState } from './storage';
import type { ServerSecrets } from './auth';
import type { SiteContent } from '../../src/content/site-content';
import { stable } from '../shared/revisions';
import type { RecordDownloadCorrection } from './download-corrections';

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
    const names:Record<string,string>={title:'作品名称',summary:'简短介绍',status:'发行状态',tags:'用途标签',platform:'游戏平台',creators:'作者',image:'封面地址',featuredImage:'精选封图地址',version:'版本号',size:'文件大小',published:'首次发布日期',updated:'更新日期',download:'下载地址',downloadUrl:'公开下载地址',store:'商店链接',repository:'仓库链接',issues:'反馈链接'};
    for(const key of new Set([...Object.keys(old?.project??{}),...Object.keys(current?.project??{})]))record(names[key]??key,old?.project[key as keyof Work['project']],current?.project[key as keyof Work['project']]);
    record('编辑状态',old?.workflow,current?.workflow);record('列表顺序',old?.order,current?.order);record('选中的封面',old?.coverId,current?.coverId);record('选中的精选封图',old?.featuredCoverId,current?.featuredCoverId);
    const textChange=(name:string,a:string|undefined,b:string|undefined)=>{if(a!==b)output.push({name,before:a===undefined?'未设置':`${a.length} 字符`,after:b===undefined?'未设置':`${b.length} 字符${a!==undefined&&a.length===b.length?'（内容已更改）':''}`});};
    for(const tab of ['description','changelog','versions']as const)for(const locale of ['zh','en','ja']as const)textChange(`${{description:'正文介绍',changelog:'更新日志',versions:'版本正文'}[tab]} · ${locale}`,old?.markdown[tab][locale],current?.markdown[tab][locale]);
    const previousVersions=new Map(old?.versions.map(v=>[v.id,v])??[]),nextVersions=new Map(current?.versions.map(v=>[v.id,v])??[]);
    for(const id of new Set([...previousVersions.keys(),...nextVersions.keys()]))for(const locale of ['zh','en','ja']as const){const a=previousVersions.get(id),b=nextVersions.get(id);const localized=(value:Work['versions'][number]|undefined)=>typeof value?.changelog==='string'?(locale==='zh'?value.changelog:undefined):value?.changelog?.[locale];textChange(`发行日志 · ${(b??a)!.label} · ${locale}`,localized(a),localized(b));}
    record('截图集',old?.gallery.map(a=>a.displayName??a.name),current?.gallery.map(a=>a.displayName??a.name));
    const releases=(work:Work|undefined)=>work?.versions.map(v=>({version:v.label,status:v.status,date:v.date,gameVersions:v.gameVersions,files:v.files.map(a=>({name:a.displayName??a.name,size:a.size,primary:!!a.primary})),changelogLength:JSON.stringify(v.changelog).length}));
    record('发行版本与文件',releases(old),releases(current));return output.slice(0,100);
  };
  const output:AuditChange[]=[];const previous=new Map(before.works.map(w=>[w.id,w])),next=new Map(after.works.map(w=>[w.id,w]));
  for(const id of new Set([...previous.keys(),...next.keys()])){
    const old=previous.get(id),current=next.get(id);const work=current??old!;
    const changed=fields(old,current);if(old&&current&&!changed.length)continue;
    output.push({workId:id,slug:work.project.slug,title:localizedText(work.project.title,'zh'),action:!old?'created':!current?'removed':'updated',fields:changed});
  }
  return output;
}
function operation(request:Request):string|undefined {
  const p=new URL(request.url).pathname.split('/').filter(Boolean).slice(1);
  if(p[0]==='library'&&p.length===1&&request.method==='PUT')return 'save-library';
  if(p[0]==='works'&&p.length===2&&request.method==='PUT')return 'save-work';
  if(p[0]==='download-corrections'&&p.length===2&&request.method==='PUT')return 'calibrate-downloads';
  if(p[0]==='site'&&request.method==='PUT')return 'save-site';
  if(p[0]==='site'&&p[1]==='publish'&&request.method==='POST')return 'publish-site';
  if(['publish','unpublish','restore'].includes(p[0])&&request.method==='POST')return p[0]==='restore'?`restore-${p[1]}`:p[0];
  if(p[0]==='uploads'&&!(p[2]==='parts')){if(p[1]==='cleanup'&&request.method==='POST')return 'cleanup-temporary';if(p.length===1&&request.method==='POST')return 'start-upload';if(p[2]==='complete'&&request.method==='POST')return 'complete-upload';if(p.length===2&&request.method==='DELETE')return 'cancel-upload';}
}
export type AuditedSource={library:Awaited<ReturnType<typeof libraryState>>;candidate?:{value:unknown;errors:string[]};recordWorkChange?:(before:Work|null,after:Work)=>void;recordSiteChange?:(before:SiteContent|undefined,after:SiteContent)=>void;recordDownloadCorrection?:RecordDownloadCorrection;downloadCorrectionInput?:{value:unknown}|{error:unknown}};
export async function runAudited(request:Request,bucket:R2Bucket,email:string,run:(source?:AuditedSource)=>Promise<Response>):Promise<Response> {
  const op=operation(request);if(!op)return run();
  const source=await libraryState(bucket);const p=new URL(request.url).pathname.split('/').filter(Boolean).slice(1);
  const prepared:AuditedSource={library:source};const changes:AuditChange[]=[];if(op==='save-library'){const value=await readJson(request);const errors=validateLibrary(value,true);prepared.candidate={value,errors};if(errors.length===0)changes.push(...libraryChanges(source.value,value as Library));}
  if(op==='save-work')prepared.recordWorkChange=(before,after)=>{changes.splice(0,changes.length,...libraryChanges({schemaVersion:1,works:before?[before]:[]},{schemaVersion:1,works:[after]}));};
  if(op==='calibrate-downloads')prepared.recordDownloadCorrection=(work,before,after,reason)=>{
    const fields:AuditChange['fields']=[
      {name:'校正基数',before:summary(before?.value),after:summary(after.value)},
      {name:'校正日期（UTC）',before:summary(before?.date),after:summary(after.date)},
      {name:'当日原始点击锚点',before:summary(before?.anchorClicks),after:summary(after.anchorClicks)},
      ...(reason?[{name:'校正原因',before:'未设置',after:reason}]:[]),
    ];
    changes.splice(0,changes.length,{workId:work.id,slug:work.project.slug,title:localizedText(work.project.title,'zh'),action:'updated',fields});
  };
  if(['save-site','publish-site','restore-site'].includes(op))prepared.recordSiteChange=(before,after)=>{
    const names={featured:'首页精选与顺序',home:'首页快速推荐文案',studio:'工作室与联系文案',contact:'公开联系方式',updates:'近期更新'};
    const fields=(Object.keys(names)as(keyof typeof names)[]).filter(k=>stable(before?.[k])!==stable(after[k])).map(k=>({name:names[k],before:before?summary(before[k]):'未发布',after:summary(after[k])}));
    changes.splice(0,changes.length,...(fields.length?[{workId:'site-content',slug:'site-content',title:'网站内容',action:'updated' as const,fields}]:[]));
  };
  if(op==='restore-library'&&/^[a-zA-Z0-9-]{1,80}$/.test(p[2]??'')){const stored=await bucket.get(`backups/library/${p[2]}.json`);if(stored){const snapshot=await stored.json<{value:Library}>();if(validateLibrary(snapshot.value).length===0)changes.push(...libraryChanges(source.value,snapshot.value));}}
  let workId=['publish','unpublish','save-work','calibrate-downloads'].includes(op)?p[1]:undefined;const uploadId=p[0]==='uploads'&&p[1]!=='cleanup'?p[1]:undefined;
  if(op==='start-upload'){const input=await readJson(request.clone(),4096) as {workId?:string};if(source.value.works.some(w=>w.id===input.workId))workId=input.workId;}
  if(uploadId&&/^[a-zA-Z0-9-]{1,80}$/.test(uploadId)){const stored=await bucket.get(`uploads/sessions/${uploadId}.json`);if(stored)workId=(await stored.json<{workId:string}>()).workId;}
  let downloadCorrectionRequest:{value:number;operationId:string;reason?:string}|undefined;
  if(op==='calibrate-downloads'){
    // Keep the requested target in the prepared record too: a finalization
    // outage must not hide what this successful conditional write requested.
    // Invalid requests are still rejected/logged by the route, not here.
    try{const value=await readJson(request,4096);prepared.downloadCorrectionInput={value};const input=value as {value?:unknown;operationId?:unknown;reason?:unknown};
      if(input&&typeof input.value==='number'&&Number.isSafeInteger(input.value)&&input.value>=0&&typeof input.operationId==='string'&&input.operationId.length<=80){
        downloadCorrectionRequest={value:input.value,operationId:input.operationId,...(typeof input.reason==='string'&&input.reason.length<=200&&input.reason.trim()?{reason:input.reason.trim()}:{})};
      }
    }catch(error){prepared.downloadCorrectionInput={error};/* The route records the original malformed/oversized request failure. */}
  }
  const time=new Date().toISOString(),id=crypto.randomUUID();const key=`audit/${time.slice(0,10)}/${time.replaceAll(':','-')}-${id}.json`;
  const event:AuditEvent&{downloadCorrectionRequest?:typeof downloadCorrectionRequest}={schemaVersion:2,id,actorId:await actorKey(email),operation:op,time,status:'prepared',changes,...(workId?{workId}:{}),...(uploadId?{uploadId}:{}),...(downloadCorrectionRequest?{downloadCorrectionRequest}:{}),beforeEtag:source.etag};
  const stored=await putJson(bucket,key,event);
  const finish=async(status:AuditEvent['status'],httpStatus:number,afterEtag?:string)=>{
    try{await putJson(bucket,key,{...event,status,httpStatus,finishedAt:new Date().toISOString(),...(afterEtag?{afterEtag}:{})},stored.httpEtag);return true;}
    catch{console.error(JSON.stringify({operation:'audit-finalize-failed',requestId:id}));return false;}
  };
  try{const response=await run(prepared);const confirmed=await finish(response.ok?'success':'failed',response.status,response.headers.get('etag')??undefined);if(!confirmed)response.headers.set('X-Fimel-Audit-Pending','1');return response;}
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
