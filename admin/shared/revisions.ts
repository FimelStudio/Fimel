import type { Work } from './model';
import { referencedImages } from './markdown';

export function stable(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).sort(([a], [b]) => a<b?-1:a>b?1:0).map(([k, v]) => [k, sort(v)])) : item;
  return JSON.stringify(sort(value));
}
export const sameWork = (a: Work | null | undefined, b: Work | null | undefined) => stable(a ?? null) === stable(b ?? null);
export function publicationPayload(work: Work) {
  const referenced = referencedImages(work.markdown);
  return { project: work.project, order: work.order, markdown: work.markdown, coverId: work.coverId,
    gallery: work.gallery.filter(a => a.id === work.coverId || referenced.has(a.id)), versions: work.versions.filter(v => v.status === 'released') };
}
export async function publicationFingerprint(work: Work) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(publicationPayload(work))));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export type WorkConflict = { current: Work | null; base: Work | null; incoming: Work; paths: string[] };
export function mergeWork(base: Work, current: Work, incoming: Work) {
  const conflicts: string[] = [];
  const merge = (a: unknown, b: unknown, c: unknown, path: string): unknown => {
    if (stable(c) === stable(a)) return b;
    if (stable(b) === stable(a) || stable(b) === stable(c)) return c;
    const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
    if (object(a) && object(b) && object(c)) return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(c)])].filter(k => k !== 'updatedAt').map(k => [k, merge(a[k], b[k], c[k], path ? `${path}.${k}` : k)]).filter(([, v]) => v !== undefined));
    conflicts.push(path); return c;
  };
  const work = merge(base, current, incoming, '') as Work;
  return { work: { ...work, updatedAt: incoming.updatedAt }, conflicts };
}
