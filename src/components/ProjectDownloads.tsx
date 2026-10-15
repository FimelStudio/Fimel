import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { Project } from '../content/projects';
import type { DownloadRelease } from '../content/releases';
import { fileSize } from '../content/releases';
import { ProjectDownload } from './ProjectDownload';

const copy = {
  zh: { version: '下载版本', latest: '最新', game: '游戏版本', loader: '加载器', platform: '运行平台', files: '下载文件', primary: '推荐文件', date: '发布日期', checksum: '查看 SHA-256 校验值', empty: '该版本暂无可下载文件。', preview: '预览中不下载文件' },
  en: { version: 'Download version', latest: 'Latest', game: 'Game versions', loader: 'Loader', platform: 'Platform', files: 'Files', primary: 'Recommended file', date: 'Released', checksum: 'Show SHA-256 checksum', empty: 'No downloadable files in this release.', preview: 'Downloads disabled in preview' },
  ja: { version: 'ダウンロードするバージョン', latest: '最新', game: 'ゲームバージョン', loader: 'ローダー', platform: '対応環境', files: 'ファイル', primary: '推奨ファイル', date: '公開日', checksum: 'SHA-256 を表示', empty: 'このバージョンにはダウンロードファイルがありません。', preview: 'プレビューではダウンロードできません' },
};
export function ProjectDownloads({ project, releases = [], onDownload, preview = false }: { project: Project; releases?: DownloadRelease[]; onDownload?: () => void; preview?: boolean }) {
  const { i18n } = useTranslation(); const labels = copy[(i18n.resolvedLanguage?.split('-')[0] ?? 'zh') as keyof typeof copy] ?? copy.en;
  const [selected, setSelected] = useState(''); const available=releases.filter(r=>r.files.length);const release = available.find(r => r.id === selected) ?? available[0];
  const metadata = release ? [[labels.game, release.gameVersions.join(' / ')], [labels.loader, release.loaders?.join(' / ')], [labels.platform, (release.platforms?.length ? release.platforms : project.platform).join(' / ')], [labels.date, release.date]] : [[labels.version, project.version], [labels.platform, project.platform.join(' / ')], [labels.files, project.size]];
  if (!release&&!project.downloadUrl&&!project.download&&!project.latestReleaseRepo)return null;
  if (!release) return <div className="space-y-3">{!preview && <ProjectDownload project={project} onDownload={onDownload} />}<dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-content-muted">{metadata.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="inline">{label}：</dt><dd className="inline">{value}</dd></div>)}</dl></div>;
  return <section aria-label={labels.files} className="basis-full w-full max-w-3xl space-y-4 rounded-sm border border-line bg-surface p-4 sm:p-5">
    <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">{labels.version}<select value={release.id} onChange={event => setSelected(event.target.value)} className="min-h-11 max-w-full rounded-sm border border-line bg-canvas px-3 text-content">{available.map((r, index) => <option key={r.id} value={r.id}>{r.label}{index === 0 ? ` · ${labels.latest}` : ''}</option>)}</select></label>
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-content-muted">{metadata.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="inline">{label}：</dt><dd className="inline">{value}</dd></div>)}</dl>
    {!release.files.length && <p className="text-sm text-content-muted">{labels.empty}</p>}
    <ul className="space-y-3">{release.files.map(file => <li key={file.id} className="min-w-0 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><strong className="block break-all text-sm">{file.displayName ?? file.name}</strong><p className="mt-1 text-xs text-content-muted">{fileSize(file.size)}{file.primary ? ` · ${labels.primary}` : ''}</p></div>
        {preview ? <span className="text-xs text-content-muted">{labels.preview}</span> : <a href={file.publicUrl} download onClick={onDownload} className="hover-target inline-flex min-h-11 items-center gap-2 rounded-sm bg-content px-4 text-sm font-semibold text-canvas outline-offset-2 hover:bg-brand focus-visible:outline-2 focus-visible:outline-link"><Download size={16} aria-hidden />{labels.files}</a>}</div>
      <details className="mt-2 text-xs text-content-muted"><summary className="hover-target inline-flex min-h-8 cursor-pointer items-center">{labels.checksum}</summary><code className="block break-all select-all py-2">{file.sha256}</code></details>
    </li>)}</ul>
  </section>;
}
