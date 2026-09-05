import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowUpRight, Diamond, Sword, Map, Code, Sun, Moon, Globe, Star, Download, MessageCircle, Package, Search, ArrowLeft, ExternalLink } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import CustomCursor from './components/CustomCursor';
import HotbarNav from './components/HotbarNav';
import { useDownloadCounters } from './hooks/useDownloadCounters';

gsap.registerPlugin(ScrollTrigger);
import { ParticleCubes } from './components/ParticleBackground';
import { Magnetic } from './components/Magnetic';
import { StickyStack } from './components/StickyStack';
import { ScrollTextReveal } from './components/ScrollTextReveal';
import { HeroTitleReveal } from './components/HeroTitleReveal';
import { TeamHoverRoster } from './components/TeamHoverRoster';
import { CurtainLoading } from './components/CurtainLoading';
import { WorldCore3D } from './components/WorldCore3D';
import { OverlayMenu } from './components/OverlayMenu';
import { TiltGlareCard } from './components/TiltGlareCard';
import { DraggableCube } from './components/DraggableCube';
import { PageTransition } from './components/PageTransition';
import { InfiniteMarquee } from './components/InfiniteMarquee';
import { Menu } from 'lucide-react';

const FEATURED_MAPS = [
  {
    i18nKey: "werewolfFTown",
    downloads: "427,397",
    rating: "3.9",
    comments: "78",
    remarks: "176",
    size: "183 KB",
    version: "v1.23",
    released: "2021-07-12",
    updated: "2021-07-12",
    image: "maps/werewolf-f-town.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4648588173337957318",
    accent: "group-hover:text-red-500 dark:group-hover:text-red-400",
    bg: "from-red-500/10"
  },
  {
    i18nKey: "hungerGamesOldCity",
    downloads: "84,098",
    rating: "4.3",
    comments: "51",
    remarks: "95",
    size: "11.7 MB",
    version: "v2.2",
    released: "2022-08-09",
    updated: "2022-08-28",
    image: "maps/hunger-games-old-city.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4657291854883079467",
    accent: "group-hover:text-amber-500",
    bg: "from-amber-500/10"
  },
  {
    i18nKey: "abyssSkyPit",
    downloads: "1,990",
    rating: "4.3",
    comments: "10",
    remarks: "16",
    size: "3.8 MB",
    version: "v1.23",
    released: "2021-09-03",
    updated: "2021-09-03",
    image: "maps/abyss-sky-pit.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4649770038789663060",
    accent: "group-hover:text-green-500",
    bg: "from-green-500/10"
  },
  {
    i18nKey: "fmlSkyNatureArena",
    downloads: "33,251",
    rating: "4.7",
    comments: "27",
    remarks: "41",
    size: "1.1 MB",
    version: "v1.21",
    released: "2021-04-02",
    updated: "2021-07-14",
    image: "maps/fml-sky-nature-arena.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4646359448597896554",
    accent: "group-hover:text-blue-500",
    bg: "from-blue-500/10"
  },
  {
    i18nKey: "runForMoney",
    downloads: "17,809",
    rating: "4.2",
    comments: "29",
    remarks: "40",
    size: "564 KB",
    version: "v2.0",
    released: "2022-01-28",
    updated: "2022-01-30",
    image: "maps/run-for-money.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4653059746050819814",
    accent: "group-hover:text-rose-500",
    bg: "from-rose-500/10"
  },
  {
    i18nKey: "powerOn2SnowCrisis",
    downloads: "22,286",
    rating: "5.0",
    comments: "16",
    remarks: "63",
    size: "6.8 MB",
    version: "v2.1",
    released: "2022-06-02",
    updated: "2022-06-02",
    image: "maps/power-on-2-snow-crisis.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4655644384723477429",
    accent: "group-hover:text-cyan-500",
    bg: "from-cyan-500/10"
  },
  {
    i18nKey: "islandEscapeBeforeDawn",
    downloads: "39,520",
    rating: "4.2",
    comments: "15",
    remarks: "39",
    size: "18.3 MB",
    version: "v3.2",
    released: "2025-02-16",
    updated: "2025-02-16",
    image: "maps/island-escape-before-dawn.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4677793220493990518",
    accent: "group-hover:text-emerald-500",
    bg: "from-emerald-500/10"
  },
  {
    i18nKey: "amethystSalvation",
    downloads: "13,523",
    rating: "4.7",
    comments: "90",
    remarks: "192",
    size: "3.7 MB",
    version: "v2.11",
    released: "2024-07-01",
    updated: "2024-09-20",
    image: "maps/amethyst-salvation.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4672593901126936215",
    accent: "group-hover:text-amethyst",
    bg: "from-amethyst/10"
  }
];

type WorkPage = 'home' | 'studio' | 'maps-overview' | 'maps-java' | 'maps-bedrock' | 'mods' | 'tools';
type WorkContentPage = Exclude<WorkPage, 'home'>;

const WORK_PAGE_HASHES: Record<WorkContentPage, string> = {
  studio: '#/studio',
  'maps-overview': '#/works/maps',
  'maps-java': '#/works/maps-java',
  'maps-bedrock': '#/works/maps-bedrock',
  mods: '#/works/mods',
  tools: '#/works/tools'
};

const DOWNLOAD_TRACKED_WORKS = ['minecraft-obj-cubizer'] as const;

const getWorkPageFromHash = (hash: string): WorkPage => {
  const found = Object.entries(WORK_PAGE_HASHES).find(([, value]) => value === hash);
  return found ? found[0] as WorkContentPage : 'home';
};


