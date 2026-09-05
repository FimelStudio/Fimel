import React from 'react';
import { Download, Code } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectEntry } from '../../hooks/useWorksData';

interface MaterialCardProps {
  work: ProjectEntry;
  idx: number;
  basePath: string;
  downloadLabel?: string;
  onDownload?: (slug: string) => void;
}

const TexturePanel = ({ texture, code, image, title, basePath }: { texture: string, code: string, image?: string, title?: string, basePath: string }) => (
  <div className="relative min-h-[18rem] md:min-h-[24rem] overflow-hidden bg-[#e0e0e0] dark:bg-[#0a0a0a] border border-obsidian/5 dark:border-white/5 rounded-sm isolate">
    {image ? (
      <img src={image} alt={title ?? code} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" />
    ) : (
      <div
        className="absolute inset-[-20%] w-[140%] h-[140%] bg-repeat image-rendering-pixelated opacity-60 dark:opacity-40 group-hover:scale-110 transition-transform duration-[1.5s] ease-out"
        style={{
          backgroundImage: texture === 'amethyst'
            ? `url(${basePath}textures/diamond_block.png)`
            : `url(${basePath}textures/${texture})`,
          backgroundSize: '128px'
        }}
      />
    )}
    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 mix-blend-overlay"></div>
    <div className={`absolute inset-0 flex items-center justify-center mix-blend-overlay ${image ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-700' : ''}`}>
      <span className="text-obsidian/20 dark:text-white/20 font-black text-5xl md:text-7xl tracking-tighter">{code}</span>
    </div>
  </div>
);

export const MaterialCard: React.FC<MaterialCardProps> = ({ work, idx, basePath, downloadLabel, onDownload }) => {
  const { t } = useTranslation();

  return (
    <article className="reveal-up group grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-12 items-stretch">
      <TexturePanel texture={work.texture} code={`DEV_${idx + 1}`} image={work.image} title={work.title} basePath={basePath} />
      <div className="flex flex-col justify-center border-y border-obsidian/10 dark:border-white/10 py-8">
        <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.22em] font-mono text-gray-500">
          <span>{work.category}</span>
          <span>{work.status}</span>
        </div>
        <p className="mt-8 text-xs font-mono uppercase tracking-[0.25em] text-gray-500">{work.subtitle}</p>
        <h3 className={`mt-3 text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-obsidian dark:text-white transition-colors duration-500 ${work.accent}`}>
          {work.title}
        </h3>
        <p className="mt-7 text-gray-600 dark:text-gray-400 text-base md:text-lg leading-relaxed max-w-xl">{work.desc}</p>
        <div className="mt-7 flex flex-wrap gap-2">
          {work.tags.map((tag) => (
            <span key={tag} className="border border-obsidian/10 dark:border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{tag}</span>
          ))}
        </div>
        {(work.version || work.author || work.fileLabel) && (
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-gray-500">
            {work.version && <span>{t('workPages.tools.objCubizer.version_label')}: {work.version}</span>}
            {work.author && <span>{t('workPages.tools.objCubizer.author_label')}: {work.author}</span>}
            {work.fileLabel && <span>{t('workPages.tools.objCubizer.file_label')}: {work.fileLabel}</span>}
          </div>
        )}
        {work.downloadSlug && downloadLabel && (
          <div className="mt-5 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-gray-500">
            <Download className="w-4 h-4 text-diamond" />
            <span>{downloadLabel}</span>
          </div>
        )}
        {(work.download || work.repo) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {work.download && (
              <a
                href={work.download}
                download
                onClick={() => {
                  if (work.downloadSlug && onDownload) {
                    onDownload(work.downloadSlug);
                  }
                }}
                className="hover-target w-fit flex items-center gap-3 border border-obsidian dark:border-white px-5 py-4 text-xs uppercase tracking-[0.2em] font-mono hover:text-diamond hover:border-diamond transition-colors"
              >
                <Download className="w-4 h-4" /> {t('workPages.tools.objCubizer.download')}
              </a>
            )}
            {work.repo && (
              <a
                href={work.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="hover-target w-fit flex items-center gap-3 border border-obsidian/25 dark:border-white/25 px-5 py-4 text-xs uppercase tracking-[0.2em] font-mono text-gray-600 dark:text-gray-300 hover:text-obsidian hover:border-obsidian dark:hover:text-white dark:hover:border-white transition-colors"
              >
                <Code className="w-4 h-4" /> {t('workPages.tools.objCubizer.repo')}
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
