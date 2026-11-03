import assert from 'node:assert/strict';
import { test } from 'node:test';
import { docsMarkdownImages } from '../../src/content/docs';
import type { DocsImageCache } from '../../src/content/docs';
import { docsImageRefs, docsLibraryErrors, makeDoc, makeDocsCategory, replaceDocsImages } from '../shared/docs';
import { docsSourceRevision } from '../worker/docs';

test('图片分析保留 CRLF 和非 BMP 字符的原始偏移，代码与转义图片仍为文字', () => {
  const source = '🙂\r\n`![代码](fimel-doc-image:ignored)`\r\n\\![转义](fimel-doc-image:escaped)\r\n![真实](<fimel-doc-image:owned>)\r\n![引用][图]\r\n[图]: https://example.com/image.png\r\n';
  const images = docsMarkdownImages(source);
  assert.deepEqual(images.map(image => image.url), ['fimel-doc-image:owned', 'https://example.com/image.png']);
  for (const image of images) assert.equal(source.slice(image.start, image.end).replace(/^<|>$/g, ''), image.url);
});

test('请求内重用图片分析时，每篇文档仍独立核验所有权和全部字段', () => {
  const category = makeDocsCategory(); category.slug = 'rules'; category.title = '规则';
  const doc = makeDoc(category.id); doc.slug = 'rule'; doc.title = '规则'; doc.body = { zh: '![图](fimel-doc-image:owned)' };
  doc.images = [{ id: 'owned', name: 'icon.png', privateKey: `docs/uploads/${doc.id}/owned/icon.png`, size: 24, mime: 'image/png', sha256: 'a'.repeat(64) }];
  const library = { schemaVersion: 1, categories: [category], documents: [doc] };
  const cache: DocsImageCache = new Map();
  assert.deepEqual(docsLibraryErrors(library, cache), []);
  assert.equal(cache.size, 1);
  assert.deepEqual(docsImageRefs(doc.body, cache), new Set(['owned']));
  const bad = structuredClone(library); bad.documents[0].images = [];
  assert.match(docsLibraryErrors(bad, cache).join(), /不属于当前文档/);
  assert.match(docsLibraryErrors({ ...library, unexpected: true }, cache).join(), /格式错误/);
});

test('替换图片不会更改缓存顺序或代码示例，版本指纹与缓存无关', async () => {
  const doc = makeDoc('category'); doc.slug = 'rule'; doc.title = '规则';
  doc.body = { zh: '`![示例](fimel-doc-image:ignored)`\n\n![甲](fimel-doc-image:first)\n![乙](fimel-doc-image:second)' };
  for (const id of ['first', 'second', 'unused']) doc.images.push({ id, name: `${id}.png`, privateKey: `docs/uploads/${doc.id}/${id}/${id}.png`, size: 24, mime: 'image/png', sha256: 'b'.repeat(64) });
  const cache: DocsImageCache = new Map();
  const original = docsMarkdownImages(doc.body.zh!, cache);
  assert.strictEqual(docsMarkdownImages(doc.body.zh!, cache), original);
  const urls = new Map([['first', 'https://example.com/a.png'], ['second', 'https://example.com/b.png']]);
  const replaced = replaceDocsImages(doc.body, urls, cache);
  assert.equal(replaced.zh, '`![示例](fimel-doc-image:ignored)`\n\n![甲](https://example.com/a.png)\n![乙](https://example.com/b.png)');
  assert.deepEqual(original.map(image => image.url), ['fimel-doc-image:first', 'fimel-doc-image:second']);
  assert.equal(await docsSourceRevision(doc, cache), await docsSourceRevision(doc));
  const removedUnused = { ...doc, images: doc.images.filter(image => image.id !== 'unused') };
  assert.equal(await docsSourceRevision(doc, cache), await docsSourceRevision(removedUnused));
});
