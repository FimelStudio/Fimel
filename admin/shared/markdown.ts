import type { Asset } from './model';

export function imageMarkdown(asset: Asset, url = `fimel-asset:${asset.id}`) {
  const name = (asset.displayName ?? asset.name).replace(/[\\[\]()]/g, '\\$&');
  return `![${name}](${url})`;
}

/** Preserve explicitly positioned image groups; append only the remaining screenshots. */
export function appendGallery(markdown: string, assets: Asset[]) {
  const placed = new Set([...markdown.matchAll(/fimel-asset:([a-zA-Z0-9-]+)/g)].map(match => match[1]));
  const remaining = assets.filter(asset => !placed.has(asset.id) && !(asset.publicUrl && markdown.includes(asset.publicUrl)));
  return remaining.length ? `${markdown}\n\n${remaining.map(asset => imageMarkdown(asset)).join('\n')}` : markdown;
}
