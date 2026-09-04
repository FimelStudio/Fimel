import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TeamMember {
  name: string;
  role: string;
  letter: string;
  color: string; // Tailwind text color class, e.g. text-blue-500
}

export function TeamHoverRoster({ team }: { team: TeamMember[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="w-full border-t border-obsidian/10 dark:border-white/10 mt-8 relative">
      <AnimatePresence>
        {hoveredIdx !== null && (
          <motion.div
            key="watermark"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.05, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-black pointer-events-none select-none ${team[hoveredIdx].color}`}
          >
            {team[hoveredIdx].letter}
          </motion.div>
        )}
      </AnimatePresence>

      {team.map((member, idx) => {
        const isHovered = hoveredIdx === idx;
        return (
          <div
            key={member.name}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="group relative flex flex-col md:flex-row md:items-center justify-between py-8 md:py-12 border-b border-obsidian/10 dark:border-white/10 transition-colors duration-500 hover:bg-obsidian hover:text-white dark:hover:bg-white dark:hover:text-obsidian px-6 md:px-12 cursor-default overflow-hidden"
          >
            {/* Background wipe effect on hover */}
            <div className="absolute inset-0 bg-obsidian dark:bg-white origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"></div>
            
            <div className="relative z-10 flex items-center gap-8 md:gap-16">
              <span className={`font-mono text-sm tracking-widest ${isHovered ? 'text-white/50 dark:text-black/50' : 'text-gray-400'}`}>0{idx + 1}</span>
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase leading-none">
                {member.name}
              </h2>
            </div>
            
            <div className="relative z-10 mt-4 md:mt-0 flex items-center gap-6">
              <p className="font-mono text-xs md:text-sm tracking-widest uppercase opacity-70">
                {member.role}
              </p>
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-colors duration-500 ${isHovered ? 'border-white/30 dark:border-black/30' : 'border-obsidian/20 dark:border-white/20'}`}>
                <span className={`text-xl font-bold ${member.color} ${isHovered ? 'opacity-100' : 'opacity-40'}`}>
                  {member.letter}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
