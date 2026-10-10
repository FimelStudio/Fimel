import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TeamMember {
  name: string;
  role: string;
  letter: string;
  color: string; // Tailwind text color class, e.g. text-blue-500
  avatar: string;
}

function TeamAvatar({ member, isHovered }: { member: TeamMember; isHovered: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <div className={`h-12 w-12 shrink-0 border bg-surface p-1 md:h-16 md:w-16 transition-colors duration-500 ${isHovered ? 'border-white/30 dark:border-line' : 'border-obsidian/20 dark:border-line'}`}>
      {failedSource === member.avatar ? (
        <span aria-hidden="true" className={`flex h-full w-full items-center justify-center text-xl font-bold ${member.color}`}>
          {member.letter}
        </span>
      ) : (
        <img
          src={member.avatar}
          alt={member.name}
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-contain [image-rendering:pixelated]"
          onError={() => setFailedSource(member.avatar)}
        />
      )}
    </div>
  );
}

export function TeamHoverRoster({ team }: { team: TeamMember[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="w-full border-t border-obsidian/10 dark:border-line mt-8 relative">
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
            data-team-member={member.name}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="group relative flex flex-col md:flex-row md:items-center justify-between py-8 md:py-12 border-b border-obsidian/10 dark:border-line transition-colors duration-500 hover:bg-obsidian hover:text-white dark:hover:bg-surface-raised dark:hover:text-content px-6 md:px-12 cursor-default overflow-hidden"
          >
            {/* Background wipe effect on hover */}
            <div className="absolute inset-0 bg-obsidian dark:bg-surface-raised origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"></div>
            
            <div className="relative z-10 flex min-w-0 items-center gap-4 md:gap-8 lg:gap-16">
              <span className={`font-mono text-sm tracking-widest ${isHovered ? 'text-white/70 dark:text-content-muted' : 'text-gray-400'}`}>0{idx + 1}</span>
              <h3 className="min-w-0 break-words text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase leading-none">
                {member.name}
              </h3>
            </div>
            
            <div className="relative z-10 mt-4 md:mt-0 flex min-w-0 items-center justify-between gap-6 md:justify-start">
              <p className="min-w-0 font-mono text-xs md:text-sm tracking-widest uppercase opacity-70">
                {member.role}
              </p>
              <TeamAvatar member={member} isHovered={isHovered} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
