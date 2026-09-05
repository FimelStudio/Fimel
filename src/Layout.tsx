import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Globe, Sun, Moon, Menu } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import CustomCursor from './components/CustomCursor';
import HotbarNav from './components/HotbarNav';
import { CurtainLoading } from './components/CurtainLoading';
import { OverlayMenu } from './components/OverlayMenu';
import { PageTransition } from './components/PageTransition';
import { Magnetic } from './components/Magnetic';
import { useWorksData } from './hooks/useWorksData';

gsap.registerPlugin(ScrollTrigger);

export const Layout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { siteMeta } = useWorksData();
  const basePath = import.meta.env.BASE_URL;
  const logoPath = `${basePath}Fimel%20logo.png`;

  const mainRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const [loading, setLoading] = useState(() => {
    try {
      return window.sessionStorage.getItem('fimel_intro_seen') !== '1';
    } catch {
      return true;
    }
  });

  const [isDark, setIsDark] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedQQ, setCopiedQQ] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const [advancement, setAdvancement] = useState<{ title: string; desc: string; visible: boolean } | null>(null);
  const unlockedAdvancements = useRef<Set<string>>(new Set());

  // Wait for curtain to finish if loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
        try { window.sessionStorage.setItem('fimel_intro_seen', '1'); } catch { /* ignore */ }
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const current = i18n.resolvedLanguage || i18n.language || 'zh';
    document.documentElement.lang = current;
  }, [i18n.language, i18n.resolvedLanguage]);

  // Lenis smooth scroll setup
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', (e: { progress: number }) => {
      ScrollTrigger.update();
      setScrollProgress(e.progress);
    });
    
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => {
        lenis.raf(time * 1000);
      });
    };
  }, []);

  // Minecraft Advancement
  useEffect(() => {
    if (scrollProgress > 0.1 && !unlockedAdvancements.current.has('first_steps')) {
      unlockedAdvancements.current.add('first_steps');
      setAdvancement({
        title: "Advancement Made!",
        desc: "First Steps",
        visible: true
      });
      setTimeout(() => {
        setAdvancement(prev => prev ? { ...prev, visible: false } : null);
      }, 4000);
    }
  }, [scrollProgress]);

  // Route change resets scroll
  useEffect(() => {
    if (location.state && (location.state as any).scrollTo) {
      const target = (location.state as any).scrollTo;
      // Give time for page transition to complete
      setTimeout(() => {
        if (lenisRef.current) {
          lenisRef.current.scrollTo(target === '#hero' ? 0 : target, { duration: 1.5 });
        } else {
          document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 600);
      
      // Clear state to prevent re-triggering
      window.history.replaceState({}, '');
    } else {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo(0, 0);
      }
    }
  }, [location.pathname, location.state]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    try { localStorage.setItem('fimel_user_lang', lng); } catch { /* ignore */ }
    setLangMenuOpen(false);
    setMenuOpen(false);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    setMenuOpen(false);
    
    if (target.startsWith('#/')) {
      const route = target.replace('#', '');
      navigate(route);
    } else if (target.startsWith('#')) {
      // Home anchor link
      if (location.pathname !== '/') {
        navigate('/', { state: { scrollTo: target } });
      } else {
        if (lenisRef.current) {
          lenisRef.current.scrollTo(target === '#hero' ? 0 : target, { duration: 1.5 });
        } else {
          document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } else {
      // Normal route
      navigate(target);
    }
  };

  const handleCopyQQ = () => {
    navigator.clipboard.writeText("937760015");
    setCopiedQQ(true);
    setTimeout(() => setCopiedQQ(false), 2000);
  };

  // Convert legacy activePage for HotbarNav
  const getActivePageForNav = () => {
    if (location.pathname === '/studio') return 'studio';
    if (location.pathname === '/works/maps') return 'maps-unified';
    if (location.pathname === '/works/mods') return 'mods';
    if (location.pathname === '/works/tools') return 'tools';
    return 'home';
  };

  return (
    <div ref={mainRef} className="w-full font-sans transition-colors duration-700 selection:bg-diamond selection:text-white dark:selection:text-obsidian">
      <div className="noise-overlay"></div>
      <CustomCursor isDark={isDark} />
      <CurtainLoading isLoading={loading} />

      <div className={`${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700`}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <HotbarNav scrollProgress={scrollProgress} handleNavClick={handleNavClick as any} activePage={getActivePageForNav() as any} />

        {/* --- BRAND LOGO: TOP LEFT --- */}
        <div className="fixed top-5 sm:top-6 md:top-8 left-5 md:left-12 z-50 mix-blend-difference text-white pointer-events-none">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link to="/" aria-label="Fimel — Home" onClick={(e) => { e.preventDefault(); handleNavClick(e as any, '#hero'); }} className="pointer-events-auto outline-none transition-transform hover:scale-105 inline-block">
            <img src={logoPath} alt="FIMEL Logo" className="h-14 sm:h-16 md:h-20 lg:h-24 object-contain invert drop-shadow-sm transition-all" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[0.3em] uppercase">FIMEL.</span>'; }} />
          </Link>
        </div>

        {/* --- FLOATING PILL NAV: TOP RIGHT --- */}
        <nav className="fixed top-6 md:top-8 right-5 md:right-12 z-50 flex items-center gap-1.5 md:gap-4 bg-white/10 dark:bg-black/10 backdrop-blur-md border border-obsidian/10 dark:border-white/10 rounded-full px-3 py-1.5 md:px-4 md:py-2 text-obsidian dark:text-white shadow-sm transition-all">
          <div className="relative flex items-center">
            <button 
              onClick={() => setLangMenuOpen(!langMenuOpen)} 
              className="hover-target p-2 rounded-full hover:bg-obsidian/5 dark:hover:bg-white/5 transition-colors outline-none"
              aria-label="Change Language"
              title={i18n.language === 'zh' ? '切换语言' : 'Language'}
              data-cursor="LANG"
            >
              <Globe size={18} />
            </button>
            
            {langMenuOpen && (
              <div className="absolute top-full right-0 mt-4 w-32 py-2 bg-white dark:bg-obsidian rounded shadow-xl border border-obsidian/10 dark:border-white/10 flex flex-col font-mono text-sm z-50">
                <button onClick={() => changeLanguage('zh')} className="hover-target px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left w-full">中文</button>
                <button onClick={() => changeLanguage('en')} className="hover-target px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left w-full">EN</button>
                <button onClick={() => changeLanguage('ja')} className="hover-target px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left w-full">JA</button>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsDark(!isDark)} 
            className="hover-target p-2 rounded-full hover:bg-obsidian/5 dark:hover:bg-white/5 transition-colors outline-none"
            aria-label="Toggle Theme"
            title={isDark ? (i18n.language === 'zh' ? '切换至亮色' : 'Light Mode') : (i18n.language === 'zh' ? '切换至暗色' : 'Dark Mode')}
            data-cursor="THEME"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="w-px h-6 bg-obsidian/20 dark:bg-white/20 mx-1"></div>

          <button 
            onClick={() => setMenuOpen(true)}
            className="hover-target flex items-center gap-2 px-3 py-2 rounded-full hover:bg-obsidian/5 dark:hover:bg-white/5 transition-colors font-mono text-xs uppercase tracking-widest outline-none"
            data-cursor="MENU"
          >
            <span className="hidden md:inline">{t('nav.menu')}</span>
            <Menu size={18} />
          </button>
        </nav>

        {/* OVERLAY MENU */}
        <OverlayMenu 
          isOpen={menuOpen} 
          onClose={() => setMenuOpen(false)} 
          onNavigate={(e, path) => {
            // Remap overlay menu paths to actual react-router routes
            if (path.startsWith('#/')) {
              path = path.replace('#', '');
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            handleNavClick(e as any, path);
          }} 
          changeLanguage={changeLanguage}
          currentLang={i18n.language}
          activePath={location.pathname}
        />

        <main className="relative z-10 bg-paper dark:bg-obsidian border-b border-obsidian/5 dark:border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
          <PageTransition pageKey={location.pathname}>
            <Outlet context={{ isDark, basePath }} />
          </PageTransition>
        </main>

        {/* Spacer for Reveal Footer */}
        <div id="contact" className="relative z-0 h-[100svh] w-full pointer-events-none"></div>

        <footer className="fixed bottom-0 left-0 w-full h-[100svh] px-6 md:px-12 flex flex-col items-center justify-center bg-[#e5e5e5] dark:bg-black border-t border-obsidian/10 dark:border-white/10 overflow-hidden transition-colors duration-700 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,210,211,0.05),transparent_60%)] pointer-events-none"></div>
          
          <div className="z-10 text-center space-y-10 mt-auto max-w-3xl pt-32">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-obsidian dark:text-white transition-colors duration-700 leading-tight pb-2" data-cursor="FIMEL">
              <Trans i18nKey="footer.title" />
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg md:text-xl font-light transition-colors duration-700">
              <Trans i18nKey="footer.desc" />
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-[10px] md:text-xs font-mono uppercase tracking-[0.16em] text-gray-500">
              {siteMeta.contactLabels.map((label: string) => (
                <span key={label} className="border border-obsidian/10 dark:border-white/10 px-3 py-2">{label}</span>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Magnetic intensity={0.4}>
                <a href="mailto:fimel.studio.mc@gmail.com" className="inline-block text-2xl md:text-5xl font-light text-obsidian dark:text-white hover:text-diamond dark:hover:text-diamond transition-all duration-300 border-b border-obsidian/20 dark:border-white/20 hover:border-diamond pb-2 hover-target px-4 py-2" data-cursor="MAIL">
                  fimel.studio.mc@gmail.com
                </a>
              </Magnetic>
            </div>
          </div>

          <div className="w-full max-w-screen-2xl border-t border-obsidian/10 dark:border-white/10 pt-10 mt-auto mb-10 flex flex-col md:flex-row items-center justify-between gap-8 text-xs text-gray-500 font-mono uppercase tracking-widest z-10 transition-colors duration-700">
            <p>{t('footer.copy')}</p>
            <div className="flex gap-8 items-center">
              <Magnetic intensity={0.2}>
                <a href="https://x.com/FimelStudio" target="_blank" rel="noopener noreferrer" className="hover:text-obsidian dark:hover:text-white transition-colors hover-target px-2 py-1 block">X / @FimelStudio</a>
              </Magnetic>
              <Magnetic intensity={0.2}>
                <button 
                  onClick={handleCopyQQ} 
                  className="hover:text-obsidian dark:hover:text-white transition-colors cursor-pointer hover-target px-2 py-1 block"
                >
                  {copiedQQ ? "COPIED!" : "QQ Group: 937760015"}
                </button>
              </Magnetic>
            </div>
          </div>
          
          <div className="absolute -bottom-[5%] left-0 w-full text-center pointer-events-none opacity-[0.015] dark:opacity-[0.015] text-black dark:text-white select-none transition-colors duration-700">
            <span className="text-[25vw] font-black uppercase tracking-tighter leading-none block">FIMEL</span>
          </div>
        </footer>

        {/* Minecraft Advancement Toast */}
        <div 
          className="fixed top-24 md:top-28 right-6 md:right-12 z-[100] w-[320px] h-[64px] transition-transform duration-500 ease-in-out pointer-events-none bg-no-repeat bg-center bg-contain image-rendering-pixelated flex items-center px-4"
          style={{ 
            backgroundImage: `url('${basePath}HUD/Toast_advancement.png')`,
            transform: advancement?.visible ? 'translateX(0)' : 'translateX(150%)'
          }}
        >
          <div className="flex flex-col ml-[68px] justify-center mt-1">
            <span className="text-[#FFFF55] font-['Minecraftia',monospace] text-[13px] leading-[1.2] tracking-wide" style={{ textShadow: '2px 2px 0px #3f3f3f' }}>
              {advancement?.title}
            </span>
            <span className="text-white font-['Minecraftia',monospace] text-[13px] leading-[1.2] tracking-wide" style={{ textShadow: '2px 2px 0px #3f3f3f' }}>
              {advancement?.desc}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