function App() {
  const { t, i18n } = useTranslation();
  const mainRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(() => {
    try {
      return window.sessionStorage.getItem('fimel_intro_seen') !== '1';
    } catch {
      return true;
    }
  });
  const [isDark, setIsDark] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedQQ, setCopiedQQ] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activePage, setActivePage] = useState<WorkPage>(() => getWorkPageFromHash(window.location.hash));
  const [workSearch, setWorkSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [visibleCount, setVisibleCount] = useState(6);
  
  const [advancement, setAdvancement] = useState<{ title: string; desc: string; visible: boolean } | null>(null);
  const unlockedAdvancements = useRef<Set<string>>(new Set());

  // MCTooltip state & ref setup
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState<{ visible: boolean; title: string; category: string; desc: string }>({
    visible: false, title: '', category: '', desc: ''
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (tooltipRef.current && tooltipContent.visible) {
        // Offset slightly to avoid cursor blocking
        const x = e.clientX + 15;
        const y = e.clientY + 15;
        
        // Ensure tooltip doesn't clip off screen right/bottom
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

  interface SiteMetaType {
    bingoCategory: string;
    bingoSubtitle: string;
    bingoDescription: string;
    bingoTags: string[];
    contactLabels: string[];
    studio: {
      originTitle: string;
      originBody: string;
      milestones: { year: string; title: string; desc: string; }[];
      principles: { number: string; title: string; desc: string; }[];
    };
  }

  const basePath = import.meta.env.BASE_URL;
  const siteMeta = t('siteMeta', { returnObjects: true }) as SiteMetaType;
  const {
    configured: downloadCountersConfigured,
    counts: downloadCounts,
    loading: downloadCountersLoading,
    recordDownload,
  } = useDownloadCounters(DOWNLOAD_TRACKED_WORKS);
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language);
  const getDownloadCounterLabel = (slug?: string) => {
    if (!slug) {
      return null;
    }

    if (!downloadCountersConfigured) {
      return t('workPages.download_count_pending');
    }

    if (downloadCountersLoading) {
      return t('workPages.download_count_loading');
    }

    return t('workPages.download_count_metric', {
      count: numberFormatter.format(downloadCounts[slug] ?? 0),
    });
  };
  // Logo display toggle based on exact file name
  const logoPath = `${basePath}Fimel%20logo.png`;

  const handleCopyQQ = () => {
    navigator.clipboard.writeText("937760015");
    setCopiedQQ(true);
    setTimeout(() => setCopiedQQ(false), 2000);
  };

  useEffect(() => {
    const syncPageFromHash = () => {
      setActivePage(getWorkPageFromHash(window.location.hash));
      setWorkSearch('');
      setMenuOpen(false);
      setLangMenuOpen(false);
    };

    window.addEventListener('hashchange', syncPageFromHash);
    window.addEventListener('popstate', syncPageFromHash);

    return () => {
      window.removeEventListener('hashchange', syncPageFromHash);
      window.removeEventListener('popstate', syncPageFromHash);
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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

  const openWorkPage = (page: WorkContentPage) => {
    const hash = WORK_PAGE_HASHES[page];
    window.history.pushState(null, '', hash);
    setActivePage(page);
    setWorkSearch('');
    setMenuOpen(false);
    setLangMenuOpen(false);
    requestAnimationFrame(() => {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { duration: 0.8 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const scrollHomeTo = (target: string) => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const isTop = target === '#hero' || target === '';
        if (lenisRef.current) {
          lenisRef.current.scrollTo(isTop ? 0 : target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
        } else {
          if (isTop) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, 100);
    });
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    setMenuOpen(false);
    setLangMenuOpen(false);

    const targetPage = getWorkPageFromHash(target);
    if (targetPage !== 'home') {
      openWorkPage(targetPage);
      return;
    }

    setActivePage('home');
    setWorkSearch('');
    window.history.pushState(null, '', target);
    scrollHomeTo(target);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    try {
      localStorage.setItem('fimel_user_lang', lng);
    } catch {
      // Storage may be unavailable in strict privacy modes
    }
    setLangMenuOpen(false);
    setMenuOpen(false);
  };

  // Sync html lang attribute with current i18n language
  useEffect(() => {
    const current = i18n.resolvedLanguage || i18n.language || 'zh';
    document.documentElement.lang = current;
  }, [i18n.language, i18n.resolvedLanguage]);

  // Auto detect language on first visit with fallback
  useEffect(() => {
    let storedLang: string | null;
    try {
      storedLang = localStorage.getItem('fimel_user_lang');
    } catch {
      storedLang = null;
    }

    if (storedLang) {
      i18n.changeLanguage(storedLang);
      return;
    }

    // Default to browser language immediately
    const browserLang = (navigator.language || '').toLowerCase();
    if (browserLang.includes('zh')) {
      i18n.changeLanguage('zh');
    } else if (browserLang.includes('ja')) {
      i18n.changeLanguage('ja');
    } else {
      i18n.changeLanguage('en');
    }

    // Attempt non-blocking geolocation check with strict timeout and error suppression
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    fetch('https://ipapi.co/json/', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data || !data.country_code) return;
        const country = data.country_code;
        if (['CN', 'TW', 'HK', 'MO', 'SG'].includes(country)) {
          i18n.changeLanguage('zh');
        } else if (country === 'JP') {
          i18n.changeLanguage('ja');
        } else {
          i18n.changeLanguage('en');
        }
      })
      .catch(() => {
        // Silently keep browser language default on network error, timeout, or adblock
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
  }, [i18n]);

  useEffect(() => {
    if (!loading) return;

    const timer = setTimeout(() => {
      try {
        window.sessionStorage.setItem('fimel_intro_seen', '1');
      } catch {
        // Storage may be unavailable in strict privacy modes; the intro can still finish.
      }
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".hero-title",
        { y: 150, opacity: 0, skewY: 5 },
        { y: 0, opacity: 1, skewY: 0, duration: 1.5, ease: "power4.out", stagger: 0.15 }
      );
      gsap.fromTo(".hero-sub",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1.5, delay: 0.6, ease: "power3.out" }
      );
      gsap.utils.toArray<HTMLElement>('.reveal-up').forEach((elem) => {
        gsap.fromTo(elem,
          { y: 80, opacity: 0 },
          {
            scrollTrigger: { trigger: elem, start: "top 85%", end: "bottom 20%", toggleActions: "play none none reverse" },
            y: 0, opacity: 1, duration: 1.2, ease: "expo.out"
          }
        );
      });

      // Parallax bindings
      gsap.utils.toArray<HTMLElement>('.parallax-bg').forEach((elem) => {
        gsap.fromTo(elem,
          { yPercent: -15 },
          {
            yPercent: 15,
            ease: "none",
            scrollTrigger: {
              trigger: elem.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true
            }
          }
        );
      });

      gsap.utils.toArray<HTMLElement>('.parallax-text').forEach((elem) => {
        gsap.fromTo(elem,
          { yPercent: 25 },
          {
            yPercent: -25,
            ease: "none",
            scrollTrigger: {
              trigger: elem.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true
            }
          }
        );
      });

      gsap.utils.toArray<HTMLElement>('.parallax-hero').forEach((elem) => {
        gsap.to(elem, {
          yPercent: 20,
          ease: "none",
          scrollTrigger: {
            trigger: elem.parentElement,
            start: "top top",
            end: "bottom top",
            scrub: true
          }
        });
      });

    }, mainRef);
    return () => ctx.revert();
  }, [loading, i18n.language, activePage]);

  const renderStudioPage = () => {
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
      <main className="min-h-screen bg-paper dark:bg-obsidian text-obsidian dark:text-white transition-colors duration-700">
        <section className="relative min-h-[82vh] overflow-hidden flex items-center px-6 md:px-16 lg:px-24 pt-36 pb-20 border-b border-obsidian/10 dark:border-white/10">
          <div className="parallax-hero absolute inset-[-10%] w-[120%] h-[120%] opacity-45 pointer-events-none"><ParticleCubes isDark={isDark} /></div>
          <div className="relative z-10 max-w-screen-2xl w-full">
            <a href="#hero" onClick={(e) => handleNavClick(e, '#hero')} className="hover-target inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-gray-500 hover:text-obsidian dark:hover:text-white transition-colors mb-12"><ArrowLeft className="w-4 h-4" /> {t('workPages.back_home')}</a>
            <p className="hero-sub font-mono text-sm uppercase tracking-[0.35em] mb-6 text-amethyst">{t('about.tag')}</p>
            <h1 className="hero-title text-[15vw] md:text-[10vw] lg:text-[7vw] leading-[0.88] font-black tracking-tighter max-w-6xl text-obsidian dark:text-white"><Trans i18nKey="about.title" /></h1>
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
          <div className="max-w-screen-xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-24 items-stretch">
            <div className="reveal-up flex flex-col justify-center py-4">
              <div className="font-mono text-amethyst tracking-[0.2em] text-sm flex items-center gap-6"><span className="w-12 h-px bg-amethyst"></span>STUDIO / ORIGIN</div>
              <h2 className="mt-8 text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] text-obsidian dark:text-white">{siteMeta.studio.originTitle}</h2>
              <ScrollTextReveal className="mt-8 max-w-2xl text-lg md:text-xl font-light leading-relaxed text-obsidian dark:text-white">
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

        <section className="relative z-20 py-24 md:py-32 px-6 md:px-16 lg:px-24 bg-[#e5e5e5] dark:bg-[#050505] transition-colors duration-700">
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
                    <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-tight sm:leading-none mb-4 sm:mb-6">{principle.title}</h2>
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
      </main>
    );
  };

  const renderWorkPage = () => {
    if (activePage === 'studio') return renderStudioPage();
    const page = activePage as Exclude<WorkContentPage, 'studio'>;
    const pageCopy = {
      'maps-overview': {
        eyebrow: t('workPages.maps.eyebrow'),
        title: t('workPages.maps.title'),
        desc: t('workPages.maps.desc'),
        accent: 'text-diamond',
        line: 'bg-diamond',
        texture: 'diamond_block.png',
        statValue: '10+',
        mode: t('workPages.status.live')
      },
      'maps-java': {
        eyebrow: t('workPages.java.eyebrow'),
        title: t('workPages.java.title'),
        desc: t('workPages.java.desc'),
        accent: 'text-[#ff9ff3]',
        line: 'bg-[#ff9ff3]',
        texture: 'obsidian.png',
        statValue: '2',
        mode: t('workPages.status.prototype')
      },
      'maps-bedrock': {
        eyebrow: t('workPages.bedrock.eyebrow'),
        title: t('workPages.bedrock.title'),
        desc: t('workPages.bedrock.desc'),
        accent: 'text-diamond',
        line: 'bg-diamond',
        texture: 'emerald_block.png',
        statValue: `${FEATURED_MAPS.length}`,
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

    const bedrockEntries = FEATURED_MAPS.map((work) => {
      const components = t(`works.bedrockMaps.${work.i18nKey}.components`, { returnObjects: true }) as string[];
      return {
        ...work,
        title: t(`works.bedrockMaps.${work.i18nKey}.title`),
        subtitle: t(`works.bedrockMaps.${work.i18nKey}.subtitle`),
        category: t(`works.bedrockMaps.${work.i18nKey}.category`),
        genre: t(`works.bedrockMaps.${work.i18nKey}.genre`),
        desc: t(`works.bedrockMaps.${work.i18nKey}.desc`),
        players: t(`works.bedrockMaps.${work.i18nKey}.players`),
        components
      };
    });
    const query = workSearch.trim().toLocaleLowerCase();
    let filteredBedrockEntries = bedrockEntries;

    if (activeTab !== 'All') {
      filteredBedrockEntries = filteredBedrockEntries.filter((work) => {
        const lowerGenre = work.genre.toLocaleLowerCase();
        if (activeTab === 'PvP') return lowerGenre.includes('pvp');
        if (activeTab === 'RPG') return lowerGenre.includes('rpg');
        if (activeTab === 'Puzzle') return lowerGenre.includes('解谜') || lowerGenre.includes('puzzle') || lowerGenre.includes('パズル') || lowerGenre.includes('逃生') || lowerGenre.includes('escape') || lowerGenre.includes('脱出');
        return true;
      });
    }

    if (query) {
      filteredBedrockEntries = filteredBedrockEntries.filter((work) => `${work.title} ${work.subtitle} ${work.category} ${work.genre} ${work.desc} ${work.players} ${work.components.join(' ')}`.toLocaleLowerCase().includes(query));
    }

    type ProjectEntry = {
      title: string;
      subtitle: string;
      category: string;
      status: string;
      desc: string;
      texture: string;
      accent: string;
      tags: string[];
      image?: string;
      download?: string;
      downloadSlug?: string;
      repo?: string;
      version?: string;
      author?: string;
      fileLabel?: string;
    };

    const objCubizerDownload = `${basePath}plugins/minecraft-obj-cubizer/minecraft_obj_cubizer-1.4.0.zip`;
    const objCubizerLogo = `${basePath}plugins/minecraft-obj-cubizer/minecraft-obj-cubizer-logo.svg`;
    const objCubizerRepo = 'https://github.com/Ylong4004/minecraft_obj_cubizer';
    const bingoLogo = `${basePath}bingo-but-dont-do-it-logo.png`;

    const javaEntries: ProjectEntry[] = [
      {
        title: t('works.m9_t'),
        subtitle: 'Island Escape: Java Core',
        category: t('works.m9_c'),
        status: t('workPages.status.prototype'),
        desc: t('works.m9_d'),
        texture: 'ice.png',
        accent: 'group-hover:text-[#ff9ff3]',
        tags: t('workPages.java.project1_tags', { returnObjects: true }) as string[]
      },
      {
        title: t('works.m10_t'),
        subtitle: 'Narrative RPG',
        category: t('works.m10_c'),
        status: t('workPages.status.design'),
        desc: t('works.m10_d'),
        texture: 'amethyst',
        accent: 'group-hover:text-diamond',
        tags: t('workPages.java.project2_tags', { returnObjects: true }) as string[]
      }
    ];

    const modsEntries: ProjectEntry[] = [
      {
        title: 'Bingo × Don\'t Do It',
        subtitle: siteMeta.bingoSubtitle,
        category: siteMeta.bingoCategory,
        status: t('workPages.status.live'),
        desc: siteMeta.bingoDescription,
        texture: 'redstone_block.png',
        image: bingoLogo,
        accent: 'group-hover:text-emerald-500',
        tags: siteMeta.bingoTags,
        repo: 'https://github.com/Ylong4004/bingo-but-dont-do-it'
      }
    ];

    const toolsEntries: ProjectEntry[] = [
      {
        title: t('workPages.tools.objCubizer.title'),
        subtitle: t('workPages.tools.objCubizer.subtitle'),
        category: t('workPages.tools.objCubizer.category'),
        status: t('workPages.tools.objCubizer.status'),
        desc: t('workPages.tools.objCubizer.desc'),
        texture: 'diamond_block.png',
        image: objCubizerLogo,
        download: objCubizerDownload,
        downloadSlug: 'minecraft-obj-cubizer',
        repo: objCubizerRepo,
        version: 'v1.4.0',
        author: 'Ylong',
        fileLabel: 'ZIP · 52.5 KB',
        accent: 'group-hover:text-diamond',
        tags: t('workPages.tools.objCubizer.tags', { returnObjects: true }) as string[]
      },
      {
        title: t('works.tool1_t'),
        subtitle: 'Production Toolchain',
        category: t('works.tool1_c'),
        status: t('workPages.status.wip'),
        desc: t('works.tool1_d'),
        texture: 'iron_block.png',
        accent: 'group-hover:text-blue-500',
        tags: t('workPages.tools.tags', { returnObjects: true }) as string[]
      }
    ];

    const renderTexturePanel = (texture: string, code: string, image?: string, title?: string) => (
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

    const renderProjectCard = (work: ProjectEntry, idx: number) => (
      <article key={`${work.title}-${idx}`} className="reveal-up group grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-12 items-stretch">
        {renderTexturePanel(work.texture, `DEV_${idx + 1}`, work.image, work.title)}
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
          {work.downloadSlug && (
            <div className="mt-5 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-gray-500">
              <Download className="w-4 h-4 text-diamond" />
              <span>{getDownloadCounterLabel(work.downloadSlug)}</span>
            </div>
          )}
          {(work.download || work.repo) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {work.download && (
                <a
                  href={work.download}
                  download
                  onClick={() => {
                    if (work.downloadSlug) {
                      void recordDownload(work.downloadSlug);
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

    const renderBedrockCard = (work: typeof bedrockEntries[number], _idx: number, compact = false) => (
      <article
        key={work.link}
        className={`reveal-up group bg-white/40 dark:bg-black/40 border border-obsidian/5 dark:border-white/5 hover:border-obsidian/20 dark:hover:border-white/20 transition-colors duration-500 ${compact ? '' : 'grid lg:grid-cols-[0.95fr_1.05fr] gap-0'}`}
        onMouseEnter={() => setTooltipContent({ visible: true, title: work.title, category: work.genre, desc: work.desc })}
        onMouseLeave={() => setTooltipContent({ visible: false, title: '', category: '', desc: '' })}
      >
        <a href={work.link} target="_blank" rel="noopener noreferrer" className="hover-target block relative min-h-[18rem] md:min-h-[24rem] overflow-hidden isolate" aria-label={t('works.open_detail_aria', { title: work.title })}>
          <img src={`${basePath}${work.image}`} alt={work.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" />
          <div className={`absolute inset-0 bg-gradient-to-br ${work.bg} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-multiply dark:mix-blend-screen`}></div>
          <div className="absolute left-4 top-4 bg-black/70 text-white text-[10px] uppercase tracking-[0.2em] font-mono px-3 py-2">{work.category}</div>
        </a>
        <div className="p-6 md:p-8 flex flex-col justify-between gap-8">
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

    const heroStats = [
      { label: t('workPages.stats.projects'), value: pageCopy.statValue },
      { label: t('workPages.stats.platform'), value: activePage === 'maps-java' ? 'Java' : activePage === 'maps-bedrock' ? 'Bedrock' : 'Fimel' },
      { label: t('workPages.stats.mode'), value: pageCopy.mode }
    ];

    return (
      <main className="min-h-screen bg-paper dark:bg-obsidian text-obsidian dark:text-white transition-colors duration-700">
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
            <a href="#hero" onClick={(e) => handleNavClick(e, '#hero')} className="hover-target inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-gray-500 hover:text-obsidian dark:hover:text-white transition-colors mb-12">
              <ArrowLeft className="w-4 h-4" /> {t('workPages.back_home')}
            </a>
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
            {(activePage === 'maps-bedrock' || activePage === 'maps-overview') && (
              <div className="reveal-up flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
                <div>
                  <div className={`font-mono text-xs uppercase tracking-[0.25em] flex items-center gap-4 ${pageCopy.accent}`}>
                    <span className={`w-10 h-px ${pageCopy.line}`}></span>
                    {activePage === 'maps-overview' ? t('workPages.maps.catalog') : t('workPages.bedrock.catalog')}
                  </div>
                  <h2 className="mt-5 text-4xl md:text-6xl font-black uppercase tracking-tighter">{t('workPages.catalog_title')}</h2>
                </div>
                <label className="relative w-full lg:w-[28rem] block">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={workSearch}
                    onChange={(event) => setWorkSearch(event.target.value)}
                    placeholder={t('workPages.search_placeholder')}
                    className="w-full bg-white/60 dark:bg-black/50 border border-obsidian/10 dark:border-white/10 py-4 pl-11 pr-4 outline-none focus:border-diamond font-mono text-sm transition-colors"
                  />
                </label>
              </div>
            )}

            {activePage === 'maps-overview' && (
              <div className="space-y-24">
                <div className="grid lg:grid-cols-2 gap-8">
                  {filteredBedrockEntries.slice(0, 4).map((work, idx) => renderBedrockCard(work, idx, true))}
                </div>
                <div className="reveal-up flex flex-wrap gap-4">
                  <a href={WORK_PAGE_HASHES['maps-bedrock']} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-bedrock'])} className="hover-target inline-flex items-center gap-3 border border-obsidian dark:border-white px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] hover:text-diamond hover:border-diamond transition-colors">
                    {t('workPages.view_bedrock')} <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <a href={WORK_PAGE_HASHES['maps-java']} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-java'])} className="hover-target inline-flex items-center gap-3 border border-obsidian/20 dark:border-white/20 px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] hover:text-[#ff9ff3] hover:border-[#ff9ff3] transition-colors">
                    {t('workPages.view_java')} <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="space-y-16">
                  <h2 className="reveal-up text-4xl md:text-6xl font-black uppercase tracking-tighter">{t('nav.nav_maps_je')}</h2>
                  {javaEntries.map(renderProjectCard)}
                </div>
              </div>
            )}

            {activePage === 'maps-bedrock' && (
              <div className="space-y-10">
                <div className="flex flex-wrap gap-3 mb-12">
                  {['All', 'PvP', 'RPG', 'Puzzle'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setVisibleCount(6); }}
                      className={`px-5 py-3 font-mono text-xs uppercase tracking-widest border transition-colors ${
                        activeTab === tab
                          ? 'bg-obsidian text-white border-obsidian dark:bg-white dark:text-obsidian dark:border-white'
                          : 'bg-transparent text-obsidian border-obsidian/20 dark:text-white dark:border-white/20 hover:border-obsidian dark:hover:border-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div className="space-y-10">
                  <AnimatePresence mode="popLayout">
                    {filteredBedrockEntries.length ? (
                      filteredBedrockEntries.slice(0, visibleCount).map((work, idx) => (
                        <motion.div
                          key={work.link}
                          layout
                          initial={{ opacity: 0, y: 50, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {renderBedrockCard(work, idx)}
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        key="no-results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="reveal-up border-y border-obsidian/10 dark:border-white/10 py-16 text-center"
                      >
                        <p className="text-gray-500 font-mono uppercase tracking-[0.2em]">{t('workPages.no_results')}</p>
                        <button onClick={() => setWorkSearch('')} className="hover-target mt-6 text-diamond font-mono text-xs uppercase tracking-[0.2em]">{t('workPages.clear_search')}</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {filteredBedrockEntries.length > visibleCount && (
                  <div className="flex justify-center pt-12">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 6)}
                      className="group flex items-center gap-4 px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] text-obsidian dark:text-white border border-obsidian/20 dark:border-white/20 hover:border-diamond hover:text-diamond transition-colors"
                    >
                      {t('workPages.load_more', 'LOAD MORE')}
                      <span className="w-4 h-4 flex items-center justify-center border border-current rounded-full group-hover:bg-diamond group-hover:text-white transition-all">+</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activePage === 'maps-java' && (
              <div className="space-y-16">
                {javaEntries.map(renderProjectCard)}
              </div>
            )}

            {activePage === 'mods' && (
              <div className="space-y-16">
                {modsEntries.map(renderProjectCard)}
              </div>
            )}

            {activePage === 'tools' && (
              <div className="space-y-16">
                {toolsEntries.map(renderProjectCard)}
              </div>
            )}
          </div>
        </section>
      </main>
    );
  };

  return (
    <div ref={mainRef} className="w-full font-sans transition-colors duration-700 selection:bg-diamond selection:text-white dark:selection:text-obsidian">
      <div className="noise-overlay"></div>
      <CustomCursor isDark={isDark} />
      
      <CurtainLoading isLoading={loading} />

      <div className={`${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700`}>
        
        {/* Minecraft Tooltip */}
        <div 
          ref={tooltipRef}
          className="fixed top-0 left-0 pointer-events-none z-[100] px-4 py-3 opacity-0 transition-opacity duration-150 image-rendering-pixelated"
          style={{ 
            opacity: tooltipContent.visible ? 1 : 0,
            borderStyle: 'solid',
            borderWidth: '8px',
            borderImageSource: `url(${basePath}HUD/Tooltip_background.png)`,
            borderImageSlice: '6 fill',
            borderImageRepeat: 'stretch',
            textShadow: '2px 2px 0px #3f3f3f'
          }}
        >
          <div className="flex flex-col gap-1 font-mono textShadow-mc -mt-1 -mx-0.5">
            <span className="text-[#FFFF55] text-lg font-bold">{tooltipContent.title}</span>
            <span className="text-[#AAAAAA] text-xs uppercase tracking-widest">{tooltipContent.category}</span>
            <span className="text-[#5555FF] text-sm mt-1 max-w-[250px] leading-snug">{tooltipContent.desc}</span>
          </div>
        </div>

        {/* Phase 3 Hotbar Navigation HUD */}
        <HotbarNav scrollProgress={scrollProgress} handleNavClick={handleNavClick} activePage={activePage} />

        {/* --- BRAND LOGO: TOP LEFT --- */}
        <div className="fixed top-5 sm:top-6 md:top-8 left-5 md:left-12 z-50 mix-blend-difference text-white pointer-events-none">
          <a href="#hero" aria-label="Fimel — Home" onClick={(e) => handleNavClick(e, '#hero')} className="pointer-events-auto outline-none transition-transform hover:scale-105 inline-block">
            <img src={logoPath} alt="FIMEL Logo" className="h-14 sm:h-16 md:h-20 lg:h-24 object-contain invert drop-shadow-sm transition-all" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[0.3em] uppercase">FIMEL.</span>'; }} />
          </a>
        </div>

        {/* --- FLOATING PILL NAV: TOP RIGHT --- */}
        <nav className="fixed top-6 md:top-8 right-5 md:right-12 z-50 flex items-center gap-1.5 md:gap-4 bg-white/10 dark:bg-black/10 backdrop-blur-md border border-obsidian/10 dark:border-white/10 rounded-full px-3 py-1.5 md:px-4 md:py-2 text-obsidian dark:text-white shadow-sm transition-all">
          <div className="relative flex items-center">
            <button 
              onClick={() => setLangMenuOpen(!langMenuOpen)} 
              className="hover-target p-2 rounded-full hover:bg-obsidian/5 dark:hover:bg-white/5 transition-colors outline-none"
              aria-label="Change Language"
              data-cursor="LANG"
            >
              <Globe size={18} />
            </button>
            
            {langMenuOpen && (
              <div className="absolute top-full right-0 mt-4 w-32 py-2 bg-white dark:bg-obsidian rounded shadow-xl border border-obsidian/10 dark:border-white/10 flex flex-col font-mono text-sm z-50">
                <button onClick={() => { changeLanguage('zh'); setLangMenuOpen(false); }} className="hover-target px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left w-full">中文</button>
                <button onClick={() => { changeLanguage('en'); setLangMenuOpen(false); }} className="hover-target px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left w-full">EN</button>
                <button onClick={() => { changeLanguage('ja'); setLangMenuOpen(false); }} className="hover-target px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left w-full">JA</button>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsDark(!isDark)} 
            className="hover-target p-2 rounded-full hover:bg-obsidian/5 dark:hover:bg-white/5 transition-colors outline-none"
            aria-label="Toggle Theme"
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
          onNavigate={handleNavClick} 
          changeLanguage={changeLanguage}
          currentLang={i18n.language}
        />

        <main className="relative z-10 bg-paper dark:bg-obsidian border-b border-obsidian/5 dark:border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
        <PageTransition pageKey={activePage}>
        {activePage === 'home' ? (
        <>
        <section id="hero" className="relative w-full min-h-[100svh] overflow-hidden flex flex-col justify-center px-6 pt-24 pb-20 md:px-16 lg:px-24 bg-paper dark:bg-obsidian transition-colors duration-700">
          <div className="parallax-hero absolute inset-[-10%] w-[120%] h-[120%] z-0 opacity-70 pointer-events-none">
            <ParticleCubes isDark={isDark} />
          </div>
          
          <div className="relative z-10 max-w-screen-2xl w-full flex flex-col items-start gap-4 pointer-events-none mt-12 md:mt-0">
            <div className="hero-sub pointer-events-auto flex items-center gap-4 mb-2 font-mono text-[10px] md:text-xs uppercase tracking-[0.22em] text-obsidian/60 dark:text-white/60">
              <span className="w-8 md:w-12 h-px bg-diamond"></span>
              {t('home.studio_label')}
            </div>
            
            <div className="overflow-visible pointer-events-auto flex flex-col gap-2">
              <HeroTitleReveal delay={0.4} className="hero-title text-[13vw] lg:text-[9vw] leading-[1] font-extrabold tracking-tighter uppercase text-obsidian dark:text-white transition-colors duration-700">
                {t('hero.crafting')}
              </HeroTitleReveal>
              <HeroTitleReveal delay={0.6} className="hero-title text-[13vw] lg:text-[9vw] leading-[1] font-extrabold tracking-tighter uppercase text-obsidian dark:text-white lg:ml-[10vw] transition-colors duration-700 flex gap-4">
                <span className="italic text-obsidian/40 dark:text-white/40 font-serif">the</span> {t('hero.worlds')}
              </HeroTitleReveal>
            </div>

            <div className="hero-sub mt-6 md:mt-8 flex flex-col md:flex-row items-start md:items-center gap-5 md:gap-8 max-w-2xl pointer-events-auto">
              <p className="text-base md:text-xl font-light tracking-wide text-gray-600 dark:text-gray-300 leading-relaxed font-sans transition-colors duration-700">
                <Trans i18nKey="hero.sub" />
              </p>
            </div>

            <div className="hero-sub mt-10 flex flex-col sm:flex-row gap-4 pointer-events-auto w-full sm:w-auto">
              <a
                href="#quick-entry"
                onClick={(e) => handleNavClick(e, '#quick-entry')}
                className="group relative inline-flex min-h-12 items-center justify-between gap-8 bg-obsidian dark:bg-white text-white dark:text-obsidian px-6 py-4 font-mono text-xs uppercase tracking-[0.18em] transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl hover:shadow-diamond/20"
              >
                <span className="relative z-10">{t('home.featured_cta')}</span>
                <ArrowUpRight className="w-4 h-4 relative z-10 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                <div className="absolute inset-0 bg-diamond opacity-0 group-hover:opacity-10 transition-opacity"></div>
              </a>
              <a
                href={WORK_PAGE_HASHES['maps-java']}
                onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-java'])}
                className="group inline-flex min-h-12 items-center justify-between gap-8 border border-obsidian/30 dark:border-white/30 bg-transparent backdrop-blur-sm px-6 py-4 font-mono text-xs uppercase tracking-[0.18em] text-obsidian dark:text-white transition-all hover:border-obsidian dark:hover:border-white hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{t('home.current_cta')}</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          <div className="hidden md:flex absolute bottom-12 right-12 flex-col items-center gap-2 opacity-60 hero-sub mix-blend-difference pointer-events-none">
            <span className="text-[10px] tracking-[0.3em] uppercase font-mono rotate-90 mb-8 text-white">{t('hero.scroll')}</span>
            <div className="w-[1px] h-20 bg-gradient-to-b from-white to-transparent"></div>
          </div>
        </section>

        <div className="w-full overflow-hidden bg-obsidian dark:bg-white text-white dark:text-obsidian py-5 flex whitespace-nowrap z-10 relative transition-colors duration-700">
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

        <section id="quick-entry" className="scroll-mt-[136px] md:scroll-mt-[160px] py-20 md:py-28 px-6 md:px-16 lg:px-24 bg-[#e5e5e5] dark:bg-[#050505] transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto">
            <div className="mb-10 md:mb-14">
              <h2 className="reveal-up max-w-3xl text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-obsidian dark:text-white">
                {t('home.quick_title')}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
              <TiltGlareCard
                href={WORK_PAGE_HASHES['maps-overview']}
                onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-overview'])}
                className="hover-target reveal-up group relative min-h-[22rem] md:min-h-[30rem] overflow-hidden border border-white/10 bg-obsidian/70 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] text-white col-span-1 md:col-span-12 lg:col-span-7"
              >
                <img src={`${basePath}maps/island-escape-before-dawn.png`} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-70 transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-10 pointer-events-none">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 mb-4">01 / {t('home.maps_title')}</span>
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
                href={WORK_PAGE_HASHES.mods}
                onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.mods)}
                className="hover-target reveal-up group relative min-h-[20rem] md:min-h-[30rem] overflow-hidden border border-emerald-500/10 bg-[#07120a]/80 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-white col-span-1 md:col-span-6 lg:col-span-5"
              >
                <img src={`${basePath}bingo-but-dont-do-it-logo.png`} alt="" loading="lazy" decoding="async" className="absolute inset-x-0 top-10 w-full h-[50%] object-contain p-6 opacity-80 transition-all duration-[1200ms] ease-out group-hover:scale-110 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07120a] via-[#07120a]/80 to-transparent"></div>
                <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-10 pointer-events-none">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/70 mb-4">02 / {t('home.mods_title')}</span>
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
                href={WORK_PAGE_HASHES.tools}
                onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.tools)}
                className="hover-target reveal-up group relative min-h-[16rem] md:min-h-[22rem] overflow-hidden border border-obsidian/10 dark:border-white/10 bg-white/80 dark:bg-[#111]/80 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] text-obsidian dark:text-white col-span-1 md:col-span-6 lg:col-span-12"
              >
                <div className="absolute right-0 top-0 w-1/2 h-full hidden md:flex items-center justify-end pr-12 bg-[radial-gradient(circle_at_center,rgba(0,210,211,0.15),transparent_66%)]">
                  <img src={`${basePath}plugins/minecraft-obj-cubizer/minecraft-obj-cubizer-logo.svg`} alt="" loading="lazy" decoding="async" className="w-[60%] h-[60%] object-contain opacity-85 transition-all duration-[1200ms] ease-out group-hover:scale-105 group-hover:opacity-100" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent dark:from-[#111] dark:via-[#111]/95 md:w-2/3"></div>
                <div className="relative z-10 h-full flex flex-col justify-center p-8 md:p-12 w-full md:w-2/3 lg:w-1/2 pointer-events-none">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-diamond mb-4">03 / {t('home.tools_title')}</span>
                  <h3 className="text-2xl md:text-4xl font-bold mb-4">{t('home.tools_featured')}</h3>
                  <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400 mb-8 max-w-md">{t('home.tools_desc')}</p>
                  <div className="pointer-events-auto">
                    <Magnetic intensity={0.3}>
                      <span className="inline-flex items-center gap-2 px-6 py-3 border border-obsidian/20 dark:border-white/20 rounded-sm font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:bg-obsidian hover:text-white dark:hover:bg-white dark:hover:text-black" data-cursor="EXPLORE">
                        {t('home.enter')} <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </Magnetic>
                  </div>
                </div>
              </TiltGlareCard>
            </div>
          </div>
        </section>

        <section id="about" className="relative px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto flex flex-col lg:flex-row relative">
            
            {/* Mobile Visual (Visible only on small screens) */}
            <div className="w-full h-[36vh] sm:h-[45vh] lg:hidden relative mt-20 mb-8 overflow-hidden rounded-sm group bg-[#e5e5e5] dark:bg-[#050505] p-4 flex flex-col items-center justify-center perspective-1000 touch-pan-y">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(155,89,182,0.15),transparent_70%)] opacity-50"></div>
              <DraggableCube basePath={basePath} />
              <span className="relative z-20 mt-4 text-[10px] font-mono tracking-widest uppercase text-obsidian/40 dark:text-white/40 select-none pointer-events-none">
                {t('about.render')}
              </span>
            </div>

            {/* Left Column: Scrolling Narrative */}
            <div className="w-full lg:w-[55%] lg:py-[20vh] pt-16 pb-32 space-y-[15vh] lg:space-y-[35vh]">
              <div className="min-h-[30vh] lg:min-h-[50vh] flex flex-col justify-center">
                <h2 className="reveal-up text-5xl md:text-6xl lg:text-8xl font-bold leading-[1.1] tracking-tighter text-obsidian dark:text-white transition-colors duration-700 max-w-lg">
                  <Trans i18nKey="about.title" />
                </h2>
              </div>
              
              <div className="min-h-[30vh] lg:min-h-[50vh] flex flex-col justify-center">
                <ScrollTextReveal className="text-2xl md:text-3xl lg:text-4xl text-obsidian dark:text-white font-bold leading-relaxed transition-colors duration-700">
                  {t('about.desc')}
                </ScrollTextReveal>
              </div>

              <div className="min-h-[30vh] lg:min-h-[50vh] flex flex-col justify-center pb-10 lg:pb-[10vh]">
                <div className="reveal-up grid grid-cols-2 gap-12 lg:gap-20 pt-12 border-t border-obsidian/10 dark:border-white/10 transition-colors duration-700">
                  <div>
                    <div className="text-6xl lg:text-7xl font-black text-diamond mb-3 tracking-tighter">{t('about.y1')}</div>
                    <div className="text-xs md:text-sm tracking-widest font-mono text-gray-500 uppercase">{t('about.y1_sub')}</div>
                  </div>
                  <div>
                    <div className="text-6xl lg:text-7xl font-black text-diamond mb-3 tracking-tighter">{t('about.y2')}</div>
                    <div className="text-xs md:text-sm tracking-widest font-mono text-gray-500 uppercase">{t('about.y2_sub')}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Desktop Pinned Visual */}
            <div className="hidden lg:flex w-[45%] h-[100vh] sticky top-0 items-center justify-center pl-16">
              <div className="w-full h-[70vh] relative overflow-hidden rounded-sm group bg-[#e5e5e5] dark:bg-[#050505] p-10 flex items-center justify-center transition-colors duration-700 perspective-1000">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(155,89,182,0.15),transparent_70%)] opacity-50"></div>
                
                <DraggableCube basePath={basePath} />

                <div className="absolute bottom-6 right-6 text-xs text-obsidian/30 dark:text-white/20 font-mono transition-colors duration-700">{t('about.render')}</div>
              </div>
            </div>
          </div>
        </section>



        <section id="works" className="py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-8">
              <h2 className="reveal-up text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-tight pb-2 text-obsidian dark:text-white transition-colors duration-700">
                <Trans i18nKey="works.title" />
              </h2>
              <a href="#contact" onClick={(e) => handleNavClick(e, '#contact')} className="reveal-up flex items-center gap-3 pb-2 border-b border-obsidian dark:border-white hover:text-diamond hover:border-diamond dark:hover:border-diamond transition-colors group font-mono uppercase tracking-widest text-xs text-obsidian dark:text-white">
                {t('works.inquire')} <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Homepage is a curated entry point. Full work cards remain available through the existing maps / mods / tools pages. */}
            <div className="space-y-24">
              <div className="reveal-up grid lg:grid-cols-[0.8fr_1.2fr] gap-8 border-y border-obsidian/10 dark:border-white/10 py-8 md:py-12">
                <div className="flex flex-col justify-between gap-8">
                  <div>
                    <div className="font-mono text-diamond tracking-[0.2em] text-sm flex items-center gap-4">
                      <span className="w-10 h-px bg-diamond"></span>
                      {t('nav.nav_maps_je')}
                    </div>
                    <h3 className="mt-6 text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-obsidian dark:text-white">
                      {t('workPages.status.prototype')}
                    </h3>
                  </div>
                  <a href={WORK_PAGE_HASHES['maps-java']} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-java'])} className="hover-target w-fit flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono text-gray-500 hover:text-diamond transition-colors">
                    {t('workPages.view_java')} <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  {[
                    { title: t('works.m9_t'), category: t('works.m9_c'), desc: t('works.m9_d'), texture: 'ice.png', accent: 'hover:border-[#ff9ff3] hover:text-[#ff9ff3]' },
                    { title: t('works.m10_t'), category: t('works.m10_c'), desc: t('works.m10_d'), texture: 'diamond_block.png', accent: 'hover:border-diamond hover:text-diamond' }
                  ].map((work) => (
                    <a key={work.title} href={WORK_PAGE_HASHES['maps-java']} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-java'])} className={`hover-target group relative min-h-[18rem] overflow-hidden border border-obsidian/10 dark:border-white/10 p-6 flex flex-col justify-end transition-colors duration-500 ${work.accent}`}>
                      <div className="parallax-bg absolute inset-[-18%] w-[136%] h-[136%] opacity-30 dark:opacity-40 bg-repeat image-rendering-pixelated group-hover:scale-110 transition-transform duration-[1.5s] ease-out" style={{ backgroundImage: `url(${basePath}textures/${work.texture})`, backgroundSize: '112px' }}></div>
                      <div className="relative z-10">
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">{work.category}</p>
                        <h4 className="mt-3 text-2xl md:text-3xl font-bold uppercase tracking-tighter leading-none">{work.title}</h4>
                        <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{work.desc}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="reveal-up flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                  <div className="font-mono text-diamond tracking-[0.2em] text-sm flex items-center gap-4">
                    <span className="w-10 h-px bg-diamond"></span>
                    {t('workPages.status.live')}
                  </div>
                  <h3 className="mt-5 text-4xl md:text-6xl font-black uppercase tracking-tighter text-obsidian dark:text-white">{t('works.category_maps')}</h3>
                </div>
                <a href={WORK_PAGE_HASHES['maps-overview']} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-overview'])} className="hover-target w-fit flex items-center gap-3 border-b border-obsidian dark:border-white pb-2 text-xs uppercase tracking-[0.2em] font-mono text-obsidian dark:text-white hover:text-diamond hover:border-diamond transition-colors">
                  {t('workPages.maps.catalog')} <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {[FEATURED_MAPS[6], FEATURED_MAPS[7], FEATURED_MAPS[0]].map((work) => {
                  const title = t(`works.bedrockMaps.${work.i18nKey}.title`);
                  const category = t(`works.bedrockMaps.${work.i18nKey}.genre`);
                  const description = t(`works.bedrockMaps.${work.i18nKey}.desc`);
                  return (
                    <article key={work.link} className="reveal-up group relative min-h-[30rem] overflow-hidden bg-[#e0e0e0] dark:bg-[#0a0a0a] border border-obsidian/5 dark:border-white/5" onMouseEnter={() => setTooltipContent({ visible: true, title, category, desc: description })} onMouseLeave={() => setTooltipContent({ visible: false, title: '', category: '', desc: '' })}>
                      <a href={work.link} target="_blank" rel="noopener noreferrer" className="hover-target absolute inset-0" aria-label={t('works.open_detail_aria', { title })}>
                        <div className="parallax-bg absolute inset-[-18%] w-[136%] h-[136%]">
                          <img src={`${basePath}${work.image}`} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" />
                        </div>
                        <div className={`absolute inset-0 bg-gradient-to-t ${work.bg} via-transparent to-obsidian/45 opacity-80 group-hover:opacity-100 transition-opacity duration-700`}></div>
                        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/70">{category}</p>
                          <h4 className="mt-3 text-3xl font-bold uppercase tracking-tighter leading-none">{title}</h4>
                          <div className="mt-5 flex items-center gap-3 text-xs font-mono text-white/80"><Download className="w-4 h-4 text-diamond" />{t('works.downloads_metric', { downloads: work.downloads })}</div>
                        </div>
                      </a>
                    </article>
                  );
                })}
              </div>

              <div className="reveal-up flex flex-wrap gap-4 pt-2">
                <a href={WORK_PAGE_HASHES['maps-overview']} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES['maps-overview'])} className="hover-target inline-flex items-center gap-3 border border-obsidian dark:border-white px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] hover:text-diamond hover:border-diamond transition-colors">{t('nav.nav_maps')} <ArrowUpRight className="w-4 h-4" /></a>
                <a href={WORK_PAGE_HASHES.tools} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.tools)} className="hover-target inline-flex items-center gap-3 border border-obsidian/20 dark:border-white/20 px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] text-gray-500 hover:text-diamond hover:border-diamond transition-colors">{t('nav.nav_tools')} <ArrowUpRight className="w-4 h-4" /></a>
                <a href={WORK_PAGE_HASHES.mods} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.mods)} className="hover-target inline-flex items-center gap-3 border border-obsidian/20 dark:border-white/20 px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] text-gray-500 hover:text-diamond hover:border-diamond transition-colors">{t('nav.nav_mods')} <ArrowUpRight className="w-4 h-4" /></a>
              </div>

              <div className="pt-16 md:pt-24 border-t border-obsidian/10 dark:border-white/10">
                <div className="reveal-up flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
                  <div>
                    <div className="font-mono text-blue-500 tracking-[0.2em] text-sm flex items-center gap-4">
                      <span className="w-10 h-px bg-blue-500"></span>
                      {t('nav.nav_tools')}
                    </div>
                    <h3 className="mt-5 text-4xl md:text-6xl font-black uppercase tracking-tighter text-obsidian dark:text-white">LAB / SYSTEMS</h3>
                  </div>
                  <a href={WORK_PAGE_HASHES.tools} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.tools)} className="hover-target w-fit flex items-center gap-3 border-b border-obsidian dark:border-white pb-2 text-xs uppercase tracking-[0.2em] font-mono text-obsidian dark:text-white hover:text-blue-500 hover:border-blue-500 transition-colors">
                    {t('nav.nav_tools')} <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="max-w-4xl">
                  <a href={WORK_PAGE_HASHES.tools} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.tools)} className="hover-target reveal-up group relative min-h-[22rem] overflow-hidden p-7 md:p-10 border border-obsidian/10 dark:border-white/10 flex flex-col justify-end bg-[#e5e5e5] dark:bg-[#050505]">
                    <div className="parallax-bg absolute inset-[-15%] w-[130%] h-[130%] opacity-20 dark:opacity-30 group-hover:scale-110 transition-transform duration-[1.5s] ease-out flex items-center justify-center p-10">
                      <img src={`${basePath}plugins/minecraft-obj-cubizer/minecraft-obj-cubizer-logo.svg`} alt="Minecraft OBJ Cubizer" className="w-full h-full max-w-md object-contain opacity-90" />
                    </div>
                    <div className="relative z-10">
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">Blockbench Desktop Plugin · Released</p>
                      <h4 className="mt-3 text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-obsidian dark:text-white group-hover:text-diamond transition-colors">Minecraft OBJ Cubizer</h4>
                      <p className="mt-5 max-w-xl text-sm md:text-base leading-relaxed text-gray-600 dark:text-gray-400">{t('workPages.tools.objCubizer.desc')}</p>
                    </div>
                  </a>
                </div>
              </div>

              <div className="pt-16 md:pt-24 border-t border-obsidian/10 dark:border-white/10">
                <div className="reveal-up flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
                  <div>
                    <div className="font-mono text-emerald-500 tracking-[0.2em] text-sm flex items-center gap-4">
                      <span className="w-10 h-px bg-emerald-500"></span>
                      {t('nav.nav_mods')}
                    </div>
                    <h3 className="mt-5 text-4xl md:text-6xl font-black uppercase tracking-tighter text-obsidian dark:text-white">MOD / PLAYABLE SYSTEMS</h3>
                  </div>
                  <a href={WORK_PAGE_HASHES.mods} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.mods)} className="hover-target w-fit flex items-center gap-3 border-b border-obsidian dark:border-white pb-2 text-xs uppercase tracking-[0.2em] font-mono text-obsidian dark:text-white hover:text-emerald-500 hover:border-emerald-500 transition-colors">
                    {t('nav.nav_mods')} <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
                <a href={WORK_PAGE_HASHES.mods} onClick={(e) => handleNavClick(e, WORK_PAGE_HASHES.mods)} className="hover-target reveal-up group relative block min-h-[18rem] overflow-hidden p-7 md:p-10 border border-obsidian/10 dark:border-white/10 bg-[#07120a]">
                  <img src={`${basePath}bingo-but-dont-do-it-logo.png`} alt="Bingo × Don't Do It" className="parallax-bg absolute inset-[-10%] w-[120%] h-[120%] object-contain p-8 md:p-12 opacity-55 group-hover:opacity-80 group-hover:scale-105 transition-all duration-[1.2s] ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#07120a] via-[#07120a]/55 to-transparent"></div>
                  <div className="relative z-10 max-w-xl pt-24">
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300">{siteMeta.bingoCategory} · {t('workPages.status.live')}</p>
                    <h4 className="mt-3 text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-white">Bingo × Don't Do It</h4>
                    <p className="mt-5 text-sm md:text-base leading-relaxed text-white/70">{siteMeta.bingoDescription}</p>
                  </div>
                </a>
              </div>
            </div>

          </div>
        </section>

        </>
        ) : (
          <>
            {renderWorkPage()}
          </>
        )}
        </PageTransition>
        </main>

        {/* Spacer for Reveal Footer */}
        <div className="relative z-0 h-[100svh] w-full pointer-events-none"></div>

        <footer id="contact" className="fixed bottom-0 left-0 w-full h-[100svh] px-6 md:px-12 flex flex-col items-center justify-center bg-[#e5e5e5] dark:bg-black border-t border-obsidian/10 dark:border-white/10 overflow-hidden transition-colors duration-700 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,210,211,0.05),transparent_60%)] pointer-events-none"></div>
          
          <div className="z-10 text-center space-y-10 mt-auto max-w-3xl pt-32">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-obsidian dark:text-white transition-colors duration-700 leading-tight pb-2" data-cursor="FIMEL">
              <Trans i18nKey="footer.title" />
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg md:text-xl font-light transition-colors duration-700">
              <Trans i18nKey="footer.desc" />
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-[10px] md:text-xs font-mono uppercase tracking-[0.16em] text-gray-500">
              {siteMeta.contactLabels.map((label) => (
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
          className="fixed top-24 right-6 md:right-12 z-[100] w-[320px] h-[64px] transition-transform duration-500 ease-in-out pointer-events-none bg-no-repeat bg-center bg-contain image-rendering-pixelated flex items-center px-4"
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
}

export default App;
