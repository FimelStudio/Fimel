import React, { type MouseEvent, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useMotionValue, useReducedMotion } from 'motion/react';
import { useFinePointer } from '../hooks/useAnimationActivity';

interface TiltGlareCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  href?: string;
}

export function TiltGlareCard({ children, className = '', onClick, href }: TiltGlareCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const bounds = useRef<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const enableTilt = finePointer && !reducedMotion;

  // Motion values for pointer coordinates
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for rotation
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  // Map mouse coordinates to rotation (-5deg to +5deg)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  // Map mouse coordinates to glare background position
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "-50%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "-50%"]);

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!enableTilt || !bounds.current) return;
    const rect = bounds.current;
    const width = rect.width;
    const height = rect.height;
    // Normalize coordinates between -0.5 and 0.5
    const mouseX = (e.clientX - rect.left) / width - 0.5;
    const mouseY = (e.clientY - rect.top) / height - 0.5;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseEnter = () => {
    if (!enableTilt) return;
    bounds.current = ref.current?.getBoundingClientRect() ?? null;
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    bounds.current = null;
    // Reset to center
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: enableTilt ? rotateX : 0,
        rotateY: enableTilt ? rotateY : 0,
        transformStyle: "preserve-3d",
      }}
      className={`relative block perspective-1000 ${className}`}
    >
      {/* Glare effect layer */}
      <motion.div
        className="absolute inset-0 z-20 pointer-events-none rounded-[inherit]"
        style={{
          background: "radial-gradient(circle at center, rgba(240,246,252,0.15) 0%, transparent 60%)",
          x: glareX,
          y: glareY,
          left: 0,
          top: 0,
          width: "200%",
          height: "200%",
          opacity: enableTilt && isHovered ? 1 : 0,
          transition: reducedMotion ? 'none' : "opacity 0.4s ease"
        }}
      />
      
      {/* Inner content wrapper for scale effect on hover */}
      <div 
        className="relative w-full h-full transform-style-3d transition-transform duration-500 rounded-[inherit]"
        style={{ transform: enableTilt && isHovered ? "translateZ(10px)" : "translateZ(0)" }}
      >
        {children}
      </div>
    </motion.a>
  );
}
