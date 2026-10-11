import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('.');
const publicDirectory = path.join(root, 'public');
const checked = new Set();

// Windows accepts wrong-case paths, but Cloudflare/GitHub Pages do not.
async function checkExactFile(relative, label) {
  assert(!path.isAbsolute(relative) && !relative.includes('\\'), `${label}: use a relative POSIX path.`);
  const target = path.resolve(publicDirectory, relative);
  assert(target.startsWith(publicDirectory + path.sep), `${label}: path escapes public/.`);
  let directory = publicDirectory;
  for (const segment of path.relative(publicDirectory, target).split(path.sep)) {
    const names = await readdir(directory);
    assert(names.includes(segment), `${label}: missing or wrong-case path ${relative}`);
    directory = path.join(directory, segment);
  }
  assert((await stat(target)).isFile(), `${label}: not a file ${relative}`);
  checked.add(relative);
}

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else yield file;
  }
}

const publicRoots = new Set(['assets', 'works', 'mods', 'plugins', 'robots.txt']);
for (const entry of await readdir(publicDirectory)) {
  assert(publicRoots.has(entry), `Unexpected public/${entry}; follow docs/project-structure.md.`);
}

const catalogue = JSON.parse(await readFile(path.join(publicDirectory, 'works/catalogue.json'), 'utf8'));
const schema = JSON.parse(await readFile(path.join(publicDirectory, 'works/catalogue.schema.json'), 'utf8'));
const projectModule = await readFile(path.join(root, 'src/content/projects.ts'), 'utf8');
const declared = projectModule.match(/PROJECT_TYPES\s*=\s*\[([^\]]+)\]/);
assert(declared, 'PROJECT_TYPES declaration missing.');
const sourceTypes = [...declared[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
assert.deepEqual(sourceTypes, schema.$defs.project.properties.type.enum, 'Runtime and JSON Schema categories differ.');

for (const project of catalogue.projects) {
  for (const value of [project.image, project.download, project.fallbackDownload]) {
    if (value && !/^https?:\/\//.test(value)) await checkExactFile(value, project.slug);
  }
  for (const value of Object.values(project.content)) {
    for (const file of typeof value === 'string' ? [value] : Object.values(value)) {
      if (!/^https?:\/\//.test(file)) await checkExactFile(file, project.slug);
    }
  }
}

// Check source literals, including HUD/CSS backgrounds, audio and distribution URLs.
// Dynamic texture names are separately checked against the shared texture directory.
const sourceFiles = [];
for await (const file of files(path.join(root, 'src'))) {
  if (/\.(?:tsx?|css)$/.test(file)) sourceFiles.push(file);
}
sourceFiles.push(path.join(root, 'index.html'));
for (const file of sourceFiles) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\b(?:assets|mods|plugins)\/[A-Za-z0-9_./%-]+\.(?:png|jpe?g|webp|svg|ogg|mp3|wav|woff2?|jar|zip)\b/g)) {
    await checkExactFile(decodeURIComponent(match[0]), path.relative(root, file));
  }
  for (const match of text.matchAll(/['"]([A-Za-z0-9_-]+\.png)['"]/g)) {
    await checkExactFile(`assets/textures/minecraft/${match[1]}`, path.relative(root, file));
  }
  assert(!/\$\{basePath\}(?:maps|textures|sound|HUD|team)\//.test(text), `Stale resource prefix in ${path.relative(root, file)}`);
}

// Relative Markdown media/download links resolve from the actual Markdown folder.
for await (const file of files(path.join(publicDirectory, 'works'))) {
  if (!file.endsWith('.md')) continue;
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)) {
    const url = match[1];
    if (/^(?:[a-z][\w+.-]*:|#)/i.test(url)) continue;
    const decoded = decodeURIComponent(url.split(/[?#]/)[0]);
    assert(!decoded.startsWith('/'), `Root-absolute Markdown link breaks subdirectory hosting: ${file}`);
    await checkExactFile(path.relative(publicDirectory, path.resolve(path.dirname(file), decoded)).split(path.sep).join('/'), path.relative(root, file));
  }
}

let sources = 0;
for await (const file of files(path.join(root, 'content-sources/netease'))) {
  if (!file.endsWith('.json')) continue;
  const source = JSON.parse(await readFile(file, 'utf8'));
  await checkExactFile(source.descriptionMarkdown, path.relative(root, file));
  if (source.changelogMarkdown) await checkExactFile(source.changelogMarkdown, path.relative(root, file));
  if (source.cover?.localPath) await checkExactFile(source.cover.localPath, path.relative(root, file));
  if (source.gallery) {
    assert(Array.isArray(source.gallery.images), `Invalid gallery snapshot: ${file}`);
    const galleryPaths = new Set();
    for (const image of source.gallery.images) {
      assert(/^https:\/\//.test(image.sourceUrl) && image.sourceKind === 'store-gallery', `Unverified gallery source: ${file}`);
      assert(!galleryPaths.has(image.localPath), `Duplicate gallery image: ${file}`);
      galleryPaths.add(image.localPath);
      await checkExactFile(image.localPath, path.relative(root, file));
      assert.equal((await stat(path.join(publicDirectory, image.localPath))).size, image.bytes, `Gallery byte count differs: ${image.localPath}`);
    }
  }
  sources += 1;
}

console.log(`Validated ${checked.size} exact-case resource/content paths, ${sources} source snapshots and category consistency.`);
