import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Diamond, ArrowUpRight } from 'lucide-react';
import { HeroTitleReveal } from '../components/HeroTitleReveal';
import { InteractiveStudioImage } from '../components/InteractiveStudioImage';
import { HomeSpotlights } from '../components/HomeSpotlights';
import { HomeFeaturedWorks } from '../components/HomeFeaturedWorks';
import { DeferredParticleScene } from '../components/DeferredScene';
import { RecentUpdates } from '../components/RecentUpdates';
import { useProjectCatalogue } from '../hooks/useProjectCatalogue';
import { localizedText } from '../content/projects';

export const Home: React.FC = () => {
  const { isDark, basePath } = useOutletContext<{ isDark: boolean; basePath: string }>();
  const { t, i18n } = useTranslation();
  const { site } = useProjectCatalogue();
  const studioTitle=localizedText(site?.studio.title,i18n.resolvedLanguage??'zh');
  const [tooltipContent, setTooltipContent] = useState<{ visible: boolean; title: string; category: string; desc: string }>({ visible: false, title: '', category: '', desc: '' });

  // Custom cursor follower logic for tooltip
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (tooltipRef.current && tooltipContent.visible) {
        const x = e.clientX + 15;
        const y = e.clientY + 15;
        const rect = tooltipRef.current.getBoundingClientRect();
        const adjustedX = x + rect.width > window.innerWidth ? e.clientX - rect.width - 5 : x;
        const adjustedY = y + rect.height > window.innerHeight ? e.clientY - rect.height - 5 : y;
        tooltipRef.current.style.transform = `translate(${adjustedX}px, ${adjustedY}px)`;
      }
    };
    
    if (tooltipContent.visible) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [tooltipContent.visible]);

  return (
    <>
      <section id="hero" className="relative w-full min-h-[100svh] overflow-hidden flex flex-col justify-center px-6 md:px-12 lg:px-20 bg-paper dark:bg-canvas transition-colors duration-700 pt-20">
        <div className="parallax-hero absolute inset-[-10%] w-[120%] h-[120%] z-0 pointer-events-none">
          <DeferredParticleScene isDark={isDark} />
        </div>
        
        <div className="w-full max-w-[1600px] mx-auto flex flex-col pointer-events-none">
          
          {/* Top-Left: "构筑" */}
          <div className="flex flex-col items-start w-full mix-blend-difference z-10">
            <div className="hero-sub pointer-events-auto flex items-center gap-4 mb-4 font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50">
              <span className="w-8 md:w-12 h-px bg-diamond"></span>
              {t('home.studio_label')}
            </div>
            <HeroTitleReveal delay={0.4} className="hero-title text-[22vw] lg:text-[18vw] leading-[0.8] font-black tracking-tighter uppercase text-white transition-colors duration-700 -ml-2 md:-ml-4">
              {t('hero.crafting')}
            </HeroTitleReveal>
          </div>

          {/* Middle: Subtext nested right below "构筑" */}
          <div className="w-full flex justify-start lg:pl-[2vw] mt-6 md:mt-10 mb-10 md:mb-16 pointer-events-auto z-20">
             <div className="max-w-md lg:max-w-xl pr-4">
                <p className="hero-sub text-base md:text-lg font-light tracking-wide text-gray-700 dark:text-content-muted leading-relaxed font-sans transition-colors duration-700">
                  <Trans i18nKey="hero.sub" />
                </p>
             </div>
          </div>

          {/* Bottom-Right: "THE 无限" */}
          <div className="flex flex-col items-end w-full mix-blend-difference z-10 lg:-mt-12">
            <HeroTitleReveal delay={0.6} className="hero-title text-[22vw] lg:text-[18vw] leading-[0.8] font-black tracking-tighter uppercase text-white transition-colors duration-700 flex items-baseline justify-end gap-3 md:gap-6 -mr-2 md:-mr-4">
              <span className="italic text-white/50 font-sans font-light text-[7vw] lg:text-[5vw] tracking-normal mb-2 md:mb-4">THE</span> {t('hero.worlds')}
            </HeroTitleReveal>
          </div>
          
          {/* Bottom-Right: CTAs under "无限" */}
          <div className="w-full flex justify-end mt-8 pointer-events-auto z-20">
            <div className="hero-sub flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link
                to="/"
                state={{ scrollTo: '#quick-entry' }}
                className="group relative inline-flex h-12 md:h-14 items-center justify-between gap-6 bg-obsidian dark:bg-diamond text-white dark:text-obsidian px-8 font-mono text-[10px] md:text-xs uppercase tracking-[0.15em] transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl hover:shadow-diamond/20"
              >
                <span className="relative z-10">{t('home.featured_cta')}</span>
                <ArrowUpRight className="w-4 h-4 relative z-10 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/works?type=java"
                className="group inline-flex h-12 md:h-14 items-center justify-between gap-6 border border-obsidian/30 dark:border-line bg-transparent dark:bg-surface-raised backdrop-blur-sm px-8 font-mono text-[10px] md:text-xs uppercase tracking-[0.15em] text-obsidian dark:text-content transition-all hover:border-obsidian dark:hover:border-content-muted hover:bg-obsidian/5 dark:hover:bg-surface hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{t('home.current_cta')}</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
          
        </div>
      </section>

      <div className="w-full overflow-hidden bg-obsidian dark:bg-diamond text-white dark:text-obsidian py-5 flex whitespace-nowrap z-10 relative transition-colors duration-700">
        <div className="animate-marquee flex gap-12 items-center text-2xl font-bold uppercase tracking-widest shrink-0 px-6">
          <span>{t('marq.pvp')}</span> <Diamond size={20} /> 
          <span>{t('marq.rpg')}</span> <Diamond size={20} /> 
          <span>{t('marq.puz')}</span> <Diamond size={20} /> 
          <span>{t('marq.vdl')}</span> <Diamond size={20} />
          <span>{t('marq.jve')}</span> <Diamond size={20} />
          <span>{t('marq.pvp')}</span> <Diamond size={20} /> 
          <span>{t('marq.rpg')}</span> <Diamond size={20} /> 
          <span>{t('marq.puz')}</span> <Diamond size={20} /> 
          <span>{t('marq.vdl')}</span> <Diamond size={20} />
          <span>{t('marq.jve')}</span> <Diamond size={20} />
        </div>
        <div className="animate-marquee flex gap-12 items-center text-2xl font-bold uppercase tracking-widest shrink-0 px-6" aria-hidden="true">
          <span>{t('marq.pvp')}</span> <Diamond size={20} /> 
          <span>{t('marq.rpg')}</span> <Diamond size={20} /> 
          <span>{t('marq.puz')}</span> <Diamond size={20} /> 
          <span>{t('marq.vdl')}</span> <Diamond size={20} />
          <span>{t('marq.jve')}</span> <Diamond size={20} />
          <span>{t('marq.pvp')}</span> <Diamond size={20} /> 
          <span>{t('marq.rpg')}</span> <Diamond size={20} /> 
          <span>{t('marq.puz')}</span> <Diamond size={20} /> 
          <span>{t('marq.vdl')}</span> <Diamond size={20} />
          <span>{t('marq.jve')}</span> <Diamond size={20} />
        </div>
      </div>

      <HomeSpotlights />

      <section id="about" className="relative px-6 md:px-16 lg:px-24 py-20 md:py-28 bg-paper dark:bg-canvas transition-colors duration-700">
        <div className="max-w-screen-xl mx-auto grid lg:grid-cols-[1fr_1.1fr] items-center gap-10 lg:gap-16">
          <div className="min-w-0 space-y-7">
            <h2 className="reveal-up text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tighter text-obsidian dark:text-content">
              {studioTitle||<Trans i18nKey="about.title" />}
            </h2>
            <p className="reveal-up text-lg md:text-xl leading-relaxed text-gray-700 dark:text-content-muted">
              {localizedText(site?.studio.description,i18n.resolvedLanguage??'zh')||t('about.desc')}
            </p>
            <dl className="reveal-up grid grid-cols-2 gap-8 pt-8 border-t border-obsidian/10 dark:border-line">
              <div><dd className="text-5xl md:text-6xl font-black text-brand tracking-tighter">{t('about.y1')}</dd><dt className="mt-3 text-sm text-gray-600 dark:text-content-muted">{t('about.y1_sub')}</dt></div>
              <div><dd className="text-5xl md:text-6xl font-black text-brand tracking-tighter">{t('about.y2')}</dd><dt className="mt-3 text-sm text-gray-600 dark:text-content-muted">{t('about.y2_sub')}</dt></div>
            </dl>
          </div>
          <InteractiveStudioImage />
        </div>
      </section>

      <section id="works" className="py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-paper dark:bg-canvas transition-colors duration-700">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-8">
            <h2 className="reveal-up text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-tight pb-2 text-obsidian dark:text-content transition-colors duration-700">
              <Trans i18nKey="works.title" />
            </h2>
            <Link to="/works" className="hover-target reveal-up flex items-center gap-3 pb-2 border-b border-obsidian dark:border-white hover:text-brand hover:border-diamond dark:hover:border-diamond transition-colors group font-mono uppercase tracking-widest text-xs text-obsidian dark:text-content">
              {t('homeFeatured.view_all')} <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <HomeFeaturedWorks
            onPreview={(title, category, desc) => setTooltipContent({ visible: true, title, category, desc })}
            onPreviewEnd={() => setTooltipContent({ visible: false, title: '', category: '', desc: '' })}
          />

        </div>
      </section>

      <RecentUpdates />
      {/* Quick Tooltip logic since Home has custom hover tooltips */}
      <div 
        ref={tooltipRef}
        className="fixed top-0 left-0 pointer-events-none z-[100] px-4 py-3 opacity-0 transition-opacity duration-150 image-rendering-pixelated hidden md:block"
        style={{ 
          opacity: tooltipContent.visible ? 1 : 0,
          borderStyle: 'solid',
          borderWidth: '8px',
          borderImageSource: `url(${basePath}assets/images/ui/minecraft/Tooltip_background.png)`,
          borderImageSlice: '6 fill',
          borderImageRepeat: 'stretch',
          textShadow: '2px 2px 0px #3f3f3f',
          width: 'max-content',
          maxWidth: '320px'
        }}
        id="home-tooltip-follower"
      >
        <div className="flex flex-col gap-1 font-mono textShadow-mc -mt-1 -mx-0.5">
          <span className="text-[#FFFF55] text-lg font-bold">{tooltipContent.title}</span>
          {tooltipContent.category && <span className="text-[#AAAAAA]">{tooltipContent.category}</span>}
          {tooltipContent.desc && <span className="text-white mt-1 leading-tight">{tooltipContent.desc}</span>}
        </div>
      </div>
    </>
  );
};
