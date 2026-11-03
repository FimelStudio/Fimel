import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseDocsManifest, type DocsManifest, type PublicDoc } from '../../src/content/docs';
import type { DocsExampleSource } from '../../admin/shared/docs';

export const docsFixtureOrigin = 'https://download.studiofimel.com/docs/test-images/';
export async function documentationFixture(): Promise<DocsManifest> {
  const example = JSON.parse(await readFile('admin/examples/docs-example.json', 'utf8')) as DocsExampleSource;
  const documents: PublicDoc[] = example.documents.map(document => {
    let zh = document.body.zh!;
    for (const image of document.images) zh = zh.replaceAll(`fimel-doc-image:${image.id}`, `${docsFixtureOrigin}${image.name}`);
    return { id: document.id, slug: document.slug, categoryId: example.category.id, title: document.title, summary: document.summary, body: { zh }, order: document.order, updatedAt: '2026-11-03T00:00:00.000Z', sourceRevision: createHash('sha256').update(zh).digest('hex') };
  });
  const demonstration = [
    ':::image-right', `![安全图文示例](${docsFixtureOrigin}${example.documents[0].images[0].name})`, '',
    '## 左侧文字', '', '这一段是右图左文示例，手机上将自动上下排列。', ':::', '',
    '## 重复标题', '', '[返回本页](#重复标题)', '', '## 重复标题', '',
    '```markdown', ':::image-left', '![这是代码](javascript:alert(1))', '', '## 代码中的标题', ':::', '```', '',
    '[危险链接](javascript:alert(1))', '', '<script>window.__docsUnsafe = true</script>', '',
    '[Fast Card 规则](#/docs/fimel-card-fast-card)',
  ].join('\n');
  documents.push({ id: 'layout-guide', slug: 'layout-guide', categoryId: 'guides', title: { zh: '排版与安全示例', en: 'Layout and safety', ja: 'レイアウトと安全' }, summary: { zh: '用于核对左右图文、目录定位与安全渲染。' }, body: { zh: demonstration, en: demonstration }, order: 0, updatedAt: '2026-11-03T00:00:00.000Z', sourceRevision: createHash('sha256').update(demonstration).digest('hex') });
  return parseDocsManifest({ schemaVersion: 1, publicationId: 'local-documentation-fixture', publishedAt: '2026-11-03T00:00:00.000Z', categories: [example.category, { id: 'guides', slug: 'guides', title: { zh: '使用指南', en: 'Guides', ja: 'ガイド' }, summary: { zh: '独立分类与布局示例。' }, order: 1 }], documents });
}
