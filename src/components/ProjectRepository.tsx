import { Code } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = { repository?: string; preview?: boolean; className?: string };

export function ProjectRepository({ repository, preview = false, className = 'hover-target inline-flex items-center gap-2 min-h-12 px-4 rounded-sm border border-obsidian/20 dark:border-line text-sm dark:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link' }: Props) {
  const { t } = useTranslation();
  if (!repository) return null;
  try {
    const url = new URL(repository);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
  } catch { return null; }
  const content = <><Code size={16} aria-hidden/>{t('project.repository')}</>;
  return preview ? <button type="button" className={className} disabled>{content}</button> : <a href={repository} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>;
}
