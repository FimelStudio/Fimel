import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { assetUrl } from '../content/projects';

const markdownCache = new Map<string, string>();

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
  return <div className="project-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ href, children }) => {
      if (href?.startsWith('#/')) return <Link to={href.slice(1)}>{children}</Link>;
      const resolved = href ? new URL(href, fileUrl).href : undefined;
      const external = resolved ? new URL(resolved).origin !== window.location.origin : false;
      return <a href={resolved} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} download={resolved && /\.(jar|zip)(?:\?|$)/i.test(resolved) && !external ? true : undefined}>{children}</a>;
    },
    img: ({ src, alt }) => <img src={typeof src === 'string' ? new URL(src, fileUrl).href : undefined} alt={alt ?? ''} loading="lazy" decoding="async" />,
    table: ({ children }) => <div className="markdown-table-scroll"><table>{children}</table></div>,
  }}>{content}</Markdown></div>;
}
