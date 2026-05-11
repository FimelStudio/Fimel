import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Canvas } from '@react-three/fiber';
import { Float, Box, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowUpRight, MousePointerClick, Diamond, Sword, Map, Code, Sun, Moon, Globe } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import CustomCursor from './components/CustomCursor';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 🎲 MINECRAFT BLOCK TEXTURE CONFIGURATION
// You can add more block types here once you put the images in public/textures/
// ==========================================
const BLOCK_TEXTURES = [
  {
    id: 'grass',
    top: 'block_top.png',
    side: 'block_side.png',
    bottom: 'dirt.png'
  },
  // Example: how to add more blocks later (uncomment and change names when files are ready)
  {
    id: 'stone',
    top: 'stone.png',     // if you have public/textures/stone.png
    side: 'stone.png',    
    bottom: 'stone.png'   
  },
  {
    id: 'oak_planks',
    top: 'oak_planks.png',
    side: 'oak_planks.png',
    bottom: 'oak_planks.png'
  },
  {
    id: 'oak_log',
    top: 'oak_log_top.png',
    side: 'oak_log.png',
    bottom: 'oak_log_top.png'
  },
  {
    id: 'diamond_block',
    top: 'diamond_block.png',
    side: 'diamond_block.png',
    bottom: 'diamond_block.png'
  },
  {
    id: 'crafting_table',
    top: 'crafting_table_top.png',
    side: 'crafting_table_side.png',
    bottom: 'oak_planks.png' // using oak planks for bottom since crafting table doesn't have a unique bottom texture
  },
  {
    id: 'dirt',
    top: 'dirt.png',
    side: 'dirt.png',
    bottom: 'dirt.png'
  },
  {
    id: 'sand',
    top: 'sand.png',
    side: 'sand.png',
    bottom: 'sand.png'
  },
  {
    id: 'gravel',
    top: 'gravel.png',
    side: 'gravel.png',
    bottom: 'gravel.png'
  },
  {
    id: 'ice',
    top: 'ice.png',
    side: 'ice.png',
    bottom: 'ice.png'
  },
  {
    id: 'cobblestone',
    top: 'cobblestone.png',
    side: 'cobblestone.png',
    bottom: 'cobblestone.png'
  },
  {
    id: 'emerald_block',
    top: 'emerald_block.png',
    side: 'emerald_block.png',
    bottom: 'emerald_block.png'
  },
  {
    id: 'gold_block',
    top: 'gold_block.png',
    side: 'gold_block.png',
    bottom: 'gold_block.png'
  },
  {
    id: 'redstone_block',
    top: 'redstone_block.png',
    side: 'redstone_block.png',
    bottom: 'redstone_block.png'
  },
  {
    id: 'iron_block',
    top: 'iron_block.png',
    side: 'iron_block.png',
    bottom: 'iron_block.png'
  },
  {
    id: 'obsidian',
    top: 'obsidian.png',
    side: 'obsidian.png',
    bottom: 'obsidian.png'
  },
  {
    id: 'cherry_leaves',
    top: 'cherry_leaves.png',
    side: 'cherry_leaves.png',
    bottom: 'cherry_leaves.png'
  },
  {
    id: 'cactus',
    top: 'cactus_top.png',
    side: 'cactus_side.png',
    bottom: 'cactus_bottom.png'
  },
];

function MinecraftBlock({ cube, isDark }: { cube: any, isDark: boolean }) {
  const basePath = import.meta.env.BASE_URL;
  const config = BLOCK_TEXTURES[cube.textureIndex];
  
  // Load textures based on the randomly assigned block type
  const textures = useTexture({
    mapTop: `${basePath}textures/${config.top}`,
    mapSide: `${basePath}textures/${config.side}`,
    mapBottom: `${basePath}textures/${config.bottom}`,
  });

  // Make textures pixelated (Minecraft style)
  React.useMemo(() => {
    Object.values(textures).forEach((tex) => {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
    });
  }, [textures]);

  const { mapTop, mapSide, mapBottom } = textures;

  // Add the original color tinting back lightly, or just show the block
  // If we tint it based on the original colors it still looks magical
  const tintColor = cube.colorType === 0 
    ? (isDark ? "#d0d0d0" : "#ffffff") 
    : cube.colorType === 1 
      ? (isDark ? "#d8cbe0" : "#fbf7ff") // 更轻微的淡紫色
      : (isDark ? "#cbd8d8" : "#f7ffff"); // 更轻微的淡青色

  // Box geometry materials array: right, left, top, bottom, front, back
  const materials = React.useMemo(() => {
    const commonProps = { 
      roughness: isDark ? 0.6 : 0.8, 
      metalness: 0.1,
      color: tintColor
    };
    return [
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps }),
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps }),
      new THREE.MeshStandardMaterial({ map: mapTop, ...commonProps }),
      new THREE.MeshStandardMaterial({ map: mapBottom, ...commonProps }),
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps }),
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps }),
    ];
  }, [mapSide, mapTop, mapBottom, isDark, tintColor]);

  return (
    <Float
      speed={cube.speed}
      rotationIntensity={cube.rotationIntensity}
      floatIntensity={cube.floatIntensity}
      position={cube.position}
    >
      <Box args={cube.size} material={materials} />
    </Float>
  );
}

