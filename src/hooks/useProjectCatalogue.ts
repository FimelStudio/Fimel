import { useEffect, useSyncExternalStore } from 'react';
import { assetUrl, parseCatalogue } from '../content/projects';
import type { Project } from '../content/projects';

type CatalogueState = { status: 'idle' | 'loading' | 'ready' | 'error'; projects: Project[] };
let snapshot: CatalogueState = { status: 'idle', projects: [] };
const listeners = new Set<() => void>();

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
  if (snapshot.status === 'loading') return;
  publish({ ...snapshot, status: 'loading' });
  try {
    const response = await fetch(assetUrl('works/catalogue.json'), { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Catalogue returned HTTP ${response.status}`);
    const projects = parseCatalogue(await response.json());
    publish({ status: 'ready', projects });
  } catch (error) {
    console.warn('Unable to load work catalogue:', error);
    publish({ status: 'error', projects: [] });
  }
};

export function useProjectCatalogue() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (getSnapshot().status === 'idle') void loadCatalogue();
  }, []);
  return { ...state, retry: loadCatalogue };
}
