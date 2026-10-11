import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Diamond, ArrowUpRight, Download } from 'lucide-react';
import { HeroTitleReveal } from '../components/HeroTitleReveal';
import { DraggableCube } from '../components/DraggableCube';
import { ScrollTextReveal } from '../components/ScrollTextReveal';
import { TiltGlareCard } from '../components/TiltGlareCard';
import { Magnetic } from '../components/Magnetic';
import { useWorksData } from '../hooks/useWorksData';
import { DeferredParticleScene } from '../components/DeferredScene';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isDark, basePath } = useOutletContext<{ isDark: boolean; basePath: string }>();
  const { t } = useTranslation();
  const { siteMeta, bedrockEntries } = useWorksData();
  const [tooltipContent, setTooltipContent] = useState<{ visible: boolean; title: string; category: string; desc: string }>({ visible: false, title: '', category: '', desc: '' });
  const openCategory = (event: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(path);
  };

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

      <section id="quick-entry" className="scroll-mt-[136px] md:scroll-mt-[160px] py-20 md:py-28 px-6 md:px-16 lg:px-24 bg-[#e5e5e5] dark:bg-surface transition-colors duration-700">
        <div className="max-w-screen-xl mx-auto">
          <div className="mb-10 md:mb-14">
            <h2 className="reveal-up max-w-3xl text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-obsidian dark:text-content">
              {t('home.quick_title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
              <TiltGlareCard
                href="#/works?type=bedrock"
                onClick={(e) => openCategory(e, '/works?type=bedrock')}
                className="hover-target reveal-up group relative min-h-[22rem] md:min-h-[30rem] overflow-hidden border border-white/10 bg-obsidian/70 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] text-white col-span-1 md:col-span-12 lg:col-span-7"
              >
                <img src={`${basePath}assets/images/works/island-escape-before-dawn/cover.png`} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-70 transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-10 pointer-events-none">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 mb-4">{t('home.maps_title')}</span>
                  <h3 className="text-3xl md:text-4xl font-bold mb-4">{t('home.maps_featured')}</h3>
                  <p className="text-base leading-relaxed text-white/70 mb-8 max-w-lg">{t('home.maps_desc')}</p>
                  <div className="pointer-events-auto">
                    <Magnetic intensity={0.3}>
                      <span className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 rounded-sm font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:bg-white hover:text-black" data-cursor="EXPLORE">
                        {t('home.enter')} <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </Magnetic>
                  </div>
                </div>
              </TiltGlareCard>

              <TiltGlareCard
                href="#/works?type=mods"
                onClick={(e) => openCategory(e, '/works?type=mods')}
                className="hover-target reveal-up group relative min-h-[20rem] md:min-h-[30rem] overflow-hidden border border-emerald-500/10 bg-[#07120a]/80 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-white col-span-1 md:col-span-6 lg:col-span-5"
              >
                <img src={`${basePath}assets/images/works/bingo-but-dont-do-it/cover.png`} alt="" loading="lazy" decoding="async" className="absolute inset-x-0 top-10 w-full h-[50%] object-contain p-6 opacity-80 transition-all duration-[1200ms] ease-out group-hover:scale-110 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07120a] via-[#07120a]/80 to-transparent"></div>
                <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-10 pointer-events-none">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/70 mb-4">{t('home.mods_title')}</span>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4">{t('home.mods_featured')}</h3>
                  <p className="text-base leading-relaxed text-white/70 mb-8 max-w-sm">{t('home.mods_desc')}</p>
                  <div className="pointer-events-auto">
                    <Magnetic intensity={0.3}>
                      <span className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 rounded-sm font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:bg-white hover:text-black" data-cursor="EXPLORE">
                        {t('home.enter')} <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </Magnetic>
                  </div>
                </div>
              </TiltGlareCard>

              <TiltGlareCard
                href="#/works?type=tools"
                onClick={(e) => openCategory(e, '/works?type=tools')}
                className="hover-target reveal-up group relative min-h-[16rem] md:min-h-[22rem] overflow-hidden border border-obsidian/10 dark:border-line bg-white/80 dark:bg-surface/80 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] text-obsidian dark:text-content col-span-1 md:col-span-6 lg:col-span-12"
              >
                <div className="absolute right-0 top-0 w-1/2 h-full hidden md:flex items-center justify-end pr-12 bg-[radial-gradient(circle_at_center,rgba(0,210,211,0.15),transparent_66%)]">
                  <img src={`${basePath}assets/images/works/minecraft-obj-cubizer/cover.svg`} alt="" loading="lazy" decoding="async" className="w-[60%] h-[60%] object-contain opacity-85 transition-all duration-[1200ms] ease-out group-hover:scale-105 group-hover:opacity-100" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent dark:from-surface dark:via-surface/95 md:w-2/3"></div>
                <div className="relative z-10 h-full flex flex-col justify-center p-8 md:p-12 w-full md:w-2/3 lg:w-1/2 pointer-events-none">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand mb-4">{t('home.tools_title')}</span>
                  <h3 className="text-2xl md:text-4xl font-bold mb-4">{t('home.tools_featured')}</h3>
                  <p className="text-base leading-relaxed text-gray-600 dark:text-content-muted mb-8 max-w-md">{t('home.tools_desc')}</p>
                  <div className="pointer-events-auto">
                    <Magnetic intensity={0.3}>
                      <span className="inline-flex items-center gap-2 px-6 py-3 border border-obsidian/20 dark:border-line rounded-sm font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:bg-obsidian hover:text-white dark:hover:bg-surface-raised dark:hover:text-content" data-cursor="EXPLORE">
                        {t('home.enter')} <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </Magnetic>
                  </div>
                </div>
              </TiltGlareCard>
            </div>
          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2 font-mono text-sm text-obsidian dark:text-content">
            <Link to="/works?type=java" className="hover-target inline-flex min-h-11 items-center gap-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">{t('nav.nav_maps_je')} <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
            <Link to="/works?type=datapacks" className="hover-target inline-flex min-h-11 items-center gap-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">{t('nav.nav_datapacks')} <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section id="about" className="relative px-6 md:px-16 lg:px-24 bg-paper dark:bg-canvas transition-colors duration-700">
        <div className="max-w-screen-xl mx-auto flex flex-col lg:flex-row relative">
          
          {/* Mobile Visual (Visible only on small screens) */}
          <div className="w-full h-[36vh] sm:h-[45vh] lg:hidden relative mt-20 mb-8 overflow-hidden rounded-sm group bg-[#e5e5e5] dark:bg-surface p-4 flex flex-col items-center justify-center perspective-1000 touch-pan-y">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(155,89,182,0.15),transparent_70%)] opacity-50"></div>
            <DraggableCube basePath={basePath} />
          </div>

          {/* Left Column: Scrolling Narrative */}
          <div className="w-full lg:w-[55%] lg:py-[20vh] pt-16 pb-32 space-y-[15vh] lg:space-y-[35vh]">
            <div className="min-h-[30vh] lg:min-h-[50vh] flex flex-col justify-center">
              <h2 className="reveal-up text-5xl md:text-6xl lg:text-8xl font-bold leading-[1.1] tracking-tighter text-obsidian dark:text-content transition-colors duration-700 max-w-lg">
                <Trans i18nKey="about.title" />
              </h2>
            </div>
            
            <div className="min-h-[30vh] lg:min-h-[50vh] flex flex-col justify-center">
              <ScrollTextReveal className="text-2xl md:text-3xl lg:text-4xl text-obsidian dark:text-content font-bold leading-relaxed transition-colors duration-700">
                {t('about.desc')}
              </ScrollTextReveal>
            </div>

            <div className="min-h-[30vh] lg:min-h-[50vh] flex flex-col justify-center pb-10 lg:pb-[10vh]">
              <div className="reveal-up grid grid-cols-2 gap-12 lg:gap-20 pt-12 border-t border-obsidian/10 dark:border-line transition-colors duration-700">
                <div>
                  <div className="text-6xl lg:text-7xl font-black text-brand mb-3 tracking-tighter">{t('about.y1')}</div>
                  <div className="text-xs md:text-sm tracking-widest font-mono text-gray-600 dark:text-content-muted uppercase">{t('about.y1_sub')}</div>
                </div>
                <div>
                  <div className="text-6xl lg:text-7xl font-black text-brand mb-3 tracking-tighter">{t('about.y2')}</div>
                  <div className="text-xs md:text-sm tracking-widest font-mono text-gray-600 dark:text-content-muted uppercase">{t('about.y2_sub')}</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Desktop Pinned Visual */}
          <div className="hidden lg:flex w-[45%] h-[100vh] sticky top-0 items-center justify-center pl-16">
            <div className="w-full h-[70vh] relative overflow-hidden rounded-sm group bg-[#e5e5e5] dark:bg-surface p-10 flex items-center justify-center transition-colors duration-700 perspective-1000">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(155,89,182,0.15),transparent_70%)] opacity-50"></div>
              
              <DraggableCube basePath={basePath} />

            </div>
          </div>
        </div>
      </section>

      <section id="works" className="py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-paper dark:bg-canvas transition-colors duration-700">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-8">
            <h2 className="reveal-up text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-tight pb-2 text-obsidian dark:text-content transition-colors duration-700">
              <Trans i18nKey="works.title" />
            </h2>
            <Link to="/studio" state={{ scrollTo: '#contact' }} className="reveal-up flex items-center gap-3 pb-2 border-b border-obsidian dark:border-white hover:text-brand hover:border-diamond dark:hover:border-diamond transition-colors group font-mono uppercase tracking-widest text-xs text-obsidian dark:text-content">
              {t('works.inquire')} <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="space-y-24">
            <div className="reveal-up grid lg:grid-cols-[0.8fr_1.2fr] gap-8 border-y border-obsidian/10 dark:border-line py-8 md:py-12">
              <div className="flex flex-col justify-between gap-8">
                <div>
                  <div className="font-mono text-brand tracking-[0.2em] text-sm flex items-center gap-4">
                    <span className="w-10 h-px bg-diamond"></span>
                    {t('nav.nav_maps_je')}
                  </div>
                  <h3 className="mt-6 text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-obsidian dark:text-content">
                    {t('catalogue.development')}
                  </h3>
                </div>
                <Link to="/works?type=java" className="hover-target w-fit flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-gray-600 dark:text-content-muted hover:text-[#007d7e] dark:hover:text-brand transition-colors">
                  {t('workPages.view_java')} <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                {[
                  { slug: 'island-escape-java', title: t('works.m9_t'), category: t('works.m9_c'), desc: t('works.m9_d'), texture: 'ice.png', accent: 'hover:border-[#ff9ff3] hover:text-[#ff9ff3]' },
                  { slug: 'spoiler-rpg', title: t('works.m10_t'), category: t('works.m10_c'), desc: t('works.m10_d'), texture: 'diamond_block.png', accent: 'hover:border-diamond hover:text-brand' }
                ].map((work) => (
                  <Link key={work.title} to={`/works/${work.slug}`} className={`hover-target group relative min-h-[18rem] overflow-hidden border border-obsidian/10 dark:border-line p-6 flex flex-col justify-end transition-colors duration-500 ${work.accent}`}>
                    <div className="parallax-bg absolute inset-[-18%] w-[136%] h-[136%] opacity-30 dark:opacity-40 bg-repeat image-rendering-pixelated group-hover:scale-110 transition-transform duration-[1.5s] ease-out" style={{ backgroundImage: `url(${basePath}assets/textures/minecraft/${work.texture})`, backgroundSize: '112px' }}></div>
                    <div className="relative z-10">
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600 dark:text-content-muted">{work.category}</p>
                      <h4 className="mt-3 text-2xl md:text-3xl font-bold uppercase tracking-tighter leading-none">{work.title}</h4>
                      <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-content-muted">{work.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="reveal-up flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div>
                <div className="font-mono text-brand tracking-[0.2em] text-sm flex items-center gap-4">
                  <span className="w-10 h-px bg-diamond"></span>
                  {t('workPages.status.live')}
                </div>
                <h3 className="mt-5 text-4xl md:text-6xl font-black uppercase tracking-tighter text-obsidian dark:text-content">{t('works.category_maps')}</h3>
              </div>
              <Link to="/works?type=bedrock" className="hover-target w-fit flex items-center gap-3 border-b border-obsidian dark:border-white pb-2 text-xs uppercase tracking-[0.2em] font-mono text-obsidian dark:text-content hover:text-brand hover:border-diamond transition-colors">
                {t('workPages.maps.catalog')} <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {[bedrockEntries[6], bedrockEntries[7], bedrockEntries[0]].map((work) => {
                return (
                  <article key={work.link} className="reveal-up group relative min-h-[30rem] overflow-hidden bg-[#e0e0e0] dark:bg-canvas border border-obsidian/5 dark:border-line/70" onMouseEnter={() => setTooltipContent({ visible: true, title: work.title, category: work.category, desc: work.desc })} onMouseLeave={() => setTooltipContent({ visible: false, title: '', category: '', desc: '' })}>
                    <Link to={`/works/${work.slug}`} className="hover-target absolute inset-0">
                      <div className="parallax-bg absolute inset-[-18%] w-[136%] h-[136%]">
                        <img src={`${basePath}${work.image}`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" />
                      </div>
                      <div className={`absolute inset-0 bg-gradient-to-t ${work.bg} via-transparent to-obsidian/45 opacity-80 group-hover:opacity-100 transition-opacity duration-700`}></div>
                      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/70">{work.category}</p>
                        <h4 className="mt-3 text-3xl font-bold uppercase tracking-tighter leading-none">{work.title}</h4>
                        <div className="mt-5 flex items-center gap-3 text-xs font-mono text-white/80"><Download className="w-4 h-4 text-brand" />{t('works.downloads_metric', { downloads: work.downloads })}</div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>

            <p className="reveal-up text-xs leading-relaxed text-gray-600 dark:text-content-muted">
              {t('project.historical_metrics')}
            </p>

            <div className="reveal-up flex flex-wrap gap-4 pt-2">
              <Link to="/works?type=bedrock" className="hover-target inline-flex items-center gap-3 border border-obsidian dark:border-white px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] hover:text-brand hover:border-diamond transition-colors">{t('nav.nav_maps')} <ArrowUpRight className="w-4 h-4" /></Link>
              <Link to="/works?type=tools" className="hover-target inline-flex items-center gap-3 border border-obsidian/20 dark:border-line px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] text-gray-600 dark:text-content-muted hover:text-[#007d7e] dark:hover:text-brand hover:border-diamond transition-colors">{t('nav.nav_tools')} <ArrowUpRight className="w-4 h-4" /></Link>
              <Link to="/works?type=mods" className="hover-target inline-flex items-center gap-3 border border-obsidian/20 dark:border-line px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] text-gray-600 dark:text-content-muted hover:text-[#007d7e] dark:hover:text-brand hover:border-diamond transition-colors">{t('nav.nav_mods')} <ArrowUpRight className="w-4 h-4" /></Link>
            </div>

            <div className="pt-16 md:pt-24 border-t border-obsidian/10 dark:border-line">
              <div className="reveal-up flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
                <div>
                  <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-obsidian dark:text-content">{t('home.tools_title')}</h3>
                </div>
                <Link to="/works?type=tools" className="hover-target w-fit flex items-center gap-3 border-b border-obsidian dark:border-white pb-2 text-xs uppercase tracking-[0.2em] font-mono text-obsidian dark:text-content hover:text-blue-500 hover:border-blue-500 transition-colors">
                  {t('nav.nav_tools')} <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="max-w-4xl">
                <Link to="/works/minecraft-obj-cubizer" className="hover-target reveal-up group relative min-h-[22rem] overflow-hidden p-7 md:p-10 border border-obsidian/10 dark:border-line flex flex-col justify-end bg-[#e5e5e5] dark:bg-surface">
                  <div className="parallax-bg absolute inset-[-15%] w-[130%] h-[130%] opacity-20 dark:opacity-30 group-hover:scale-110 transition-transform duration-[1.5s] ease-out flex items-center justify-center p-10">
                    <img src={`${basePath}assets/images/works/minecraft-obj-cubizer/cover.svg`} alt="Minecraft OBJ Cubizer" className="w-full h-full max-w-md object-contain opacity-90" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600 dark:text-content-muted">{t('workPages.tools.objCubizer.category')} · {t('catalogue.live')}</p>
                    <h4 className="mt-3 text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-obsidian dark:text-content group-hover:text-brand transition-colors">Minecraft OBJ Cubizer</h4>
                    <p className="mt-5 max-w-xl text-sm md:text-base leading-relaxed text-gray-600 dark:text-content-muted">{t('home.tools_desc')}</p>
                  </div>
                </Link>
              </div>
            </div>

            <div className="pt-16 md:pt-24 border-t border-obsidian/10 dark:border-line">
              <div className="reveal-up flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
                <div>
                  <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-obsidian dark:text-content">{t('home.mods_title')}</h3>
                </div>
                <Link to="/works?type=mods" className="hover-target w-fit flex items-center gap-3 border-b border-obsidian dark:border-white pb-2 text-xs uppercase tracking-[0.2em] font-mono text-obsidian dark:text-content hover:text-emerald-500 hover:border-emerald-500 transition-colors">
                  {t('nav.nav_mods')} <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <Link to="/works/bingo-but-dont-do-it" className="hover-target reveal-up group relative block min-h-[18rem] overflow-hidden p-7 md:p-10 border border-obsidian/10 dark:border-line bg-[#07120a]">
                <img src={`${basePath}assets/images/works/bingo-but-dont-do-it/cover.png`} alt={t('home.mods_featured')} className="parallax-bg absolute inset-[-10%] w-[120%] h-[120%] object-contain p-8 md:p-12 opacity-55 group-hover:opacity-80 group-hover:scale-105 transition-all duration-[1.2s] ease-out" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#07120a] via-[#07120a]/55 to-transparent"></div>
                <div className="relative z-10 max-w-xl pt-24">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300">{siteMeta.bingoCategory} · {t('workPages.status.live')}</p>
                  <h4 className="mt-3 text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white">{t('home.mods_featured')}</h4>
                  <p className="mt-5 text-sm md:text-base leading-relaxed text-white/70">{t('home.mods_desc')}</p>
                </div>
              </Link>
            </div>
          </div>

        </div>
      </section>

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
