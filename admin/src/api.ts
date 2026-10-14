export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<{ data: T; etag: string }> {
  const response = await fetch(`/api/${path}`, { ...options, credentials: 'same-origin', headers: {
    'Content-Type': 'application/json', 'X-Fimel-CSRF': '1', ...options.headers,
  } });
  let data: unknown;
  try { data = await response.json(); } catch { throw new RequestError(response.status, '管理会话可能已失效，请重新登录。'); }
  if (!response.ok) throw new RequestError(response.status, data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : '请求失败。');
  const revision = data && typeof data === 'object' && 'etag' in data && typeof data.etag === 'string' ? data.etag : response.headers.get('etag')?.replace(/^W\//, '') ?? '';
  return { data: data as T, etag: revision };
}
