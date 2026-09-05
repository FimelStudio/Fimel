import React, { useState, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PageTransitionProps {
  pageKey: string;
  children: React.ReactNode;
}

const curtainVariants = {
  initial: { scaleY: 1, transformOrigin: "top" },
  ready: { 
    scaleY: 0, 
    transformOrigin: "top",
    transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] as const } 
  },
  exit: { 
    scaleY: 1, 
    transformOrigin: "bottom",
    transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] as const } 
  }
};

let hasMountedOnce = false;

const PageContent = forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => {
  const [isFirstMount] = useState(() => {
    const isFirst = !hasMountedOnce;
    hasMountedOnce = true;
    return isFirst;
  });
  
  const [isReady, setIsReady] = useState(isFirstMount);

  useEffect(() => {
    if (isFirstMount) return;
    
    let isCancelled = false;
    
    // Slight delay to allow DOM to render
    const initTimer = setTimeout(() => {
      if (isCancelled) return;
      
      const el = document.getElementById('page-content-wrapper');
      if (!el) {
        setIsReady(true);
        return;
      }
      
      const images = Array.from(el.querySelectorAll('img:not([loading="lazy"])')) as HTMLImageElement[];
      const unresolved = images.filter(img => !img.complete);
      
      if (unresolved.length === 0) {
        setIsReady(true);
        return;
      }
      
      let loaded = 0;
      const onImageLoad = () => {
        if (isCancelled) return;
        loaded++;
        if (loaded === unresolved.length) setIsReady(true);
      };
      
      unresolved.forEach(img => {
        img.addEventListener('load', onImageLoad, { once: true });
        img.addEventListener('error', onImageLoad, { once: true });
      });
    }, 50);

    const fallbackTimer = setTimeout(() => {
      if (!isCancelled) setIsReady(true);
    }, 1500);

    return () => {
      isCancelled = true;
      clearTimeout(initTimer);
      clearTimeout(fallbackTimer);
    };
  }, [isFirstMount]);

  return (
    <motion.div
      ref={ref}
      className="relative w-full"
      initial={isFirstMount ? false : "initial"}
      animate={isReady ? "ready" : "initial"}
      exit="exit"
    >
      <motion.div 
        id="page-content-wrapper"
        initial={isFirstMount ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="relative w-full"
      >
        {children}
      </motion.div>
      
      {!isFirstMount && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-obsidian pointer-events-none"
          variants={curtainVariants}
        />
      )}
    </motion.div>
  );
});

PageContent.displayName = 'PageContent';

export const PageTransition: React.FC<PageTransitionProps> = ({ pageKey, children }) => {
  return (
    <AnimatePresence mode="wait">
      <PageContent key={pageKey}>
        {children}
      </PageContent>
    </AnimatePresence>
  );
};
