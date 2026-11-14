/** Only img markup is supported: never pass author HTML to the browser. */
export type InlineImage = { src: string; alt: string; title?: string; width?: number; height?: number; start: number; end: number };
const imageTag = /<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
function entities(value: string) {
  return value.replace(/&(?:#x([a-f\d]+)|#(\d+)|(amp|quot|apos|lt|gt|colon));/gi, (raw, hex, decimal, name) => {
    if (name) return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', colon: ':' } as Record<string, string>)[name.toLowerCase()];
    const code = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : raw;
  });
}
export function inlineImages(source: string): InlineImage[] {
  const images: InlineImage[] = [];
  for (const match of source.matchAll(imageTag)) {
    const attributes = new Map<string, { value: string; start: number; end: number }>();
    const raw = match[0]; let cursor = 4, valid = true;
    const attr = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
    while (cursor < raw.length) {
      if (/^\s*\/?\s*>$/.test(raw.slice(cursor))) break;
      attr.lastIndex = cursor; const item = attr.exec(raw);
      if (!item) { valid = false; break; }
      const key = item[1].toLowerCase(), value = item[2] ?? item[3] ?? item[4] ?? '';
      if (attributes.has(key)) { valid = false; break; }
      const local = item.index + item[0].length - value.length - (item[2] !== undefined || item[3] !== undefined ? 1 : 0);
      attributes.set(key, { value: entities(value), start: match.index! + local, end: match.index! + local + value.length });
      cursor = attr.lastIndex;
    }
    const src = attributes.get('src');
    if (!valid || !src?.value) continue;
    const dimension = (key: string) => { const value = attributes.get(key)?.value; return value && /^[1-9]\d{0,3}$/.test(value) && Number(value) <= 4096 ? Number(value) : undefined; };
    images.push({ src: src.value, alt: attributes.get('alt')?.value ?? '', ...(attributes.has('title') ? { title: attributes.get('title')!.value } : {}), width: dimension('width'), height: dimension('height'), start: src.start, end: src.end });
  }
  return images;
}
