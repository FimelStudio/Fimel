import { useEffect, useState } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { assetUrl } from '../content/projects';
import { ProjectGallery, type ProjectGalleryImage } from './ProjectGallery';

const markdownCache = new Map<string, string>();
function resolveContentUrl(value: string | undefined, base: URL, image = false): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value, base);
    if (!['https:', 'http:', ...(image ? [] : ['mailto:'])].includes(url.protocol)) return;
    return url.href;
  } catch { return; }
}

export function ProjectMarkdown({ path }: { path: string }) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [content, setContent] = useState<string | null>(() => markdownCache.get(path) ?? null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (markdownCache.has(path)) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort('timeout'), 10_000);
    const load = async () => {
      try {
        const response = await fetch(assetUrl(path), { signal: controller.signal });
        if (!response.ok) throw new Error(`Markdown returned HTTP ${response.status}`);
        const text = await response.text();
        if (/^\s*(?:<!doctype html|<html)/i.test(text)) throw new Error('Markdown path returned the SPA fallback.');
        if (controller.signal.aborted) return;
        markdownCache.set(path, text);
        setContent(text);
        setError(false);
      } catch (cause) {
        if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
        console.warn('Unable to load project content:', cause);
        setError(true);
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void load();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [path, attempt]);
  if (error) return <div role="alert" className="py-10"><p>{t('project.content_error')}</p><button type="button" onClick={() => { setError(false); setAttempt((value) => value + 1); }} className="mt-4 border border-current px-5 min-h-11">{t('project.retry')}</button></div>;
  if (content === null) return <div role="status" aria-label={t('project.loading')} className="space-y-4 py-3"><div className="h-7 w-1/2 bg-obsidian/5 dark:bg-surface-raised animate-pulse motion-reduce:animate-none" /><div className="h-28 bg-obsidian/5 dark:bg-surface-raised animate-pulse motion-reduce:animate-none" /></div>;
  const fileUrl = new URL(assetUrl(path), window.location.origin);
  return <ProjectMarkdownBody content={content} fileUrl={fileUrl} />;
}

/** Shared by the public reader and authenticated Admin preview. */
export function ProjectMarkdownBody({ content, fileUrl, resolveAsset }: {
  content: string; fileUrl: URL; resolveAsset?: (id: string) => string | undefined;
}) {
  return <div className="project-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml
    urlTransform={(url, key) => url.startsWith('fimel-asset:') ? key === 'src' ? resolveAsset?.(url.slice('fimel-asset:'.length)) ?? '' : '' : defaultUrlTransform(url)} components={{
    p: ({ node, children }) => {
      // Standard Markdown: adjacent image lines (no blank line) form one
      // image-only paragraph. Mixed text or linked images stay normal prose.
      const imageOnly = node?.children.length && node.children.every((child) =>
        child.type === 'element' && child.tagName === 'img' || child.type === 'text' && !child.value.trim());
      if (imageOnly) {
        const images: ProjectGalleryImage[] = [];
        for (const child of node!.children) {
          if (child.type !== 'element' || child.tagName !== 'img' || typeof child.properties.src !== 'string' || !child.properties.src) continue;
          try {
            const src = resolveContentUrl(child.properties.src, fileUrl, true);
            if (src) images.push({ src, alt: String(child.properties.alt ?? '') });
          } catch {
            // An invalid image URL must not prevent the project text loading.
          }
        }
        if (images.length) return <ProjectGallery key={images.map((image) => image.src).join('|')} images={images} />;
      }
      return <p>{children}</p>;
    },
    a: ({ href, children }) => {
      if (!resolveAsset && href?.startsWith('#/')) return <Link to={href.slice(1)}>{children}</Link>;
      const resolved = resolveContentUrl(href, fileUrl);
      const external = resolved ? new URL(resolved).origin !== window.location.origin : false;
      return <a href={resolved} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} download={resolved && /\.(jar|zip)(?:\?|$)/i.test(resolved) && !external ? true : undefined}>{children}</a>;
    },
    img: ({ src, alt }) => <img src={resolveContentUrl(typeof src === 'string' ? src : undefined, fileUrl, true)} alt={alt ?? ''} loading="lazy" decoding="async" />,
    table: ({ children }) => <div className="markdown-table-scroll"><table>{children}</table></div>,
  }}>{content}</Markdown></div>;
}
