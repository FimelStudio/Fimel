import { ApiError, EMPTY_ETAG, putJson } from './http';

const GATE_KEY = 'maintenance/write-gate.json';
type Gate = { writers: Record<string, string>; cleaner?: string };
// No expiring writer leases: a terminated Worker must never silently make a
// still-uncertain write safe to race with irreversible deletion. Fail closed.
async function change(bucket: R2Bucket, update: (gate: Gate) => Gate) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const object = await bucket.get(GATE_KEY);
    const gate = object ? await object.json<Gate>() : { writers: {} };
    if (!gate || !gate.writers || typeof gate.writers !== 'object' || Array.isArray(gate.writers) || Object.keys(gate).some(key=>!['writers','cleaner'].includes(key)) || Object.entries(gate.writers).some(([id,time])=>!/^[a-zA-Z0-9-]{1,80}$/.test(id)||typeof time!=='string'||!Number.isFinite(Date.parse(time))) || gate.cleaner!==undefined&&(typeof gate.cleaner!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(gate.cleaner))) throw new ApiError(503, '存储维护锁异常，已停止写入与清理。');
    const next = update(gate);
    try { await putJson(bucket, GATE_KEY, next, object?.httpEtag ?? EMPTY_ETAG); return; }
    catch (error) { if (!(error instanceof ApiError) || error.status !== 409) throw error; }
  }
  throw new ApiError(409, '存储正被其他窗口操作，请稍后重试。');
}
export async function withStorageWriter<T>(bucket: R2Bucket, operation: () => Promise<T>): Promise<T> {
  const id = crypto.randomUUID();
  await change(bucket, gate => {
    if (gate.cleaner) throw new ApiError(503, '存储正在清理，请稍后重试；当前修改已保留。');
    if (Object.keys(gate.writers).length >= 64) throw new ApiError(503, '存储写入过多，当前修改已保留，请稍后重试。');
    return { ...gate, writers: { ...gate.writers, [id]: new Date().toISOString() } };
  });
  try { return await operation(); }
  finally { await change(bucket, gate => { const writers = { ...gate.writers }; delete writers[id]; return { ...gate, writers }; }); }
}
export async function withStorageCleaner<T>(bucket: R2Bucket, operation: () => Promise<T>): Promise<T> {
  const id = crypto.randomUUID();
  await change(bucket, gate => {
    if (gate.cleaner || Object.keys(gate.writers).length) throw new ApiError(409, '仍有写入或清理尚未结束，未删除任何新文件。请等待后重试；长期未结束时需检查服务日志。');
    return { writers: {}, cleaner: id };
  });
  try { return await operation(); }
  finally { await change(bucket, gate => { if (gate.cleaner !== id) throw new ApiError(503, '清理锁归属异常。'); return { writers: gate.writers }; }); }
}
