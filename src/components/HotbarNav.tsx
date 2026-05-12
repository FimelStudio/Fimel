import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Info, Map, Library, Wrench, PenTool, Swords, Blocks, Mail, ChevronUp, ChevronDown } from 'lucide-react';

export default function HotbarNav({ scrollProgress, handleNavClick }: { scrollProgress: number, handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void }) {
  const { t } = useTranslation();
  const basePath = import.meta.env.BASE_URL;
  const [isOpen, setIsOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);

  const slots = [
    { id: '#hero', tooltip: 'Respawn (Home)', icon: Home, color: '#FFFF55' },
    { id: '#about', tooltip: t('nav.about'), icon: Info, color: 'white' },
    { id: '#works-maps-be', tooltip: t('nav.nav_maps_be'), icon: Map, color: 'white' },
    { id: '#works-maps-je', tooltip: t('nav.nav_maps_je'), icon: Library, color: 'white' },
    { id: '#works-mods', tooltip: t('nav.nav_mods'), icon: Wrench, color: 'white' },
    { id: '#works-tools', tooltip: t('nav.nav_tools'), icon: PenTool, color: 'white' },
    { id: '#works', tooltip: 'PvP', icon: Swords, color: '#AAAAAA' },
    { id: '#works', tooltip: 'Blocks', icon: Blocks, color: '#AAAAAA' },
    { id: '#contact', tooltip: t('nav.contact'), icon: Mail, color: '#FFFF55' },
  ];

  useEffect(() => {
    const sectionIds = ['hero', 'about', 'works-maps-be', 'works-maps-je', 'works-mods', 'works-tools', 'contact'];
    
    const handleScroll = () => {
      // Trigger point slightly above the middle of the screen
      const triggerPoint = window.scrollY + window.innerHeight / 2.5; 
      
      let newActiveIndex = -1;
      // Search from bottom up to find the deepest matching section
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el && el.offsetTop <= triggerPoint) {
          const id = `#${sectionIds[i]}`;
          newActiveIndex = slots.findIndex(s => s.id === id);
          break;
        }
      }
      
      // If none found, assume top (hero)
      if (newActiveIndex === -1 && window.scrollY < 100) {
        newActiveIndex = 0;
      }
      
      if (newActiveIndex !== -1 && newActiveIndex !== activeSlot) {
        setActiveSlot(newActiveIndex);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initialize
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [slots, activeSlot]);

  return (
    <>
      <div 
        className={`fixed left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center drop-shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] bottom-6 md:bottom-10 ${isOpen ? 'translate-y-0' : 'translate-y-[92px] md:translate-y-[132px]'}`}
      >
        {/* HUD Toggle Button (Attached to the top of the HUD system) */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="bg-[#1a1a1a]/90 hover:bg-black border-2 border-[#555] px-4 h-[32px] md:h-[40px] text-white font-mono text-xs md:text-sm image-rendering-pixelated flex items-center justify-center gap-2 pointer-events-auto rounded-t-lg border-b-0 min-w-[120px] md:min-w-[140px]"
          style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.8)' }}
        >
          {isOpen ? <ChevronDown size={14} className="text-[#FFFF55]" /> : <ChevronUp size={14} className="text-[#55FF55]" />}
          {isOpen ? 'HIDE M-HUD' : 'SHOW M-HUD'}
        </button>

        {/* Active slot name overlay (Text above EXP bar) */}
      <div 
        className="text-white text-xs md:text-sm font-mono tracking-widest h-5 md:h-6 transition-opacity duration-300 mb-1 md:mb-1.5 pointer-events-none flex items-center"
        style={{ textShadow: '2px 2px 0px #3f3f3f', color: slots[activeSlot]?.color || 'white' }}
      >
        {slots[activeSlot]?.tooltip}
      </div>
        
        {/* MC Experience Bar Scroll Indicator (Embedded above hotbar) */}
        <div className="w-[273px] h-[7.5px] md:w-[364px] md:h-[10px] bg-no-repeat bg-cover image-rendering-pixelated mb-1 md:mb-2 pointer-events-none drop-shadow-md"
          style={{ backgroundImage: `url(${basePath}HUD/experience_bar_background.png)` }}>
          <div className="h-full bg-no-repeat bg-cover image-rendering-pixelated transition-all duration-100 ease-out"
            style={{ width: `${scrollProgress * 100}%`, backgroundImage: `url(${basePath}HUD/experience_bar_progress.png)` }}
          />
        </div>
      
      {/* Hotbar Background */}
      <div 
        className="w-[273px] h-[33px] md:w-[364px] md:h-[44px] bg-no-repeat bg-cover image-rendering-pixelated relative pointer-events-auto flex"
        style={{ backgroundImage: `url(${basePath}HUD/Hotbar.png)` }}
      >
        {/* Clickable slots with Icons */}
        {slots.map((slot, idx) => (
          <a
            key={idx}
            href={slot.id}
            onClick={(e) => handleNavClick(e, slot.id)}
            className="flex-1 h-full cursor-pointer hover:bg-white/20 transition-colors flex items-center justify-center relative z-10 group"
          >
            <slot.icon 
              className={`w-[18px] h-[18px] md:w-5 md:h-5 opacity-70 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 ${idx === activeSlot ? 'opacity-100 animate-pulse' : ''}`} 
              color={idx === activeSlot ? slot.color : 'currentColor'}
            />
          </a>
        ))}

        {/* Hotbar Selection Ring */}
        <div 
          className="absolute top-[-1.5px] md:top-[-2px] w-[36px] h-[36px] md:w-[48px] md:h-[48px] pointer-events-none bg-no-repeat bg-cover transition-all duration-200 ease-out image-rendering-pixelated hidden md:block z-20"
          style={{ 
            backgroundImage: `url(${basePath}HUD/Hotbar_selection.png)`,
            left: `calc(-2px + ${activeSlot * 40}px)`
          }}
        />
        <div 
          className="absolute top-[-1.5px] w-[36px] h-[36px] pointer-events-none bg-no-repeat bg-cover transition-all duration-200 ease-out image-rendering-pixelated md:hidden z-20"
          style={{ 
            backgroundImage: `url(${basePath}HUD/Hotbar_selection.png)`,
            left: `calc(-1.5px + ${activeSlot * 30.33}px)`
          }}
        />
      </div>
    </div>
    </>
  );
} 
