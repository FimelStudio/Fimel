import type { Asset, Work } from './model';
import type { Locale } from './model';
import { localizedText } from '../../src/content/projects';

export function imageMarkdown(asset: Asset, url = `fimel-asset:${asset.id}`) {
  const name = (asset.displayName ?? asset.name).replace(/[\\[\]()]/g, '\\$&');
  return `![${name}](${url})`;
}

/** Uploaded images are private candidates until selected as a cover or explicitly referenced. */
export function referencedImages(markdown: Work['markdown']) {
  const ids = new Set<string>();
  for (const localized of Object.values(markdown)) for (const text of Object.values(localized)) {
    for (const match of (text ?? '').matchAll(/fimel-asset:([a-zA-Z0-9-]+)/g)) ids.add(match[1]);
  }
  return ids;
}

/** Keep version-page generation identical in publication and the visual preview. */
export function versionMarkdown(body:string,releases:Work['versions'],locale:Locale,url:(asset:Asset,release:Work['versions'][number])=>string) {
  for(const release of releases.filter(v=>v.status==='released')){
    body+=`\n\n## ${release.label} · ${release.date}\n\n${release.gameVersions.join(' / ')}\n\n${localizedText(release.changelog,locale)}\n\n`;
    for(const file of release.files)body+=`- [${(file.displayName??file.name).replace(/[\\[\]()]/g,'\\$&')}](${url(file,release)}) · ${(file.size/1024**2).toFixed(1)} MiB\n  - SHA-256: \`${file.sha256}\`\n`;
  }
  return body;
}
