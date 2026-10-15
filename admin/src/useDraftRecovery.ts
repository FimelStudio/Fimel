import { useEffect, useState } from 'react';
import type { Library } from '../shared/model';
import { sameWork } from '../shared/revisions';
import { recoveryStore, browserTabId } from './draft-recovery';
import type { Recovery } from './draft-recovery';
import { validateLibrary } from '../shared/validation';
export function useDraftRecovery(actorId: string | null, library: Library, original: string, selected: string | null) {
  const [found, setFound] = useState<Recovery | null>(null); const [error, setError] = useState(''); const [savedAt, setSavedAt] = useState('');
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const key = actorId ? `draft:${actorId}:${browserTabId()}` : null;
  useEffect(() => {
    if (!key) return; let active = true;
    void recoveryStore<Recovery[]>(key, 'list').then(records => {
      if (!active) return; setReadyKey(key);
      const own=records.filter(r=>typeof r?.key==='string'&&(r.key===`draft:${actorId}`||r.key.startsWith(`draft:${actorId}:`)));
      for(const record of own)if(Date.parse(record.at)<Date.now()-7*86400000)void recoveryStore(record.key,'delete');
      const record=own.find(r=>r.key===key)??own.filter(r=>Date.parse(r.at)>=Date.now()-7*86400000).sort((a,b)=>b.at.localeCompare(a.at))[0];
      if (!record) return;
      if(typeof record.at!=='string'||!Number.isFinite(Date.parse(record.at))||!Array.isArray(record.edits)||record.edits.length>500||validateLibrary({schemaVersion:1,works:record.edits.map(e=>e?.work)}).length||record.edits.some(e=>e.base!==null&&validateLibrary({schemaVersion:1,works:[e.base]}).length))throw Error('Invalid local recovery');
      if (Date.parse(record.at) < Date.now() - 7 * 86400000) { void recoveryStore(key, 'delete'); return; }
      setFound(record);
    }).catch(() => { if (active) { setReadyKey(key); setError('当前浏览器无法保存本机恢复记录，请及时保存草稿或导出修改。'); } });
    return () => { active = false; };
  }, [key,actorId]);
  useEffect(() => {
    if (!key || readyKey !== key || !original || found?.key===key) return;
    const base = JSON.parse(original) as Library;
    const edits = library.works.filter(work => !sameWork(work, base.works.find(w => w.id === work.id))).map(work => ({ work, base: base.works.find(w => w.id === work.id) ?? null }));
    const timer = setTimeout(() => {
      if (!edits.length) { void recoveryStore(key, 'delete').catch(() => {}); return; }
      const at = new Date().toISOString();
      void recoveryStore(key, 'put', { key, at, selected, edits }).then(() => { setSavedAt(at); setError(''); }).catch(() => setError('本机恢复记录保存失败，请保存草稿或导出修改。'));
    }, 800);
    return () => clearTimeout(timer);
  }, [key, readyKey, library, original, selected, found]);
  const dismiss = async () => { if (found?.key) await recoveryStore(found.key, 'delete').catch(() => {}); setFound(null); };
  return { found, dismiss, savedAt, error };
}
