import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { DEFAULT_SITE_CONTENT, parseSiteContent, siteContentErrors } from '../../src/content/site-content';
import type { SiteContent } from '../../src/content/site-content';
import { makeWork } from '../shared/model';
import type { PublicManifest } from '../shared/model';
import { sitePublicationIssues } from '../shared/featured';

function site(): SiteContent {
  return { ...structuredClone(DEFAULT_SITE_CONTENT), featured: { maps: [], released: [], development: [] }, studio: { title: { zh: '保留的工作室标题', en: 'Retained title' }, description: '现有介绍' } };
}

test('旧版网站内容保持 schemaVersion 1，首页新增字段可选并保留三语与空值回退', () => {
  const legacy = site();
  assert.deepEqual(siteContentErrors(legacy), []);
  assert.deepEqual(parseSiteContent({ site: legacy }), legacy);
  assert.equal(Object.hasOwn(parseSiteContent({ site: legacy })!, 'home'), false);
  const extended: SiteContent = { ...legacy, home: { quickTitle: { zh: '精选入口', en: 'Quick picks', ja: 'おすすめ' }, spotlights: {
    maps: { workSlug: 'private-java-map', label: { zh: '', en: 'Maps' }, title: { zh: '推荐标题' }, summary: { zh: '推荐介绍', en: 'Summary' } },
    mods: {}, tools: { label: '', title: '', summary: '' },
  } } };
  assert.deepEqual(siteContentErrors(extended), []);
  assert.deepEqual(parseSiteContent({ site: extended }), extended);
  assert.deepEqual(siteContentErrors({ ...legacy, home: {} }), []);
  assert.deepEqual(siteContentErrors({ ...legacy, home: { quickTitle: '', spotlights: {} } }), []);
});

test('首页字段拒绝未知键、越界文本与危险作品路径，私有作品只在发布前阻止', () => {
  const legacy = site();
  for (const home of [null, [], { unknown: true }, { quickTitle: { fr: 'bad' } }, { quickTitle: 'x'.repeat(3001) }, { spotlights: { games: {} } }, { spotlights: { maps: null } }, { spotlights: { maps: { unknown: true } } }, { spotlights: { maps: { workSlug: '../escape' } } }, { spotlights: { maps: { title: { en: 123 } } } }]) {
    assert.ok(siteContentErrors({ ...legacy, home }).length, JSON.stringify(home));
  }
  const draft: SiteContent = { ...legacy, home: { spotlights: { maps: { workSlug: 'private-java-map' } } } };
  assert.deepEqual(siteContentErrors(draft), []);
  assert.match(sitePublicationIssues(draft, []).join('\n'), /首页快速推荐“地图推荐卡”.*尚未公开：private-java-map/);
  const project = { ...makeWork().project, slug: 'private-java-map', type: 'java' as const };
  assert.deepEqual(sitePublicationIssues(draft, [project]), []);
});

let mf: Miniflare;
before(async () => {
  const bundle = await build({ entryPoints: ['admin/worker/local.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-12', r2Buckets: ['PRIVATE', 'PUBLIC'], bindings: {
    ADMIN_ORIGIN: 'http://127.0.0.1:5174', ACCESS_AUD: 'local-test', ACCESS_ISSUER: 'https://local.invalid', ADMIN_EMAILS: 'local-admin@example.invalid',
  } }));
  await mf.ready;
});
after(async () => { await mf?.dispose(); });
const request = (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => mf.dispatchFetch(`http://127.0.0.1/api/${path}`, {
  method, headers: { Origin: 'http://127.0.0.1:5174', 'X-Fimel-CSRF': '1', 'Content-Type': 'application/json', Connection: 'close', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
async function state() {
  const response = await request('site'); assert.equal(response.status, 200);
  return await response.json() as { site: SiteContent; published: SiteContent | null; etag: string; publicEtag: string };
}
async function save(content: SiteContent) {
  const current = await state();
  const response = await request('site', 'PUT', { site: content }, { 'If-Match': current.etag });
  assert.equal(response.status, 200, await response.text());
  return state();
}
async function publish() {
  const current = await state();
  return request('site/publish', 'POST', {}, { 'If-Match': current.etag, 'X-Public-ETag': current.publicEtag });
}

test('真实本地 Worker 保存与发布兼容旧网站内容，新增首页关联保持草稿和公开隔离', async () => {
  assert.equal((await state()).site.home, undefined);
  const legacy = site();
  await save(legacy);
  const first = await publish(); assert.equal(first.status, 200, await first.text());
  const old = await state(); assert.deepEqual(old.published, legacy); assert.equal(Object.hasOwn(old.site, 'home'), false);

  const draft: SiteContent = { ...legacy, home: { quickTitle: { zh: '新的首页标题', en: 'New home title', ja: '新しいタイトル' }, spotlights: {
    maps: { workSlug: 'new-java-map', label: { zh: 'Java 地图' }, title: { zh: '卡片标题' }, summary: { zh: '卡片介绍' } },
  } } };
  const saved = await save(draft);
  assert.deepEqual(saved.site.home, draft.home); assert.deepEqual(saved.published, legacy);
  const rejected = await publish(); assert.equal(rejected.status, 422); assert.match(await rejected.text(), /地图推荐卡.*尚未公开：new-java-map/);
  assert.equal((await state()).publicEtag, old.publicEtag);

  const bucket = await mf.getR2Bucket('PUBLIC');
  const manifest = await (await bucket.get('data/works.json'))!.json() as PublicManifest;
  const project = { ...makeWork().project, slug: 'new-java-map', title: '新的 Java 地图', type: 'java' as const, status: 'released' as const };
  manifest.projects.push(project); manifest.releases[project.slug] = [];
  await bucket.put('data/works.json', JSON.stringify(manifest));
  const withMap = { ...draft, featured: { ...draft.featured, maps: [project.slug] } };
  await save(withMap);
  const published = await publish(); assert.equal(published.status, 200, await published.text());
  const visible = await state();
  assert.deepEqual(visible.published, withMap);
  assert.deepEqual(visible.published!.studio, legacy.studio);
  assert.deepEqual(visible.published!.contact, legacy.contact);
  const publicManifest = await (await bucket.get('data/works.json'))!.json() as PublicManifest;
  assert.deepEqual(publicManifest.projects, manifest.projects); assert.deepEqual(publicManifest.releases, manifest.releases);
  assert.deepEqual(publicManifest.site?.home, draft.home);
});

test('真实本地 Worker 接受已发行 Java 精选地图，同时拒绝数据包错放并保留官网', async () => {
  const current = await state();
  const bucket = await mf.getR2Bucket('PUBLIC');
  const manifest = await (await bucket.get('data/works.json'))!.json() as PublicManifest;
  const datapack = { ...makeWork().project, slug: 'released-datapack', title: '数据包', type: 'datapacks' as const, status: 'released' as const };
  manifest.projects.push(datapack); manifest.releases[datapack.slug] = [];
  await bucket.put('data/works.json', JSON.stringify(manifest));
  const before = await state();
  await save({ ...current.site, featured: { ...current.site.featured, maps: [datapack.slug] } });
  const rejected = await publish(); assert.equal(rejected.status, 422);
  const message = await rejected.text(); assert.match(message, /分类不适合“精选地图”.*数据包/); assert.match(message, /基岩版与 Java 版地图/);
  const after = await state(); assert.equal(after.publicEtag, before.publicEtag); assert.deepEqual(after.published, before.published);
});
