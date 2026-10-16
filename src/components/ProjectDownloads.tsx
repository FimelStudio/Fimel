import type { Project } from '../content/projects';
import type { DownloadRelease } from '../content/releases';
import { releaseProject } from '../content/releases';
import { ProjectDownload } from './ProjectDownload';

/** Keep the original primary action in the header. Version browsing belongs to its tab. */
export function ProjectDownloads({project,releases=[],onDownload,preview=false}:{project:Project;releases?:DownloadRelease[];onDownload?:()=>void;preview?:boolean}) {
  return <ProjectDownload project={releaseProject(project,releases)} onDownload={onDownload} preview={preview}/>;
}
