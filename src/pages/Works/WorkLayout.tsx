import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ParticleCubes } from '../../components/ParticleBackground';

export type WorkPageKey = 'maps-unified' | 'mods' | 'tools';

interface WorkLayoutProps {
  page: WorkPageKey;
  isDark: boolean;
  basePath: string;
  totalBedrockMaps?: number;
  children: React.ReactNode;
}

export const WorkLayout: React.FC<WorkLayoutProps> = ({ page, isDark, basePath, totalBedrockMaps = 8, children }) => {
  const { t } = useTranslation();

  const pageCopy = {
    'maps-unified': {
      eyebrow: t('workPages.maps.eyebrow'),
      title: t('workPages.maps.title'),
      desc: t('workPages.maps.desc'),
      accent: 'text-diamond',
      line: 'bg-diamond',
      texture: 'emerald_block.png',
      statValue: `${totalBedrockMaps}+`,
      mode: t('workPages.status.live')
    },
    mods: {
      eyebrow: t('workPages.mods.eyebrow'),
      title: t('workPages.mods.title'),
      desc: t('workPages.mods.desc'),
      accent: 'text-emerald-500',
      line: 'bg-emerald-500',
      texture: 'redstone_block.png',
      statValue: '1',
      mode: t('workPages.status.wip')
    },
    tools: {
      eyebrow: t('workPages.tools.eyebrow'),
      title: t('workPages.tools.title'),
      desc: t('workPages.tools.desc'),
      accent: 'text-blue-500',
      line: 'bg-blue-500',
      texture: 'iron_block.png',
      statValue: '2',
      mode: t('workPages.status.released_research')
    }
  }[page];

  const heroStats = [
    { label: t('workPages.stats.projects'), value: pageCopy.statValue },
    { label: t('workPages.stats.platform'), value: page === 'maps-unified' ? 'Bedrock / Java' : 'Fimel' },
    { label: t('workPages.stats.mode'), value: pageCopy.mode }
  ];

  return (
    <div className="min-h-screen bg-paper dark:bg-obsidian text-obsidian dark:text-white transition-colors duration-700">
      <section className="relative min-h-[82vh] overflow-hidden flex items-center px-6 md:px-16 lg:px-24 pt-36 pb-20 border-b border-obsidian/10 dark:border-white/10">
        <div className="parallax-hero absolute inset-[-10%] w-[120%] h-[120%] opacity-40 pointer-events-none">
          <ParticleCubes isDark={isDark} />
        </div>
        <div
          className="absolute right-[-10%] bottom-[-20%] w-[55vw] h-[55vw] max-w-[680px] max-h-[680px] opacity-[0.07] dark:opacity-10 bg-repeat image-rendering-pixelated pointer-events-none"
          style={{ 
            backgroundImage: `url(${basePath}textures/${pageCopy.texture})`, 
            backgroundSize: '96px',
            maskImage: 'radial-gradient(ellipse at bottom right, black 20%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at bottom right, black 20%, transparent 70%)'
          }}
        ></div>
        <div className="relative z-10 max-w-screen-2xl w-full">
          <Link to="/" className="hover-target inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-gray-500 hover:text-obsidian dark:hover:text-white transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" /> {t('workPages.back_home')}
          </Link>
          <p className={`hero-sub font-mono text-sm uppercase tracking-[0.35em] mb-6 ${pageCopy.accent}`}>{pageCopy.eyebrow}</p>
          <h1 className="hero-title text-[17vw] md:text-[11vw] lg:text-[8vw] leading-[0.85] font-black uppercase tracking-tighter max-w-6xl">
            {pageCopy.title}
          </h1>
          <p className="hero-sub mt-10 max-w-3xl text-lg md:text-2xl leading-relaxed text-gray-600 dark:text-gray-400 font-light">
            {pageCopy.desc}
          </p>
          <div className="hero-sub mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
            {heroStats.map((stat) => (
              <div key={stat.label} className="border-y border-obsidian/10 dark:border-white/10 py-5">
                <div className={`text-3xl font-black uppercase ${pageCopy.accent}`}>{stat.value}</div>
                <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-20 px-6 md:px-16 lg:px-24 py-24 md:py-32 bg-paper dark:bg-obsidian">
        <div className="max-w-screen-2xl mx-auto">
          {children}
        </div>
      </section>
    </div>
  );
};
