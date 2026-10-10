import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { assetUrl } from '../content/projects';
import type { Project } from '../content/projects';

export function ProjectDownload({ project, onDownload }: { project: Project; onDownload?: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);
  const download = async () => {
    if (busyRef.current || !project.latestReleaseRepo) return;
    busyRef.current = true;
    setStatus('loading');
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), 8_000);
    try {
      const response = await fetch(`https://api.github.com/repos/${project.latestReleaseRepo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
      const release = await response.json() as { assets?: { name: string; state: string; browser_download_url: string }[] };
      const file = release.assets?.find((asset) => asset.state === 'uploaded' && /\.jar$/i.test(asset.name) && !/(sources|javadoc|dev)/i.test(asset.name));
      if (!file?.browser_download_url) throw new Error('No published JAR in the latest release.');
      window.location.assign(file.browser_download_url);
      setStatus('idle');
      onDownload?.();
    } catch (error) {
      // An unmounted page must not start a download after navigation.
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
      console.warn('Latest release unavailable; using local fallback.', error);
      if (project.fallbackDownload) {
        const link = document.createElement('a');
        link.href = assetUrl(project.fallbackDownload);
        link.download = project.fallbackFileName ?? '';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setStatus('idle');
        onDownload?.();
      } else setStatus('error');
    } finally {
      window.clearTimeout(timeout);
      busyRef.current = false;
      requestRef.current = null;
    }
  };
  const className = 'hover-target inline-flex items-center justify-center gap-2 min-h-12 px-5 bg-obsidian dark:bg-diamond text-white dark:text-obsidian border border-obsidian dark:border-diamond rounded-sm text-sm font-semibold hover:bg-[#007d7e] dark:hover:bg-[#35dddd] hover:border-[#007d7e] dark:hover:border-diamond focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link transition-colors whitespace-nowrap';
  if (project.latestReleaseRepo) return <div>
    <button type="button" onClick={() => void download()} disabled={status === 'loading'} aria-busy={status === 'loading'} className={`${className} disabled:opacity-60 disabled:cursor-wait`}>
      <Download size={17} aria-hidden />{t(status === 'loading' ? 'project.downloading' : 'project.download_latest')}
    </button>
    {status === 'error' && <p role="status" className="mt-2 text-sm text-amber-700 dark:text-amber-400">{t('project.release_error')} <a className="underline" href={project.releasePage ?? `https://github.com/${project.latestReleaseRepo}/releases`} target="_blank" rel="noopener noreferrer">{t('project.releases')}</a></p>}
  </div>;
  if (project.download) return <a href={assetUrl(project.download)} download onClick={onDownload} className={className}><Download size={17} aria-hidden />{t('project.download')}</a>;
  return null;
}
