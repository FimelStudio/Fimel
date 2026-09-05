import React from 'react';
import { Download, Star, MessageCircle, Package, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BedrockEntry } from '../../hooks/useWorksData';

interface ShowcaseCardProps {
  work: BedrockEntry & { title: string; subtitle: string; category: string; genre: string; desc: string; players: string; components: string[] };
  basePath: string;
  compact?: boolean;
  onHoverEnter?: (info: { visible: boolean; title: string; category: string; desc: string }) => void;
  onHoverLeave?: () => void;
}

export const ShowcaseCard: React.FC<ShowcaseCardProps> = ({ work, basePath, compact = false, onHoverEnter, onHoverLeave }) => {
  const { t } = useTranslation();

  return (
    <article
      className={`reveal-up group bg-white/40 dark:bg-black/40 border border-obsidian/5 dark:border-white/5 hover:border-obsidian/20 dark:hover:border-white/20 transition-colors duration-500 ${compact ? 'flex flex-col' : 'grid lg:grid-cols-[0.95fr_1.05fr] gap-0'}`}
      onMouseEnter={() => onHoverEnter && onHoverEnter({ visible: true, title: work.title, category: work.genre, desc: work.desc })}
      onMouseLeave={() => onHoverLeave && onHoverLeave()}
    >
      <a href={work.link} target="_blank" rel="noopener noreferrer" className="hover-target block relative min-h-[18rem] md:min-h-[24rem] overflow-hidden isolate" aria-label={t('works.open_detail_aria', { title: work.title })}>
        <img src={`${basePath}${work.image}`} alt={work.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" />
        <div className={`absolute inset-0 bg-gradient-to-br ${work.bg} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-multiply dark:mix-blend-screen`}></div>
        <div className="absolute left-4 top-4 bg-black/70 text-white text-[10px] uppercase tracking-[0.2em] font-mono px-3 py-2">{work.category}</div>
      </a>
      <div className="p-6 md:p-8 flex flex-col justify-between gap-8 h-full">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] font-mono text-gray-500">
            <span>{work.genre}</span>
            <span className="h-px w-8 bg-obsidian/20 dark:bg-white/20"></span>
            <span>{work.players}</span>
          </div>
          <p className="mt-6 text-xs font-mono uppercase tracking-[0.25em] text-gray-500">{work.subtitle}</p>
          <h3 className={`mt-3 text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-obsidian dark:text-white transition-colors duration-500 ${work.accent}`}>
            {work.title}
          </h3>
          <p className="mt-5 text-gray-600 dark:text-gray-400 leading-relaxed">{work.desc}</p>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 text-xs font-mono text-obsidian dark:text-white">
            <span className="flex items-center gap-2"><Download className="w-4 h-4 text-diamond" />{t('works.downloads_metric', { downloads: work.downloads })}</span>
            <span className="flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" />{t('works.rating_metric', { rating: work.rating })}</span>
            <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-amethyst" />{t('works.comments_metric', { comments: work.comments, remarks: work.remarks })}</span>
            <span className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-500" />{work.size} · {work.version}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {work.components.map((component) => (
              <span key={component} className="border border-obsidian/10 dark:border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{component}</span>
            ))}
          </div>
          <a href={work.link} target="_blank" rel="noopener noreferrer" className="hover-target w-fit flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-gray-500 hover:text-obsidian dark:hover:text-white transition-colors">
            <ExternalLink className="w-4 h-4" /> {t('workPages.open_external')}
          </a>
        </div>
      </div>
    </article>
  );
};
