import assert from 'node:assert/strict';
import { test } from 'node:test';
import { docsMarkdownImages, parseDocsManifest } from '../../src/content/docs';
import { docsImageRefs, docsLibraryErrors, makeDoc, makeDocsCategory, replaceDocsImages } from '../shared/docs';
import type { DocsLibrary } from '../shared/docs';

function fixture(): DocsLibrary { const category = { ...makeDocsCategory(), slug: 'fimel-card', title: { zh: 'Fimel Card' } }; const doc = { ...makeDoc(category.id), slug: 'game-rules', title: { zh: '游戏规则' }, body: { zh: '# 游戏规则' } }; return { schemaVersion: 1, categories: [category], documents: [doc] }; }
test('文档模型严格拒绝重复/未知字段、错误分类、过大正文与不合法发布状态', () => {
  const library = fixture(); assert.deepEqual(docsLibraryErrors(library), []);
  for (const change of [(value: DocsLibrary) => value.documents.push(structuredClone(value.documents[0])), (value: DocsLibrary) => value.documents[0].categoryId = 'missing', (value: DocsLibrary) => value.documents[0].body.zh = 'a'.repeat(120001), (value: DocsLibrary) => { value.documents[0].body = {}; value.documents[0].workflow = 'ready'; }, (value: DocsLibrary) => value.categories.push(...Array.from({ length: 50 }, (_, index) => ({ ...value.categories[0], id: `category-${index}`, slug: `category-${index}` })))]) { const candidate = structuredClone(library); change(candidate); assert.ok(docsLibraryErrors(candidate).length); }
  assert.ok(docsLibraryErrors({ ...library, extra: true }).length);
  assert.ok(docsLibraryErrors({ ...library, documents: [{ ...library.documents[0], workflow: 'published' }] }).length);
});
test('只识别实际图片目标：围栏/行内/缩进代码和转义教学示例不被替换，引用式图片也支持', () => {
  const marker = 'fimel-doc-image:owned-image';
  const source = `![${marker}](${marker})\n\n![引用][pic]\n\n[pic]: <${marker}>\n\n\`![代码](${marker})\`\n\n\`\`\`md\n![代码](${marker})\n/api/docs docs/uploads/anything\n\`\`\`\n\n    ![缩进](${marker})\n\n\\![转义](${marker})`;
  assert.equal(docsMarkdownImages(source).length, 2); assert.deepEqual([...docsImageRefs({ zh: source })], ['owned-image']);
  const replaced = replaceDocsImages({ zh: source }, new Map([['owned-image', 'https://download.studiofimel.com/docs/images/image.png']]));
  assert.equal(replaced.zh?.match(/https:\/\/download\.studiofimel\.com/g)?.length, 2);
  assert.ok(replaced.zh?.includes(`\`![代码](${marker})\``)); assert.ok(replaced.zh?.includes(`\\![转义](${marker})`));
  const library = fixture(); library.documents[0].body.zh = source; assert.ok(docsLibraryErrors(library).some(error => error.includes('不属于')));
  library.documents[0].body.zh = `\`![例子](fimel-doc-image:someone-else)\`\n\n\`\`\`md\n![例子](/api/docs/media/private)\n\`\`\`\n普通文字 docs/uploads/abc /api/docs`;
  assert.deepEqual(docsLibraryErrors(library), []);
});
test('真实私有路径、编码路径、跨作品scheme及跨文档图片被拒绝，普通HTTPS图片允许', () => {
  for (const url of ['/api/docs/media/x/y/z.png', 'https://admin.studiofimel.com/api/media/private', 'https://example.invalid/docs%2Fuploads%2Fx.png', 'fimel-asset:work-image', 'fimel-doc-image:other-document', 'fimel-doc-image&#58;other-document']) { const library = fixture(); library.documents[0].body.zh = `![图片](${url})`; assert.ok(docsLibraryErrors(library).length, url); }
  const library = fixture(); library.documents[0].body.zh = '![外部图片](https://example.invalid/image.png)'; assert.deepEqual(docsLibraryErrors(library), []);
});
test('公开parser只接受独立有限公开字段，代码中的私有示例保留、真实私有图片拒绝', () => {
  const source = fixture(), doc = source.documents[0];
  const manifest = { schemaVersion: 1 as const, publicationId: crypto.randomUUID(), publishedAt: doc.createdAt, categories: source.categories, documents: [{ id: doc.id, slug: doc.slug, categoryId: doc.categoryId, title: doc.title, summary: doc.summary, body: { zh: '`fimel-doc-image:example`\n\n```md\n![教学](/api/docs/media/private)\n```' }, order: 0, updatedAt: doc.updatedAt, sourceRevision: 'a'.repeat(64) }] };
  assert.equal(parseDocsManifest(manifest).documents.length, 1);
  assert.throws(() => parseDocsManifest({ ...manifest, documents: [{ ...manifest.documents[0], images: [] }] }));
  assert.throws(() => parseDocsManifest({ ...manifest, documents: [{ ...manifest.documents[0], body: { zh: '![真实](/api/docs/media/private)' } }] }));
  assert.throws(() => parseDocsManifest({ ...manifest, documents: [{ ...manifest.documents[0], sourceRevision: 'wrong' }] }));
});
