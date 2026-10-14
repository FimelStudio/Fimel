import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Moon, Sun } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import CustomCursor from './components/CustomCursor';
import HotbarNav from './components/HotbarNav';
import { CurtainLoading } from './components/CurtainLoading';
import { PageTransition } from './components/PageTransition';

gsap.registerPlugin(ScrollTrigger);

type HudHandle = { updateProgress: (progress: number) => void };
type HudProps = {
  activePage: string;
  handleNavClick: (event: React.MouseEvent<HTMLAnchorElement>, target: string) => void;
};

// Scroll updates stay in the optional Minecraft HUD instead of rerendering every page.
const ScrollProgressHud = memo(forwardRef<HudHandle, HudProps>(({ activePage, handleNavClick }, ref) => {
  const [progress, setProgress] = useState(0);
  const lastProgress = useRef(0);

  useImperativeHandle(ref, () => ({
    updateProgress(nextProgress) {
      const next = Math.max(0, Math.min(1, nextProgress));
      if (Math.abs(next - lastProgress.current) < 0.005 && next !== 0 && next !== 1) return;
      if (next === lastProgress.current) return;
      lastProgress.current = next;
      setProgress(next);
    },
  }), []);

  return <HotbarNav scrollProgress={progress} handleNavClick={handleNavClick} activePage={activePage} />;
}));
ScrollProgressHud.displayName = 'ScrollProgressHud';

type RouteState = { scrollTo?: string } | null;

