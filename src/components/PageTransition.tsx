import React, { useState, useEffect, useRef } from 'react';
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

const PageContent: React.FC<{ children: React.ReactNode; isFirstMount: boolean }> = ({ children, isFirstMount }) => {
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;
    
    // Slight delay to allow React/ThreeJS to insert DOM nodes
    const initTimer = setTimeout(() => {
      if (isCancelled || !containerRef.current) return;
      
      const images = Array.from(containerRef.current.querySelectorAll('img'));
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
  }, []);

  return (
    <>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full"
      >
        {children}
      </motion.div>
      
      {!isFirstMount && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-obsidian pointer-events-none"
          variants={curtainVariants}
          initial="initial"
          animate={isReady ? "ready" : "initial"}
          exit="exit"
        />
      )}
    </>
  );
};

let hasMountedOnce = false;

export const PageTransition: React.FC<PageTransitionProps> = ({ pageKey, children }) => {
  const [isFirstMount] = useState(() => !hasMountedOnce);

  useEffect(() => {
    hasMountedOnce = true;
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div key={pageKey} className="relative w-full">
        <PageContent isFirstMount={isFirstMount}>
          {children}
        </PageContent>
      </motion.div>
    </AnimatePresence>
  );
};
