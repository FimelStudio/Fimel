/** Keep explicitly sized table icons compact in both the reader and Admin preview. */
export function MarkdownImage({ src, alt, title, width, height }: { src?: string; alt?: string; title?: string; width?: number | string; height?: number | string }) {
  const dimension = (value: number | string | undefined) => value && /^[1-9]\d{0,3}$/.test(String(value)) && Number(value) <= 4096 ? Number(value) : undefined;
  const w = dimension(width), h = dimension(height);
  return <img src={src} alt={alt ?? ''} title={title} width={w} height={h} style={w || h ? { width: w, height: h, objectFit: 'contain' } : undefined} loading="lazy" decoding="async"/>;
}
