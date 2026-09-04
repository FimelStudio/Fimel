import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function CurtainLoading({ isLoading }: { isLoading: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            return 100;
          }
          return p + Math.floor(Math.random() * 15) + 5;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper dark:bg-obsidian"
          initial={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 1.2, ease: [0.7, 0, 0.1, 1] as const }} // Cinematic curtain raise
        >
          {/* Subtle noise/texture overlay for the curtain */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
            }}
          ></div>
          
          <div className="relative flex flex-col items-center overflow-hidden">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
              className="font-mono text-7xl md:text-9xl font-black text-obsidian dark:text-white mix-blend-difference"
            >
              {Math.min(progress, 100)}%
            </motion.div>
          </div>
          
          <motion.div 
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs font-mono uppercase tracking-[0.3em] text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Fimel Studio
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
