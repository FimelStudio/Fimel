import type { Library, PublicManifest } from '../shared/model';
import { EMPTY_ETAG, putJson } from './http';
export const LIBRARY_KEY = 'state/library.json';
export const MANIFEST_KEY = 'data/works.json';
export async function libraryState(bucket: R2Bucket) {
  const object = await bucket.get(LIBRARY_KEY);
  return { value: object ? await object.json<Library>() : { schemaVersion: 1, works: [] } as Library, etag: object?.httpEtag ?? EMPTY_ETAG };
}
export async function publicState(bucket: R2Bucket) {
  const object = await bucket.get(MANIFEST_KEY);
  return { value: object ? await object.json<PublicManifest>() : { schemaVersion: 2, publicationId: 'empty', projects: [], releases: {} } as PublicManifest, etag: object?.httpEtag ?? EMPTY_ETAG };
}
export async function audit(bucket: R2Bucket, operation: string, workId?: string) {
  await putJson(bucket, `audit/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.json`, { operation, workId, status: 'prepared', time: new Date().toISOString() });
}
export async function backup(bucket: R2Bucket, value: unknown, kind: 'library' | 'public' | 'site') {
  const id = crypto.randomUUID();
  await putJson(bucket, `backups/${kind}/${id}.json`, { id, kind, time: new Date().toISOString(), value });
  return id;
}
export async function listAll(bucket: R2Bucket, prefix: string) {
  const objects: R2Object[] = []; let cursor: string | undefined;
  do { const page = await bucket.list({ prefix, cursor }); objects.push(...page.objects); cursor = page.truncated ? page.cursor : undefined; } while (cursor);
  return objects;
}
