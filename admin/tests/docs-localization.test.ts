import assert from 'node:assert/strict';
import { test } from 'node:test';
import { docsLocalizedText } from '../../src/content/docs';

test('文档优先使用非空当前译文，地区代码与原换行格式得到保留', () => {
  const text = { zh: '中文', en: '\nEnglish body\n\n## Heading\n', ja: '日本語' };
  assert.equal(docsLocalizedText(text, 'en-US'), text.en);
  assert.equal(docsLocalizedText(text, 'ja-JP'), text.ja);
  assert.equal(docsLocalizedText('原始字符串正文', 'en'), '原始字符串正文');
});

test('文档空译文和纯空白译文都会回退到已有中文', () => {
  for (const empty of ['', ' ', '\n\t\r\n']) {
    assert.equal(docsLocalizedText({ zh: '已有中文', en: empty }, 'en'), '已有中文');
    assert.equal(docsLocalizedText({ zh: '已有中文', ja: empty }, 'ja'), '已有中文');
    assert.equal(docsLocalizedText({ zh: '已有中文', en: empty, ja: empty }, 'en-US'), '已有中文');
  }
});

test('中文也为空时继续寻找其他非空语言，未知语言采用明确稳定回退', () => {
  assert.equal(docsLocalizedText({ zh: '', en: '\t', ja: '利用できる日本語' }, 'en'), '利用できる日本語');
  assert.equal(docsLocalizedText({ zh: '中文', en: 'English' }, 'fr'), '中文');
  assert.equal(docsLocalizedText({ en: 'English' }, 'zh'), 'English');
});

test('不存在或全部空白的文档元数据返回空字符串，分类未找到时也安全', () => {
  assert.equal(docsLocalizedText({}, 'en'), '');
  assert.equal(docsLocalizedText({ zh: '', en: ' ', ja: '\n' }, 'en'), '');
  assert.equal(docsLocalizedText(undefined, 'en'), '');
});
