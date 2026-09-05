import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { ArrowLeft, Sword, Map, Code } from 'lucide-react';
import { ParticleCubes } from '../components/ParticleBackground';
import { InfiniteMarquee } from '../components/InfiniteMarquee';
import { WorldCore3D } from '../components/WorldCore3D';
import { ScrollTextReveal } from '../components/ScrollTextReveal';
import { StickyStack } from '../components/StickyStack';
import { TeamHoverRoster } from '../components/TeamHoverRoster';
import { useWorksData } from '../hooks/useWorksData';

export const Studio: React.FC = () => {
  const { isDark, basePath } = useOutletContext<{ isDark: boolean; basePath: string }>();
  const { t } = useTranslation();
  const { siteMeta } = useWorksData();

  const capabilities = [
    { icon: Sword, title: t('core.pvp'), desc: t('core.pvp_d') },
    { icon: Map, title: t('core.rpg'), desc: t('core.rpg_d') },
    { icon: Code, title: t('core.puz'), desc: t('core.puz_d') }
  ];

  const team = [
    { name: 'Ylong', role: t('team.role1'), letter: 'Y', color: 'text-diamond' },
    { name: 'TreeHey', role: t('team.role2'), letter: 'T', color: 'text-amethyst' },
    { name: 'crystal215', role: t('team.role4'), letter: 'C', color: 'text-[#00d2d3]' },
    { name: 'chengzi', role: t('team.role3'), letter: 'C', color: 'text-[#ffa500]' }
  ];

  return (
    <>
      <section className="relative min-h-[82vh] overflow-hidden flex items-center px-6 md:px-16 lg:px-24 pt-36 pb-20 border-b border-obsidian/10 dark:border-white/10 bg-paper dark:bg-obsidian transition-colors duration-700">
        <div className="parallax-hero absolute inset-[-10%] w-[120%] h-[120%] opacity-45 pointer-events-none">
          <ParticleCubes isDark={isDark} />
        </div>
        <div className="relative z-10 max-w-screen-2xl w-full text-obsidian dark:text-white">
          <Link to="/" className="hover-target inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-gray-500 hover:text-obsidian dark:hover:text-white transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" /> {t('workPages.back_home')}
          </Link>
          <p className="hero-sub font-mono text-sm uppercase tracking-[0.35em] mb-6 text-amethyst">{t('about.tag')}</p>
          <h1 className="hero-title text-[15vw] md:text-[10vw] lg:text-[7vw] leading-[0.88] font-black tracking-tighter max-w-6xl"><Trans i18nKey="about.title" /></h1>
          <p className="hero-sub mt-10 max-w-3xl text-lg md:text-2xl leading-relaxed text-gray-600 dark:text-gray-400 font-light">{t('about.desc')}</p>
          <div className="hero-sub mt-12 grid grid-cols-2 gap-4 max-w-xl">
            <div className="border-y border-obsidian/10 dark:border-white/10 py-5"><div className="text-3xl font-black text-diamond">{t('about.y1')}</div><div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 mt-2">{t('about.y1_sub')}</div></div>
            <div className="border-y border-obsidian/10 dark:border-white/10 py-5"><div className="text-3xl font-black text-diamond">{t('about.y2')}</div><div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 mt-2">{t('about.y2_sub')}</div></div>
          </div>
        </div>
      </section>

      <div className="py-24 overflow-hidden bg-paper dark:bg-obsidian border-b border-obsidian/10 dark:border-white/10 transition-colors duration-700">
        <InfiniteMarquee baseVelocity={-2}>
          <span className="text-[12vw] font-black tracking-tighter text-transparent [-webkit-text-stroke:2px_var(--color-obsidian)] dark:[-webkit-text-stroke:2px_var(--color-paper)]">FIMEL STUDIO </span>
          <span className="text-[12vw] font-black tracking-tighter text-diamond">CREATIVE </span>
          <span className="text-[12vw] font-black tracking-tighter text-transparent [-webkit-text-stroke:2px_var(--color-obsidian)] dark:[-webkit-text-stroke:2px_var(--color-paper)]">MINECRAFT </span>
        </InfiniteMarquee>
      </div>

      <section className="relative z-20 py-24 md:py-32 px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian transition-colors duration-700">
        <div className="max-w-screen-xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-24 items-stretch text-obsidian dark:text-white">
          <div className="reveal-up flex flex-col justify-center py-4">
            <div className="font-mono text-amethyst tracking-[0.2em] text-sm flex items-center gap-6"><span className="w-12 h-px bg-amethyst"></span>STUDIO / ORIGIN</div>
            <h2 className="mt-8 text-4xl md:text-6xl font-black tracking-tighter leading-[0.95]">{siteMeta.studio.originTitle}</h2>
            <ScrollTextReveal className="mt-8 max-w-2xl text-lg md:text-xl font-light leading-relaxed">
              {siteMeta.studio.originBody}
            </ScrollTextReveal>
            <div className="mt-10 flex flex-wrap gap-3 text-xs font-mono uppercase tracking-[0.15em] text-gray-500"><span className="border border-obsidian/10 dark:border-white/10 px-3 py-2">Minecraft</span><span className="border border-obsidian/10 dark:border-white/10 px-3 py-2">Gameplay</span><span className="border border-obsidian/10 dark:border-white/10 px-3 py-2">World Systems</span></div>
          </div>
          <div className="reveal-up relative min-h-[22rem] overflow-hidden border border-obsidian/10 dark:border-white/10 bg-[#e5e5e5] dark:bg-[#050505] perspective-1000 group">
            <div className="parallax-bg absolute inset-[-15%] w-[130%] h-[130%] opacity-35 dark:opacity-25 bg-repeat image-rendering-pixelated" style={{ backgroundImage: `url(${basePath}textures/stone.png)`, backgroundSize: '96px' }}></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,210,211,0.18),transparent_65%)]"></div>
            <WorldCore3D isDark={isDark} />
            <span className="absolute right-5 bottom-5 text-[10px] font-mono uppercase tracking-[0.2em] text-obsidian/35 dark:text-white/35">FIMEL // WORLD_CORE</span>
          </div>
        </div>
      </section>

      <section className="relative z-20 py-24 md:py-32 px-6 md:px-16 lg:px-24 bg-[#e5e5e5] dark:bg-[#050505] transition-colors duration-700 text-obsidian dark:text-white">
        <div className="max-w-screen-xl mx-auto">
          <div className="reveal-up font-mono text-diamond tracking-[0.2em] text-sm flex items-center gap-6 mb-16"><span className="w-12 h-px bg-diamond"></span>{t('core.tag')}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {capabilities.map((item) => (
              <article key={item.title} className="reveal-up group relative p-8 md:p-10 bg-white/40 dark:bg-black/40 border border-obsidian/5 dark:border-white/5 hover:border-obsidian/20 dark:hover:border-white/20 transition-colors duration-700">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-diamond via-amethyst to-transparent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700"></div>
                <item.icon className="w-10 h-10 text-obsidian/30 dark:text-white/30 group-hover:text-obsidian dark:group-hover:text-white transition-colors duration-500 mb-10" strokeWidth={1.5} />
                <h2 className="text-2xl font-bold mb-5 tracking-wide">{item.title}</h2><p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="mt-28 border-t border-obsidian/10 dark:border-white/10 pt-16">
            <div className="reveal-up font-mono text-diamond tracking-[0.2em] text-sm flex items-center gap-6 mb-12"><span className="w-12 h-px bg-diamond"></span>WORLD_LOG / MILESTONES</div>
            <div className="grid md:grid-cols-3 border-t border-obsidian/10 dark:border-white/10">
              {siteMeta.studio.milestones.map((milestone) => (
                <article key={milestone.year} className="reveal-up min-h-[15rem] py-8 md:px-8 border-b md:border-b-0 md:border-r border-obsidian/10 dark:border-white/10 last:border-r-0 first:md:pl-0">
                  <p className="font-mono text-sm tracking-[0.16em] text-diamond">{milestone.year}</p>
                  <h2 className="mt-8 text-2xl md:text-3xl font-black tracking-tighter leading-none">{milestone.title}</h2>
                  <p className="mt-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{milestone.desc}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="mt-28 border-t border-obsidian/10 dark:border-white/10 pt-16">
            <div className="reveal-up font-mono text-amethyst tracking-[0.2em] text-sm flex items-center gap-6 mb-12"><span className="w-12 h-px bg-amethyst"></span>PROCESS / PRINCIPLES</div>
            <StickyStack cards={
              siteMeta.studio.principles.map((principle) => (
                <article key={principle.number} className="w-full h-full p-6 sm:p-12 md:p-24 flex flex-col justify-center">
                  <p className="font-mono text-lg sm:text-xl md:text-2xl text-amethyst mb-4 sm:mb-8">{principle.number}</p>
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-tight sm:leading-none mb-4 sm:mb-6 text-obsidian dark:text-white">{principle.title}</h2>
                  <p className="text-base sm:text-xl md:text-2xl leading-relaxed text-gray-600 dark:text-gray-400 max-w-3xl">{principle.desc}</p>
                </article>
              ))
            } />
          </div>
          <div className="mt-28 border-t border-obsidian/10 dark:border-white/10 pt-16">
            <div className="reveal-up font-mono text-amethyst tracking-[0.2em] text-sm flex items-center gap-6 mb-12"><span className="w-12 h-px bg-amethyst"></span>{t('team.tag')}</div>
            <TeamHoverRoster team={team} />
          </div>
        </div>
      </section>
    </>
  );
};
