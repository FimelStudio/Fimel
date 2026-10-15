const explicit:string=import.meta.env.VITE_WORK_EVENTS_URL??'';
const endpoint=explicit||(import.meta.env.PROD&&!['127.0.0.1','localhost'].includes(location.hostname)?'https://studiofimel.com/api/work-events':'');
const opened=new Map<string,number>();
export function recordWorkEvent(slug:string,kind:'view'|'download') {
  if(!endpoint)return;
  try{const url=new URL(endpoint);if(url.href!=='https://studiofimel.com/api/work-events'&&!(import.meta.env.DEV&&url.hostname==='127.0.0.1'&&url.pathname==='/api/work-events'))return;}catch{return;}
  // React development remounts must not double-count the same opening.
  if(kind==='view'){if(Date.now()-(opened.get(slug)??0)<1500)return;opened.set(slug,Date.now());if(opened.size>500)opened.delete(opened.keys().next().value!);}
  void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,kind}),keepalive:true,signal:AbortSignal.timeout(5000)}).catch(()=>{});
}
