import type { Library, PublicManifest, Upload } from '../shared/model';
import { ADMIN_CSP } from '../shared/security';
import { validateLibrary } from '../shared/validation';
import { authenticate, protectWrite } from './auth';
import type { AccessContext, ServerSecrets } from './auth';
import { ApiError, expectMatch, json, putJson, readJson } from './http';
import { backup, libraryState, LIBRARY_KEY, listAll, publicState } from './storage';
import { commitPublication, publishedWork } from './publication';
import { uploadRoute } from './uploads';
import { runAudited, auditFeed, actorKey } from './audit';
import type { AuditedSource } from './audit';
import { metrics } from './analytics';
import type { AnalyticsSecrets } from './analytics';
import { saveWork } from './work-save';
import { publishedPreview } from './published-preview';
import { siteRoute, SITE_KEY } from './site-content';
import { siteContentErrors } from '../../src/content/site-content';
import type { SiteContent } from '../../src/content/site-content';
import { workEventKey } from '../../src/content/work-events';
import type { WorkEventDay } from '../../src/content/work-events';
import { publicationFingerprint } from '../shared/revisions';
export type AdminEnv = Env & ServerSecrets & AnalyticsSecrets;
export async function handle(request: Request, env: AdminEnv, ctx: AccessContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  let response: Response;
  try {
    const email = await authenticate(request, env, ctx);
    const url = new URL(request.url);
    protectWrite(request, env.ADMIN_ORIGIN);
    if (!url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method)) throw new ApiError(405, '不支持此方法。');
      response = await env.ASSETS.fetch(request);
    } else response = await runAudited(request, env.PRIVATE, email, source => route(request, env, email, source));
  } catch (error) {
    if (!(error instanceof ApiError)) console.error(JSON.stringify({ operation: 'request-failed', requestId }));
    response = json({ error: error instanceof ApiError ? error.message : '存储服务暂时不可用，操作未确认成功。', requestId }, error instanceof ApiError ? error.status : 503);
  }
  const secured = new Response(response.body, response);
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('Referrer-Policy', 'same-origin');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Cache-Control', 'no-store');
  secured.headers.set('Content-Security-Policy', ADMIN_CSP);
  return secured;
}
async function route(request: Request, env: AdminEnv, email: string, source?:AuditedSource): Promise<Response> {
  const path = new URL(request.url).pathname.split('/').filter(Boolean).slice(1);
  const method = request.method;
  if(path[0]==='site'&&(path.length===1||path.length===2&&path[1]==='publish'))return siteRoute(request,env.PRIVATE,env.PUBLIC,path.length===2,source?.recordSiteChange);
  if (path[0] === 'published' && path.length === 2 && method === 'GET' && /^[a-zA-Z0-9-]{1,80}$/.test(path[1])) return publishedPreview(path[1],env.PRIVATE,env.PUBLIC);
  if (path[0] === 'works' && path.length === 2 && method === 'PUT' && /^[a-zA-Z0-9-]{1,80}$/.test(path[1])) return saveWork(request, env.PRIVATE, env.PUBLIC, path[1],source?.recordWorkChange);
  if (path[0] === 'import-source' && path.length === 1 && method === 'GET') {
    const response = await env.ASSETS.fetch(new Request(new URL('/migration/library.json',request.url)));
    if (!response.ok) throw new ApiError(503,'现有作品导入文件尚未构建，请联系维护者。');
    const library = await readJson({headers:response.headers,body:response.body});
    if (validateLibrary(library).length) throw new ApiError(503,'现有作品导入文件校验失败，未修改作品库。');
    return json({library,source:'现有官网作品快照'});
  }
  if (path[0] === 'audit' && path.length === 1 && method === 'GET') return json(await auditFeed(request,env.PRIVATE,env,email));
  if (path[0] === 'analytics' && path.length === 1 && method === 'GET') {
    const feed=await metrics(request,env);const days:string[]=[];for(let d=new Date(feed.from);d.getTime()<Date.parse(feed.to);d.setUTCDate(d.getUTCDate()+1))days.push(d.toISOString().slice(0,10));
    const records=await Promise.all(days.map(async date=>{const stored=await env.PUBLIC.get(workEventKey(date));return stored?stored.json<WorkEventDay>():null;}));
    const workEvents=records.flatMap(day=>day?Object.entries(day.works).map(([slug,c])=>({date:day.date,slug,...c})):[]);
    return json({...feed,workEvents,workEventsAvailable:records.some(Boolean)});
  }
  if (path[0] === 'session' && path.length === 1 && method === 'GET') return json({ authenticated: true, username: email.split('@')[0], actorId: await actorKey(email) });
  if (path[0] === 'uploads') return uploadRoute(request, env.PRIVATE, path.slice(1));
  if (path[0] === 'files' && path.length === 2 && ['GET','HEAD'].includes(method)) {
    if(!/^[a-zA-Z0-9-]{1,80}$/.test(path[1]))throw new ApiError(404,'文件不存在。');
    const stored=await env.PRIVATE.get(`uploads/sessions/${path[1]}.json`);
    const upload=stored?await stored.json<Upload>():null;const asset=upload?.asset;
    if(upload?.status!=='complete'||upload.kind!=='file'||!asset?.privateKey||asset.privateKey!==`uploads/verified/${upload.id}/${upload.name}`)throw new ApiError(404,'文件尚未验证或不存在。');
    const object=await env.PRIVATE.head(asset.privateKey);
    if(!object||object.size!==asset.size||object.customMetadata?.assetId!==asset.id||object.customMetadata?.workId!==upload.workId||object.customMetadata?.sha256!==asset.sha256)throw new ApiError(404,'文件验证信息不一致。');
    const headers=new Headers({'Content-Type':upload.mime,'Accept-Ranges':'bytes','Content-Length':String(object.size),'Cache-Control':'no-store','Content-Disposition':`attachment; filename="${upload.name}"; filename*=UTF-8''${encodeURIComponent(upload.displayName??upload.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`});
    const range=request.headers.get('range');let start=0,end=object.size-1;
    if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{'Content-Range':`bytes */${object.size}`}});
      if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),object.size-1):end;}else{const suffix=Number(match[2]);start=Math.max(0,object.size-suffix);}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=object.size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${object.size}`}});
      headers.set('Content-Range',`bytes ${start}-${end}/${object.size}`);headers.set('Content-Length',String(end-start+1));
    }
    if(method==='HEAD')return new Response(null,{status:range?206:200,headers});
    const body=await env.PRIVATE.get(asset.privateKey,{...(range?{range:{offset:start,length:end-start+1}}:{}),onlyIf:{etagMatches:object.etag}});
    if(!body||!('body'in body))throw new ApiError(409,'文件版本已改变，请重新下载。');
    return new Response(body.body,{status:range?206:200,headers});
  }
  if (path[0] === 'media' && path.length === 2 && method === 'GET') {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(path[1])) throw new ApiError(404, '图片不存在。');
    const session = await env.PRIVATE.get(`uploads/sessions/${path[1]}.json`);
    const upload = session ? await session.json<Upload>() : null;
    if (!upload?.asset?.privateKey || upload.kind !== 'image') throw new ApiError(404, '图片不存在。');
    const object = await env.PRIVATE.get(upload.asset.privateKey); if (!object) throw new ApiError(404, '图片不存在。');
    return new Response(object.body, { headers: { 'Content-Type': upload.mime, 'Cache-Control': 'no-store' } });
  }
  if (path[0] === 'library' && path.length === 1) {
    const state = source?.library ?? await libraryState(env.PRIVATE);
    if (method === 'GET') { const published = await publicState(env.PUBLIC); return json({ library: state.value, public: published.value, publicEtag: published.etag }, 200, state.etag); }
    if (method === 'PUT') {
      expectMatch(request, state.etag);
      const input = source?.candidate ? source.candidate.value : await readJson(request);
      const errors = source?.candidate?.errors ?? validateLibrary(input); if (errors.length) throw new ApiError(422, errors.join('\n'));
      const value = input as Library;
      const visible=await publicState(env.PUBLIC);
      if(value.works.some(w=>w.workflow==='archived'&&visible.value.projects.some(p=>p.slug===w.project.slug)))throw new ApiError(422,'已公开作品请先下架，再保存归档状态。');
      for (const old of state.value.works) {
        const current = value.works.find(w => w.id === old.id);
        if (!current) throw new ApiError(422, '不支持永久删除作品，请归档。');
        if (old.project.slug !== current.project.slug || old.project.type !== current.project.type) throw new ApiError(422, '已有作品 slug 和分类保持稳定，避免历史地址失效。');
      }
      await backup(env.PRIVATE, state.value, 'library');
      const result = await putJson(env.PRIVATE, LIBRARY_KEY, value, state.etag);
      return json({ saved: true }, 200, result.httpEtag);
    }
    throw new ApiError(405, '此接口仅支持 GET / PUT。');
  }
  if (['publish', 'unpublish', 'preview'].includes(path[0]) && path.length === 2) {
    if (method !== (path[0] === 'preview' ? 'GET' : 'POST')) throw new ApiError(405, '方法不支持。');
    const state = await libraryState(env.PRIVATE); const published = await publicState(env.PUBLIC);
    const work = state.value.works.find(w => w.id === path[1]); if (!work) throw new ApiError(404, '作品不存在。');
    if (path[0] === 'preview') return json({ before: published.value.projects.find(p => p.slug === work.project.slug) ?? null, after: work.project, versions: work.versions.filter(v => v.status === 'released'), warnings: work.workflow === 'archived' ? ['作品已归档'] : [] });
    expectMatch(request, state.etag); expectMatch(request, published.etag, 'x-public-etag');
    const publicationId = crypto.randomUUID();
    const after: PublicManifest = structuredClone(published.value); after.publicationId = publicationId;
    const slug = work.project.slug; after.projects = after.projects.filter(p => p.slug !== slug);
    if (path[0] === 'publish') {
      const errors = validateLibrary(state.value); if (errors.length) throw new ApiError(422, errors.join('\n'));
      for (const object of await listAll(env.PRIVATE,'uploads/active/')) {
        const active=await env.PRIVATE.get(object.key);
        const upload=active?await active.json<Upload>():null;
        if(upload?.workId===work.id&&Date.parse(upload.expiresAt)>Date.now())throw new ApiError(409,'此作品仍有未完成上传，请完成或取消会话后再发布。');
      }
      const prepared = await publishedWork(work, env.PRIVATE, env.PUBLIC, publicationId);
      after.projects.push(prepared.project); after.releases[slug] = prepared.releases;
      after.publicationStates ??= {};
      after.publicationStates[slug] = { fingerprint: await publicationFingerprint(work), publishedAt: new Date().toISOString(), savedAt: work.updatedAt };
      after.projects.sort((a,b) => (state.value.works.find(w => w.project.slug === a.slug)?.order ?? 0) - (state.value.works.find(w => w.project.slug === b.slug)?.order ?? 0));
    } else { delete after.releases[slug]; if (after.publicationStates) delete after.publicationStates[slug]; }
    const latestSource=await env.PRIVATE.head(LIBRARY_KEY);
    if(latestSource?.httpEtag!==state.etag)throw new ApiError(409,'发布期间草稿已被修改，请重新加载后重试。');
    const result = await commitPublication(env.PRIVATE, env.PUBLIC, published.value, after, published.etag);
    return json({ published: path[0] === 'publish', publicationId }, 200, result.httpEtag);
  }
  if (path[0] === 'history' && method === 'GET') {
    const objects = await listAll(env.PRIVATE, 'backups/');
    return json({ snapshots: objects.sort((a,b) => b.uploaded.getTime() - a.uploaded.getTime()).slice(0,100).map(o => ({ key: o.key, time: o.uploaded.toISOString() })) });
  }
  if (path[0] === 'restore' && path.length === 3 && method === 'POST') {
    if (!['library', 'public','site'].includes(path[1]) || !/^[a-zA-Z0-9-]{1,80}$/.test(path[2])) throw new ApiError(422, '恢复编号不合法。');
    const object = await env.PRIVATE.get(`backups/${path[1]}/${path[2]}.json`); if (!object) throw new ApiError(404, '备份不存在。');
    const snapshot = await object.json<{ value: Library | PublicManifest }>();
    if(path[1]==='site'){
      const source=snapshot.value as unknown as {site:SiteContent;updatedAt:string|null};const errors=siteContentErrors(source.site);if(errors.length)throw new ApiError(422,errors.join('\n'));
      const current=await env.PRIVATE.get(SITE_KEY);expectMatch(request,current?.httpEtag??'"empty"');if(current)await backup(env.PRIVATE,await current.json(),'site');
      const saved=await putJson(env.PRIVATE,SITE_KEY,{site:source.site,updatedAt:new Date().toISOString()},current?.httpEtag??'"empty"');return json({restored:true},200,saved.httpEtag);
    }
    if (path[1] === 'library') {
      const state = await libraryState(env.PRIVATE); expectMatch(request, state.etag);
      const errors = validateLibrary(snapshot.value); if (errors.length) throw new ApiError(422, errors.join('\n'));
      await backup(env.PRIVATE, state.value, 'library');
      const result = await putJson(env.PRIVATE, LIBRARY_KEY, snapshot.value, state.etag); return json({ restored: true }, 200, result.httpEtag);
    }
    const published = await publicState(env.PUBLIC); expectMatch(request, published.etag, 'x-public-etag');
    const value = snapshot.value as PublicManifest; value.publicationId = crypto.randomUUID();
    for (const project of value.projects) {
      if (project.downloadUrl && !await env.PUBLIC.head(new URL(project.downloadUrl).pathname.slice(1))) throw new ApiError(422, '恢复引用的下载文件缺失。');
      for (const path of Object.values(project.content)) for (const url of typeof path === 'string' ? [path] : Object.values(path ?? {})) {
        if (url.startsWith('https://download.studiofimel.com/') && !await env.PUBLIC.head(new URL(url).pathname.slice(1))) throw new ApiError(422, '恢复引用的正文缺失。');
      }
    }
    const result = await commitPublication(env.PRIVATE, env.PUBLIC, published.value, value, published.etag);
    return json({ restored: true }, 200, result.httpEtag);
  }
  throw new ApiError(404, '接口不存在。');
}
export default { fetch: handle };
