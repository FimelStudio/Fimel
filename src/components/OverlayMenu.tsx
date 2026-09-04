import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X, Globe } from 'lucide-react';

interface OverlayMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => void;
  changeLanguage: (lang: string) => void;
  currentLang: string;
}

export function OverlayMenu({ isOpen, onClose, onNavigate, changeLanguage, currentLang }: OverlayMenuProps) {
  const { t } = useTranslation();

  const menuItems = [
    { label: t('workPages.back_home'), hash: '#hero' },
    { label: t('nav.about'), hash: '#/studio' },
    { label: t('nav.nav_maps_all'), hash: '#/works/maps' },
    { label: t('nav.nav_maps_je'), hash: '#/works/maps-java' },
    { label: t('nav.nav_maps_be'), hash: '#/works/maps-bedrock' },
    { label: t('nav.nav_mods'), hash: '#/works/mods' },
    { label: t('nav.nav_tools'), hash: '#/works/tools' },
    { label: t('nav.contact'), hash: '#contact' }
  ];

  const langs = ['zh', 'en', 'ja'];

  // Animation variants
  const overlayVariants = {
    hidden: { y: "-100%" },
    visible: { 
      y: 0, 
      transition: { duration: 0.8, ease: [0.7, 0, 0.1, 1] as const, staggerChildren: 0.1, delayChildren: 0.2 }
    },
    exit: { 
      y: "-100%", 
      transition: { duration: 0.8, ease: [0.7, 0, 0.1, 1] as const, staggerChildren: 0.05, staggerDirection: -1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, rotateX: 20 },
    visible: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4 } }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-[100] bg-obsidian text-white flex flex-col px-6 md:px-16 lg:px-24 overflow-y-auto"
          style={{ paddingTop: 'clamp(1rem, 3vh, 2rem)', paddingBottom: 'clamp(1rem, 4vh, 4rem)' }}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={overlayVariants}
        >
          {/* Noise background */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
            }}
          ></div>

          {/* Header */}
          <div className="flex justify-between items-center relative z-10" style={{ marginBottom: 'clamp(1rem, 4vh, 4rem)' }}>
            <div className="font-mono text-xs uppercase tracking-widest text-white/50">Fimel / Navigation</div>
            <button 
              onClick={onClose}
              className="hover-target p-3 hover:bg-white/10 rounded-full transition-colors outline-none"
              aria-label="Close menu"
              data-cursor="CLOSE"
            >
              <X size={24} />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full relative z-10 perspective-1000" style={{ gap: 'clamp(0.25rem, 1.5vh, 1.5rem)' }}>
            {menuItems.map((item, i) => (
              <motion.div key={item.hash} variants={itemVariants} className="transform-style-3d">
                <a
                  href={item.hash}
                  onClick={(e) => {
                    onNavigate(e, item.hash);
                    onClose();
                  }}
                  data-cursor="GO"
                  className="hover-target group inline-flex items-center gap-4 md:gap-6"
                >
                  <span className="font-mono text-[10px] md:text-xs text-white/30 tracking-widest w-6 md:w-8">0{i + 1}</span>
                  <span className="font-black uppercase tracking-tighter hover:text-diamond transition-colors duration-300" style={{ fontSize: 'clamp(1.5rem, 5.5vh, 4rem)', lineHeight: 1.1 }}>
                    {item.label}
                  </span>
                </a>
              </motion.div>
            ))}
          </div>

          {/* Footer inside menu */}
          <motion.div 
            className="mt-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-8 border-t border-white/10 relative z-10"
            style={{ paddingTop: 'clamp(1rem, 3vh, 3rem)' }}
            variants={itemVariants}
          >
            <div className="flex items-center gap-6 font-mono text-xs uppercase tracking-widest">
              <Globe size={16} className="text-white/50" />
              {langs.map(l => (
                <button 
                  key={l}
                  onClick={() => { changeLanguage(l); onClose(); }}
                  className={`hover:text-white transition-colors ${currentLang === l ? 'text-diamond' : 'text-white/50'}`}
                >
                  {l === 'zh' ? '中文' : l === 'en' ? 'EN' : 'JA'}
                </button>
              ))}
            </div>
            
            <div className="font-mono text-xs text-white/30 uppercase tracking-widest">
              From Blocks to Experiences
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
