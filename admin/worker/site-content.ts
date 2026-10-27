import { DEFAULT_SITE_CONTENT, siteContentErrors } from '../../src/content/site-content';
import type { SiteContent } from '../../src/content/site-content';
import { sitePublicationIssues } from '../shared/featured';
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
  if(!publish&&request.method==='GET'){const visible=await publicState(pub);return json({...state.value,published:visible.value.site??null,publicProjects:visible.value.projects,publicEtag:visible.etag},200,state.etag);}
  if(request.method!==(publish?'POST':'PUT'))throw new ApiError(405,'此接口不支持该方法。');
  expectMatch(request,state.etag);
  if(!publish){const input=await readJson(request,160_000) as {site?:unknown};const errors=siteContentErrors(input?.site);if(errors.length)throw new ApiError(422,errors.join('\n'));await backup(priv,state.value,'site');const value={site:input.site as SiteContent,updatedAt:new Date().toISOString()};const saved=await putJson(priv,SITE_KEY,value,state.etag);record?.(state.value.site,value.site);return json(value,200,saved.httpEtag);}
  if(!state.value.updatedAt)throw new ApiError(422,'请先保存网站内容草稿。');
  const visible=await publicState(pub);expectMatch(request,visible.etag,'x-public-etag');
  const issues=sitePublicationIssues(state.value.site,visible.value.projects);if(issues.length)throw new ApiError(422,issues.join('\n'));
  const after={...structuredClone(visible.value),publicationId:crypto.randomUUID(),site:state.value.site};
  if((await siteState(priv)).etag!==state.etag)throw new ApiError(409,'发布期间网站草稿已改变，请重新核对。');
  const saved=await commitPublication(priv,pub,visible.value,after,visible.etag);record?.(visible.value.site,state.value.site);return json({published:true,publicationId:after.publicationId},200,saved.httpEtag);
}
