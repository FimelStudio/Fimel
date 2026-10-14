export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function json(value: unknown, status = 200, etag?: string): Response {
  // CDN compression may weaken/remove HTTP ETag. Keep the opaque storage revision in JSON.
  const payload = etag && value && typeof value === 'object' && !Array.isArray(value) ? { ...value, etag } : value;
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store', ...(etag ? { ETag: etag } : {}) } });
}
export async function readJson(request: Pick<Request, 'headers' | 'body'>, limit = 4_000_000): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, '需要 JSON 请求。');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(422, '缺少请求正文。');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new ApiError(413, '请求过大。'); } chunks.push(next.value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError(422, 'JSON 格式错误。'); }
}
export function expectMatch(request: Request, etag: string, header = 'if-match'): void {
  const match = request.headers.get(header);
  if (!match) throw new ApiError(428, '缺少版本条件，请重新加载。');
  if (match !== etag) throw new ApiError(409, '内容已被其他窗口修改，请导出当前修改后重新加载。');
}
export const EMPTY_ETAG = '"empty"';
export async function putJson(bucket: R2Bucket, key: string, value: unknown, etag?: string): Promise<R2Object> {
  const result = await bucket.put(key, JSON.stringify(value), {
    onlyIf: etag && etag !== EMPTY_ETAG ? { etagMatches: etag.replaceAll('"', '') } : { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
  if (!result) throw new ApiError(409, '对象版本冲突，未覆盖现有数据。');
  return result;
}
