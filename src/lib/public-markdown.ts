import { Marked } from 'marked';
import { documentationBlocks, plainHeading } from '../content/documentation-markdown';
import { inlineImages } from '../content/markdown-images';
import { privateDocsImageUrl } from '../content/docs';
import { legacyPublicPath, unsafeUrlCharacters } from './public-routing';

export const PUBLIC_ORIGIN = 'https://studiofimel.com';
export const DOWNLOAD_ORIGIN = 'https://download.studiofimel.com';
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

/** Author links are rendered, never fetched by the server. */
export function publicUrl(value: string | undefined, base = PUBLIC_ORIGIN + '/', image = false): string | undefined {
  if (!value || unsafeUrlCharacters(value)) return;
  const legacy = legacyPublicPath(value);
  try {
    const url = new URL(legacy ? PUBLIC_ORIGIN + legacy : value, base);
    if (url.username || url.password || !['https:', 'http:', ...(image ? [] : ['mailto:'])].includes(url.protocol)) return;
    if (privateDocsImageUrl(url.href)) return;
    return url.href;
  } catch { return; }
}

/** GFM without arbitrary author HTML; matches the reader's img-only HTML policy. */
export function publicMarkdown(source: string, base: string, pageUrl = PUBLIC_ORIGIN + '/'): string {
  const headingIds = new Set<string>();
  const image = (src: string, alt: string, title?: string | null, width?: number, height?: number) => {
    const url = publicUrl(src, base, true);
    return url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''}${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''} loading="lazy" decoding="async">` : escapeHtml(alt);
  };
  const parser = new Marked({ gfm: true, async: false, renderer: {
    heading({ tokens, depth, text }) {
      const stem = plainHeading(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
      let id = stem, index = 1;
      while (headingIds.has(id)) id = `${stem}-${++index}`;
      headingIds.add(id);
      return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    html({ text }) {
      // A complete, standalone img is the only supported raw HTML element.
      if (!/^\s*<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>\s*$/i.test(text)) return '';
      const item = inlineImages(text)[0];
      return item ? image(item.src, item.alt, item.title, item.width, item.height) : '';
    },
    image({ href, text, title }) { return image(href, text, title); },
    link({ href, title, tokens }) {
      const url = publicUrl(href, href.startsWith('#') && !href.startsWith('#/') ? pageUrl : base), label = this.parser.parseInline(tokens);
      return url ? `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>` : label;
    },
  } });
  return documentationBlocks(source).map(block => block.kind === 'markdown'
    ? parser.parse(block.content, { async: false })
    : `<section class="public-split public-split-${block.side}"><div>${parser.parse(block.image, { async: false })}</div><div>${parser.parse(block.content, { async: false })}</div></section>`).join('\n');
}
