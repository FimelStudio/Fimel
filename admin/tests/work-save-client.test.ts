import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWork } from '../shared/model';
import type { Work } from '../shared/model';
import { savedChangesPresent, saveWorkDraft, SaveUnconfirmed } from '../src/work-save';
import { RequestError, api } from '../src/api';

const base = makeWork(); base.project.slug = 'save-network-test'; base.markdown.description.zh = '原始正文';
const incoming: Work = { ...structuredClone(base), markdown: { ...base.markdown, description: { zh: '修改后的正文' } } };
const snapshot = (work: Work) => ({ library: { schemaVersion: 1, works: [work] }, public: { schemaVersion: 2, publicationId: 'unchanged', projects: [], releases: {} }, publicEtag: 'public-before', etag: 'private-next' });

test('正常保存只提交一次，不增加核对请求', async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string) => { calls.push(path); return Response.json(snapshot(incoming)); });
  const phases: string[] = [];
  assert.equal((await saveWorkDraft(base, incoming, value => phases.push(value))).etag, 'private-next');
  assert.deepEqual(calls, [`/api/works/${incoming.id}`]); assert.deepEqual(phases, ['saving']);
});

test('保存已提交但响应丢失时只读核对，忽略服务端时间戳，不重复写入', async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string) => {
    calls.push(path); if (path !== '/api/library') throw new TypeError('Failed to fetch');
    return Response.json(snapshot({ ...incoming, updatedAt: '2026-11-19T16:00:00.000Z' }));
  });
  const phases: string[] = [];
  await saveWorkDraft(base, incoming, value => phases.push(value));
  assert.deepEqual(calls, [`/api/works/${incoming.id}`, '/api/library']); assert.deepEqual(phases, ['saving', 'checking']);
});

test('保存及核对均悬挂且忽略 abort 时 45 秒内恢复，不会无限等待', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let checking!: () => void; const checked = new Promise<void>(resolve => { checking = resolve; });
  t.mock.method(globalThis, 'fetch', (path: string) => { if (path === '/api/library') checking(); return new Promise<Response>(() => {}); });
  const pending = saveWorkDraft(base, incoming, () => {});
  const rejection = assert.rejects(pending, error => error instanceof SaveUnconfirmed && /当前编辑已保留/.test(error.message));
  t.mock.timers.tick(30_000); await checked; t.mock.timers.tick(15_000); await rejection;
});

test('HTTP 响应头到达但 JSON 正文悬挂仍受时间上限约束', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } }), { headers: { 'Content-Type': 'application/json' } }));
  const pending = api('library', {}, 100);
  const rejection = assert.rejects(pending, error => error instanceof RequestError && error.status === 0 && /超时/.test(error.message));
  await Promise.resolve(); t.mock.timers.tick(100); await rejection;
});

test('明确登录、校验和并发冲突保留服务端错误，不误报成功', async t => {
  for (const status of [401, 403, 409, 422]) {
    let calls = 0; const mocked = t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: `明确拒绝 ${status}` }, { status }); });
    await assert.rejects(saveWorkDraft(base, incoming, () => {}), error => error instanceof RequestError && error.status === status && error.message === `明确拒绝 ${status}`);
    assert.equal(calls, 1); mocked.mock.restore();
  }
});

test('未保存或内容已被后续覆盖时不把旧草稿误报为成功', async t => {
  for (const current of [base, { ...incoming, markdown: { ...incoming.markdown, description: { zh: '另一个管理员的后续修改' } } }]) {
    const mocked = t.mock.method(globalThis, 'fetch', async (path: string) => {
      if (path !== '/api/library') throw new TypeError('network'); return Response.json(snapshot(current));
    });
    await assert.rejects(saveWorkDraft(base, incoming, () => {}), SaveUnconfirmed); mocked.mock.restore();
  }
});

test('核对接受三方合并的独立修改，拒绝同字段冲突、旧正文及缺失作品', () => {
  const merged = { ...incoming, project: { ...incoming.project, summary: '其他管理员的独立介绍' } };
  assert.equal(savedChangesPresent(base, incoming, merged), true);
  assert.equal(savedChangesPresent(null, incoming, { ...incoming, updatedAt: base.createdAt }), true);
  assert.equal(savedChangesPresent(null, incoming, merged), false);
  assert.equal(savedChangesPresent(base, incoming, base), false);
  assert.equal(savedChangesPresent(base, incoming, undefined), false);
  assert.equal(savedChangesPresent(base, incoming, { ...merged, markdown: { ...incoming.markdown, description: { zh: '同字段冲突' } } }), false);
});

test('调用者取消立即结束请求，保留取消原因', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(() => {}));
  const pending = api('library', { signal: controller.signal });
  const rejected = assert.rejects(pending, error => error instanceof DOMException && error.name === 'AbortError');
  controller.abort(); await rejected;
});
