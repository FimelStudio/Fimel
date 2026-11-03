import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** Local, repeatable conversion. Source files are only ever read. No uploads or publication. */
const RULES = [
  ['Fast Card', 'fast-card'], ['赌命德州扑克', 'death-poker'], ['花火', 'hanabi'],
  ['出包魔法师', 'abraca-what'], ['瞎掰王', 'bluff-master'], ['谍报风云', 'spy-games'],
  ['临界点', 'critical-point'], ['问非所答', 'wrong-answers'], ['骷髅牌', 'skull'],
  ['经典斗地主', 'classic-dou-dizhu'], ['UNO', 'uno'], ['国际象棋', 'chess'],
  ['中国象棋', 'xiangqi'], ['五子棋', 'gomoku'], ['飞行棋', 'aeroplane-chess'],
  ['阿瓦隆', 'avalon'], ['情书', 'love-letter'], ['掼蛋', 'guandan'],
  ['命悬一线', 'hanging-by-a-thread'], ['围棋', 'go'], ['卡坦岛', 'catan'],
  ['璀璨宝石', 'splendor'], ['胡闹运动会', 'chaotic-sports'],
] as const;
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.join(projectRoot, 'admin/examples');
const imagesRoot = path.join(outputRoot, 'docs-example/images');
const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const normalize = (value: string) => value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const sourceFiles = new Map<string, { bytes: Buffer; hash: string }>();
type ExampleImage = { id: string; name: string; displayName: string; size: number; mime: 'image/png'; sha256: string; url: string };
type Rewritten = { text: string; substitutions: Array<{ from: string; to: string }> };

function contained(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function readSource(sourceRoot: string, relative: string) {
  const fullPath = await realpath(path.resolve(sourceRoot, relative));
  assert(contained(sourceRoot, fullPath), `源文件必须位于指定目录：${relative}`);
  const bytes = await readFile(fullPath);
  const hash = sha256(bytes);
  if (sourceFiles.has(fullPath)) assert.equal(sourceFiles.get(fullPath)!.hash, hash, `生成期间源文件发生变化：${relative}`);
  sourceFiles.set(fullPath, { bytes, hash });
  return bytes;
}

/** Rewrite actual Markdown links only; code examples and screenshot filename placeholders stay literal. */
function rewriteLinks(source: string, rewrite: (image: boolean, destination: string) => string): Rewritten {
  const substitutions: Rewritten['substitutions'] = [];
  let fence: { char: string; length: number } | undefined;
  const text = source.split('\n').map(line => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = undefined;
      return line;
    }
    if (fence) return line;
    // Inline code is retained verbatim, including image/path-looking example text.
    return line.split(/(`+[^`]*`+)/g).map(part => part.startsWith('`') ? part : part.replace(/(!?\[(?:[^\]\\]|\\.)*\]\()([^\n)]*)(\))/g, (full, before: string, destination: string, after: string) => {
      const changed = rewrite(before.startsWith('!'), destination);
      if (changed === destination) return full;
      const next = `${before}${changed}${after}`;
      substitutions.push({ from: full, to: next });
      return next;
    })).join('');
  }).join('\n');
  return { text, substitutions };
}