function ParticleCubes({ isDark }: { isDark: boolean }) {
  // Generate random values once to prevent jumping when re-rendering (e.g., language/theme switch)
  const cubes = React.useMemo(() => {
    const generated: any[] = [];
    
    // Check if it's mobile to adapt the generation volume (phones need tall/narrow boxes)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    // Significantly increased block count for a dense, immersive feel
    const count = isMobile ? 65 : 110; 
    
    for (let i = 0; i < count; i++) {
      const textureIndex = i % BLOCK_TEXTURES.length;
      let finalPos = [0, 0, 0] as [number, number, number];

      // Pure randomized uniform scattering with gentle overlap prevention
      for (let attempt = 0; attempt < 40; attempt++) {
        const testPos = [
          (Math.random() - 0.5) * (isMobile ? 26 : 52), // Ultra-wide X spread for desktop
          (Math.random() - 0.5) * (isMobile ? 40 : 28), // Taller Y spread
          (Math.random() - 0.5) * 25 - 5 // Deep Z spread (-17.5 to 7.5) to bring blocks closer to camera
        ] as [number, number, number];

        let isValid = true;
        for (const existingCube of generated) {
          const dx = existingCube.position[0] - testPos[0];
          const dy = existingCube.position[1] - testPos[1];
          const dz = existingCube.position[2] - testPos[2];
          const distSq = dx * dx + dy * dy + dz * dz;

          // Gentle collision: Same blocks must be dist 12 apart, any blocks dist 3 apart
          const minAllowedDistSq = existingCube.textureIndex === textureIndex ? 12 : 3;
          if (distSq < minAllowedDistSq) {
            isValid = false;
            break;
          }
        }

        if (isValid || attempt === 39) {
          finalPos = testPos;
          break;
        }
      }

      generated.push({
        speed: Math.random() * 1.5 + 0.5,
        rotationIntensity: Math.random() * 1.5,
        floatIntensity: Math.random() * 2,
        position: finalPos,
        // Block sizes made slightly bigger overall to reduce empty space
        size: Array(3).fill(Math.random() * 0.9 + 0.35) as [number, number, number],
        colorType: i % 3,
        textureIndex: textureIndex
      });
    }
    return generated;
  }, []);

  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 45 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={isDark ? 0.4 : 0.8} />
      <directionalLight position={[10, 10, 10]} intensity={isDark ? 2 : 1.5} color="#9b59b6" />
      <directionalLight position={[-10, -10, -10]} intensity={isDark ? 2 : 1.5} color="#00d2d3" />
      
      {isDark && <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />}

      <React.Suspense fallback={null}>
        {cubes.map((cube, i) => (
          <MinecraftBlock key={i} cube={cube} isDark={isDark} />
        ))}
      </React.Suspense>
    </Canvas>
  );
}

