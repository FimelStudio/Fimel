import React, { forwardRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface PageTransitionProps {
  pageKey: string;
  children: React.ReactNode;
}

const curtainVariants = {
  initial: { scaleY: 1, transformOrigin: "top" },
  ready: { 
    scaleY: 0, 
    transformOrigin: "top",
    transition: { duration: 0.35, ease: [0.76, 0, 0.24, 1] as const }
  },
  exit: { 
    scaleY: 1, 
    transformOrigin: "bottom",
    transition: { duration: 0.25, ease: [0.76, 0, 0.24, 1] as const }
  }
};

const PageContent = forwardRef<HTMLDivElement, { children: React.ReactNode; reducedMotion: boolean }>(({ children, reducedMotion }, ref) => {
  return (
    <motion.div
      ref={ref}
      className="relative w-full"
      initial={reducedMotion ? false : "initial"}
      animate="ready"
      exit={reducedMotion ? undefined : "exit"}
    >
      <motion.div 
        id="page-content-wrapper"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        className="relative w-full"
      >
        {children}
      </motion.div>
      
      {!reducedMotion && (
        <motion.div
          aria-hidden="true"
          className="fixed inset-0 z-[9999] bg-paper dark:bg-canvas pointer-events-none"
          variants={curtainVariants}
        />
      )}
    </motion.div>
  );
});

PageContent.displayName = 'PageContent';

export const PageTransition: React.FC<PageTransitionProps> = ({ pageKey, children }) => {
  const reducedMotion = Boolean(useReducedMotion());
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageContent key={pageKey} reducedMotion={reducedMotion}>
        {children}
      </PageContent>
    </AnimatePresence>
  );
};
