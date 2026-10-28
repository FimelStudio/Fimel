import type { MetricsFeed } from '../shared/analytics';
import { ApiError } from './http';
import { workEventWindow } from '../../src/content/work-events';
export type AnalyticsSecrets = { CF_ANALYTICS_TOKEN?:string; CF_ANALYTICS_ZONE?:string };
type Group = { count:number; sum:{edgeResponseBytes:number;visits?:number}; dimensions:{date:string;clientRequestHTTPHost?:string;clientRequestPath?:string} };
type Zone = { traffic:Group[]; downloads:Group[]; files:Group[]; visitors:{dimensions:{date:string};sum:{requests:number};uniq:{uniques:number}}[] };
const cache=new Map<string,{at:number;data:MetricsFeed}>();
export const METRICS_QUERY=`query FimelMetrics($zone:String!,$from:String!,$to:String!,$first:String!,$last:String!){viewer{zones(filter:{zoneTag:$zone}){
 traffic:httpRequestsAdaptiveGroups(limit:1000,filter:{datetime_geq:$from,datetime_lt:$to,requestSource:"eyeball"},orderBy:[date_ASC]){count sum{edgeResponseBytes visits} dimensions{date clientRequestHTTPHost}}
 downloads:httpRequestsAdaptiveGroups(limit:31,filter:{datetime_geq:$from,datetime_lt:$to,requestSource:"eyeball",clientRequestHTTPHost:"download.studiofimel.com",clientRequestHTTPMethodName:"GET",edgeResponseStatus_in:[200,206],clientRequestPath_like:"/works/%"},orderBy:[date_ASC]){count sum{edgeResponseBytes} dimensions{date}}
 files:httpRequestsAdaptiveGroups(limit:200,filter:{datetime_geq:$from,datetime_lt:$to,requestSource:"eyeball",clientRequestHTTPHost:"download.studiofimel.com",clientRequestHTTPMethodName:"GET",edgeResponseStatus_in:[200,206],clientRequestPath_like:"/works/%"},orderBy:[count_DESC]){count sum{edgeResponseBytes} dimensions{date clientRequestPath}}
 visitors:httpRequests1dGroups(limit:31,filter:{date_geq:$first,date_leq:$last}){dimensions{date}sum{requests}uniq{uniques}}
}}}`;
function number(value:unknown):number {if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new ApiError(503,'Cloudflare 统计数据格式异常，请稍后重试。');return value;}
export function parseMetrics(zone:Zone,from:string,to:string):MetricsFeed {
  if(!zone||![zone.traffic,zone.downloads,zone.files,zone.visitors].every(Array.isArray))throw new ApiError(503,'Cloudflare 没有返回可用统计，请检查只读分析权限。');
  const domains:MetricsFeed['domains']=[];
  for(const row of zone.traffic){let host:string;try{host=new URL('https://'+row.dimensions.clientRequestHTTPHost).hostname;}catch{continue;}if(!['studiofimel.com','www.studiofimel.com','download.studiofimel.com','admin.studiofimel.com'].includes(host))continue;
    domains.push({date:row.dimensions.date,host,requests:number(row.count),visits:number(row.sum.visits??0),bytes:number(row.sum.edgeResponseBytes)});}
  return{generatedAt:new Date().toISOString(),from,to,timeZone:'UTC',domains,
    zoneVisitors:zone.visitors.map(r=>({date:r.dimensions.date,requests:number(r.sum.requests),uniqueIPs:number(r.uniq.uniques)})),
    downloadDays:zone.downloads.map(r=>({date:r.dimensions.date,requests:number(r.count),bytes:number(r.sum.edgeResponseBytes)})),
    files:zone.files.flatMap(r=>{const path=r.dimensions.clientRequestPath??'';const match=/^\/works\/(?:bedrock|java|datapacks|tools|mods)\/([a-z0-9-]+)\//.exec(path);if(!match)return[];return[{date:r.dimensions.date,path,slug:match[1],requests:number(r.count),bytes:number(r.sum.edgeResponseBytes)}];}),filesTruncated:zone.files.length===200};
}
export async function metrics(request:Request,env:AnalyticsSecrets):Promise<MetricsFeed> {
  const days=Number(new URL(request.url).searchParams.get('days')??7);if(![1,7,30].includes(days))throw new ApiError(422,'统计范围仅支持 1、7 或 30 天。');
  if(!env.CF_ANALYTICS_TOKEN||!env.CF_ANALYTICS_ZONE)throw new ApiError(503,'域名统计尚未连接：需要为 studiofimel.com 配置只读 Cloudflare 分析权限。');
  if(!/^[a-f0-9]{32}$/.test(env.CF_ANALYTICS_ZONE))throw new ApiError(503,'统计域名配置异常。');
  const {from,to}=workEventWindow(days as 1|7|30),end=new Date(to),key=`${env.CF_ANALYTICS_ZONE}:${days}:${from}`;const previous=cache.get(key);if(previous&&Date.now()-previous.at<300000)return previous.data;
  let response:Response;try{response=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.CF_ANALYTICS_TOKEN}`},body:JSON.stringify({query:METRICS_QUERY,variables:{zone:env.CF_ANALYTICS_ZONE,from,to,first:from.slice(0,10),last:new Date(end.getTime()-86400000).toISOString().slice(0,10)}}),signal:AbortSignal.timeout(20000)});}catch{throw new ApiError(503,'Cloudflare 统计服务暂时不可用，请稍后重试。');}
  if(!response.ok)throw new ApiError(503,'Cloudflare 统计访问被拒绝，请核对只读分析权限。');
  const body=await response.json()as{data?:{viewer?:{zones?:Zone[]}};errors?:unknown[]};if(body.errors?.length)throw new ApiError(503,'Cloudflare 查询未完成，可能超过当前统计窗口或权限范围。');
  const zone=body.data?.viewer?.zones?.[0];if(!zone)throw new ApiError(503,'当前权限未返回 studiofimel.com 的统计。');const data=parseMetrics(zone,from,to);if(cache.size>=10)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),data});return data;
}
