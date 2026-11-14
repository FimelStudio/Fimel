import { useMemo, type ReactNode } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkImages } from '../content/remark-images';
import { MarkdownImage } from './MarkdownImage';
import { Link, useInRouterContext } from 'react-router-dom';
import type { Components } from 'react-markdown';
import { documentationBlocks, documentationHeadings } from '../content/documentation-markdown';
import './DocumentationBody.css';

/** One renderer for the public document reader and authenticated editor preview. */
export function DocumentationBody({ content, fileUrl, resolveImage }: { content: string; fileUrl?: URL; resolveImage?: (id: string) => string | undefined }) {
  const blocks = useMemo(() => documentationBlocks(content), [content]);
  const headings = useMemo(() => documentationHeadings(content), [content]);
  const inRouter = useInRouterContext();
  const base = fileUrl ?? new URL('https://studiofimel.com/');
  const resolved = (value: string | undefined, image = false): string | undefined => {
    if (!value) return undefined;
    if (image && value.startsWith('fimel-doc-image:')) {
      const preview = resolveImage?.(value.slice(16));
      value = preview ? new URL(preview, window.location.origin).href : undefined;
    }
    if (!value) return undefined;
    try { const url = new URL(value, base); return ['https:', 'http:', ...(image ? [] : ['mailto:'])].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
  };
  function render(value: string, line: number) {
    const heading = (level: 1 | 2 | 3 | 4 | 5 | 6): NonNullable<Components['h2']> => ({ node, children }) => {
      const originalLine = line + (node?.position?.start.line ?? 1) - 1;
      const id = headings.find(item => item.line === originalLine)?.id;
      const Tag = `h${level}` as const;
      return <Tag id={id} tabIndex={-1}>{children}</Tag>;
    };
    return <Markdown remarkPlugins={[remarkGfm, remarkImages]} skipHtml urlTransform={(url, key) => key === 'src' && url.startsWith('fimel-doc-image:') ? url : defaultUrlTransform(url)} components={{
      h1: heading(1), h2: heading(2), h3: heading(3), h4: heading(4), h5: heading(5), h6: heading(6),
      a: ({ href, children }) => {
        if (href?.startsWith('#/docs') && inRouter && !resolveImage) return <Link to={href.slice(1)}>{children}</Link>;
        if (href?.startsWith('#') && !href.startsWith('#/')) return <a href={href} onClick={event => {
          event.preventDefault();
          try { const id = decodeURIComponent(href.slice(1)); const scope = event.currentTarget.closest('.documentation-body'); const target = scope?.querySelector(`#${CSS.escape(id)}`); if (target instanceof HTMLElement) { event.preventDefault(); target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); } } catch { /* Leave malformed anchors inert. */ }
        }}>{children}</a>;
        const target = resolved(href);
        const external = !!target && new URL(target).origin !== window.location.origin;
        return <a href={target} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{children}</a>;
      },
      img: ({ src, alt, title, width, height }) => { const url = resolved(typeof src === 'string' ? src : undefined, true); return url ? <MarkdownImage src={url} alt={alt} title={title} width={width} height={height}/> : <span className="docs-image-placeholder">{alt || '图片暂不可用'}</span>; },
      table: ({ children }: { children?: ReactNode }) => <div className="markdown-table-scroll"><table>{children}</table></div>,
    }}>{value}</Markdown>;
  }
  return <div className="documentation-body project-markdown">{blocks.map((block, index) => block.kind === 'markdown' ? <div className="docs-prose" key={index}>{render(block.content, block.line)}</div> : <div className={`docs-image-text docs-image-${block.side}`} key={index}><div className="docs-image-column">{render(block.image, block.imageLine)}</div><div className="docs-text-column">{render(block.content, block.line)}</div></div>)}</div>;
}
