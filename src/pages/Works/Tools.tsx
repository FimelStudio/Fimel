import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkLayout } from './WorkLayout';
import { MaterialCard } from '../../components/cards/MaterialCard';
import { useWorksData } from '../../hooks/useWorksData';
import { useDownloadCounters } from '../../hooks/useDownloadCounters';

const DOWNLOAD_TRACKED_WORKS = ['minecraft-obj-cubizer'] as const;

export const Tools: React.FC = () => {
  const { isDark, basePath } = useOutletContext<{ isDark: boolean; basePath: string }>();
  const { t, i18n } = useTranslation();
  const { toolsEntries } = useWorksData();
  const { configured, counts, loading, recordDownload } = useDownloadCounters(DOWNLOAD_TRACKED_WORKS);
  
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language);
  const getDownloadCounterLabel = (slug?: string) => {
    if (!slug) return undefined;
    if (!configured) return t('workPages.download_count_pending');
    if (loading) return t('workPages.download_count_loading');
    return t('workPages.download_count_metric', { count: numberFormatter.format(counts[slug] ?? 0) });
  };
  
  return (
    <WorkLayout page="tools" isDark={isDark} basePath={basePath}>
      <div className="space-y-16">
        {toolsEntries.map((work, idx) => (
          <MaterialCard 
            key={work.title} 
            work={work} 
            idx={idx} 
            basePath={basePath} 
            downloadLabel={work.downloadSlug ? getDownloadCounterLabel(work.downloadSlug) : undefined}
            onDownload={(slug) => void recordDownload(slug)}
          />
        ))}
      </div>
    </WorkLayout>
  );
};
