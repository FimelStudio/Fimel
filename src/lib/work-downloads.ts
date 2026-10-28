import type { PublicWorkDownloads, PublicWorkDownloadTotals } from '../content/work-events';
import { HISTORY_CURSOR_PATTERN } from './work-download-cursor';

const revisionPattern=/^[a-zA-Z0-9._-]{1,128}$/;
const MAX_PAGES=200;
const MAX_OBJECTS=40000;
type HistoryRequest=(input:string,options:{credentials:'omit';cache:'no-store';signal:AbortSignal})=>Promise<{ok:boolean;json():Promise<unknown>}>;

function isSegment(value:unknown):value is PublicWorkDownloads {
  if(!value||typeof value!=='object')return false;
  const data=value as Partial<PublicWorkDownloads>,segment=data.segment;
  return typeof data.generatedAt==='string'&&Number.isFinite(Date.parse(data.generatedAt))&&data.scope==='all-time'&&
    typeof data.revision==='string'&&revisionPattern.test(data.revision)&&!!segment&&typeof segment.complete==='boolean'&&
    Number.isSafeInteger(segment.objects)&&segment.objects>=0&&segment.objects<=200&&
    Number.isSafeInteger(segment.records)&&segment.records>=0&&segment.records<=segment.objects&&
    (segment.complete?segment.nextCursor===undefined:typeof segment.nextCursor==='string'&&HISTORY_CURSOR_PATTERN.test(segment.nextCursor))&&
    !!data.works&&typeof data.works==='object'&&!Array.isArray(data.works)&&Object.keys(data.works).length<=1000&&
    Object.entries(data.works).every(([slug,row])=>/^[a-z0-9-]{1,80}$/.test(slug)&&row&&
      (row.downloadClicks===null||Number.isSafeInteger(row.downloadClicks)&&row.downloadClicks>=0));
}

/** Publish no total until every history page has succeeded under one public revision. */
export async function readWorkDownloadTotals(endpoint:string,request:HistoryRequest=fetch):Promise<PublicWorkDownloadTotals> {
  const totals=new Map<string,number>();
  const cursors=new Set<string>();
  let revision:string|undefined,cursor:string|undefined,membership:string|undefined;
  let generatedAt='',objects=0;
  for(let page=0;page<MAX_PAGES;page++){
    const query=cursor?`?${new URLSearchParams({cursor,revision:revision!})}`:'';
    const response=await request(`${endpoint}${query}`,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Download history unavailable.');
    const value:unknown=await response.json();if(!isSegment(value))throw Error('Invalid download history.');
    const slugs=Object.keys(value.works).sort(),members=slugs.join(',');
    if(revision!==undefined&&(value.revision!==revision||members!==membership))throw Error('Public catalogue changed during history read.');
    revision=value.revision;membership=members;
    generatedAt=!generatedAt||value.generatedAt<generatedAt?value.generatedAt:generatedAt;
    objects+=value.segment.objects;if(objects>MAX_OBJECTS)throw Error('Download history exceeds the safe aggregation limit.');
    for(const [slug,row] of Object.entries(value.works)){
      if(row.downloadClicks===null)continue;
      const count=(totals.get(slug)??0)+row.downloadClicks;if(!Number.isSafeInteger(count))throw Error('Invalid download total.');
      totals.set(slug,count);
    }
    if(value.segment.complete)return {generatedAt,scope:'all-time',revision,works:Object.fromEntries(slugs.map(slug=>[slug,{downloadClicks:totals.get(slug)??null}]))};
    cursor=value.segment.nextCursor!;
    if(cursors.has(cursor))throw Error('Repeated download history cursor.');
    cursors.add(cursor);
  }
  throw Error('Download history exceeds the safe aggregation limit.');
}
