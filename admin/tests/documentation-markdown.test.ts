import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { documentationBlocks, documentationHeadings, plainHeading } from '../../src/content/documentation-markdown';
import type { DocsExampleSource } from '../shared/docs';

test('图片左右容器保留 Markdown 内容和原始行号', () => {
  const source = '前文\r\n\r\n:::image-left\r\n![左图](https://example.test/left.png)\r\n\r\n## 规则\r\n\r\n| 项目 | 内容 |\r\n| --- | --- |\r\n| 人数 | 4 |\r\n:::\r\n\r\n:::image-right\r\n![右图](https://example.test/right.png)\r\n\r\n右侧图片的说明\r\n:::';
  const blocks = documentationBlocks(source);
  assert.equal(blocks[0].kind, 'markdown');
  const left = blocks.find(block => block.kind === 'split' && block.side === 'left');
  assert(left?.kind === 'split');
  assert.equal(left.imageLine, 4);
  assert.equal(left.line, 5);
  assert.equal(left.image, '![左图](https://example.test/left.png)');
  assert.match(left.content, /## 规则/);
  assert.match(left.content, /\| 人数 \| 4 \|/);
  const right = blocks.find(block => block.kind === 'split' && block.side === 'right');
  assert(right?.kind === 'split');
  assert.equal(right.imageLine, 14);
  assert.equal(right.content.trim(), '右侧图片的说明');
  assert.deepEqual(documentationHeadings(source), [{ id: '规则', text: '规则', depth: 2, line: 6 }]);
});

test('反引号与波浪线 fenced code 里的容器和标题始终是原始代码', () => {
  for (const fence of ['```markdown', '~~~~markdown']) {
    const end = fence.startsWith('`') ? '```' : '~~~~';
    const source = [fence, ':::image-left', '![示例](demo.png)', '', '## 不应生成标题', ':::', end, '', '## 真实标题'].join('\n');
    const blocks = documentationBlocks(source);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, 'markdown');
    assert.equal(blocks[0].content, source);
    assert.deepEqual(documentationHeadings(source), [{ id: '真实标题', text: '真实标题', depth: 2, line: 9 }]);
  }
});

test('容器内代码里的结束标记不能提前关闭容器，标题行号仍正确', () => {
  const source = [':::image-left', '![图](a.png)', '', '说明', '', '```text', ':::', '## 代码标题', '```', '', '## 真实标题', ':::'].join('\n');
  const [block] = documentationBlocks(source);
  assert.equal(block.kind, 'split');
  assert.match(block.content, /```text\n:::\n## 代码标题\n```/);
  assert.deepEqual(documentationHeadings(source), [{ id: '真实标题', text: '真实标题', depth: 2, line: 11 }]);
});

test('四空格和制表符缩进代码里的容器与标题始终保留为代码', () => {
  for (const indent of ['    ', '\t', '  \t']) {
    const source = [`${indent}:::image-left`, `${indent}![图](example.png)`, '', `${indent}## 缩进代码标题`, `${indent}说明`, `${indent}:::`, '', '## 真实标题'].join('\n');
    const blocks = documentationBlocks(source);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].kind, 'markdown');
    assert.equal(blocks[0].content, source);
    assert.deepEqual(documentationHeadings(source), [{ id: '真实标题', text: '真实标题', depth: 2, line: 8 }]);
  }
});

test('缺图片、缺说明、未结束等错误容器保留全部原文', () => {
  for (const source of [
    ':::image-left\n这不是图片\n\n说明\n:::',
    ':::image-right\n![图](a.png)\n:::',
    ':::image-left\n![图](a.png)\n\n说明',
    ':::image-top\n![图](a.png)\n\n说明\n:::',
    '前文\n\n:::image-left\n![图](a.png)\n\n尚未结束',
  ]) {
    const blocks = documentationBlocks(source);
    assert(blocks.every(block => block.kind === 'markdown'));
    assert.equal(blocks.map(block => block.content).join('\n'), source);
  }
});

test('一个容器允许多张图片，图片标题或外链不会吞掉后续正文', () => {
  const source = ':::image-right\n![第一张](https://example.test/a.png "图片标题")\n![第二张](https://example.test/b.png)\n\n[官方说明](https://example.test/rules)\n\n正文。\n:::';
  const [block] = documentationBlocks(source);
  assert.equal(block.kind, 'split');
  if (block.kind !== 'split') return;
  assert.equal(block.image.split('\n').length, 2);
  assert.match(block.content, /\[官方说明\]\(https:\/\/example.test\/rules\)/);
  assert.match(block.content, /正文。/);
});

test('标题去除 Markdown 语法，保留中文，重复标题使用唯一定位', () => {
  const source = '## **游戏设置**\n\n### [官方说明](https://example.test)\n\n## 游戏设置\n\n## Ｆａｓｔ Ｃａｒｄ\n\n    ## 缩进代码';
  assert.deepEqual(documentationHeadings(source).map(({ id, text }) => ({ id, text })), [
    { id: '游戏设置', text: '游戏设置' }, { id: '官方说明', text: '官方说明' },
    { id: '游戏设置-2', text: '游戏设置' }, { id: 'fast-card', text: 'Ｆａｓｔ Ｃａｒｄ' },
  ]);
  assert.equal(plainHeading('**Rule** `Q` [help](https://example.test)'), 'Rule Q help');
});

test('重复标题与自然数字后缀相撞时，每个标题仍有独立 ID', () => {
  const headings = documentationHeadings('## Example\n## Example\n## Example-2\n## Example\n## Example-2');
  assert.equal(new Set(headings.map(heading => heading.id)).size, headings.length);
});

test('23 篇真实规则首块均可左右排版，表格、代码块与 69 处截图占位保持完整', async () => {
  const examples = JSON.parse(await readFile('admin/examples/docs-example.json', 'utf8')) as DocsExampleSource;
  assert.equal(examples.documents.length, 23);
  assert.equal(examples.documents.reduce((sum, doc) => sum + doc.images.length, 0), 25);
  let placeholders = 0;
  for (const doc of examples.documents) {
    const body = doc.body.zh!;
    const split = documentationBlocks(body).find(block => block.kind === 'split');
    assert(split?.kind === 'split', `${doc.slug} 缺少图文容器`);
    assert.equal(split.side, 'left');
    assert.match(split.image, /fimel-doc-image:example-fimel-card-/);
    assert.match(split.content, /\| 游戏编号/);
    assert.match(body, /```mcfunction/);
    placeholders += (body.match(/截图位：/g) ?? []).length;
    assert(documentationHeadings(body).length >= 5);
  }
  assert.equal(placeholders, 69);
});
