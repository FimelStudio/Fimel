import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSvg, MAX_SVG_SIZE } from '../shared/svg';
import { inlineImages } from '../../src/content/markdown-images';
import { docsMarkdownImages, parseDocsManifest } from '../../src/content/docs';
import { matchLocalImages } from '../shared/image-import';
import { docsImageRefs, replaceDocsImages } from '../shared/docs';

const svg = (content: string) => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${content}</svg>`);
test('静态 SVG 保留内部引用、渐变、阴影和颜色变量，拒绝主动内容及外部资源', () => {
  assert.doesNotThrow(() => validateSvg(svg('<defs><g id="card"><rect width="40" height="40" fill="var(--top)"/></g><filter id="shadow"><feDropShadow dx="1" dy="2" stdDeviation="1"/></filter></defs><use href="#card" style="--top:#35475f;--left:#1e293c" filter="url(#shadow)"/>')));
  for (const content of [
    '<script>alert(1)</script>', '<foreignObject><div>HTML</div></foreignObject>', '<rect onload="alert(1)"/>',
    '<animate attributeName="href"/>', '<use href="https://example.com/a.svg#x"/>', '<use href="javascript&#58;alert(1)"/>',
    '<use href="data:image/svg+xml,evil"/>', '<image href="https://example.com/a.png"/>', '<style>@import "https://example.com";</style>',
    '<rect fill="url(https://example.com/a.svg)"/>', '<rect style="fill:u\\72l(https://example.com)"/>',
    '<rect xml:base="https://example.com"/>', '<g xmlns="http://www.w3.org/1999/xhtml"><script/></g>',
    '<rect style="background: red"/>', '<rect style="--top:url(http://example.com)"/>', '<rect fill="url(&#104;ttps://example.com)"/>',
    '<rect><path></rect>',
  ]) assert.throws(() => validateSvg(svg(content)), /SVG/, content);
  assert.throws(() => validateSvg(new TextEncoder().encode('<!DOCTYPE svg [<!ENTITY x "x">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>')));
  assert.throws(() => validateSvg(new TextEncoder().encode('<?xml-stylesheet href="https://example.com"?><svg xmlns="http://www.w3.org/2000/svg"/>')));
  assert.throws(() => validateSvg(new Uint8Array(MAX_SVG_SIZE + 1)));
  assert.throws(() => validateSvg(svg('<g>'.repeat(50) + '</g>'.repeat(50))));
});

test('表格 img 解析尺寸与原始 src 偏移，代码、注释、脚本示例不作为配图', () => {
  const source = '🙂\r\n| 图标 | 名称 |\r\n| --- | --- |\r\n| <img src="../图标/a.svg" alt="牌 &amp; 说明" width="40" height="40" onerror="alert(1)"> | A |\r\n\n`<img src="ignored.svg">`\n<!-- <img src="ignored2.svg"> -->\n<script><img src="ignored3.svg"></script>\n```html\n<img src="ignored4.svg">\n```';
  const images = docsMarkdownImages(source); assert.equal(images.length, 1);
  assert.equal(images[0].url, '../图标/a.svg'); assert.equal(source.slice(images[0].start, images[0].end), '../图标/a.svg');
  const parsed = inlineImages('<img width="40" src=\'../a.svg?a=1&amp;b=2\' alt="A &quot;B&quot;" height="40">')[0];
  assert.equal(parsed.width, 40); assert.equal(parsed.height, 40); assert.equal(parsed.src, '../a.svg?a=1&b=2'); assert.equal(parsed.alt, 'A "B"');
  assert.equal(inlineImages('<img src="ok.svg" src="bad.svg">').length, 0);
  assert.equal(inlineImages('<img src="ok.svg" width="999999" height="-2">')[0].width, undefined);
});

test('批量图片按文件名绑定本机相对路径，保留表格、尺寸、远程地址及代码', () => {
  const source = '| <img src="../images/%E5%9B%BE.svg" width="40" height="40"> |\n![重复](../images/%E5%9B%BE.svg)\n![外链](https://example.com/图.svg)\n`![示例](../images/图.svg)`';
  const result = matchLocalImages(source, '图.svg', 'fimel-doc-image:owned'); assert.ok(result.matched);
  assert.ok(result.content.includes('<img src="fimel-doc-image:owned" width="40" height="40">'));
  assert.equal(result.content.match(/fimel-doc-image:owned/g)?.length, 2);
  assert.ok(result.content.includes('https://example.com/图.svg')); assert.ok(result.content.includes('`![示例](../images/图.svg)`'));
  assert.deepEqual(docsImageRefs({ zh: result.content }), new Set(['owned']));
  const published = replaceDocsImages({ zh: result.content }, new Map([['owned', 'https://download.example.com/owned.svg']]));
  assert.ok(published.zh?.includes('<img src="https://download.example.com/owned.svg" width="40" height="40">'));
  assert.throws(() => matchLocalImages('![甲](a/icon.svg) ![乙](b/icon.svg)', 'icon.svg', 'fimel-asset:owned'), /同名图片/);
  assert.equal(matchLocalImages('![外链](https://example.com/a.svg)', 'a.svg', 'managed').matched, false);
});

test('公开文档清单拒绝 HTML img 泄露私有路径', () => {
  const manifest = { schemaVersion: 1, publicationId: 'test', publishedAt: '2026-11-14T00:00:00.000Z', categories: [], documents: [{ id: 'doc', slug: 'doc', categoryId: '', title: '测试', summary: '', order: 0, updatedAt: '2026-11-14T00:00:00.000Z', sourceRevision: 'a'.repeat(64), body: { zh: '<img src="fimel-doc-image:owned" width="40">' } }] };
  assert.throws(() => parseDocsManifest(manifest));
});