function App() {
  const { t, i18n } = useTranslation();
  const mainRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [copiedQQ, setCopiedQQ] = useState(false);

  const basePath = import.meta.env.BASE_URL;
  // Logo display toggle based on exact file name
  const logoPath = `${basePath}Fimel%20logo.png`;

  const handleCopyQQ = () => {
    navigator.clipboard.writeText("937760015");
    setCopiedQQ(true);
    setTimeout(() => setCopiedQQ(false), 2000);
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('fimel_user_lang', lng);
    setLangMenuOpen(false);
  };

  // Auto detect IP to switch language on first visit
  useEffect(() => {
    const storedLang = localStorage.getItem('fimel_user_lang');
    if (!storedLang) {
      // First check IP via a free API
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
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
          // Fallback to browser language if IP request fails (e.g. adblocker)
          const browserLang = navigator.language.toLowerCase();
          if (browserLang.includes('zh')) {
            i18n.changeLanguage('zh');
          } else if (browserLang.includes('ja')) {
            i18n.changeLanguage('ja');
          } else {
            i18n.changeLanguage('en');
          }
        });
    } else {
      // If user had selected a language before, enforce it
      i18n.changeLanguage(storedLang);
    }
  }, [i18n]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

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
  }, [loading, i18n.language]);

  return (
    <div ref={mainRef} className="w-full font-sans transition-colors duration-700 selection:bg-diamond selection:text-white dark:selection:text-obsidian">
      <div className="noise-overlay"></div>
      <CustomCursor isDark={isDark} />
      
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-paper dark:bg-obsidian transition-transform duration-1000 ease-[cubic-bezier(0.7,0,0.3,1)] ${loading ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16 transform rotate-45">
            <div className="absolute inset-0 border-2 border-obsidian/20 dark:border-white/20"></div>
            <div className="absolute inset-0 border-2 border-diamond animate-[spin_2s_linear_infinite]"></div>
          </div>
          <p className="tracking-[0.4em] text-xs font-mono text-gray-500 animate-pulse">{t('hero.gen')}</p>
        </div>
      </div>

      <div className={`${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-1000`}>
        
        <nav className="fixed top-0 left-0 w-full z-40 flex items-center justify-between px-6 py-8 md:px-12 pointer-events-none mix-blend-difference text-white">
          <a href="#hero" onClick={(e) => handleNavClick(e, '#hero')} className="pointer-events-auto hover-target transition-transform hover:scale-105">
            <img src={logoPath} alt="FIMEL Logo" className="h-12 md:h-16 object-contain invert" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement!.innerHTML = '<span class="text-xl font-bold tracking-[0.3em] uppercase">FIMEL.</span>'; }} />
          </a>
          <div className="hidden md:flex items-center gap-10 text-xs tracking-widest uppercase font-mono pointer-events-auto">
              <a href="#about" onClick={(e) => handleNavClick(e, '#about')} className="hover:text-diamond transition-colors hover-target">{t('nav.about')}</a>
              
              <div className="relative group hover-target py-2">
                <a href="#works" onClick={(e) => handleNavClick(e, '#works')} className="hover:text-diamond transition-colors inline-block">{t('nav.works')}</a>
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-300 z-50 flex flex-col items-center">
                  <div className="bg-white dark:bg-[#111] text-obsidian dark:text-white rounded shadow-xl border border-obsidian/10 dark:border-white/10 flex flex-col font-mono text-xs whitespace-nowrap overflow-hidden">
                    <a href="#works" onClick={(e) => handleNavClick(e, '#works')} className="px-5 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-center">Bedrock/Netease</a>
                    <a href="#works" onClick={(e) => handleNavClick(e, '#works')} className="px-5 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-center border-t border-obsidian/5 dark:border-white/5">Java Edition</a>
                  </div>
                </div>
              </div>

              <a href="#contact" onClick={(e) => handleNavClick(e, '#contact')} className="hover:text-diamond transition-colors hover-target">{t('nav.contact')}</a>
            </div>
            <div className="flex items-center gap-6 pointer-events-auto relative">
              <div className="relative hover-target">
                <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="hover:text-diamond transition-colors flex items-center gap-2">
                  <Globe size={18} />
                  <span className="text-xs font-mono hidden md:block">{i18n.language.toUpperCase()}</span>
                </button>
              {langMenuOpen && (
                <div className="absolute right-0 mt-4 w-32 py-2 bg-white dark:bg-[#111] text-obsidian dark:text-white rounded shadow-xl border border-obsidian/10 dark:border-white/10 flex flex-col font-mono text-xs z-50">
                  <button onClick={() => changeLanguage('zh')} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left">中文 (ZH)</button>
                  <button onClick={() => changeLanguage('en')} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left">English (EN)</button>
                  <button onClick={() => changeLanguage('ja')} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 text-left">日本語 (JA)</button>
                </div>
              )}
            </div>
            
              <button onClick={() => setIsDark(!isDark)} className="hover:text-diamond transition-colors hover-target">
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            <div className="block md:hidden">
              <span className="text-xs uppercase font-mono tracking-widest border-b border-white">{t('nav.menu')}</span>
            </div>
          </div>
        </nav>

        <section id="hero" className="relative w-full h-screen overflow-hidden flex flex-col justify-center px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian transition-colors duration-700">
          <div className="parallax-hero absolute inset-[-10%] w-[120%] h-[120%] z-0 opacity-70 pointer-events-none">
            <ParticleCubes isDark={isDark} />
          </div>
          
          <div className="relative z-10 max-w-screen-2xl w-full flex flex-col items-start gap-2">
            <div className="overflow-visible p-6 -m-6">
              <h1 className="hero-title pt-4 text-[14vw] lg:text-[11vw] leading-tight font-extrabold tracking-tighter uppercase text-obsidian dark:text-white transition-colors duration-700 pb-4 pr-8">
                {t('hero.crafting')}
              </h1>
            </div>
            <div className="overflow-visible p-6 -m-6">
              <h1 className="hero-title text-[14vw] lg:text-[11vw] leading-tight font-extrabold tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-amethyst to-diamond lg:ml-[10vw] pb-4 pr-8">
                {t('hero.worlds')}
              </h1>
            </div>
            
            <div className="hero-sub mt-12 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10 max-w-3xl">
              <div className="w-16 h-[2px] bg-diamond hidden md:block"></div>
              <p className="text-base md:text-xl font-light tracking-wide text-gray-600 dark:text-gray-400 leading-relaxed font-sans transition-colors duration-700">
                <Trans i18nKey="hero.sub" />
              </p>
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 hero-sub">
            <span className="text-[10px] tracking-[0.3em] uppercase font-mono rotate-90 mb-6 text-obsidian dark:text-white transition-colors duration-700">{t('hero.scroll')}</span>
            <div className="w-[1px] h-16 bg-gradient-to-b from-obsidian dark:from-white to-transparent transition-colors duration-700"></div>
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

        <section id="about" className="py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian relative transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto flex flex-col lg:flex-row gap-20">
            <div className="w-full lg:w-[55%] space-y-10">
              <div className="reveal-up font-mono text-amethyst tracking-[0.2em] text-sm flex items-center gap-6">
                <span className="w-12 h-[1px] bg-amethyst"></span>
                {t('about.tag')}
              </div>
              <h2 className="reveal-up text-4xl md:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-obsidian dark:text-white transition-colors duration-700">
                <Trans i18nKey="about.title" />
              </h2>
              <p className="reveal-up text-lg md:text-xl text-gray-600 dark:text-gray-400 font-light leading-relaxed transition-colors duration-700">
                {t('about.desc')}
              </p>
              <div className="reveal-up grid grid-cols-2 gap-12 pt-12 border-t border-obsidian/10 dark:border-white/10 transition-colors duration-700">
                <div>
                  <div className="text-5xl font-black text-diamond mb-3">{t('about.y1')}</div>
                  <div className="text-xs tracking-widest font-mono text-gray-500 uppercase">{t('about.y1_sub')}</div>
                </div>
                <div>
                  <div className="text-5xl font-black text-diamond mb-3">{t('about.y2')}</div>
                  <div className="text-xs tracking-widest font-mono text-gray-500 uppercase">{t('about.y2_sub')}</div>
                </div>
              </div>
            </div>
            
            <div className="w-full lg:w-[45%] relative h-[60vh] lg:h-auto overflow-hidden rounded-sm group reveal-up bg-[#e5e5e5] dark:bg-[#050505] p-10 flex items-center justify-center transition-colors duration-700 perspective-1000">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(155,89,182,0.15),transparent_70%)] opacity-50"></div>
              
              {/* CSS 3D Minecraft Block */}
              <div className="relative z-10 w-32 h-32 sm:w-48 sm:h-48 transform-style-3d mc-block">
                
                {/* Spin and Hover Wrappers to prevent transform conflicts */}
                <div className="absolute inset-0 transform-style-3d animate-[spin-slow_15s_linear_infinite] group-hover:[animation-play-state:paused]">
                  <div className="absolute inset-0 transform-style-3d transition-transform duration-[1500ms] ease-out group-hover:[transform:scale3d(1.25,1.25,1.25)_rotateX(15deg)_rotateY(-30deg)]">
                    
                    {/* Front */}
                    <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" 
                         style={{ transform: "rotateY(0deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
                    {/* Back */}
                    <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" 
                         style={{ transform: "rotateY(180deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
                    {/* Right */}
                    <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" 
                         style={{ transform: "rotateY(90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
                    {/* Left */}
                    <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" 
                         style={{ transform: "rotateY(-90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
                    {/* Top */}
                    <div className="mc-face border-2 border-obsidian/30 dark:border-white/30 bg-[#7cbd6b]" 
                         style={{ transform: "rotateX(90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_top.png')`, backgroundBlendMode: 'multiply' }}></div>
                    {/* Bottom */}
                    <div className="mc-face border-2 border-obsidian/30 dark:border-white/30 bg-obsidian/20 dark:bg-obsidian/10" 
                         style={{ transform: "rotateX(-90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_bottom.png')` }}></div>
                  
                  </div>
                </div>
              </div>

              <div className="absolute bottom-6 right-6 text-xs text-obsidian/30 dark:text-white/20 font-mono transition-colors duration-700">{t('about.render')}</div>
            </div>
          </div>
        </section>

        <section className="py-32 bg-[#e5e5e5] dark:bg-[#050505] px-6 md:px-16 lg:px-24 transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto">
            <div className="reveal-up font-mono text-diamond tracking-[0.2em] text-sm flex items-center gap-6 mb-20">
              <span className="w-12 h-[1px] bg-diamond"></span>
              {t('core.tag')}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-16 gap-x-10">
              {[
                { icon: Sword, title: t('core.pvp'), desc: t('core.pvp_d') },
                { icon: Map, title: t('core.rpg'), desc: t('core.rpg_d') },
                { icon: Code, title: t('core.puz'), desc: t('core.puz_d') }
              ].map((item, idx) => (
                <div key={idx} className="reveal-up group relative p-10 bg-white/40 dark:bg-black/40 border border-obsidian/5 dark:border-white/5 hover:border-obsidian/20 dark:hover:border-white/20 transition-colors duration-700">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-diamond via-amethyst to-transparent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700"></div>
                  <item.icon className="w-10 h-10 text-obsidian/30 dark:text-white/30 group-hover:text-obsidian dark:group-hover:text-white transition-colors duration-500 mb-10" strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-5 tracking-wide text-obsidian dark:text-white">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed text-sm md:text-base transition-colors duration-700">{item.desc}</p>
                </div>
              ))}
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

            <div className="space-y-32">
              {[
                { title: t('works.m1_t'), category: t('works.m1_c'), year: "100k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-red-500 dark:group-hover:text-red-400", bg: "from-red-500/10", desc: t('works.m1_d'), link: "https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4648588173337957318" },
                { title: t('works.m2_t'), category: t('works.m2_c'), year: "50k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-amber-500", bg: "from-amber-500/10", desc: t('works.m2_d') },
                { title: t('works.m3_t'), category: t('works.m3_c'), year: "1k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-green-500", bg: "from-green-500/10", desc: t('works.m3_d') },
                { title: t('works.m4_t'), category: t('works.m4_c'), year: "10k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-blue-500", bg: "from-blue-500/10", desc: t('works.m4_d') },
                { title: t('works.m5_t'), category: t('works.m5_c'), year: "10k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-pink-500", bg: "from-pink-500/10", desc: t('works.m5_d') },
                { title: t('works.m6_t'), category: t('works.m6_c'), year: "10k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-cyan-500", bg: "from-cyan-500/10", desc: t('works.m6_d') },
                { title: t('works.m7_t'), category: t('works.m7_c'), year: "10k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-orange-500", bg: "from-orange-500/10", desc: t('works.m7_d') },
                { title: t('works.m8_t'), category: t('works.m8_c'), year: "10k+ DL", image: `${basePath}placeholder.jpg`, accent: "group-hover:text-amethyst", bg: "from-amethyst/10", desc: t('works.m8_d') },
              ].map((work, idx) => (
                <div key={idx} className="reveal-up group relative flex flex-col md:flex-row gap-12 lg:gap-20 items-center">
                  <div className="w-full md:w-1/2 lg:w-[60%] h-[50vh] overflow-hidden bg-[#e0e0e0] dark:bg-[#0a0a0a] relative isolate rounded-sm border border-obsidian/5 dark:border-white/5 transition-colors duration-700">
                    <div className="parallax-bg absolute inset-[-20%] w-[140%] h-[140%]">
                      {work.image ? (
                        <img 
                          src={work.image} 
                          alt={work.title} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" 
                        />
                      ) : (
                        <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.03)_20px,rgba(0,0,0,0.03)_40px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(255,255,255,0.02)_20px,rgba(255,255,255,0.02)_40px)] group-hover:scale-110 transition-transform duration-[1.5s] ease-out"></div>
                      )}
                    </div>
                    <div className={`absolute inset-0 bg-gradient-to-br ${work.bg} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-multiply dark:mix-blend-screen`}></div>
                    <div className="parallax-text absolute inset-0 flex items-center justify-center mix-blend-overlay">
                       <span className="text-obsidian/20 dark:text-white/20 font-black text-6xl md:text-8xl tracking-tighter transition-colors duration-700">MAP_{idx+1}</span>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-1/2 lg:w-[40%] flex flex-col justify-center space-y-8">
                    <div className="text-xs uppercase font-mono tracking-widest text-gray-500 border-b border-obsidian/10 dark:border-white/10 pb-4 flex justify-between transition-colors duration-700">
                      <span>{work.category}</span>
                      <span>{work.year}</span>
                    </div>
                    <h3 className={`text-4xl md:text-5xl lg:text-7xl font-bold uppercase tracking-tighter transition-colors duration-500 text-obsidian dark:text-white ${work.accent}`}>
                      {work.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 font-light font-sans max-w-md text-base md:text-lg leading-relaxed transition-colors duration-700">
                      {work.desc}
                    </p>
                    
                    {work.link ? (
                      <a href={work.link} target="_blank" rel="noopener noreferrer" className="w-fit flex items-center gap-3 text-xs md:text-sm uppercase tracking-[0.2em] font-mono hover:text-diamond text-gray-500 transition-colors mt-4">
                        <MousePointerClick className="w-4 h-4" /> {t('works.view')}
                      </a>
                    ) : (
                      <div className="w-fit flex items-center gap-3 text-xs md:text-sm uppercase tracking-[0.2em] font-mono text-gray-500/50 dark:text-gray-500/50 mt-4 cursor-not-allowed" title="Link Coming Soon">
                        <MousePointerClick className="w-4 h-4" /> {t('works.view')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer id="contact" className="py-32 px-6 md:px-12 flex flex-col items-center justify-center bg-[#e5e5e5] dark:bg-black border-t border-obsidian/10 dark:border-white/10 relative overflow-hidden transition-colors duration-700">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,210,211,0.05),transparent_60%)] pointer-events-none"></div>
          
          <div className="z-10 text-center space-y-10 mb-32 max-w-3xl reveal-up">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-obsidian dark:text-white transition-colors duration-700 leading-tight pb-2">
              <Trans i18nKey="footer.title" />
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg md:text-xl font-light transition-colors duration-700">
              <Trans i18nKey="footer.desc" />
            </p>
            <a href="mailto:fimel.studio@hotmail.com" className="inline-block mt-8 text-2xl md:text-5xl font-light text-obsidian dark:text-white hover:text-diamond dark:hover:text-diamond transition-all duration-300 border-b border-obsidian/20 dark:border-white/20 hover:border-diamond pb-2 hover-target">
              fimel.studio@hotmail.com
            </a>
          </div>

          <div className="w-full max-w-screen-2xl border-t border-obsidian/10 dark:border-white/10 pt-10 flex flex-col md:flex-row items-center justify-between gap-8 text-xs text-gray-500 font-mono uppercase tracking-widest z-10 transition-colors duration-700">
            <p>{t('footer.copy')}</p>
            <div className="flex gap-8 items-center">
              {/* <a href="#" className="hover:text-obsidian dark:hover:text-white transition-colors">X (Twitter)</a> */}
              {/* <a href="#" className="hover:text-obsidian dark:hover:text-white transition-colors">Bilibili</a> */}
              <button 
                onClick={handleCopyQQ} 
                className="hover:text-obsidian dark:hover:text-white transition-colors cursor-pointer hover-target"
              >
                {copiedQQ ? "COPIED!" : "QQ Group: 937760015"}
              </button>
              {/* <a href="#" className="hover:text-obsidian dark:hover:text-white transition-colors">GitHub</a> */}
            </div>
          </div>
          
          <div className="absolute -bottom-[5%] left-0 w-full text-center pointer-events-none opacity-[0.03] dark:opacity-[0.03] text-black dark:text-white select-none transition-colors duration-700">
            <span className="text-[25vw] font-black uppercase tracking-tighter leading-none block">FIMEL</span>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default App;