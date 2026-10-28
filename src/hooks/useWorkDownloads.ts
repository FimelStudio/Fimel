import { useEffect, useSyncExternalStore } from 'react';
import type { PublicWorkDownloadTotals } from '../content/work-events';
import { readWorkDownloadTotals } from '../lib/work-downloads';

type State = {status:'idle'|'loading'|'ready'|'error';data?:PublicWorkDownloadTotals};
let snapshot:State={status:'idle'};
const listeners=new Set<()=>void>();
let pending=false;
let checkedAt=0;
let readers=0;
let refreshTimer:number|undefined;
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
const getSnapshot=()=>snapshot;
const publish=(value:State)=>{snapshot=value;listeners.forEach(listener=>listener());};
const endpoint=import.meta.env.DEV?'/api/work-downloads':'https://studiofimel.com/api/work-downloads';

async function load() {
  if(pending||Date.now()-checkedAt<60000)return;
  pending=true;
  if(snapshot.status!=='ready')publish({status:'loading'});
  try{
    const data=await readWorkDownloadTotals(endpoint);
    publish({status:'ready',data});
  }catch{publish({status:'error'});}
  finally{checkedAt=Date.now();pending=false;}
}
const refresh=()=>{if(document.visibilityState==='visible')void load();};

/** One request serves every row; failed or uncollected metrics never become zero. */
export function useWorkDownloads() {
  const state=useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
  useEffect(()=>{
    void load();
    if(++readers===1){
      refreshTimer=window.setInterval(refresh,60000);
      window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
    }
    return()=>{if(--readers===0){window.clearInterval(refreshTimer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);}};
  },[]);
  return state;
}
