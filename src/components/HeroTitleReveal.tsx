import { motion } from "motion/react";
import type { ReactNode } from "react";

export function HeroTitleReveal({ children, className, delay = 0 }: { children: ReactNode, className?: string, delay?: number }) {
  return (
    <div className="overflow-hidden pb-4">
      <motion.h1 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          duration: 1.2, 
          ease: [0.16, 1, 0.3, 1],
          delay: delay 
        }}
        className={className + " origin-bottom"}
      >
        {children}
      </motion.h1>
    </div>
  );
}
