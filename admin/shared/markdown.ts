import type { Asset, Work } from './model';

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
