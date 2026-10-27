import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { earliestReleaseDate, releaseProject } from '../../src/content/releases';
import type { DownloadRelease } from '../../src/content/releases';
import { makeWork, PUBLIC_ORIGIN } from '../shared/model';
import type { Library, PublicManifest, Release, Work } from '../shared/model';

function release(id: string, date: string, slug = 'date-test'): Release & DownloadRelease {
  return { id, label: id, date, status: 'released', gameVersions: [], changelog: '', files: [{
    id: `${id}-file`, name: `${id}.zip`, size: 4, mime: 'application/zip', sha256: 'a'.repeat(64),
    publicUrl: `${PUBLIC_ORIGIN}/works/bedrock/${slug}/${id}/${id}.zip`,
  }] };
}

test('首次发行日只取有文件的正式版本中最早真实日期，不依赖版本顺序', () => {
  const versions = [release('new', '2026-10-27'), release('old', '2026-10-26')];
  assert.equal(earliestReleaseDate(versions), '2026-10-26');
  assert.equal(earliestReleaseDate([...versions].reverse()), '2026-10-26');
  assert.equal(earliestReleaseDate([
    { ...release('private', '2020-01-01'), status: 'draft' },
    { ...release('empty', '2021-01-01'), files: [] },
    ...['2026-02-29', '2025-02-30', '2026-13-01', '2026-00-01', '2026-2-01', '0000-01-01', '2026-10-26T00:00:00Z'].map((date, n) => release(`invalid-${n}`, date)),
    release('leap', '2024-02-29'), ...versions,
  ]), '2024-02-29');
  assert.equal(earliestReleaseDate([{ ...release('private', '2020-01-01'), status: 'draft' }, { ...release('empty', '2021-01-01'), files: [] }]), undefined);
});

test('两篇已发行数据包缺失首发日时使用已知版本日，显式历史与未发行状态不变', () => {
  for (const [slug, dates, expected] of [
    ['fimel-card', ['2026-10-26', '2026-10-26', '2026-10-26', '2026-10-26'], '2026-10-26'],
    ['simple-replay-datapack', ['2026-10-27'], '2026-10-27'],
  ] as const) {
    const project = { ...makeWork().project, slug, status: 'released' as const };
    const versions = dates.map((date, n) => release(`version-${n}`, date, slug));
    assert.equal(releaseProject(project, versions).published, expected);
    assert.equal(project.published, undefined);
    assert.equal(releaseProject({ ...project, published: '2020-05-01' }, versions).published, '2020-05-01');
    for (const status of ['development', 'planned'] as const) assert.equal(releaseProject({ ...project, status }, versions).published, undefined);
    assert.equal(releaseProject({ ...project, updated: '2026-10-27' }, [], '2026-10-27').published, undefined);
  }
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
  const response = await request('library'); assert.equal(response.status, 200);
  return await response.json() as { library: Library; public: PublicManifest; etag: string; publicEtag: string };
}
async function save(base: Work | null, work: Work) {
  const response = await request(`works/${work.id}`, 'PUT', { base, work });
  assert.equal(response.status, 200, await response.text());
  return (await state()).library.works.find(item => item.id === work.id)!;
}
async function publish(work: Work) {
  const before = await state();
  const response = await request(`publish/${work.id}`, 'POST', {}, { 'If-Match': before.etag, 'X-Public-ETag': before.publicEtag });
  assert.equal(response.status, 200, await response.text());
  return (await state()).public.projects.find(project => project.slug === work.project.slug)!;
}
function work(slug: string) {
  const candidate = makeWork(); candidate.project.slug = slug; candidate.project.title = slug; candidate.project.status = 'released'; candidate.markdown.description.zh = '可核对的作品介绍。';
  return candidate;
}

test('重发移除最早版本仍保留旧公开首发日期，显式纠正优先且不修改私有草稿', async () => {
  const initial = work('republished-date');
  initial.versions = [release('later', '2026-10-27', initial.project.slug), release('first', '2026-10-26', initial.project.slug)];
  const saved = await save(null, initial);
  const bucket = await mf.getR2Bucket('PUBLIC');
  for (const version of initial.versions) for (const file of version.files) await bucket.put(new URL(file.publicUrl!).pathname.slice(1), 'test');
  const legacy: PublicManifest = { schemaVersion: 2, publicationId: 'legacy', projects: [initial.project], releases: { [initial.project.slug]: initial.versions }, publicationStates: {
    [initial.project.slug]: { fingerprint: 'legacy', publishedAt: '2026-10-27T20:00:00Z', savedAt: initial.updatedAt },
  } };
  await bucket.put('data/works.json', JSON.stringify(legacy));
  const withoutFirst = await save(saved, { ...saved, versions: [saved.versions[0]] });
  assert.equal((await publish(withoutFirst)).published, '2026-10-26');
  assert.equal((await state()).library.works.find(item => item.id === initial.id)!.project.published, undefined);
  const withoutVersions = await save(withoutFirst, { ...withoutFirst, versions: [] });
  assert.equal((await publish(withoutVersions)).published, '2026-10-26');
  const corrected = await save(withoutVersions, { ...withoutVersions, project: { ...withoutVersions.project, published: '2020-05-01' } });
  assert.equal((await publish(corrected)).published, '2020-05-01');
});

test('没有可靠首发来源的新作品和旧作品不会使用今天或最近发布时间补日期', async () => {
  for (const legacy of [false, true]) {
    const candidate = await save(null, work(legacy ? 'old-no-release-date' : 'new-no-release-date'));
    if (legacy) {
      const current = await state(); current.public.projects.push(candidate.project); current.public.releases[candidate.project.slug] = [];
      current.public.publicationStates ??= {};
      current.public.publicationStates[candidate.project.slug] = { fingerprint: 'legacy', publishedAt: '2024-01-01T00:00:00Z', savedAt: candidate.updatedAt };
      await (await mf.getR2Bucket('PUBLIC')).put('data/works.json', JSON.stringify(current.public));
    }
    const result = await publish(candidate); assert.equal(result.published, undefined); assert.ok(result.updated);
  }
});
