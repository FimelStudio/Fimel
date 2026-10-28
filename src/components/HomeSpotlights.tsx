import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import { useProjectCatalogue } from '../hooks/useProjectCatalogue';
import { assetUrl, localizedText } from '../content/projects';
import { SPOTLIGHT_KEYS, spotlightCopy } from '../content/home-spotlights';
import { TiltGlareCard } from './TiltGlareCard';

export function HomeSpotlights() {
  const { t, i18n } = useTranslation();
  const { site, projects } = useProjectCatalogue();
  const navigate = useNavigate();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const open = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); navigate(path);
  };
  return <section id="quick-entry" className="scroll-mt-[136px] md:scroll-mt-[160px] py-20 md:py-28 px-6 md:px-16 lg:px-24 bg-[#e5e5e5] dark:bg-surface transition-colors duration-700">
    <div className="max-w-screen-xl mx-auto">
      <h2 className="reveal-up mb-10 md:mb-14 max-w-4xl text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-obsidian dark:text-content">{localizedText(site?.home?.quickTitle, language) || t('home.quick_title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
        {SPOTLIGHT_KEYS.map(key => {
          const copy = spotlightCopy(key, site?.home?.spotlights?.[key], projects, t, language);
          return <TiltGlareCard key={key} href={`#${copy.href}`} onClick={event => open(event, copy.href)} className={`hover-target reveal-up group min-h-[24rem] md:min-h-[30rem] overflow-hidden border border-white/15 rounded-sm bg-obsidian text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link col-span-1 md:col-span-12 ${key === 'maps' ? 'lg:col-span-7' : key === 'mods' ? 'lg:col-span-5' : 'lg:col-span-12 md:min-h-[22rem]'}`}>
            <img src={assetUrl(copy.image)} alt="" loading="lazy" decoding="async" className={`absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none ${key === 'tools' ? 'object-contain object-right opacity-70 md:pr-10 md:py-6' : 'object-cover'}`}/>
            <div className={`absolute inset-0 ${key === 'tools' ? 'bg-gradient-to-r from-black via-black/85 to-black/25' : 'bg-gradient-to-t from-black via-black/60 to-black/5'}`}/>
            <div className={`relative flex h-full min-h-[24rem] md:min-h-[30rem] flex-col justify-end p-7 md:p-10 ${key === 'tools' ? 'md:min-h-[22rem] md:max-w-[65%]' : ''}`}>
              <p className="text-xs text-white/85">{copy.label}</p>
              <h3 className="mt-4 text-3xl md:text-4xl font-bold leading-tight tracking-tight">{copy.title}</h3>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90">{copy.summary}</p>
              <span className="mt-7 inline-flex min-h-11 items-center gap-3 self-start border border-white/30 px-5 py-3 rounded-sm text-sm group-hover:bg-white group-hover:text-obsidian transition-colors">{t('home.enter')}<ArrowUpRight size={16} aria-hidden/></span>
            </div>
          </TiltGlareCard>;
        })}
      </div>
      <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2 text-sm text-obsidian dark:text-content">
        <Link to="/works?type=java" className="hover-target inline-flex min-h-11 items-center gap-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">{t('nav.nav_maps_je')}<ArrowUpRight aria-hidden size={16}/></Link>
        <Link to="/works?type=datapacks" className="hover-target inline-flex min-h-11 items-center gap-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">{t('nav.nav_datapacks')}<ArrowUpRight aria-hidden size={16}/></Link>
      </div>
    </div>
  </section>;
}
