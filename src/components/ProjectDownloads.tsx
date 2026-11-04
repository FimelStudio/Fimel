import { useTranslation } from 'react-i18next';
import { projectDownloadUrl } from '../content/projects';
import type { Project } from '../content/projects';
import type { DownloadRelease } from '../content/releases';
import { releaseProject } from '../content/releases';
import { ProjectDownload } from './ProjectDownload';

/** Only an unambiguous download may bypass the version list. */
export function ProjectDownloads({project,releases=[],onDownload,onSelectVersion,preview=false}:{project:Project;releases?:DownloadRelease[];onDownload?:()=>void;onSelectVersion?:()=>void;preview?:boolean}) {
  const { t } = useTranslation();
  const available = releases.filter(release => release.files.length);
  const selectVersion = available.length > 1 || available.some(release => release.files.length > 1);
  const singleRelease = available.length === 1 ? available[0] : undefined;
  const environment = singleRelease && !selectVersion
    ? [...(singleRelease.platforms?.length ? singleRelease.platforms : project.platform), ...singleRelease.gameVersions, ...(singleRelease.loaders ?? [])].join(' · ')
    : '';

  if (!available.length && !projectDownloadUrl(project) && !project.latestReleaseRepo) return null;

  return <div className="space-y-2">
    <ProjectDownload project={releaseProject(project,releases)} onDownload={onDownload} selectVersion={selectVersion} onSelectVersion={onSelectVersion} preview={preview}/>
    {environment && <p className="text-xs text-gray-600 dark:text-content-muted">{t('project.download_environment', { environment })}</p>}
  </div>;
}
