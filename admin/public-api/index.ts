// Independent public API. This module never receives the private bucket or Admin bindings.
import {readJson,ApiError} from '../worker/http';
export default {
  async fetch(request:Request,env:StatisticsEnv):Promise<Response>{
    const origin=request.headers.get('origin');
    const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'});
    if(origin===env.SITE_ORIGIN){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');}
    const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
    if(origin!==env.SITE_ORIGIN)return respond({error:'Origin rejected'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    const url=new URL(request.url);if(url.pathname!=='/api/download-counts')return respond({error:'Not found'},404);
    if(!['GET','POST'].includes(request.method))return respond({error:'Method not allowed'},405);
    try{
      const limited=await env.LIMITER.limit({key:request.headers.get('cf-connecting-ip')??'unknown'});if(!limited.success)return respond({error:'Rate limited'},429);
      const manifest=await env.PUBLIC.get('data/works.json');if(!manifest)return respond({error:'Catalogue unavailable'},503);
      const value=await manifest.json<{projects:{slug:string;status:string;downloadSlug?:string;downloadUrl?:string}[]}>();
      const targets=new Set(value.projects.filter(p=>p.status==='released'&&p.downloadUrl).map(p=>p.downloadSlug??p.slug));
      if(request.method==='GET'){
        const slugs=(url.searchParams.get('slugs')??'').split(',').filter(s=>targets.has(s)).slice(0,100);
        if(!slugs.length)return respond({counts:{}});
        const rows=await env.COUNTS.prepare(`SELECT slug,download_count FROM work_download_counts WHERE slug IN (${slugs.map(()=>'?').join(',')})`).bind(...slugs).all<{slug:string;download_count:number}>();
        return respond({counts:Object.fromEntries(slugs.map(slug=>[slug,rows.results.find(row=>row.slug===slug)?.download_count??0]))});
      }
      if(request.headers.get('content-type')!=='application/json'||Number(request.headers.get('content-length'))<1||Number(request.headers.get('content-length'))>1024)return respond({error:'Invalid request'},422);
      const input=await readJson(request,1024) as {slug?:string}|null;if(!input?.slug||!targets.has(input.slug))return respond({error:'Unknown public download target'},404);
      const saved=await env.COUNTS.prepare('INSERT INTO work_download_counts(slug,download_count) VALUES(?,1) ON CONFLICT(slug) DO UPDATE SET download_count=download_count+1,updated_at=CURRENT_TIMESTAMP RETURNING download_count').bind(input.slug).first<{download_count:number}>();
      if(!saved)throw new Error('Counter update not confirmed');return respond({count:saved.download_count});
    }catch(error){return respond({error:error instanceof ApiError?error.message:'Statistics temporarily unavailable'},error instanceof ApiError?error.status:503);}
  },
};
