import React, { useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

interface DraggableCubeProps {
  basePath: string;
}

export const DraggableCube: React.FC<DraggableCubeProps> = ({ basePath }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Core rotation values
  const rotateX = useMotionValue(-15);
  const rotateY = useMotionValue(30);

  // Smooth springs for rotation so it feels weighty
  const springX = useSpring(rotateX, { stiffness: 100, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 100, damping: 20 });

  // Handle Drag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrag = (_event: any, info: any) => {
    // Delta applied to rotation
    rotateX.set(rotateX.get() - info.delta.y * 0.5);
    rotateY.set(rotateY.get() + info.delta.x * 0.5);
  };

  return (
    <motion.div
      className="relative z-10 w-32 h-32 sm:w-48 sm:h-48 transform-style-3d mc-block cursor-grab active:cursor-grabbing touch-pan-y"
      style={{ touchAction: 'pan-y' }}
      data-cursor={isDragging ? "DRAGGING" : "DRAG"}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => {
        setIsHovered(false);
        // Slowly return to base auto-spin feel, or just let it stay where dragged
      }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0} // No translation, only catching the drag events
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      onDrag={handleDrag}
    >
      {/* 
        Auto-spin wrapper. If user is dragging or hovering, we pause it. 
        Wait, if we use Framer Motion for rotation, mixing it with CSS animation is tricky.
        Let's just use Framer Motion for everything, but to keep it simple, we use a CSS class for auto-spin that halts on hover,
        while the inner div handles the manual rotation.
      */}
      <div className={`absolute inset-0 transform-style-3d ${!isHovered && !isDragging ? 'animate-[spin-slow_15s_linear_infinite]' : ''}`}>
        <motion.div
          className="absolute inset-0 transform-style-3d"
          style={{
            rotateX: springX,
            rotateY: springY,
            scale: isHovered || isDragging ? 1.25 : 1
          }}
          transition={{ scale: { type: "spring", stiffness: 300, damping: 20 } }}
        >
          <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" style={{ transform: "rotateY(0deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
          <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" style={{ transform: "rotateY(180deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
          <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" style={{ transform: "rotateY(90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
          <div className="mc-face border-2 border-obsidian/30 dark:border-white/30" style={{ transform: "rotateY(-90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_side.png')` }}></div>
          <div className="mc-face border-2 border-obsidian/30 dark:border-white/30 bg-[#7cbd6b]" style={{ transform: "rotateX(90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/block_top.png')`, backgroundBlendMode: 'multiply' }}></div>
          <div className="mc-face border-2 border-obsidian/30 dark:border-white/30 bg-obsidian/20 dark:bg-obsidian/10" style={{ transform: "rotateX(-90deg) translateZ(var(--tz))", backgroundImage: `url('${basePath}textures/dirt.png')` }}></div>
        </motion.div>
      </div>
    </motion.div>
  );
};
