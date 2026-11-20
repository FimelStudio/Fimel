export type StorageBucket = 'private' | 'public';
export type StorageKind = 'temporary' | 'asset' | 'content' | 'history' | 'receipt' | 'system';
export type StoragePolicy = { enabled: boolean; assets: boolean; publicAssets: boolean; temporaryDays: number; privateDays: number; publicDays: number; historyDays: number };
export const DEFAULT_STORAGE_POLICY: StoragePolicy = { enabled: false, assets: false, publicAssets: false, temporaryDays: 7, privateDays: 30, publicDays: 90, historyDays: 30 };
export type StorageItem = { bucket: StorageBucket; key: string; etag: string; size: number; uploaded: string; kind: StorageKind; eligible: boolean; reason: string };
export type StorageScan = { id: string; createdAt: string; status: 'inventory' | 'references' | 'ready'; bucket: StorageBucket; cursor?: string; items: StorageItem[]; refs: string[]; queue: string[]; read: number; revisions: Record<string, string>; policy: StoragePolicy; deleted: string[]; skipped: string[] };
export const storageId = (bucket: StorageBucket, key: string) => `${bucket}:${key}`;
export function storageKind(bucket: StorageBucket, key: string): StorageKind {
  if (bucket === 'private' && key.startsWith('uploads/temporary/')) return 'temporary';
  if (bucket === 'private' && /^(uploads\/verified\/|docs\/uploads\/)/.test(key) || bucket === 'public' && /^(images\/|works\/|docs\/images\/)/.test(key)) return 'asset';
  if (bucket === 'public' && key.startsWith('content/')) return 'content';
  if (key.endsWith('.json') && (bucket === 'private' && /^(backups\/(library|public|site|docs|docs-public)\/|snapshots\/|maintenance\/scans\/)/.test(key) || bucket === 'public' && /^(data\/snapshots\/|data\/docs-snapshots\/)/.test(key))) return 'history';
  if (bucket === 'private' && /^uploads\/(sessions|receipts|active)\//.test(key)) return 'receipt';
  return 'system';
}
export function storagePolicyErrors(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  const p = value as StoragePolicy;
  return Object.keys(p).sort().join(',') !== Object.keys(DEFAULT_STORAGE_POLICY).sort().join(',') || typeof p.enabled !== 'boolean' || typeof p.assets !== 'boolean' || typeof p.publicAssets !== 'boolean' || p.publicAssets&&!p.assets || ![7,14,30].includes(p.temporaryDays) || ![30,60,90].includes(p.privateDays) || ![90,180,365].includes(p.publicDays) || ![30,60,90,180].includes(p.historyDays);
}
