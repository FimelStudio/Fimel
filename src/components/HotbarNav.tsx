import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Info, Map, Library, Wrench, PenTool, Swords, Blocks, Mail, ChevronUp, ChevronDown } from 'lucide-react';

export default function HotbarNav({ handleNavClick }: { handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void }) {
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
      {/* HUD Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed left-1/2 -translate-x-1/2 z-[60] bg-[#1a1a1a]/90 hover:bg-black border-2 border-[#555] px-4 py-1.5 text-white font-mono text-xs image-rendering-pixelated flex items-center gap-2 transition-all duration-500 pointer-events-auto ${isOpen ? 'bottom-[90px] md:bottom-[120px]' : 'bottom-0 rounded-t-lg border-b-0'}`}
        style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.8)' }}
      >
        {isOpen ? <ChevronDown size={14} className="text-[#FFFF55]" /> : <ChevronUp size={14} className="text-[#55FF55]" />}
        {isOpen ? 'HIDE M-HUD' : 'SHOW M-HUD'}
      </button>

      <div 
        className={`fixed left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center drop-shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isOpen ? 'bottom-8 md:bottom-12' : '-bottom-[80px] md:-bottom-[120px]'}`}
      >
        {/* Active slot name overlay */}
      <div 
        className="text-white text-xs md:text-sm font-mono tracking-widest h-5 md:h-6 transition-opacity duration-300 mb-1 pointer-events-none"
        style={{ textShadow: '2px 2px 0px #3f3f3f', color: slots[activeSlot]?.color || 'white' }}
      >
        {slots[activeSlot]?.tooltip}
      </div>
      
      {/* Hotbar Background */}
      <div 
        className="w-[182px] h-[22px] md:w-[364px] md:h-[44px] bg-no-repeat bg-cover image-rendering-pixelated relative pointer-events-auto flex"
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
              className={`w-3 h-3 md:w-5 md:h-5 opacity-70 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 ${idx === activeSlot ? 'opacity-100 animate-pulse' : ''}`} 
              color={idx === activeSlot ? slot.color : 'currentColor'}
            />
          </a>
        ))}

        {/* Hotbar Selection Ring */}
        <div 
          className="absolute top-[-1px] md:top-[-2px] w-[24px] h-[24px] md:w-[48px] md:h-[48px] pointer-events-none bg-no-repeat bg-cover transition-all duration-200 ease-out image-rendering-pixelated hidden md:block z-20"
          style={{ 
            backgroundImage: `url(${basePath}HUD/Hotbar_selection.png)`,
            left: `calc(-2px + ${activeSlot * 40}px)`
          }}
        />
        <div 
          className="absolute top-[-1px] w-[24px] h-[24px] pointer-events-none bg-no-repeat bg-cover transition-all duration-200 ease-out image-rendering-pixelated md:hidden z-20"
          style={{ 
            backgroundImage: `url(${basePath}HUD/Hotbar_selection.png)`,
            left: `calc(-1px + ${activeSlot * 20}px)`
          }}
        />
      </div>
    </div>
    </>
  );
} 
