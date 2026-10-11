import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { ArrowLeft, ArrowUpRight, Sword, Map, Code, Copy, Check, MessageCircle } from 'lucide-react';
import { InfiniteMarquee } from '../components/InfiniteMarquee';
import { ScrollTextReveal } from '../components/ScrollTextReveal';
import { TeamHoverRoster } from '../components/TeamHoverRoster';
import { DeferredParticleScene, DeferredWorldCore } from '../components/DeferredScene';
import { useWorksData } from '../hooks/useWorksData';

export const Studio: React.FC = () => {
  const { isDark, basePath } = useOutletContext<{ isDark: boolean; basePath: string }>();
  const { t } = useTranslation();
  const { siteMeta } = useWorksData();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const copyQQ = async () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText('937760015');
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    copyTimer.current = setTimeout(() => setCopyState('idle'), 3000);
  };

  const contactIntents = ['cooperation', 'creators', 'support'] as const;

  const capabilities = [
    { icon: Sword, title: t('core.pvp'), desc: t('core.pvp_d') },
    { icon: Map, title: t('core.rpg'), desc: t('core.rpg_d') },
    { icon: Code, title: t('core.puz'), desc: t('core.puz_d') }
  ];

  const team = [
    { name: 'Ylong', role: t('team.role1'), letter: 'Y', color: 'text-brand', avatar: `${basePath}assets/images/team/YYYlong.png` },
    { name: 'TreeHey', role: t('team.role2'), letter: 'T', color: 'text-amethyst', avatar: `${basePath}assets/images/team/TreeHey.png` },
    { name: 'crystal215', role: t('team.role4'), letter: 'C', color: 'text-brand', avatar: `${basePath}assets/images/team/crystal215.png` },
    { name: 'chengzi', role: t('team.role3'), letter: 'C', color: 'text-[#ffa500]', avatar: `${basePath}assets/images/team/chengzi_bucheng.png` }
  ];

  return (
    <>
      <section className="relative min-h-[82dvh] overflow-hidden flex items-center px-6 md:px-16 lg:px-24 pt-36 pb-20 border-b border-line bg-canvas transition-colors duration-700">
        <div className="parallax-hero absolute inset-[-10%] w-[120%] h-[120%] opacity-45 pointer-events-none">
          <DeferredParticleScene isDark={isDark} />
        </div>
        <div className="relative z-10 max-w-screen-2xl w-full text-content">
          <Link to="/" className="hover-target inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-content-muted hover:text-content transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" /> {t('workPages.back_home')}
          </Link>
          <p className="hero-sub font-mono text-sm uppercase tracking-[0.35em] mb-6 text-amethyst">{t('about.tag')}</p>
          <h1 className="hero-title text-[13vw] md:text-[9vw] lg:text-[7vw] leading-[0.95] font-black tracking-tighter max-w-6xl"><Trans i18nKey="about.title" /></h1>
          <p className="hero-sub mt-10 max-w-3xl text-lg md:text-2xl leading-relaxed text-content-muted font-light">{t('about.desc')}</p>
          <div className="hero-sub mt-8 flex flex-wrap items-center gap-4 text-sm">
            <Link to="/works" className="hover-target inline-flex min-h-11 items-center gap-3 border border-line bg-surface px-5 py-3 font-bold transition-colors hover:border-diamond hover:bg-diamond/10 focus-visible:outline-2 focus-visible:outline-diamond">
              {t('studioContact.view_works')} <ArrowUpRight size={17} />
            </Link>
            <Link to="/studio" state={{ scrollTo: '#contact' }} className="hover-target inline-flex min-h-11 items-center gap-3 px-2 py-3 text-content-muted hover:text-content focus-visible:outline-2 focus-visible:outline-diamond">
              {t('nav.contact')} <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-sub mt-12 grid grid-cols-2 gap-4 max-w-xl">
            <div className="border-y border-line py-5"><div className="text-3xl font-black text-brand">{t('about.y1')}</div><div className="text-xs font-mono uppercase tracking-[0.2em] text-content-muted mt-2">{t('about.y1_sub')}</div></div>
            <div className="border-y border-line py-5"><div className="text-3xl font-black text-brand">{t('about.y2')}</div><div className="text-xs font-mono uppercase tracking-[0.2em] text-content-muted mt-2">{t('about.y2_sub')}</div></div>
          </div>
        </div>
      </section>
      <div className="py-12 overflow-hidden bg-canvas border-b border-line transition-colors duration-700">
        <InfiniteMarquee baseVelocity={-2}>
          <span className="text-[12vw] font-black tracking-tighter text-transparent [-webkit-text-stroke:2px_var(--color-content)]">FIMEL STUDIO </span>
          <span className="text-[12vw] font-black tracking-tighter text-brand">MINECRAFT </span>
        </InfiniteMarquee>
      </div>

      <section className="relative z-20 py-16 md:py-24 px-6 md:px-16 lg:px-24 bg-canvas transition-colors duration-700">
        <div className="max-w-screen-xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-24 items-stretch text-content">
          <div className="reveal-up flex flex-col justify-center py-4">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95]">{siteMeta.studio.originTitle}</h2>
            <ScrollTextReveal className="mt-8 max-w-2xl text-lg md:text-xl font-light leading-relaxed">
              {siteMeta.studio.originBody}
            </ScrollTextReveal>
          </div>
          <div className="reveal-up relative min-h-[22rem] overflow-hidden border border-line bg-surface-raised perspective-1000 group">
            <div className="parallax-bg absolute inset-[-15%] w-[130%] h-[130%] opacity-35 dark:opacity-25 bg-repeat image-rendering-pixelated" style={{ backgroundImage: `url(${basePath}assets/textures/minecraft/stone.png)`, backgroundSize: '96px' }}></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,210,211,0.18),transparent_65%)]"></div>
            <div className="absolute inset-0"><DeferredWorldCore isDark={isDark} /></div>
          </div>
        </div>
      </section>

      <section className="relative z-20 py-16 md:py-24 px-6 md:px-16 lg:px-24 bg-surface-raised transition-colors duration-700 text-content">
        <div className="max-w-screen-xl mx-auto">
          <h2 className="reveal-up mb-10 text-3xl font-black tracking-tight md:text-4xl">{t('core.tag')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {capabilities.map((item) => (
              <article key={item.title} className="reveal-up group relative p-8 md:p-10 bg-surface border border-line hover:border-content-muted transition-colors duration-700">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-diamond via-amethyst to-transparent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700"></div>
                <item.icon className="w-10 h-10 text-content-muted group-hover:text-content transition-colors duration-500 mb-10" strokeWidth={1.5} />
                <h3 className="text-2xl font-bold mb-5 tracking-wide">{item.title}</h3><p className="text-content-muted font-light leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="mt-16 border-t border-line pt-12 md:mt-20">
            <h2 className="reveal-up mb-10 text-3xl font-black tracking-tight md:text-4xl">{t('team.tag')}</h2>
            <TeamHoverRoster team={team} />
          </div>
        </div>
      </section>
      <section id="contact" className="relative scroll-mt-28 border-t border-line bg-canvas px-6 py-20 text-content md:px-16 md:py-28 lg:px-24">
        <div className="mx-auto max-w-screen-xl">
          <h2 className="text-4xl font-black leading-tight tracking-tighter sm:text-5xl md:text-7xl">{t('studioContact.title')}</h2>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-content-muted md:text-lg">{t('studioContact.intro')}</p>

          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              {contactIntents.map((intent) => (
                <a key={intent} href={`mailto:fimel.studio.mc@gmail.com?subject=${encodeURIComponent(`Fimel / ${t(`studioContact.${intent}`)}`)}`} className="hover-target group flex min-h-20 items-center justify-between gap-5 border-b border-line py-6 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-diamond">
                  <span className="text-xl font-bold tracking-tight sm:text-2xl">{t(`studioContact.${intent}`)}</span>
                  <ArrowUpRight size={23} strokeWidth={1.5} className="shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 motion-reduce:transition-none" />
                </a>
              ))}
              <div className="mt-9 flex flex-wrap gap-6 text-sm">
                <a href="https://x.com/FimelStudio" target="_blank" rel="noopener noreferrer" className="hover-target inline-flex min-h-11 items-center gap-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-diamond">X / @FimelStudio <ArrowUpRight size={15} /></a>
              </div>
            </div>

            <div className="border border-line bg-surface p-5 sm:p-8">
              <h3 className="text-lg font-bold">{t('studioContact.connect')}</h3>
              <div className="mt-6">
                <p className="text-xs text-content-muted">{t('studioContact.email')}</p>
                <a href="mailto:fimel.studio.mc@gmail.com" className="hover-target mt-2 inline-flex min-h-11 max-w-full items-center gap-2 break-all text-base font-semibold hover:text-brand focus-visible:outline-2 focus-visible:outline-diamond sm:text-xl">fimel.studio.mc@gmail.com</a>
              </div>
              <div className="mt-7 border-t border-line pt-6">
                <p className="text-xs text-content-muted">{t('studioContact.qq_group')}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="select-text font-mono text-xl font-bold">937760015</span>
                  <button onClick={() => void copyQQ()} className="hover-target inline-flex min-h-11 items-center gap-2 px-2 text-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-diamond">
                    {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                    {t(copyState === 'copied' ? 'studioContact.copied' : 'studioContact.copy_qq')}
                  </button>
                </div>
                <p role="status" aria-live="polite" className="mt-1 min-h-5 text-xs text-content-muted">{copyState === 'error' ? t('studioContact.copy_failed') : copyState === 'copied' ? t('studioContact.copied') : ''}</p>
              </div>
              <a href="https://discord.gg/X9aVJJVvA" target="_blank" rel="noopener noreferrer" className="hover-target group mt-6 flex items-start gap-4 border-t border-line pt-6 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-diamond">
                <MessageCircle size={24} strokeWidth={1.6} className="mt-1 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block text-xl font-bold">{t('studioContact.discord')}</span><span className="mt-2 block text-sm leading-relaxed text-content-muted">{t('studioContact.discord_desc')}</span></span>
                <ArrowUpRight size={18} className="mt-1 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
