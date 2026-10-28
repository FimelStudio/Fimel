import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork } from '../shared/model';
import type { Asset, Library, PublicManifest, Work } from '../shared/model';
import { publicationFingerprint, mergeWork } from '../shared/revisions';
import { removeImage } from '../shared/image-usage';
import { validateLibrary } from '../shared/validation';
import { parseCatalogue } from '../../src/content/projects';

let runtime: Miniflare;
before(async () => {
  const bundle = await build({ entryPoints: ['admin/worker/local.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-12', r2Buckets: ['PRIVATE', 'PUBLIC'], bindings: { ADMIN_ORIGIN: 'http://127.0.0.1:5174', ACCESS_AUD: 'local-test', ACCESS_ISSUER: 'https://local.invalid', ADMIN_EMAILS: 'local-admin@example.invalid' } }));
  await runtime.ready;
});
after(async () => { await runtime?.dispose(); });
const request = (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => runtime.dispatchFetch(`http://127.0.0.1/api/${path}`, { method, headers: { Origin: 'http://127.0.0.1:5174', 'X-Fimel-CSRF': '1', 'Content-Type': 'application/json', Connection: 'close', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
async function state() { const response = await request('library'); assert.equal(response.status, 200); return response.json() as Promise<{ library: Library; public: PublicManifest; etag: string; publicEtag: string }>; }
async function save(base: Work | null, work: Work) { const response = await request(`works/${work.id}`, 'PUT', { base, work }); assert.equal(response.status, 200, await response.clone().text()); return (await state()).library.works.find(item => item.id === work.id)!; }
async function publish(work: Work) { const current = await state(); return request(`publish/${work.id}`, 'POST', {}, { 'If-Match': current.etag, 'X-Public-ETag': current.publicEtag }); }
async function fixture() {
  const work = makeWork(); work.project.slug = `featured-${work.id}`; work.project.title = { zh: '精选封图' }; work.project.status = 'released'; work.markdown.description.zh = '保留原正文。';
  const bytes = await readFile('public/assets/brand/fimel-logo.png');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); const sha256 = [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const bucket = await runtime.getR2Bucket('PRIVATE');
  for (const [index, name] of ['cover.png', 'featured.png', 'body.png', 'unused.png'].entries()) {
    const id = `${work.id}-image-${index}`, privateKey = `uploads/verified/${id}/${name}`;
    const asset: Asset = { id, name, size: bytes.length, mime: 'image/png', sha256, privateKey };
    await bucket.put(privateKey, bytes, { httpMetadata: { contentType: 'image/png' }, customMetadata: { workId: work.id, assetId: id, sha256, versionId: '', kind: 'image' } });
    work.gallery.push(asset);
  }
  return work;
}

test('独立精选封图随作品发布，主封面和正文保持独立，清除后回退且历史图片保留', async () => {
  let work = await fixture();
  work.coverId = work.gallery[0].id; work.featuredCoverId = work.gallery[1].id;
  work.markdown.description.zh += `\n\n![正文](fimel-asset:${work.gallery[2].id})`;
  work = await save(null, work);
  const published = await publish(work); assert.equal(published.status, 200, await published.text());
  const current = await state(); const project = current.public.projects.find(item => item.slug === work.project.slug)!;
  assert.ok(project.image.includes(work.gallery[0].id)); assert.ok(project.featuredImage?.includes(work.gallery[1].id)); assert.notEqual(project.image, project.featuredImage);
  assert.equal(parseCatalogue(current.public).find(item => item.slug === work.project.slug)?.featuredImage, project.featuredImage);
  const publicBucket = await runtime.getR2Bucket('PUBLIC');
  const paths = await publicBucket.list({ prefix: `images/${work.project.type}/${work.project.slug}/` });
  assert.equal(paths.objects.length, 3); assert.ok(!paths.objects.some(item => item.key.includes(work.gallery[3].id)));
  const description = project.content.description!; const markdownPath = typeof description === 'string' ? description : description.zh!;
  const markdown = await (await publicBucket.get(new URL(markdownPath).pathname.slice(1)))!.text();
  assert.ok(markdown.includes(work.gallery[2].id)); assert.ok(!markdown.includes(work.gallery[1].id));
  const featuredUrl = project.featuredImage!;
  work = await save(work, { ...work, gallery: work.gallery.map(asset => asset.id === work.featuredCoverId ? { ...asset, privateKey: undefined, publicUrl: featuredUrl } : asset) });
  const retained = await publish(work); assert.equal(retained.status, 200, await retained.text());
  assert.equal((await state()).public.projects.find(item => item.slug === work.project.slug)!.featuredImage, featuredUrl);
  work = await save(work, { ...work, featuredCoverId: undefined });
  const cleared = await publish(work); assert.equal(cleared.status, 200, await cleared.text());
  const after = (await state()).public.projects.find(item => item.slug === work.project.slug)!;
  assert.equal(Object.hasOwn(after, 'featuredImage'), false); assert.equal(after.image, project.image);
  assert.ok(await publicBucket.head(new URL(featuredUrl).pathname.slice(1)));
});

test('精选候选需属于当前作品且完成验证，错误引用不会改变公开目录', async () => {
  const work = await fixture(); work.featuredCoverId = work.gallery[1].id;
  const saved = await save(null, work); const before = await state();
  const privateBucket = await runtime.getR2Bucket('PRIVATE'); const asset = work.gallery[1];
  await privateBucket.put(asset.privateKey!, await readFile('public/assets/brand/fimel-logo.png'), { httpMetadata: { contentType: asset.mime }, customMetadata: { workId: 'another-work', assetId: asset.id, sha256: asset.sha256, versionId: '', kind: 'image' } });
  const rejected = await publish(saved); assert.equal(rejected.status, 422); assert.match(await rejected.text(), /不属于此作品/);
  assert.equal((await state()).publicEtag, before.publicEtag);
  const invalid = { ...saved, featuredCoverId: 'missing-image' };
  assert.match(validateLibrary({ schemaVersion: 1, works: [invalid] }).join('\n'), /精选封图不存在/);
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.invalid/image.png', '../image.png']) {
    assert.ok(validateLibrary({ schemaVersion: 1, works: [{ ...saved, project: { ...saved.project, featuredImage: url } }] }).length);
    assert.throws(() => parseCatalogue({ schemaVersion: 1, projects: [{ ...saved.project, featuredImage: url }] }));
  }
});

test('精选引用参与发布指纹和冲突合并，未使用候选不改变指纹，删除候选清理关联', async () => {
  const work = await fixture(); const original = await publicationFingerprint(work);
  const extra: Asset = { ...work.gallery[3], id: 'extra-candidate' };
  assert.equal(await publicationFingerprint({ ...work, gallery: [...work.gallery, extra] }), original);
  const selected = { ...work, featuredCoverId: work.gallery[1].id };
  assert.notEqual(await publicationFingerprint(selected), original);
  const other = { ...work, project: { ...work.project, summary: '另一个管理员更改介绍' } };
  const merged = mergeWork(work, other, selected); assert.deepEqual(merged.conflicts, []); assert.equal(merged.work.featuredCoverId, selected.featuredCoverId); assert.equal(merged.work.project.summary, other.project.summary);
  const removed = removeImage(selected, selected.featuredCoverId); assert.equal(removed.featuredCoverId, undefined); assert.equal(removed.gallery.length, 3); assert.deepEqual(removed.markdown, work.markdown);
});

test('作品库备份恢复保留精选选择且不隐式发布，未验证的保留地址不能公开', async () => {
  let work = await fixture(); work.featuredCoverId = work.gallery[1].id;
  work = await save(null, work);
  const before = await state(); const originalId = work.featuredCoverId;
  const cleared = await save(work, { ...work, featuredCoverId: undefined });
  const bucket = await runtime.getR2Bucket('PRIVATE');
  let restoreId: string | undefined;
  for (const object of (await bucket.list({ prefix: 'backups/library/' })).objects) {
    const backup = await (await bucket.get(object.key))!.json() as { value: Library };
    if (backup.value.works.find(item => item.id === work.id)?.featuredCoverId === originalId) { restoreId = object.key.split('/').at(-1)!.replace('.json', ''); break; }
  }
  assert.ok(restoreId);
  const current = await state();
  const restored = await request(`restore/library/${restoreId}`, 'POST', {}, { 'If-Match': current.etag }); assert.equal(restored.status, 200, await restored.text());
  assert.equal((await state()).library.works.find(item => item.id === work.id)!.featuredCoverId, originalId);
  assert.equal((await state()).publicEtag, before.publicEtag);
  const latest = (await state()).library.works.find(item => item.id === work.id)!;
  const fakeUrl = `https://download.studiofimel.com/images/${work.project.type}/${work.project.slug}/fake/cover.png`;
  await (await runtime.getR2Bucket('PUBLIC')).put(new URL(fakeUrl).pathname.slice(1), 'unverified', { httpMetadata: { contentType: 'image/png' } });
  const fake = await save(latest, { ...cleared, project: { ...cleared.project, featuredImage: fakeUrl } });
  const rejected = await publish(fake); assert.equal(rejected.status, 422); assert.match(await rejected.text(), /未完成验证/);
  assert.equal((await state()).publicEtag, before.publicEtag);
});
