import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { documentationBlocks } from '../src/content/documentation-markdown';
import { docsMarkdownImages } from '../src/content/docs';

// Read-only source conversion. Network uploads and publication are separate steps.
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const contained = (root: string, value: string) => { const relative = path.relative(root, value); return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };
const normalize = (text: string) => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const escapeAlt = (text: string) => text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[\\[\]|]/g, value => `\\${value}`);
type Image = { id: string; file: string; sha256: string; size: number; width: number; height: number; mime: 'image/png'; sources: string[] };
async function svgPng(bytes: Buffer) {
  const svg = bytes.toString('utf8');
  assert(!/<\s*(?:script|foreignObject|iframe|image|use)\b|\bon\w+\s*=|<!DOCTYPE|<!ENTITY|\b(?:href|src)\s*=|@import|url\(\s*[^#]/i.test(svg), 'SVG contains active content or external resources');
  const dimensions = /<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/i.exec(svg); assert(dimensions);
  const width = +dimensions[1], height = +dimensions[2]; assert(width > 0 && height > 0 && width <= 4096 && height <= 4096);
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try { const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false, serviceWorkers: 'block' }); await context.route('**/*', route => route.abort()); const page = await context.newPage(); await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{margin:0}svg{display:block}</style></head><body>${svg}</body></html>`); return await page.locator('svg').screenshot({ type: 'png', scale: 'css' }); } finally { await browser.close(); }
}
async function main() {
  const [sourceArg, outputArg] = process.argv.slice(2); assert(sourceArg && outputArg, 'Usage: npx tsx scripts/prepare-fimel-card-rules.ts <rules directory> <.artifacts/output>');
  const source = await realpath(sourceArg), output = path.resolve(outputArg);
  assert(contained(path.resolve('.artifacts'), output) && !contained(source, output), 'Output must stay inside project .artifacts and outside the source');
  await mkdir(path.join(output, 'images'), { recursive: true });
  const files = (await readdir(source)).filter(name => /^(?:0[1-9]|1\d|2[0-3])-.+\.md$/.test(name)).sort(); assert.equal(files.length, 23);
  const example = JSON.parse(await readFile('admin/examples/docs-example.json', 'utf8')) as { documents: { slug: string }[] };
  const sourceHashes = new Map<string, string>(), assets = new Map<string, Image>(), bySource = new Map<string, Image>();
  async function sourceBytes(relative: string) { const full = await realpath(path.resolve(source, relative)); assert(contained(source, full)); const bytes = await readFile(full); sourceHashes.set(full, sha(bytes)); return bytes; }
  async function image(relative: string) {
    const previous = bySource.get(relative); if (previous) return previous;
    const original = await sourceBytes(relative), bytes = /\.svg$/i.test(relative) ? await svgPng(original) : original;
    assert(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `Only source PNG or static SVG supported: ${relative}`);
    const digest = sha(bytes); let asset = assets.get(digest);
    if (!asset) { asset = { id: `source-${digest.slice(0, 40)}`, file: `images/${digest}.png`, sha256: digest, size: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), mime: 'image/png', sources: [] }; assets.set(digest, asset); await writeFile(path.join(output, asset.file), bytes); }
    asset.sources.push(relative); bySource.set(relative, asset); return asset;
  }
  const documents = [];
  for (const [index, file] of files.entries()) {
    const original = normalize((await sourceBytes(file)).toString('utf8')), heading = /^# ([^\n]+)\n/.exec(original); assert(heading);
    let body = original.slice(heading[0].length); const changes: { from: string; to: string }[] = [];
    function change(regex: RegExp, fn: (...values: string[]) => string) { body = body.replace(regex, (...values) => { const from = values[0] as string, to = fn(...values as string[]); if (from !== to) changes.push({ from, to }); return to; }); }
    change(/<img\b[^>]*>/g, tag => { const src = /\bsrc="([^"]+)"/.exec(tag), alt = /\balt="([^"]*)"/.exec(tag); assert(src); return `![${escapeAlt(alt?.[1] ?? '')}](${src[1]})`; });
    const destinations = [...docsMarkdownImages(body)].map(ref => ref.url);
    for (const destination of new Set(destinations)) { assert(!/^(?:[a-z]+:|\/\/)/i.test(destination), 'Expected local source images'); await image(decodeURIComponent(destination)); }
    change(/!\[((?:[^\]\\]|\\.)*)\]\(([^)\n]+)\)/g, (full, alt, destination) => { const asset = bySource.get(decodeURIComponent(destination)); assert(asset); return `![${alt}](fimel-doc-image:${asset.id})`; });
    change(/(?<!!)\[([^\]\n]*)\]\((?:\.\/)?README\.md\)/gi, (_, text) => `[${text}](#/docs?category=fimel-card)`);
    change(/(?<!!)\[([^\]\n]*)\]\((?:\.\/)?00-新手入门与界面图例\.md\)/g, (_, text) => `${text}（见数据包随附《新手入门与界面图例》）`);
    const intro = /^(\s*)(!\[[^\n]+\]\([^\n]+\))\n\n([^]*?)(?=\n## |$)/.exec(body);
    if (intro && intro[3].trim().length <= 800) change(/^(\s*)(!\[[^\n]+\]\([^\n]+\))\n\n([^]*?)(?=\n## |$)/, (_, whitespace, picture, text) => `${whitespace}:::image-left\n${picture}\n\n${text.trim()}\n:::\n`);
    let smallFigures = 0;
    change(/^\| 实图[^\n]*\n\|[ \t|:-]+\n((?:\|[^\n]*\|(?:\n|$))+)/gm, (table, rowsText) => {
      const rows = rowsText.trim().split('\n'); if (rows.length !== 1) return table;
      const cells = rows[0].split(/(?<!\\)\|/).slice(1, -1).map(value => value.trim()); if (cells.length !== 4) return table;
      const id = /^!\[[^]*\]\(fimel-doc-image:([^)]*)\)$/.exec(cells[0])?.[1], asset = [...assets.values()].find(image => image.id === id);
      if (!asset || asset.width > 640 || asset.height > 640) return table;
      const side = smallFigures++ % 2 ? 'left' : 'right'; return `:::image-${side}\n${cells[0]}\n\n**${cells[1]}**\n\n**数量／所属：** ${cells[2]}\n\n${cells[3]}\n:::\n`;
    });
    let restored = body;
    for (const { from, to } of [...changes].reverse()) { const position = restored.lastIndexOf(to); assert(position >= 0, `Cannot restore ${file}`); restored = restored.slice(0, position) + from + restored.slice(position + to.length); }
    assert.equal(heading[0] + restored, original, `Source round trip failed: ${file}`);
    assert(!body.includes('<img')); assert(!body.includes('](README.md)')); assert(!body.includes('](00-新手入门与界面图例.md)'));
    assert.equal(docsMarkdownImages(body).length, destinations.length, `Images dropped: ${file}`);
    const ids = [...new Set(docsMarkdownImages(body).map(ref => ref.url.slice('fimel-doc-image:'.length)))];
    const blocks = documentationBlocks(body), split = blocks.filter(block => block.kind === 'split'); assert.equal(split.length, 1 + smallFigures, `Invalid split container: ${file}`);
    documents.push({ file, slug: example.documents[index].slug, title: heading[1], body: { zh: body }, imageIds: ids, sourceSha256: sourceHashes.get(path.join(source, file)), roundTrip: true, layouts: { left: split.filter(block => block.side === 'left').length, right: split.filter(block => block.side === 'right').length, fullWidth: destinations.filter(destination => /\/catalogs\//.test(destination)).length } });
  }
  for (const [file, expected] of sourceHashes) assert.equal(sha(await readFile(file)), expected, 'Source changed during conversion');
  const result = { schemaVersion: 1, source, excluded: ['00-新手入门与界面图例.md', 'README.md'], documents, images: [...assets.values()], sourceFilesUnchanged: true };
  await writeFile(path.join(output, 'plan.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ documents: documents.length, sourceImages: bySource.size, uniqueImages: assets.size, totalImageBytes: [...assets.values()].reduce((sum, image) => sum + image.size, 0), layouts: documents.map(doc => ({ file: doc.file, images: doc.imageIds.length, ...doc.layouts })), sourceFilesUnchanged: true }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
