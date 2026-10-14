import { useEffect, useSyncExternalStore } from 'react';
import { assetUrl, parseCatalogue } from '../content/projects';
import type { Project } from '../content/projects';

type CatalogueState = { status: 'idle' | 'loading' | 'ready' | 'error'; projects: Project[]; fallback?: boolean };
let snapshot: CatalogueState = { status: 'idle', projects: [] };
const listeners = new Set<() => void>();
// Enabled only after reviewed R2 migration. Existing deployments keep the local contract.
const remoteUrl: string = import.meta.env.VITE_CATALOGUE_URL ?? '';
let lastValidated = 0;
let loading = false;
let remoteSucceeded = false;
let responseEtag: string | null = null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => snapshot;
const publish = (next: CatalogueState) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const loadCatalogue = async () => {
  if (loading) return;
  loading = true;
  if (snapshot.status !== 'ready') publish({ ...snapshot, status: 'loading' });
  try {
    if (remoteUrl && !/^https:\/\/download\.studiofimel\.com\/data\/works\.json$/.test(remoteUrl)) throw new Error('Unsupported public catalogue URL.');
    const response = await fetch(remoteUrl || assetUrl('works/catalogue.json'), { signal: AbortSignal.timeout(10_000),
      ...(remoteUrl ? { cache: 'no-store' as const, headers: responseEtag ? { 'If-None-Match': responseEtag } : {} } : {}),
    });
    if (response.status === 304 && snapshot.status === 'ready') { lastValidated = Date.now(); return; }
    if (!response.ok) throw new Error(`Catalogue returned HTTP ${response.status}`);
    const projects = parseCatalogue(await response.json());
    if (remoteUrl) { remoteSucceeded = true; responseEtag = response.headers.get('etag'); }
    lastValidated = Date.now();
    publish({ status: 'ready', projects, fallback: false });
  } catch (error) {
    console.warn('Unable to load work catalogue:', error);
    // Never resurrect removed projects from the Git snapshot after any successful R2 read.
    if (remoteUrl && !remoteSucceeded) {
      try {
        const fallback = await fetch(assetUrl('works/catalogue.json'), { signal: AbortSignal.timeout(10_000) });
        if (!fallback.ok) throw new Error('Fallback unavailable', { cause: error });
        publish({ status: 'ready', projects: parseCatalogue(await fallback.json()), fallback: true });
      } catch { publish({ status: 'error', projects: [] }); }
    } else if (snapshot.status !== 'ready') publish({ status: 'error', projects: [] });
  } finally { loading = false; }
};

export function useProjectCatalogue() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (getSnapshot().status === 'idle') void loadCatalogue();
    if (!remoteUrl) return;
    const refresh = () => { if (document.visibilityState === 'visible' && Date.now() - lastValidated > 60_000) void loadCatalogue(); };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, []);
  return { ...state, retry: loadCatalogue };
}