async function rasterizeSvg(bytes: Buffer): Promise<Buffer> {
  const svg = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert(!/<\s*(?:script|foreignObject|iframe|image|use)\b|\bon\w+\s*=|<!DOCTYPE|<!ENTITY|\b(?:href|src)\s*=|@import|url\(\s*[^#]/i.test(svg), 'SVG 仅允许静态、无外链的本地矢量图');
  const dimensions = /<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/i.exec(svg);
  assert(dimensions, 'SVG 必须具有明确的像素宽高');
  const width = Number(dimensions[1]), height = Number(dimensions[2]);
  assert(width > 0 && height > 0 && width <= 4096 && height <= 4096, 'SVG 尺寸超出离线转换范围');
  const browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'msedge' : undefined });
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, javaScriptEnabled: false, serviceWorkers: 'block' });
    // Even a future source edit cannot load a network resource during conversion.
    await context.route('**/*', route => route.abort('blockedbyclient'));
    const page = await context.newPage();
    await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; font-src 'none'; img-src 'none'"><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`, { waitUntil: 'load' });
    return await page.locator('svg').screenshot({ type: 'png', animations: 'disabled', scale: 'css' });
  } finally { await browser.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('-')) throw new Error('用法：npx tsx scripts/docs-example-import.ts <游戏规则源目录>');
  const sourceRoot = await realpath(path.resolve(args[0]));
  assert(!contained(sourceRoot, outputRoot), '导出目录不得写入源目录');
  const names = await readdir(sourceRoot);
  const ruleFiles = RULES.map(([title], index) => `${String(index + 1).padStart(2, '0')}-${title}.md`);
  assert.equal(names.filter(name => /^\d{2}-.+\.md$/i.test(name)).length, 23, '源目录必须恰好包含 01—23 共 23 篇规则');
  for (const name of ruleFiles) assert(names.includes(name), `缺少规则：${name}`);
  const docRoutes = new Map(ruleFiles.map((file, index) => [file, `#/docs/fimel-card-${RULES[index][1]}`]));
  const assets = new Map<string, { source: string; image: ExampleImage; bytes: Buffer; converted: boolean; sourceHash: string }>();
  const evidence: Array<Record<string, unknown>> = [];
  const documents = [];
  await mkdir(imagesRoot, { recursive: true });
  for (const [index, [expectedTitle, key]] of RULES.entries()) {
    const number = String(index + 1).padStart(2, '0');
    const file = ruleFiles[index];
    const bytes = await readSource(sourceRoot, file);
    const original = normalize(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const firstHeading = /^(\s*#\s+([^\n]+)\n)/.exec(original);
    assert(firstHeading && firstHeading[2].trim() === expectedTitle, `首标题与固定映射不符：${file}`);
    const body = original.slice(firstHeading[1].length);
    const assetPaths = new Set<string>();
    rewriteLinks(body, (isImage, destination) => {
      if (!isImage || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(destination)) return destination;
      assetPaths.add(decodeURIComponent(destination.replace(/^<|>$/g, '')).replace(/\\/g, '/'));
      return destination;
    });
    const docImages: ExampleImage[] = [];
    for (const relative of assetPaths) {
      let asset = assets.get(relative);
      if (!asset) {
        const sourceBytes = await readSource(sourceRoot, relative);
        const converted = /\.svg$/i.test(relative);
        assert(converted || /\.png$/i.test(relative), `示例只支持原有 PNG 或静态 SVG：${relative}`);
        const convertedBytes = converted ? await rasterizeSvg(sourceBytes) : sourceBytes;
        assert(convertedBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `不是有效 PNG：${relative}`);
        const role = relative.startsWith('images/icons/') ? 'icon' : `diagram-${docImages.length}`;
        const name = `${number}-${key}-${role}.png`;
        const id = `example-fimel-card-${key}-${role}`;
        const image: ExampleImage = { id, name, displayName: path.basename(relative), size: convertedBytes.length, mime: 'image/png', sha256: sha256(convertedBytes), url: `/migration/docs-example/images/${name}` };
        asset = { source: relative, image, bytes: convertedBytes, converted, sourceHash: sha256(sourceBytes) };
        assets.set(relative, asset);
        await writeFile(path.join(imagesRoot, name), convertedBytes);
      }
      docImages.push(asset.image);
    }
    const rewritten = rewriteLinks(body, (isImage, destination) => {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(destination)) return destination;
      const decoded = decodeURIComponent(destination.replace(/^<|>$/g, '')).replace(/\\/g, '/').replace(/^\.\//, '');
      if (isImage) {
        const asset = assets.get(decoded);
        assert(asset, `未读取的正文图片：${decoded}`);
        return `fimel-doc-image:${asset.image.id}`;
      }
      const [local, fragment] = decoded.split('#', 2);
      if (local.toLowerCase() === 'readme.md') return '#/docs?category=fimel-card';
      if (docRoutes.has(local)) return `${docRoutes.get(local)}${fragment ? `#${fragment}` : ''}`;
      return destination;
    });
    const intro = /^(\s*)(!\[[^\n]+\]\([^\n]+\)\n\n(?:\|[^\n]*\n)+)/.exec(rewritten.text);
    assert(intro, `开头图标与信息表格式不符：${file}`);
    const introStart = intro[1].length, introEnd = intro[0].length;
    const renderedBody = `${rewritten.text.slice(0, introStart)}:::image-left\n${rewritten.text.slice(introStart, introEnd)}:::\n${rewritten.text.slice(introEnd)}`;
    // Full text reconstruction checks every table row, code block, placeholder, and external URL.
    let restored = renderedBody.slice(0, introStart) + renderedBody.slice(introStart + ':::image-left\n'.length);
    const closing = introEnd;
    restored = restored.slice(0, closing) + restored.slice(closing + ':::\n'.length);
    for (const substitution of [...rewritten.substitutions].reverse()) restored = restored.replace(substitution.to, substitution.from);
    assert.equal(firstHeading[1] + restored, original, `正文可逆校验失败：${file}`);
    const placeholders = (original.match(/截图位：/g) ?? []).length;
    assert.equal((renderedBody.match(/截图位：/g) ?? []).length, placeholders);
    documents.push({
      id: `fimel-card-${key}`, slug: `fimel-card-${key}`,
      title: { zh: expectedTitle }, summary: { zh: `${expectedTitle} 游戏规则、操作流程与设置说明。` },
      body: { zh: renderedBody }, order: index, images: docImages,
    });
    evidence.push({ file, id: `fimel-card-${key}`, sourceSha256: sha256(bytes), normalizedSourceSha256: sha256(original), restoredSha256: sha256(firstHeading[1] + restored), bodySha256: sha256(renderedBody), titleMovedToMetadata: true, fullTextRoundTrip: true, screenshotPlaceholders: placeholders, images: docImages.length });
  }
  assert.equal(documents.length, 23);
  assert.equal(assets.size, 25);
  assert.equal(evidence.reduce((sum, item) => sum + Number(item.screenshotPlaceholders), 0), 69);
  for (const [sourceFile, before] of sourceFiles) assert.equal(sha256(await readFile(sourceFile)), before.hash, `源文件已被更改：${sourceFile}`);
  for (const asset of assets.values()) assert.equal(sha256(await readFile(path.join(imagesRoot, asset.image.name))), asset.image.sha256);
  const manifest = {
    schemaVersion: 1,
    category: { id: 'fimel-card', slug: 'fimel-card', title: { zh: 'Fimel Card', en: 'Fimel Card', ja: 'Fimel Card' }, summary: { zh: 'Fimel Card 的 23 种桌游规则、操作流程与设置说明。' }, order: 0, workSlug: 'fimel-card' },
    documents,
  };
  await writeFile(path.join(outputRoot, 'docs-example.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const reportRoot = path.join(projectRoot, '.artifacts/documentation-review');
  await mkdir(reportRoot, { recursive: true });
  await writeFile(path.join(reportRoot, 'docs-example-verification.json'), `${JSON.stringify({
    sourceDirectory: sourceRoot, sourceFilesUnchanged: true, documents: evidence,
    images: [...assets.values()].map(asset => ({ source: asset.source, sourceSha256: asset.sourceHash, output: asset.image.name, outputSha256: asset.image.sha256, size: asset.image.size, convertedSvgToPng: asset.converted, pngByteCopy: !asset.converted })),
    documentCount: 23, imageCount: 25, screenshotPlaceholderCount: 69,
    networkAllowedDuringSvgRasterization: false, sourceFilesReadOnly: true,
  }, null, 2)}\n`, 'utf8');
  console.log('已生成受保护的本地示例：23 篇文档、25 张 PNG（24 张原样复制、1 张 SVG 离线转换）；69 处原截图占位保留。');
  console.log('全部正文通过可逆还原校验，所有源文件前后 SHA-256 一致，未上传或公开发布。');
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