export const Layout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const reducedMotion = useReducedMotion();
  const basePath = import.meta.env.BASE_URL;
  const mainRef = useRef<HTMLElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const hudRef = useRef<HudHandle>(null);
  const advancementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advancementUnlocked = useRef(false);
  const scrollPositions = useRef(new Map<string, number>());
  const currentScrollPosition = useRef(0);
  const previousPath = useRef<string | null>(null);

  const [loading, setLoading] = useState(() => {
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        && window.sessionStorage.getItem('fimel_intro_seen') !== '1';
    } catch {
      return false;
    }
  });
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = window.localStorage.getItem('fimel_theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  const [logoSource, setLogoSource] = useState<'svg' | 'png' | 'none'>('svg');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [advancementVisible, setAdvancementVisible] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setLoading(false);
      try { window.sessionStorage.setItem('fimel_intro_seen', '1'); } catch { /* Storage may be disabled. */ }
    }, 850);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    try { window.localStorage.setItem('fimel_theme', isDark ? 'dark' : 'light'); } catch { /* Storage may be disabled. */ }
  }, [isDark]);

  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage || i18n.language || 'zh';
  }, [i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    if (!langMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) setLangMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLangMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [langMenuOpen]);

  const updateScrollProgress = useCallback((progress: number) => {
    currentScrollPosition.current = window.scrollY;
    hudRef.current?.updateProgress(progress);
    if (progress > 0.1 && !advancementUnlocked.current) {
      advancementUnlocked.current = true;
      setAdvancementVisible(true);
      advancementTimer.current = setTimeout(() => setAdvancementVisible(false), 4000);
    }
  }, []);

  useEffect(() => () => {
    if (advancementTimer.current) clearTimeout(advancementTimer.current);
  }, []);

  useEffect(() => {
    if (loading) return;
    const useNativeScroll = reducedMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (useNativeScroll) {
      const progressTrigger = ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => updateScrollProgress(self.progress),
      });
      return () => progressTrigger.kill();
    }

    const lenis = new Lenis({
      duration: 0.9,
      easing: (value) => Math.min(1, 1.001 - Math.pow(2, -10 * value)),
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
    });
    lenisRef.current = lenis;
    const onScroll = () => {
      ScrollTrigger.update();
      updateScrollProgress(lenis.progress);
    };
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on('scroll', onScroll);
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [loading, reducedMotion, updateScrollProgress]);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previousRestoration; };
  }, []);

  // Save by history entry so returning from a project restores the works list.
  useEffect(() => {
    const entryKey = location.key;
    const positions = scrollPositions.current;
    return () => {
      positions.set(entryKey, currentScrollPosition.current);
      if (positions.size > 50) {
        const oldest = positions.keys().next().value;
        if (oldest) positions.delete(oldest);
      }
    };
  }, [location.key]);

  useEffect(() => {
    const routeState = location.state as RouteState;
    const anchor = routeState?.scrollTo || location.hash;
    const samePage = previousPath.current === location.pathname;
    previousPath.current = location.pathname;
    if (samePage && !anchor && navigationType !== 'POP') return;

    const savedPosition = navigationType === 'POP' ? scrollPositions.current.get(location.key) ?? 0 : 0;
    let observer: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let complete = false;
    const scrollToTarget = () => {
      const target = anchor && anchor !== '#hero' ? document.getElementById(anchor.replace(/^#/, '')) : null;
      if (anchor && anchor !== '#hero' && !target) return;
      const position = target ? target.getBoundingClientRect().top + window.scrollY - 112 : savedPosition;
      if (lenisRef.current) {
        lenisRef.current.scrollTo(Math.max(0, position), { immediate: true });
      } else {
        window.scrollTo({ top: Math.max(0, position), behavior: 'instant' });
      }
      if (target || document.documentElement.scrollHeight - window.innerHeight >= savedPosition) {
        complete = true;
        observer?.disconnect();
        resizeObserver?.disconnect();
      }
    };
    const frame = requestAnimationFrame(scrollToTarget);
    if (mainRef.current) {
      observer = new MutationObserver(() => { if (!complete) scrollToTarget(); });
      observer.observe(mainRef.current, { childList: true, subtree: true });
      resizeObserver = new ResizeObserver(() => { if (!complete) scrollToTarget(); });
      resizeObserver.observe(mainRef.current);
    }
    const timeout = setTimeout(() => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      ScrollTrigger.refresh();
    }, 1200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      observer?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [location.hash, location.key, location.pathname, location.state, navigationType]);

  const handleNavClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (target === '#contact') {
      navigate('/studio', { state: { scrollTo: '#contact' } });
    } else if (target === '#about') {
      navigate('/studio');
    } else if (target.startsWith('#/')) {
      navigate(target.slice(1));
    } else if (target.startsWith('#')) {
      if (location.pathname !== '/') {
        navigate('/', { state: { scrollTo: target } });
      } else {
        const element = document.getElementById(target.slice(1));
        if (lenisRef.current) lenisRef.current.scrollTo(target === '#hero' ? 0 : element || 0, { offset: -104 });
        else if (element) element.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
      }
    } else {
      navigate(target);
    }
  }, [location.pathname, navigate, reducedMotion]);

  const changeLanguage = (language: string) => {
    void i18n.changeLanguage(language);
    try { window.localStorage.setItem('fimel_user_lang', language); } catch { /* Storage may be disabled. */ }
    setLangMenuOpen(false);
  };

  const navigation = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/works', label: t('nav.works'), end: false },
    { to: '/studio', label: t('nav.about'), end: false },
  ];
  const activePage = location.pathname.startsWith('/works') ? 'works' : location.pathname === '/studio' ? 'studio' : 'home';

  return (
    <div className="w-full font-sans transition-colors duration-500 selection:bg-diamond selection:text-obsidian">
      <a href="#main-content" onClick={(event) => {
        event.preventDefault();
        mainRef.current?.focus();
      }} className="fixed top-2 left-4 z-[100] -translate-y-20 bg-surface border border-diamond px-4 py-3 text-content focus:translate-y-0">
        {t('nav.skip_content')}
      </a>
      <div className="noise-overlay" />
      <CustomCursor isDark={isDark} />
      <CurtainLoading isLoading={loading} />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas/95 text-content transition-colors duration-300">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-4 py-2 md:min-h-[72px] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-8 md:py-0 lg:px-12">
          <Link to="/" aria-label={`Fimel Studio / ${t('nav.home')}`} className="brand-link hover-target order-1 inline-flex items-center outline-offset-4 focus-visible:outline-2 focus-visible:outline-diamond">
            {logoSource === 'none' ? <span aria-hidden="true" className="brand-mark brand-mark-fallback">F</span> : (
              <img src={`${basePath}assets/brand/fimel-logo.${logoSource}`} alt="" width="56" height="56" className="brand-mark dark:invert" decoding="async"
                onError={() => setLogoSource(current => current === 'svg' ? 'png' : 'none')} />
            )}
            <span className="brand-wordmark" data-wordmark="Fimel Studio">Fimel Studio</span>
          </Link>

          <nav aria-label={t('nav.primary')} className="order-3 col-span-2 flex items-center justify-center gap-1 md:order-2 md:col-span-1 md:gap-2">
            {navigation.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `hover-target relative inline-flex min-h-11 items-center justify-center whitespace-nowrap px-3 text-[13px] font-bold outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-diamond sm:px-5 sm:text-sm md:px-3 lg:px-6 ${isActive ? 'text-content after:absolute after:bottom-1 after:left-3 after:right-3 after:h-0.5 after:bg-diamond' : 'text-content-muted hover:text-content'}`}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 flex items-center gap-1 justify-self-end md:order-3">
            <div ref={languageRef} className="relative">
              <button onClick={() => setLangMenuOpen((open) => !open)} aria-label={`${t('nav.language')} (${(i18n.resolvedLanguage || i18n.language || 'zh').split('-')[0].toUpperCase()})`} aria-expanded={langMenuOpen} aria-controls="language-options" className="hover-target flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 outline-offset-2 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-diamond">
                <Globe size={17} strokeWidth={1.8} />
                <span className="font-mono text-[11px] uppercase">{(i18n.resolvedLanguage || i18n.language || 'zh').split('-')[0]}</span>
              </button>
              {langMenuOpen && (
                <div id="language-options" className="absolute right-0 top-full mt-2 w-32 border border-line bg-surface p-1 text-sm shadow-lg">
                  {[{ code: 'zh', label: '中文' }, { code: 'en', label: 'English' }, { code: 'ja', label: '日本語' }].map(({ code, label }) => (
                    <button key={code} onClick={() => changeLanguage(code)} lang={code} aria-pressed={i18n.resolvedLanguage?.startsWith(code)} className="hover-target block min-h-11 w-full px-3 text-left outline-offset-0 transition-colors aria-pressed:bg-surface-raised hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-diamond">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setIsDark((dark) => !dark)} aria-label={t(isDark ? 'nav.theme_light' : 'nav.theme_dark')} title={t(isDark ? 'nav.theme_light' : 'nav.theme_dark')} aria-pressed={isDark} className="hover-target flex min-h-11 min-w-11 items-center justify-center outline-offset-2 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-diamond">
              {isDark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
            </button>
          </div>
        </div>
      </header>

      <ScrollProgressHud ref={hudRef} activePage={activePage} handleNavClick={handleNavClick} />

      <main ref={mainRef} id="main-content" tabIndex={-1} className="relative z-10 min-h-[70dvh] bg-canvas text-content outline-none">
        <PageTransition pageKey={location.pathname}>
          <Outlet context={{ isDark, basePath }} />
        </PageTransition>
      </main>

      <footer className="relative border-t border-line bg-canvas px-6 py-9 text-content md:px-12">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p className="text-xs leading-relaxed text-content-muted">{t('footer.copy')}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {navigation.map(({ to, label }) => <Link key={to} to={to} className="hover-target inline-flex min-h-10 items-center hover:text-diamond focus-visible:outline-2 focus-visible:outline-diamond">{label}</Link>)}
            <Link to="/studio" state={{ scrollTo: '#contact' }} className="hover-target inline-flex min-h-10 items-center hover:text-diamond focus-visible:outline-2 focus-visible:outline-diamond">{t('nav.contact')}</Link>
            <a href="https://discord.gg/X9aVJJVvA" target="_blank" rel="noopener noreferrer" className="hover-target inline-flex min-h-10 items-center hover:text-diamond focus-visible:outline-2 focus-visible:outline-diamond">Discord</a>
          </div>
        </div>
      </footer>

      <div className="pointer-events-none fixed right-2 top-28 z-[100] flex h-[64px] w-[min(320px,calc(100vw-16px))] items-center bg-contain bg-center bg-no-repeat px-4 transition-transform duration-500 motion-reduce:transition-none md:right-8 md:top-24 image-rendering-pixelated" style={{ backgroundImage: `url('${basePath}assets/images/ui/minecraft/Toast_advancement.png')`, transform: advancementVisible ? 'translateX(0)' : 'translateX(150%)' }} aria-hidden="true">
        <div className="ml-[68px] mt-1 flex flex-col justify-center font-['Minecraftia',monospace] text-[13px] leading-[1.2] tracking-wide" style={{ textShadow: '2px 2px 0 #3f3f3f' }}>
          <span className="text-[#FFFF55]">Advancement Made!</span>
          <span className="text-white">First Steps</span>
        </div>
      </div>
    </div>
  );
};
