import { ExternalLink } from 'lucide-react';
import type { Project } from '../../src/content/projects';
import type { Work } from '../shared/model';
import { safeUrl } from '../shared/validation';

export function ProjectMetadataFields({ work, update }: { work: Work; update(patch: Partial<Project>): void }) {
  const repository = work.project.repository ?? '';
  const valid = !!repository && safeUrl(repository);
  const error = !!repository && !valid;
  return <div className="full form-grid project-metadata-fields">
    <label className="full" htmlFor="project-repository">项目仓库地址（可选）<div className="repository-field-row"><input id="project-repository" aria-label="项目仓库地址" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://github.com/你的组织/项目" value={repository} aria-invalid={error} aria-describedby="project-repository-help" onChange={event => update({ repository: event.target.value.trim() || undefined })}/>{valid && <a className="button-link" href={repository} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>打开项目仓库</a>}</div><small id="project-repository-help" className={error ? 'field-error' : undefined}>{error ? '仓库地址须为完整 HTTPS 链接，且不能包含用户名或密码。请修正后再保存。' : '支持 GitHub、GitLab、Gitee 等 HTTPS 仓库。保存并确认发布后，官网作品页会显示“项目仓库”按钮；留空不显示。'}</small></label>
    <label htmlFor="project-published-date">首次发布日期（可选）<input id="project-published-date" aria-label="首次发布日期" type="date" value={work.project.published ?? ''} onChange={event => update({ published: event.target.value || undefined })}/><small>填写真实的首次发行日。留空时保留官网已记录的日期，或按最早公开发行版本的日期显示；后续更新不会改成当天。</small></label>
  </div>;
}
