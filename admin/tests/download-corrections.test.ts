import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork } from '../shared/model';
import type { Library, PublicManifest, Work } from '../shared/model';
import type { AuditEvent } from '../shared/audit';
import { DOWNLOAD_CORRECTIONS_KEY } from '../../src/content/download-corrections';
import type { DownloadCorrectionState, DownloadCorrections } from '../../src/content/download-corrections';
import { workEventKey } from '../../src/content/work-events';
import { readWorkDownloadTotals } from '../../src/lib/work-downloads';

let runtime: Miniflare;
const origin = 'http://127.0.0.1:5174';
const today = new Date().toISOString().slice(0, 10);
let works: Record<'public' | 'second' | 'private' | 'bedrock' | 'archived' | 'mismatch', Work>;
let original: { library: string; manifest: string; day: string; oldDay: string };
const oldDate = '2020-01-01';

before(async () => {
  const bundle = await build({ stdin: { contents: `import local from './admin/worker/local';
    import {collectWorkEvent} from './src/lib/work-event-worker';
    export default{fetch(request,env,ctx){
      if(new URL(request.url).pathname==='/__collect')return collectWorkEvent(request,env.PUBLIC,env.METRICS_LIMITER);
      const fail=request.headers.get('x-test-audit-fail');
      const privateBucket=fail?new Proxy(env.PRIVATE,{get(bucket,key){
        if(key==='put')return (name,value,options)=>{
          if(name.startsWith('audit/')&&(fail==='prepare'||fail==='finish'&&options?.onlyIf?.etagMatches))throw Error('Injected audit storage failure');
          return bucket.put(name,value,options);
        };
        const value=Reflect.get(bucket,key);return typeof value==='function'?value.bind(bucket):value;
      }}):env.PRIVATE;
      const publicBucket=request.headers.get('x-test-correction-anchor-race')==='1'?new Proxy(env.PUBLIC,{get(bucket,key){
        if(key==='put')return async(name,value,options)=>{
          if(name==='metrics/download-corrections.json'){
            // Insert the competing writer's real conditional R2 commit before
            // this request's CAS. It observed one fewer click with the same
            // operation ID, so the losing request must audit the actual winner.
            const winner=JSON.parse(value);for(const correction of Object.values(winner.works))correction.anchorClicks--;
            await bucket.put(name,JSON.stringify(winner),options);
          }
          return bucket.put(name,value,options);
        };
        const value=Reflect.get(bucket,key);return typeof value==='function'?value.bind(bucket):value;
      }}):env.PUBLIC;
      return local.fetch(request,{...env,PRIVATE:privateBucket,PUBLIC:publicBucket},ctx);
    }}`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-12', r2Buckets: ['PRIVATE', 'PUBLIC'], bindings: { ADMIN_ORIGIN: origin, ACCESS_AUD: 'local-test', ACCESS_ISSUER: 'https://local.invalid', ADMIN_EMAILS: 'local-admin@example.invalid' }, ratelimits: { METRICS_LIMITER: { namespace_id: '12009', simple: { limit: 45, period: 60 } } } }));
  await runtime.ready;
});
after(async () => { await runtime?.dispose(); });

const request = (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => runtime.dispatchFetch(`http://127.0.0.1/api/${path}`, { method, headers: { Origin: origin, 'X-Fimel-CSRF': '1', 'Content-Type': 'application/json', Connection: 'close', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const correction = (key: keyof typeof works = 'public') => `download-corrections/${works[key].id}`;
async function getState(key: keyof typeof works = 'public') { const response = await request(correction(key)); assert.equal(response.status, 200, await response.clone().text()); return response.json() as Promise<DownloadCorrectionState>; }
async function storedRegistry() { const stored = await (await runtime.getR2Bucket('PUBLIC')).get(DOWNLOAD_CORRECTIONS_KEY); return stored ? stored.json() as Promise<DownloadCorrections> : null; }
const write = (value: number, etag: string, operationId = crypto.randomUUID(), key: keyof typeof works = 'public', reason?: string) => request(correction(key), 'PUT', { value, operationId, ...(reason ? { reason } : {}) }, { 'If-Match': etag });
type CorrectionAuditEvent = AuditEvent & {downloadCorrectionRequest?:{value:number;operationId:string;reason?:string}};
async function events(): Promise<CorrectionAuditEvent[]> { const bucket = await runtime.getR2Bucket('PRIVATE'); return Promise.all((await bucket.list({ prefix: 'audit/' })).objects.map(async object => (await (await bucket.get(object.key))!.json()) as CorrectionAuditEvent)); }

beforeEach(async () => {
  const privateBucket = await runtime.getR2Bucket('PRIVATE'), publicBucket = await runtime.getR2Bucket('PUBLIC');
  for (const bucket of [privateBucket, publicBucket]) { const listed = await bucket.list(); if (listed.objects.length) await bucket.delete(listed.objects.map(object => object.key)); }
  const fixture = (slug: string, type: Work['project']['type'] = 'datapacks') => {
    const work = makeWork(); work.project.type = type; work.project.slug = slug; work.project.title = { zh: `作品 ${slug}` }; work.project.status = 'released'; work.project.download = `https://example.invalid/${slug}.zip`; work.markdown.description.zh = '# 测试作品'; return work;
  };
  works = { public: fixture('correct-public'), second: fixture('correct-second'), private: fixture('correct-private'), bedrock: fixture('correct-bedrock', 'bedrock'), archived: fixture('correct-archived'), mismatch: fixture('correct-mismatch', 'tools') };
  works.archived.workflow = 'archived';
  const library: Library = { schemaVersion: 1, works: Object.values(works) };
  const manifest: PublicManifest = { schemaVersion: 2, publicationId: crypto.randomUUID(), projects: Object.entries(works).filter(([name]) => name !== 'private').map(([name, work]) => ({ ...work.project, ...(name === 'mismatch' ? { type: 'mods' as const } : {}) })), releases: {} };
  original = { library: JSON.stringify(library), manifest: JSON.stringify(manifest), day: JSON.stringify({ date: today, works: { [works.public.project.slug]: { views: 9, downloadClicks: 7 }, [works.second.project.slug]: { views: 1, downloadClicks: 0 } } }), oldDay: JSON.stringify({ date: oldDate, works: { [works.public.project.slug]: { views: 80, downloadClicks: 999 } } }) };
  await privateBucket.put('state/library.json', original.library);
  await publicBucket.put('data/works.json', original.manifest);
  await publicBucket.put(workEventKey(today), original.day);
  await publicBucket.put(workEventKey(oldDate), original.oldDay);
});

test('认证和CSRF保护沿用Admin入口，未保存/未公开/基岩/归档/类型不一致作品明确拒绝', async () => {
  for (const path of [correction(), 'work-downloads']) assert.equal((await request(path, 'GET', undefined, { 'x-local-test-anonymous': '1' })).status, 401);
  const input = { value: 100, operationId: crypto.randomUUID() };
  assert.equal((await request(correction(), 'PUT', input, { Origin: 'https://evil.invalid', 'If-Match': '"empty"' })).status, 403);
  assert.equal((await request(correction(), 'PUT', input, { 'X-Fimel-CSRF': '', 'If-Match': '"empty"' })).status, 403);
  for (const [key, status, message] of [['private', 422, /尚未公开/], ['bedrock', 422, /平台历史下载量/], ['archived', 422, /归档/], ['mismatch', 409, /分类/]] as const) {
    const response = await request(correction(key)); assert.equal(response.status, status); assert.match(await response.text(), message);
    assert.equal((await write(100, '"empty"', crypto.randomUUID(), key)).status, status);
  }
  assert.equal((await request('download-corrections/not-saved')).status, 404);
  assert.equal((await request(correction(), 'DELETE')).status, 405);
  assert.equal(await storedRegistry(), null);
});

test('只接受目标非负安全整数和合法UUID/原因/条件，错误不写registry且记录失败日志', async () => {
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '100', null, true]) {
    const response = await request(correction(), 'PUT', { value, operationId: crypto.randomUUID() }, { 'If-Match': '"empty"' }); assert.equal(response.status, 422);
  }
  for (const body of [{ value: 1, operationId: 'bad' }, { value: 1, operationId: crypto.randomUUID(), reason: '长'.repeat(201) }, { value: 1, operationId: crypto.randomUUID(), oldCount: 5 }]) assert.equal((await request(correction(), 'PUT', body, { 'If-Match': '"empty"' })).status, 422);
  assert.equal((await request(correction(), 'PUT', { value: 1, operationId: crypto.randomUUID(), reason: 'x'.repeat(4096) }, { 'If-Match': '"empty"' })).status, 413);
  assert.equal((await request(correction(), 'PUT', { value: 1, operationId: crypto.randomUUID() })).status, 428);
  assert.equal((await write(1, '"old"')).status, 409);
  assert.equal(await storedRegistry(), null);
  const audit = await events(); assert.ok(audit.length >= 11); assert.ok(audit.every(event => event.operation === 'calibrate-downloads' && event.status === 'failed'));
});

test('校正保存当前UTC日锚点且完整审计，作品/公开目录/原日统计逐字不变，原因只留PRIVATE', async () => {
  const initial = await getState(); assert.equal(initial.etag, '"empty"'); assert.equal(initial.correction, null);
  const operationId = crypto.randomUUID(), reason = '修正迁移时遗漏的历史次数';
  const response = await write(1200, initial.etag, operationId, 'public', reason); assert.equal(response.status, 200, await response.clone().text());
  const state = await response.json() as DownloadCorrectionState;
  assert.equal(state.workId, works.public.id); assert.equal(state.slug, works.public.project.slug); assert.equal(state.etag, response.headers.get('etag'));
  assert.equal(state.correction?.value, 1200); assert.equal(state.correction?.anchorClicks, 7); assert.equal(state.correction?.date, today); assert.equal(state.correction?.operationId, operationId); assert.ok(Number.isFinite(Date.parse(state.correction!.updatedAt)));
  const publicBucket = await runtime.getR2Bucket('PUBLIC'), privateBucket = await runtime.getR2Bucket('PRIVATE');
  assert.equal(await (await privateBucket.get('state/library.json'))!.text(), original.library);
  assert.equal(await (await publicBucket.get('data/works.json'))!.text(), original.manifest);
  assert.equal(await (await publicBucket.get(workEventKey(today)))!.text(), original.day);
  assert.equal(await (await publicBucket.get(workEventKey(oldDate)))!.text(), original.oldDay);
  const raw = await (await publicBucket.get(DOWNLOAD_CORRECTIONS_KEY))!.text(); assert.ok(!raw.includes(reason)); assert.ok(!raw.includes('@')); assert.ok(!raw.includes('actor'));
  const event = (await events()).find(item => item.operation === 'calibrate-downloads')!; assert.equal(event.status, 'success'); assert.equal(event.workId, works.public.id); assert.equal(event.changes[0].slug, works.public.project.slug);
  assert.deepEqual(event.changes[0].fields.find(field => field.name === '校正基数'), { name: '校正基数', before: '未设置', after: '1200' });
  assert.equal(event.changes[0].fields.find(field => field.name === '当日原始点击锚点')?.after, '7'); assert.equal(event.changes[0].fields.find(field => field.name === '校正原因')?.after, reason);
  const second = await write(1300, state.etag); assert.equal(second.status, 200);
  assert.ok((await events()).some(item => item.changes.some(change => change.fields.some(field => field.name === '校正基数' && field.before === '1200' && field.after === '1300'))));
});

test('过期ETag重试同一操作不重新锚定，同id不同值拒绝，全局registry并发CAS保留赢家', async () => {
  const initial = await getState(), operationId = crypto.randomUUID();
  const attempts = await Promise.all([write(100, initial.etag, operationId), write(100, initial.etag, operationId)]);
  assert.deepEqual(attempts.map(response => response.status), [200, 200]);
  const first = await getState();
  const publicBucket = await runtime.getR2Bucket('PUBLIC');
  await publicBucket.put(workEventKey(today), JSON.stringify({ date: today, works: { [works.public.project.slug]: { views: 10, downloadClicks: 8 } } }));
  const retry = await write(100, initial.etag, operationId); assert.equal(retry.status, 200); assert.deepEqual((await retry.json() as DownloadCorrectionState).correction, first.correction);
  assert.equal((await write(101, first.etag, operationId)).status, 409);
  assert.equal((await write(100, initial.etag)).status, 409);
  const results = await Promise.all([write(200, first.etag), write(300, first.etag, crypto.randomUUID(), 'second')]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  const registry = (await storedRegistry())!; assert.equal(Object.keys(registry.works).length, results[0].status === 200 ? 1 : 2);
  assert.equal((await events()).filter(event => event.status === 'failed').length, 3);
  // Deterministic CAS interleaving with different anchors for identical UUIDs.
  await publicBucket.delete(DOWNLOAD_CORRECTIONS_KEY);
  const raceId = crypto.randomUUID();
  const race = await request(correction(), 'PUT', { value: 400, operationId: raceId }, { 'If-Match': '"empty"', 'x-test-correction-anchor-race': '1' });
  assert.equal(race.status, 200, await race.clone().text());
  const actual = (await race.json() as DownloadCorrectionState).correction!;
  assert.equal(actual.anchorClicks, 7); // The losing candidate had read 8.
  assert.deepEqual((await storedRegistry())!.works[works.public.project.slug], actual);
  const raceAudit = (await events()).find(event => event.downloadCorrectionRequest?.operationId === raceId)!;
  assert.equal(raceAudit.status, 'success');
  assert.equal(raceAudit.changes[0].fields.find(field => field.name === '当日原始点击锚点')?.after, String(actual.anchorClicks));
  const retried = await write(400, '"empty"', raceId); assert.equal(retried.status, 200);
  const retryAudit = (await events()).filter(event => event.downloadCorrectionRequest?.operationId === raceId);
  assert.equal(retryAudit.length, 2); assert.ok(retryAudit.every(event => event.changes[0].fields.find(field => field.name === '当日原始点击锚点')?.after === String(actual.anchorClicks)));
});

test('完整历史认证读取不依赖分析Token，校正替代旧历史且新真实点击继续累计，缺日记录锚点为0', async () => {
  const totals = () => readWorkDownloadTotals('http://127.0.0.1/api/work-downloads', async input => { const response = await request(new URL(input).pathname.slice('/api/'.length) + new URL(input).search); return { ok: response.ok, json: () => response.json() }; });
  assert.equal((await totals()).works[works.public.project.slug].downloadClicks, 1006);
  assert.equal((await write(20, (await getState()).etag)).status, 200);
  assert.equal((await totals()).works[works.public.project.slug].downloadClicks, 20);
  const event = await runtime.dispatchFetch('http://127.0.0.1/__collect', { method: 'POST', headers: { Origin: 'https://studiofimel.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: works.public.project.slug, kind: 'download' }) }); assert.equal(event.status, 204);
  assert.equal((await totals()).works[works.public.project.slug].downloadClicks, 21);
  const registry = (await storedRegistry())!; assert.equal(registry.works[works.public.project.slug].anchorClicks, 7);
  assert.equal(await (await (await runtime.getR2Bucket('PUBLIC')).get(workEventKey(oldDate)))!.text(), original.oldDay);
  await (await runtime.getR2Bucket('PUBLIC')).delete(workEventKey(today));
  const second = await write(0, (await getState('second')).etag, crypto.randomUUID(), 'second'); assert.equal(second.status, 200);
  assert.equal((await second.json() as DownloadCorrectionState).correction?.anchorClicks, 0);
});

test('损坏/超大日记录和registry失败关闭，保留之前校正并不覆盖原文件', async () => {
  const bucket = await runtime.getR2Bucket('PUBLIC');
  const initial = await getState();
  for (const raw of ['broken', JSON.stringify({ date: '2000-01-01', works: {} }), JSON.stringify({ date: today, works: { [works.public.project.slug]: { views: 0, downloadClicks: -1 } } }), ' '.repeat(1024 * 1024 + 1)]) {
    await bucket.put(workEventKey(today), raw); assert.equal((await write(10, initial.etag)).status, 503); assert.equal(await storedRegistry(), null); assert.equal(await (await bucket.get(workEventKey(today)))!.text(), raw);
  }
  await bucket.put(workEventKey(today), original.day);
  for (const raw of ['broken', JSON.stringify({ schemaVersion: 1, works: { [works.public.project.slug]: { value: -1, date: today, anchorClicks: 0, updatedAt: new Date().toISOString(), operationId: crypto.randomUUID() } } }), ' '.repeat(1024 * 1024 + 1)]) {
    await bucket.put(DOWNLOAD_CORRECTIONS_KEY, raw); assert.equal((await request(correction())).status, 503); assert.equal((await write(10, initial.etag)).status, 503); assert.equal(await (await bucket.get(DOWNLOAD_CORRECTIONS_KEY))!.text(), raw);
  }
});

test('校正registry达到1000项时拒绝新增，不覆盖其他作品或绕过同一操作编号的作用域', async () => {
  const state = await getState(), operationId = crypto.randomUUID();
  assert.equal((await write(5, state.etag, operationId)).status, 200);
  assert.equal((await write(5, (await getState('second')).etag, operationId, 'second')).status, 409);
  const now = new Date().toISOString();
  const full: DownloadCorrections = { schemaVersion: 1, works: Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`old-work-${index}`, { value: index, date: today, anchorClicks: 0, updatedAt: now, operationId: crypto.randomUUID() }])) };
  const raw = JSON.stringify(full), bucket = await runtime.getR2Bucket('PUBLIC');
  await bucket.put(DOWNLOAD_CORRECTIONS_KEY, raw);
  const latest = await getState(); assert.equal(latest.correction, null);
  assert.equal((await write(5, latest.etag)).status, 422);
  assert.equal(await (await bucket.get(DOWNLOAD_CORRECTIONS_KEY))!.text(), raw);
});

test('审计准备失败阻止校正，完成日志失败返回pending且准备记录保留目标，重试不重新锚定', async () => {
  const initial = await getState(), operationId = crypto.randomUUID(), input = { value: 88, operationId, reason: '故障恢复验收' };
  const failed = await request(correction(), 'PUT', input, { 'If-Match': initial.etag, 'x-test-audit-fail': 'prepare' });
  assert.equal(failed.status, 503); assert.equal(await storedRegistry(), null); assert.equal((await events()).length, 0);
  const pending = await request(correction(), 'PUT', input, { 'If-Match': initial.etag, 'x-test-audit-fail': 'finish' });
  assert.equal(pending.status, 200, await pending.clone().text()); assert.equal(pending.headers.get('X-Fimel-Audit-Pending'), '1');
  const saved = await pending.json() as DownloadCorrectionState;
  assert.equal(saved.correction?.value, 88); assert.equal(saved.correction?.anchorClicks, 7);
  const prepared = (await events())[0]; assert.equal(prepared.status, 'prepared'); assert.deepEqual(prepared.downloadCorrectionRequest, input);
  const click = await runtime.dispatchFetch('http://127.0.0.1/__collect', { method: 'POST', headers: { Origin: 'https://studiofimel.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: works.public.project.slug, kind: 'download' }) }); assert.equal(click.status, 204);
  const retry = await request(correction(), 'PUT', input, { 'If-Match': initial.etag }); assert.equal(retry.status, 200); assert.equal(retry.headers.get('X-Fimel-Audit-Pending'), null);
  assert.deepEqual((await retry.json() as DownloadCorrectionState).correction, saved.correction);
  assert.ok((await events()).some(event => event.status === 'success'));
});
