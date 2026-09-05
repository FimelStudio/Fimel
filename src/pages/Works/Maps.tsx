import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkLayout } from './WorkLayout';
import { ShowcaseCard } from '../../components/cards/ShowcaseCard';
import { MaterialCard } from '../../components/cards/MaterialCard';
import { useWorksData } from '../../hooks/useWorksData';

export const Maps: React.FC = () => {
  const { isDark, basePath } = useOutletContext<{ isDark: boolean; basePath: string }>();
  const { t } = useTranslation();
  const { bedrockEntries, javaEntries } = useWorksData();
  
  const [activeEdition, setActiveEdition] = useState<'bedrock' | 'java'>('bedrock');

  // Bedrock states
  const [activeTab, setActiveTab] = useState('All');
  const [workSearch, setWorkSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const [tooltipContent, setTooltipContent] = useState({ visible: false, title: '', category: '', desc: '' });

  const tooltipRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
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

  const query = workSearch.trim().toLocaleLowerCase();
  let filteredEntries = bedrockEntries;

  if (activeTab !== 'All') {
    filteredEntries = filteredEntries.filter((work) => {
      const lowerGenre = work.genre.toLocaleLowerCase();
      if (activeTab === 'PvP') return lowerGenre.includes('pvp');
      if (activeTab === 'RPG') return lowerGenre.includes('rpg');
      if (activeTab === 'Puzzle') return lowerGenre.includes('解谜') || lowerGenre.includes('puzzle') || lowerGenre.includes('パズル') || lowerGenre.includes('逃生') || lowerGenre.includes('escape') || lowerGenre.includes('脱出');
      return true;
    });
  }

  if (query) {
    filteredEntries = filteredEntries.filter((work) => `${work.title} ${work.subtitle} ${work.category} ${work.genre} ${work.desc} ${work.players} ${work.components.join(' ')}`.toLocaleLowerCase().includes(query));
  }

  return (
    <WorkLayout page="maps-unified" isDark={isDark} basePath={basePath} totalBedrockMaps={bedrockEntries.length}>
      {/* Edition Switcher Tabs */}
      <div className="reveal-up flex flex-col items-center justify-center mb-16 md:mb-24">
        <div className="relative flex items-center p-1 bg-obsidian/5 dark:bg-white/5 rounded-full border border-obsidian/10 dark:border-white/10">
          <button
            onClick={() => setActiveEdition('bedrock')}
            className={`relative z-10 px-8 py-3 rounded-full font-mono text-xs md:text-sm uppercase tracking-widest transition-colors ${
              activeEdition === 'bedrock' ? 'text-white dark:text-obsidian' : 'text-gray-500 hover:text-obsidian dark:hover:text-white'
            }`}
          >
            {t('nav.nav_maps')} (Bedrock)
          </button>
          <button
            onClick={() => setActiveEdition('java')}
            className={`relative z-10 px-8 py-3 rounded-full font-mono text-xs md:text-sm uppercase tracking-widest transition-colors ${
              activeEdition === 'java' ? 'text-white dark:text-obsidian' : 'text-gray-500 hover:text-obsidian dark:hover:text-white'
            }`}
          >
            {t('nav.nav_maps_je')}
          </button>
          
          <motion.div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-obsidian dark:bg-white rounded-full pointer-events-none"
            initial={false}
            animate={{
              left: activeEdition === 'bedrock' ? '4px' : 'calc(50% + 4px)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeEdition}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeEdition === 'bedrock' ? (
            <div className="space-y-10">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.25em] flex items-center gap-4 text-diamond">
                    <span className="w-10 h-px bg-diamond"></span>
                    {t('workPages.bedrock.catalog')}
                  </div>
                  <h2 className="mt-5 text-4xl md:text-6xl font-black uppercase tracking-tighter">{t('workPages.catalog_title')}</h2>
                </div>
                <label className="relative w-full lg:w-[28rem] block">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={workSearch}
                    onChange={(event) => setWorkSearch(event.target.value)}
                    placeholder={t('workPages.search_placeholder')}
                    className="w-full bg-white/60 dark:bg-black/50 border border-obsidian/10 dark:border-white/10 py-4 pl-11 pr-4 outline-none focus:border-diamond font-mono text-sm transition-colors text-obsidian dark:text-white"
                  />
                </label>
              </div>

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
                  {filteredEntries.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {filteredEntries.slice(0, visibleCount).map((work, idx) => {
                        const isFeatured = idx < 2;
                        return (
                          <motion.div
                            key={work.link}
                            layout
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className={isFeatured ? "col-span-1 md:col-span-2 lg:col-span-3" : "col-span-1"}
                          >
                            <ShowcaseCard 
                              work={work} 
                              basePath={basePath} 
                              compact={!isFeatured} 
                              onHoverEnter={setTooltipContent}
                              onHoverLeave={() => setTooltipContent({ visible: false, title: '', category: '', desc: '' })}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <motion.div
                      key="no-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-y border-obsidian/10 dark:border-white/10 py-16 text-center"
                    >
                      <p className="text-gray-500 font-mono uppercase tracking-[0.2em]">{t('workPages.no_results')}</p>
                      <button onClick={() => setWorkSearch('')} className="hover-target mt-6 text-diamond font-mono text-xs uppercase tracking-[0.2em]">{t('workPages.clear_search')}</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {filteredEntries.length > visibleCount && (
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
          ) : (
            <div className="space-y-16">
              {javaEntries.map((work, idx) => (
                <MaterialCard key={work.title} work={work} idx={idx} basePath={basePath} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div 
        ref={tooltipRef}
        className="fixed top-0 left-0 pointer-events-none z-[100] px-4 py-3 opacity-0 transition-opacity duration-150 image-rendering-pixelated hidden md:block"
        style={{ 
          opacity: tooltipContent.visible ? 1 : 0,
          borderStyle: 'solid',
          borderWidth: '8px',
          borderImageSource: `url(${basePath}HUD/Tooltip_background.png)`,
          borderImageSlice: '6 fill',
          borderImageRepeat: 'stretch',
          textShadow: '2px 2px 0px #3f3f3f',
          width: 'max-content',
          maxWidth: '320px'
        }}
        id="bedrock-tooltip-follower"
      >
        <div className="flex flex-col gap-1 font-mono textShadow-mc -mt-1 -mx-0.5">
          <span className="text-[#FFFF55] text-lg font-bold">{tooltipContent.title}</span>
          {tooltipContent.category && <span className="text-[#AAAAAA]">{tooltipContent.category}</span>}
          {tooltipContent.desc && <span className="text-white mt-1 leading-tight">{tooltipContent.desc}</span>}
        </div>
      </div>
    </WorkLayout>
  );
};
