import { DEFAULT_SITE_CONTENT, siteContentErrors } from '../../src/content/site-content';
import type { SiteContent } from '../../src/content/site-content';
import { commitPublication } from './publication';
import { backup, publicState } from './storage';
import { ApiError, expectMatch, json, putJson, readJson, EMPTY_ETAG } from './http';
export const SITE_KEY = 'state/site.json';
export async function siteState(priv: R2Bucket) {
  const object=await priv.get(SITE_KEY);
  return { value:object?await object.json<{site:SiteContent;updatedAt:string}>():{site:structuredClone(DEFAULT_SITE_CONTENT),updatedAt:null},etag:object?.httpEtag??EMPTY_ETAG };
}
export async function siteRoute(request:Request,priv:R2Bucket,pub:R2Bucket,publish:boolean,record?:(before:SiteContent|undefined,after:SiteContent)=>void) {
  const state=await siteState(priv);
  if(!publish&&request.method==='GET'){const visible=await publicState(pub);return json({...state.value,published:visible.value.site??null,publicEtag:visible.etag},200,state.etag);}
  if(request.method!==(publish?'POST':'PUT'))throw new ApiError(405,'此接口不支持该方法。');
  expectMatch(request,state.etag);
  if(!publish){const input=await readJson(request,160_000) as {site?:unknown};const errors=siteContentErrors(input?.site);if(errors.length)throw new ApiError(422,errors.join('\n'));await backup(priv,state.value,'site');const value={site:input.site as SiteContent,updatedAt:new Date().toISOString()};const saved=await putJson(priv,SITE_KEY,value,state.etag);record?.(state.value.site,value.site);return json(value,200,saved.httpEtag);}
  if(!state.value.updatedAt)throw new ApiError(422,'请先保存网站内容草稿。');
  const visible=await publicState(pub);expectMatch(request,visible.etag,'x-public-etag');
  for(const [group,slugs]of Object.entries(state.value.site.featured))for(const slug of slugs){const project=visible.value.projects.find(p=>p.slug===slug);if(!project)throw new ApiError(422,`精选作品尚未公开：${slug}`);if(group==='maps'&&(project.type!=='bedrock'||project.status!=='released')||group==='released'&&project.status!=='released'||group==='development'&&project.status==='released')throw new ApiError(422,`精选分组与作品发行状态不符：${slug}`);}
  for(const update of state.value.site.updates)if(update.workSlug&&!visible.value.projects.some(p=>p.slug===update.workSlug))throw new ApiError(422,`近期更新引用的作品尚未公开：${update.workSlug}`);
  const after={...structuredClone(visible.value),publicationId:crypto.randomUUID(),site:state.value.site};
  if((await siteState(priv)).etag!==state.etag)throw new ApiError(409,'发布期间网站草稿已改变，请重新核对。');
  const saved=await commitPublication(priv,pub,visible.value,after,visible.etag);record?.(visible.value.site,state.value.site);return json({published:true,publicationId:after.publicationId},200,saved.httpEtag);
}
