export class RequestError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) { super(message); this.status = status; this.details = details; }
}
export async function api<T>(path: string, options: RequestInit = {}, timeoutMs = 60_000): Promise<{ data: T; etag: string }> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort(); else options.signal?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  // Bound the entire response, including a body that stalls after HTTP headers.
  // Aborting alone is insufficient when a transport never settles its promise.
  const cancelled = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    if (controller.signal.aborted) reject(controller.signal.reason);
    timer = setTimeout(() => controller.abort(new RequestError(0, '请求等待超时，当前修改已保留，请稍后重试。', { kind: 'timeout' })), timeoutMs);
  });
  try { return await Promise.race([perform(), cancelled]); }
  catch (cause) {
    if (cause instanceof RequestError || controller.signal.aborted) throw cause;
    throw new RequestError(0, '网络连接中断，当前修改已保留，请检查网络后重试。', { kind: 'network' });
  } finally { clearTimeout(timer!); options.signal?.removeEventListener('abort', abort); }
  async function perform(): Promise<{ data: T; etag: string }> {
    if (controller.signal.aborted) throw controller.signal.reason;
    const response = await fetch(`/api/${path}`, { ...options, signal: controller.signal, credentials: 'same-origin', headers: {
      'Content-Type': 'application/json', 'X-Fimel-CSRF': '1', ...options.headers,
    } });
    let data: unknown;
    try { data = await response.json(); } catch (cause) {
      if (controller.signal.aborted) throw controller.signal.reason;
      if (cause instanceof TypeError) throw cause;
      const signIn = [401, 403].includes(response.status) || response.redirected && new URL(response.url).hostname.endsWith('.cloudflareaccess.com');
      throw new RequestError(response.status, signIn ? '管理会话已失效，请重新登录；当前修改已保留。' : response.status >= 500 ? `服务器暂时无法处理请求（HTTP ${response.status}），当前修改已保留，请稍后重试。` : '服务器返回了无法识别的响应，当前修改已保留，请稍后重试。', { requestId: response.headers.get('X-Fimel-Request-Id') ?? response.headers.get('cf-ray') });
    }
    if (!response.ok) throw new RequestError(response.status, data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : '请求失败。', data);
    const revision = data && typeof data === 'object' && 'etag' in data && typeof data.etag === 'string' ? data.etag : response.headers.get('etag')?.replace(/^W\//, '') ?? '';
    return { data: data as T, etag: revision };
  }
}
