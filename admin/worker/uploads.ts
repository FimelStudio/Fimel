import { MAX_FILE_SIZE, MAX_IMAGE_SIZE, MIME_TYPES, PART_SIZE } from '../shared/model';
import type { Asset, Upload } from '../shared/model';
import { ApiError, json, putJson, readJson } from './http';
import { libraryState, listAll } from './storage';

const sessionKey = (id: string) => `uploads/sessions/${id}.json`;
const receiptKey = (id: string, part: number) => `uploads/receipts/${id}/${String(part).padStart(3, '0')}.json`;
export async function uploadRoute(request: Request, bucket: R2Bucket, segments: string[]): Promise<Response> {
  const id = segments[0];
  if (!id && request.method === 'GET') {
    const uploads: Upload[] = [];
    for (const item of await listAll(bucket, 'uploads/sessions/')) {
      const object = await bucket.get(item.key);
      if (object) uploads.push(await object.json<Upload>());
    }
    return json({ uploads: uploads.sort((a,b) => b.expiresAt.localeCompare(a.expiresAt)).slice(0,100) });
  }
  if (id === 'cleanup' && segments.length === 1 && request.method === 'POST') {
    const input = await readJson(request, 8192) as { sessionIds?: unknown };
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'sessionIds') ||
      input.sessionIds !== undefined && (!Array.isArray(input.sessionIds) || input.sessionIds.length > 100 || input.sessionIds.some(value => typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value)))) throw new ApiError(422, '清理会话范围不合法。');
    const selected = input.sessionIds === undefined ? null : new Set(input.sessionIds as string[]);
    let cleaned = 0;
    for (const item of await listAll(bucket, 'uploads/sessions/')) {
      const object = await bucket.get(item.key); if (!object) continue;
      const s = await object.json<Upload>();
      if (selected && !selected.has(s.id)) continue;
      if (s.status === 'complete' || s.status === 'cancelled' || Date.parse(s.expiresAt) < Date.now()) {
        if (s.status !== 'complete') {
          try { await bucket.resumeMultipartUpload(s.key,s.uploadId).abort(); } catch { /* R2 auto-aborts expired multipart uploads. */ }
        }
        // Delete only the generated temporary object, never verified files, backups or public objects.
        if (!s.key.startsWith(`uploads/temporary/${s.id}/`)) throw new ApiError(422,'临时对象范围异常。');
        for (const temporary of await listAll(bucket, `uploads/temporary/${s.id}/`)) await bucket.delete(temporary.key);
        await bucket.delete(`uploads/active/${s.id}.json`);
        cleaned++;
      }
    }
    return json({ cleaned });
  }
  if (!id && request.method === 'POST') {
    const input = await readJson(request, 4096) as Partial<Upload>;
    if (typeof input.name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,149}$/.test(input.name) || input.name.includes('..')) throw new ApiError(422, '文件名只能包含英文、数字、点、横线与下划线。');
    const extension = input.name.split('.').pop()!.toLowerCase();
    if(!input.name.includes('.')||input.displayName!==undefined&&(typeof input.displayName!=='string'||input.displayName.length>200||Array.from(input.displayName).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)))throw new ApiError(422,'文件名称格式不合法或超过 200 字符。');
    const mime = MIME_TYPES[extension];
    const image = ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
    if (!mime || input.kind !== (image ? 'image' : 'file') || !Number.isInteger(input.size) || input.size! < 1 || input.size! > (image ? MAX_IMAGE_SIZE : MAX_FILE_SIZE)) throw new ApiError(422, '文件类型或大小不符合要求。');
    if (input.sha256 !== undefined && (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256))) throw new ApiError(422, '完整 SHA-256 格式错误。');
    const state = await libraryState(bucket); const work = state.value.works.find(w => w.id === input.workId);
    if (!work || !image && !work.versions.some(v => v.id === input.versionId)) throw new ApiError(422, '先保存作品与版本，再上传文件。');
    // Bound active sessions; no user-controlled object keys or multipart IDs.
    const sessions = await listAll(bucket, 'uploads/active/');
    let active = 0;
    for (const obj of sessions) { const s = await (await bucket.get(obj.key))!.json<Upload>(); if (s.status === 'uploading' && Date.parse(s.expiresAt) > Date.now()) active++; }
    if (active >= 10) throw new ApiError(429, '同时上传会话过多，请取消旧会话后重试。');
    const newId = crypto.randomUUID(); const key = `uploads/temporary/${newId}/${input.name}`;
    const multipart = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: mime }, customMetadata: { workId: work.id, kind: input.kind } });
    const upload: Upload = { id: newId, workId: work.id, ...(input.versionId ? { versionId: input.versionId } : {}), kind: input.kind,
      name: input.name, ...(input.displayName?{displayName:input.displayName}:{}), size: input.size!, mime, key, uploadId: multipart.uploadId,
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(), status: 'uploading', ...(input.sha256 ? {sha256:input.sha256} : {}) };
    try { await putJson(bucket, sessionKey(newId), upload); await putJson(bucket, `uploads/active/${newId}.json`, upload); } catch (cause) { await multipart.abort(); throw cause; }
    return json({ upload, partSize: PART_SIZE }, 201);
  }
  if (!id || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new ApiError(404, '上传会话不存在。');
  const object = await bucket.get(sessionKey(id)); if (!object) throw new ApiError(404, '上传会话不存在。');
  const upload = await object.json<Upload>();
  const multipart = bucket.resumeMultipartUpload(upload.key, upload.uploadId);
  if (request.method === 'GET' && segments.length === 1) {
    const parts = [];
    for (const obj of await listAll(bucket, `uploads/receipts/${id}/`)) parts.push(await (await bucket.get(obj.key))!.json());
    return json({ upload, parts, partSize: PART_SIZE });
  }
  if (request.method === 'DELETE' && segments.length === 1) {
    if (upload.status === 'complete') throw new ApiError(409, '已完成的文件不能通过取消接口删除。');
    await putJson(bucket, sessionKey(id), { ...upload, status: 'cancelled' }, object.httpEtag);
    await bucket.delete(`uploads/active/${id}.json`);
    await multipart.abort(); return json({ cancelled: true });
  }
  if (Date.parse(upload.expiresAt) < Date.now()) throw new ApiError(410, '上传会话已过期，请重新上传。');
  if (segments[1] === 'parts' && request.method === 'PUT' && segments.length === 3) {
    if (upload.status !== 'uploading') throw new ApiError(409, '上传会话已结束。');
    const number = Number(segments[2]); const count = Math.ceil(upload.size / PART_SIZE);
    if (!Number.isInteger(number) || number < 1 || number > count) throw new ApiError(422, '分片编号非法。');
    const expectedSize = Math.min(PART_SIZE, upload.size - (number - 1) * PART_SIZE);
    if (request.headers.get('content-type') !== 'application/octet-stream' || Number(request.headers.get('content-length')) !== expectedSize) throw new ApiError(422, '分片类型或长度错误。');
    const claimed = request.headers.get('x-part-sha256');
    if (!claimed || !/^[a-f0-9]{64}$/.test(claimed)) throw new ApiError(422, '缺少分片校验值。');
    if (!request.body) throw new ApiError(422, '缺少分片。');
    // R2 verifies the real bytes with native SHA-256, then streams them into multipart.
    // Avoid copying/hashing 16 MiB in Worker CPU; only the first 12 signature bytes are buffered.
    const stagedKey = `uploads/temporary/${id}/parts/${number}-${crypto.randomUUID()}`;
    try {
      let staged: R2Object | null;
      try { staged = await bucket.put(stagedKey, request.body, { sha256: claimed, onlyIf: { etagDoesNotMatch: '*' } }); }
      catch (cause) { if (cause instanceof Error && /checksum|sha-?256|digest/i.test(cause.message)) throw new ApiError(422, '分片 SHA-256 校验失败。'); throw cause; }
      if (!staged || staged.size !== expectedSize) throw new ApiError(422, '分片不完整或长度错误。');
      if (number === 1) {
        const prefix = await bucket.get(stagedKey, { range: { offset: 0, length: Math.min(12, staged.size) } });
        if (!prefix) throw new ApiError(503, '分片暂存读取失败，请重试。');
        checkSignature(new Uint8Array(await prefix.arrayBuffer()), upload.name);
      }
      const receipt = await bucket.get(receiptKey(id, number));
      if (receipt) { const saved = await receipt.json<{ sha256: string }>(); if (saved.sha256 !== claimed) throw new ApiError(409, '分片已存在且内容不同。'); return json(saved); }
      const bytes = await bucket.get(stagedKey);
      if (!bytes) throw new ApiError(503, '分片暂存读取失败，请重试。');
      const part = await multipart.uploadPart(number, bytes.body);
      const saved = { ...part, size: expectedSize, sha256: claimed };
      await putJson(bucket, receiptKey(id, number), saved);
      return json(saved);
    } finally {
      try { await bucket.delete(stagedKey); }
      catch { console.warn(JSON.stringify({ operation: 'part-stage-cleanup-pending', uploadId: id, partNumber: number })); }
    }
  }
  if (segments[1] === 'complete' && request.method === 'POST' && segments.length === 2) {
    const input = await readJson(request, 1024) as { sha256?: string };
    if (!input.sha256 || !/^[a-f0-9]{64}$/.test(input.sha256)) throw new ApiError(422, '缺少完整 SHA-256 校验值。');
    if (upload.status === 'complete') {
      if (input.sha256 !== upload.asset?.sha256) throw new ApiError(409, '完整校验值与已完成文件不同。');
      return json({ asset: upload.asset });
    }
    if (upload.status === 'cancelled') throw new ApiError(409, '上传已取消。');
    if (upload.sha256 && input.sha256 !== upload.sha256) throw new ApiError(409, '校验值与已开始的完成操作不同。');
    const parts: R2UploadedPart[] = [];
    for (let n = 1; n <= Math.ceil(upload.size / PART_SIZE); n++) {
      const receipt = await bucket.get(receiptKey(id, n)); if (!receipt) throw new ApiError(422, '尚有分片未上传。');
      parts.push(await receipt.json<R2UploadedPart>());
    }
    const lock = await putJson(bucket, sessionKey(id), { ...upload, status: 'verifying', sha256: input.sha256 }, object.httpEtag);
    try {
      if (!await bucket.head(upload.key)) await multipart.complete(parts);
      const source = await bucket.get(upload.key);
      if (!source || source.size !== upload.size) throw new ApiError(422, 'R2 对象大小不匹配。');
      const verifiedKey = `uploads/verified/${id}/${upload.name}`;
      let verified = await bucket.head(verifiedKey);
      if (!verified) verified = await bucket.put(verifiedKey, source.body, { onlyIf: { etagDoesNotMatch: '*' }, sha256: input.sha256,
        httpMetadata: { contentType: upload.mime, cacheControl: 'no-store' },
        customMetadata: { workId: upload.workId, versionId: upload.versionId ?? '', kind: upload.kind, sha256: input.sha256, assetId: id } });
      if (!verified || verified.size !== upload.size || verified.customMetadata?.sha256 !== input.sha256) throw new ApiError(422, '文件完整性验证失败。');
      const asset: Asset = { id, name: upload.name, ...(upload.displayName?{displayName:upload.displayName}:{}), size: upload.size, mime: upload.mime, sha256: input.sha256, privateKey: verifiedKey };
      await putJson(bucket, sessionKey(id), { ...upload, status: 'complete', asset }, lock.httpEtag);
      await bucket.delete(`uploads/active/${id}.json`);
      return json({ asset });
    } catch (error) {
      // Retain verifying state for retry; never report an unverified upload as complete.
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, 'R2 完整校验未通过或暂时失败，请重试完成操作。');
    }
  }
  throw new ApiError(405, '此上传操作不支持该方法。');
}
function checkSignature(bytes: Uint8Array, name: string) {
  const ext = name.split('.').pop()!.toLowerCase();
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && [3, 5, 7].includes(bytes[2]);
  const ok = ext === 'png' ? [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b) :
    ['jpg', 'jpeg'].includes(ext) ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    ext === 'webp' ? new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP' :
    ext === 'exe' ? bytes[0] === 77 && bytes[1] === 90 : zip;
  if (!ok) throw new ApiError(422, '文件实际格式与扩展名不一致。');
}
