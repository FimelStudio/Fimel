export class RequestError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) { super(message); this.status = status; this.details = details; }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<{ data: T; etag: string }> {
  const response = await fetch(`/api/${path}`, { ...options, credentials: 'same-origin', headers: {
    'Content-Type': 'application/json', 'X-Fimel-CSRF': '1', ...options.headers,
  } });
  let data: unknown;
  try { data = await response.json(); } catch {
    const signIn = [401, 403].includes(response.status) || response.redirected && new URL(response.url).hostname.endsWith('.cloudflareaccess.com');
    throw new RequestError(response.status, signIn ? '管理会话已失效，请重新登录；当前修改已保留。' : response.status >= 500 ? `服务器暂时无法处理请求（HTTP ${response.status}），当前修改已保留，请稍后重试。` : '服务器返回了无法识别的响应，当前修改已保留，请稍后重试。', { requestId: response.headers.get('cf-ray') });
  }
  if (!response.ok) throw new RequestError(response.status, data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : '请求失败。', data);
  const revision = data && typeof data === 'object' && 'etag' in data && typeof data.etag === 'string' ? data.etag : response.headers.get('etag')?.replace(/^W\//, '') ?? '';
  return { data: data as T, etag: revision };
}
