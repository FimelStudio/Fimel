import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Info, Map, Layers, Wrench, PenTool, Swords, Blocks, Mail, ChevronUp, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';

export default function HotbarNav({ scrollProgress, handleNavClick, activePage }: { scrollProgress: number, handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void, activePage: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const basePath = import.meta.env.BASE_URL;
  const [isOpen, setIsOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const slots = useMemo(() => [
    { id: '#hero', tooltip: 'Respawn (Home)', icon: Home, color: '#FFFF55', page: 'home' },
    { id: '#quick-entry', tooltip: t('home.featured_cta'), icon: Blocks, color: '#55FFFF', page: 'home' },
    { id: '#/studio', tooltip: t('nav.about'), icon: Info, color: 'white', page: 'studio' },
    { id: '#/works?type=datapacks', tooltip: t('nav.nav_datapacks'), icon: Layers, color: 'white', page: 'works' },
    { id: '#/works?type=bedrock', tooltip: t('nav.nav_maps_be'), icon: Map, color: 'white', page: 'works' },
    { id: '#/works?type=java', tooltip: t('nav.nav_maps_je'), icon: Wrench, color: 'white', page: 'works' },
    { id: '#/works?type=tools', tooltip: t('nav.nav_tools'), icon: PenTool, color: 'white', page: 'works' },
    { id: '#/works?type=mods', tooltip: t('nav.nav_mods'), icon: Swords, color: '#AAAAAA', page: 'works' },
    { id: '#contact', tooltip: t('nav.contact'), icon: Mail, color: '#FFFF55', page: 'home' },
  ], [t]);

  const currentType = new URLSearchParams(location.search).get('type') || 'bedrock';
  const activePageSlot = activePage === 'works'
    ? slots.findIndex(slot => slot.id === `#/works?type=${currentType}`)
    : activePage !== 'home' ? slots.findIndex(slot => slot.page === activePage) : -1;
  const visibleActiveSlot = activePageSlot !== -1 ? activePageSlot : activeSlot;
  
  // Decide which text to show: hovered slot takes precedence over active slot
  const displaySlotIndex = hoveredSlot !== null ? hoveredSlot : visibleActiveSlot;
  const displaySlot = slots[displaySlotIndex];

  useEffect(() => {
    if (activePage !== 'home') {
      return;
    }

    const homeSections = [
      { id: 'hero', slotIndex: 0 },
      { id: 'quick-entry', slotIndex: 1 },
      { id: 'about', slotIndex: 2 },
      { id: 'works', slotIndex: 4 },
      { id: 'contact', slotIndex: 8 },
    ];
    
    const observer = new IntersectionObserver(entries => {
      const section = entries.filter(entry => entry.isIntersecting).at(-1);
      if (!section) return;
      const slot = homeSections.find(item => item.id === section.target.id);
      if (slot) setActiveSlot(slot.slotIndex);
    }, { rootMargin: '-35% 0px -60% 0px' });
    const observed = new Set<HTMLElement>();
    const observeSections = () => homeSections.forEach(section => {
      const element = document.getElementById(section.id);
      if (element && !observed.has(element)) {
        observed.add(element);
        observer.observe(element);
      }
    });
    observeSections();
    // Route chunks can mount after the HUD; attach once those sections arrive.
    const mountObserver = new MutationObserver(observeSections);
    mountObserver.observe(document.getElementById('main-content') || document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mountObserver.disconnect();
    };
  }, [activePage]);

  return (
    <>
      <div 
        className={`fixed z-[60] flex flex-col items-center drop-shadow-2xl bottom-4 md:bottom-8 ${isOpen ? 'left-1/2 -translate-x-1/2' : 'right-4 md:right-auto md:left-1/2 md:-translate-x-1/2'}`}
      >
        {/* HUD Toggle Button (Attached to the top of the HUD system) */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="fimel-hud-panel"
          aria-label={isOpen ? 'HIDE M-HUD' : 'SHOW M-HUD'}
          className={`bg-[#1a1a1a]/90 hover:bg-black border-2 border-[#555] px-3 h-[32px] md:h-[40px] text-white font-mono text-[10px] md:text-sm image-rendering-pixelated flex items-center justify-center gap-2 pointer-events-auto min-w-[104px] md:min-w-[140px] ${isOpen ? 'rounded-t-lg border-b-0' : 'rounded-lg'}`}
          style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.8)' }}
        >
          {isOpen ? <ChevronDown size={14} className="text-[#FFFF55]" /> : <ChevronUp size={14} className="text-[#55FF55]" />}
          {isOpen ? 'HIDE M-HUD' : 'SHOW M-HUD'}
        </button>

      {isOpen && (
      <motion.div id="fimel-hud-panel" className="flex flex-col items-center" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>

        {/* Active/Hover slot name overlay (Text above EXP bar) */}
      <div 
        className="text-white text-xs md:text-sm font-mono tracking-widest h-5 md:h-6 transition-colors duration-150 mb-1 md:mb-1.5 pointer-events-none flex items-center"
        style={{ 
          textShadow: '2px 2px 0px #3f3f3f', 
          color: displaySlot?.color || 'white',
          opacity: hoveredSlot !== null ? 0.8 : 1 // slight fade to distinguish hover
        }}
      >
        {displaySlot?.tooltip}
      </div>
        
        {/* MC Experience Bar Scroll Indicator (Embedded above hotbar) */}
        <div className="w-[273px] h-[7.5px] md:w-[364px] md:h-[10px] bg-no-repeat bg-cover image-rendering-pixelated mb-1 md:mb-2 pointer-events-none drop-shadow-md"
          style={{ backgroundImage: `url(${basePath}assets/images/ui/minecraft/experience_bar_background.png)` }}>
          <div className="h-full w-full bg-no-repeat bg-cover image-rendering-pixelated origin-left transition-transform duration-100 ease-out"
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, scrollProgress))})`, backgroundImage: `url(${basePath}assets/images/ui/minecraft/experience_bar_progress.png)` }}
          />
        </div>
      
      {/* Hotbar Background */}
      <div 
        className="w-[273px] h-[33px] md:w-[364px] md:h-[44px] bg-no-repeat bg-cover image-rendering-pixelated relative pointer-events-auto flex"
        style={{ backgroundImage: `url(${basePath}assets/images/ui/minecraft/Hotbar.png)` }}
      >
        {/* Clickable slots with Icons */}
        {slots.map((slot, idx) => (
          <a
            key={idx}
            href={slot.id}
            onClick={(e) => handleNavClick(e, slot.id)}
            onMouseEnter={() => setHoveredSlot(idx)}
            onMouseLeave={() => setHoveredSlot(null)}
            onFocus={() => setHoveredSlot(idx)}
            onBlur={() => setHoveredSlot(null)}
            aria-label={slot.tooltip}
            aria-current={idx === visibleActiveSlot ? 'location' : undefined}
            tabIndex={isOpen ? 0 : -1}
            className="flex-1 h-full cursor-pointer hover:bg-white/20 transition-colors flex items-center justify-center relative z-10 group"
          >
            <slot.icon 
              className={`w-[18px] h-[18px] md:w-5 md:h-5 opacity-70 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 ${idx === visibleActiveSlot ? `opacity-100 ${reducedMotion ? '' : 'animate-pulse'}` : ''}`}
              color={idx === visibleActiveSlot ? slot.color : 'currentColor'}
            />
          </a>
        ))}

        {/* Hotbar Selection Ring */}
        <div 
          className="absolute top-[-1.5px] md:top-[-2px] w-[36px] h-[36px] md:w-[48px] md:h-[48px] pointer-events-none bg-no-repeat bg-cover transition-all duration-200 ease-out image-rendering-pixelated hidden md:block z-20"
          style={{ 
            backgroundImage: `url(${basePath}assets/images/ui/minecraft/Hotbar_selection.png)`,
            left: '-2px',
            transform: `translateX(${visibleActiveSlot * 40}px)`,
          }}
        />
        <div 
          className="absolute top-[-1.5px] w-[36px] h-[36px] pointer-events-none bg-no-repeat bg-cover transition-all duration-200 ease-out image-rendering-pixelated md:hidden z-20"
          style={{ 
            backgroundImage: `url(${basePath}assets/images/ui/minecraft/Hotbar_selection.png)`,
            left: '-1.5px',
            transform: `translateX(${visibleActiveSlot * 30.33}px)`,
          }}
        />
      </div>
      </motion.div>
      )}
    </div>
    </>
  );
} 
