import { docsMarkdownImages } from '../../src/content/docs';

function localImageName(value: string): string | undefined {
  // Remote URLs, managed asset IDs and absolute paths must never be rebound by name.
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) return;
  try { return decodeURIComponent(value.split(/[?#]/)[0].split('/').pop() ?? ''); } catch { return; }
}
/** Rebind local Markdown/HTML destinations only; preserve table structure and dimensions. */
export function matchLocalImages(source: string, fileName: string, url: string) {
  const matches = docsMarkdownImages(source).filter(image => localImageName(image.url) === fileName);
  const paths = new Set(matches.map(image => image.url));
  if (paths.size > 1) throw new Error(`多处相对路径使用同名图片 ${fileName}，请先改为不同文件名再上传。`);
  let content = source;
  for (const image of matches.sort((a, b) => b.start - a.start)) content = content.slice(0, image.start) + url + content.slice(image.end);
  return { content, matched: matches.length > 0, shift: (position: number) => matches.filter(image => image.end <= position).reduce((sum, image) => sum + url.length - (image.end - image.start), 0) };
}
