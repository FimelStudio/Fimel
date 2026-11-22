import { ApiError, EMPTY_ETAG, putJson } from './http';
import type { StorageGate } from '../shared/storage-gate';

const GATE_KEY = 'maintenance/write-gate.json';
// No expiring writer leases: a terminated Worker must never silently make a
// still-uncertain write safe to race with irreversible deletion. Fail closed.
export async function readStorageGate(bucket: R2Bucket) {
  const object = await bucket.get(GATE_KEY);
  if (object && object.size>65_536) { await object.body.cancel(); throw new ApiError(503,'存储维护锁超过上限，已停止写入与清理。'); }
  let gate: StorageGate;
  try { gate = object ? await object.json<StorageGate>() : { writers: {} }; }
  catch { throw new ApiError(503, '存储维护锁损坏，已停止写入与清理。'); }
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
  const validTime = (time: unknown): time is string => typeof time === 'string' && Number.isFinite(Date.parse(time));
  const validWriters = (writers: unknown): writers is Record<string, string> => !!writers && typeof writers === 'object' && !Array.isArray(writers) && Object.entries(writers).every(([id, time]) => validId(id) && validTime(time));
  const recovery = gate?.recovery, recovered = gate?.recovered;
  if (!gate || !validWriters(gate.writers) || Object.keys(gate).some(key => !['writers','cleaner','recovery','recovered'].includes(key)) ||
    gate.cleaner !== undefined && !validId(gate.cleaner) ||
    recovery !== undefined && (!recovery || !validId(recovery.id) || gate.cleaner !== recovery.id || !validTime(recovery.startedAt) || !validTime(recovery.readyAt) || Date.parse(recovery.readyAt)-Date.parse(recovery.startedAt)<60_000 || !validWriters(recovery.writers) || !recovery.revisions || typeof recovery.revisions !== 'object' || Array.isArray(recovery.revisions) || Object.values(recovery.revisions).some(value => typeof value !== 'string') || !/^audit\/[^/]+\/[^/]+\.json$/.test(recovery.auditKey)) ||
    recovered !== undefined && (!recovered || !validId(recovered.id) || !validTime(recovered.time) || !/^audit\/[^/]+\/[^/]+\.json$/.test(recovered.auditKey))) throw new ApiError(503, '存储维护锁异常，已停止写入与清理。');
  return { gate, etag: object?.httpEtag ?? EMPTY_ETAG };
}
export async function changeStorageGate(bucket: R2Bucket, update: (gate: StorageGate) => StorageGate, expected?: string) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const {gate, etag} = await readStorageGate(bucket);
    if (expected !== undefined && expected !== etag) throw new ApiError(409, '维护锁已变化，请重新读取后核对。');
    const next = update(gate);
    try { const saved = await putJson(bucket, GATE_KEY, next, etag); return {gate:next,etag:saved.httpEtag}; }
    catch (error) { if (!(error instanceof ApiError) || error.status !== 409) throw error; }
  }
  throw new ApiError(409, '存储正被其他窗口操作，请稍后重试。');
}
export async function withStorageWriter<T>(bucket: R2Bucket, operation: () => Promise<T>, requestId?: string): Promise<T> {
  const id = crypto.randomUUID();
  await changeStorageGate(bucket, gate => {
    if (gate.cleaner) throw new ApiError(503, '存储正在清理，请稍后重试；当前修改已保留。');
    if (Object.keys(gate.writers).length >= 64) throw new ApiError(503, '存储写入过多，当前修改已保留，请稍后重试。');
    return { ...gate, writers: { ...gate.writers, [id]: new Date().toISOString() } };
  });
  console.log(JSON.stringify({operation:'storage-writer-acquired',leaseId:id,requestId}));
  try { return await operation(); }
  finally { await changeStorageGate(bucket, gate => { const writers = { ...gate.writers }; delete writers[id]; return { ...gate, writers }; }); console.log(JSON.stringify({operation:'storage-writer-released',leaseId:id,requestId})); }
}
export async function withStorageCleaner<T>(bucket: R2Bucket, operation: () => Promise<T>): Promise<T> {
  const id = crypto.randomUUID();
  await changeStorageGate(bucket, gate => {
    if (gate.cleaner || Object.keys(gate.writers).length) throw new ApiError(409, '仍有写入或清理尚未结束，未删除任何新文件。请等待后重试；长期未结束时需检查服务日志。');
    return { ...gate, writers: {}, cleaner: id };
  });
  try { return await operation(); }
  finally { await changeStorageGate(bucket, gate => { if (gate.cleaner !== id) throw new ApiError(503, '清理锁归属异常。'); return { ...gate, cleaner: undefined }; }); }
}
