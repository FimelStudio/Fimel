import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const catalogue = JSON.parse(await readFile(path.join(dist, 'works/catalogue.json'), 'utf8'));
const redirects = {};
const excluded = new Set();
for (const project of catalogue.projects) {
  if (!project.downloadUrl) continue;
  const url = new URL(project.downloadUrl);
  if (url.origin !== 'https://download.studiofimel.com' || !url.pathname.startsWith(`/works/${project.type}/${project.slug}/`)) {
    throw new Error(`Invalid R2 download URL: ${project.slug}`);
  }
  for (const legacy of [project.download, project.fallbackDownload]) {
    if (!legacy || /^https?:\/\//.test(legacy)) continue;
    const normalized = legacy.replace(/^\/+/, '');
    const target = path.resolve(dist, normalized);
    if (!target.startsWith(`${dist}${path.sep}`) || /[\r\n]/.test(normalized)) throw new Error('Unsafe legacy download path.');
    redirects[`/${normalized}`] = project.downloadUrl;
    excluded.add(normalized);
  }
}
await mkdir(path.join(dist, 'downloads'), { recursive: true });
await writeFile(path.join(dist, 'downloads/r2-redirects.json'), `${JSON.stringify(redirects, null, 2)}\n`);
// GitHub Pages still ships original legacy assets; Wrangler excludes them.
// Neither source release files nor remote objects are deleted or modified.
await writeFile(path.join(dist, '.assetsignore'), `${[...excluded].join('\n')}\n`);
console.log(`Prepared ${Object.keys(redirects).length} legacy R2 redirects; no binary fragments required.`);
