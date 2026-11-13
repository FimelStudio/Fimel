import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, RequestError } from '../src/api';

test('平台非JSON故障不误报登录失效，保留真实状态与请求编号', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [500, 502, 503, 504]) {
      globalThis.fetch = async () => new Response('<html>Worker exceeded resource limits</html>', { status, headers: { 'Content-Type': 'text/html', 'cf-ray': 'example-ray' } });
      await assert.rejects(api('docs/prepare'), error => error instanceof RequestError && error.status === status && !error.message.includes('登录') && error.message.includes(String(status)) && error.message.includes('修改已保留') && (error.details as { requestId: string }).requestId === 'example-ray');
    }
    for (const status of [401, 403]) {
      globalThis.fetch = async () => new Response('<html>Access sign-in</html>', { status });
      await assert.rejects(api('docs'), error => error instanceof RequestError && error.status === status && error.message.includes('重新登录'));
    }
    globalThis.fetch = async () => Response.json({ error: '内容已由其他窗口修改。' }, { status: 409 });
    await assert.rejects(api('docs'), error => error instanceof RequestError && error.status === 409 && error.message === '内容已由其他窗口修改。');
    globalThis.fetch = async () => new Response('<html>unexpected</html>');
    await assert.rejects(api('docs'), error => error instanceof RequestError && !error.message.includes('登录') && error.message.includes('无法识别'));
    globalThis.fetch = async () => Response.json({ etag: '"storage-version"', ok: true }, { headers: { ETag: 'W/"http-version"' } });
    assert.equal((await api('docs')).etag, '"storage-version"');
  } finally { globalThis.fetch = original; }
});
