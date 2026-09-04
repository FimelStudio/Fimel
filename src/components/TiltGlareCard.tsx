import React, { type MouseEvent, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'motion/react';

interface TiltGlareCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  href?: string;
}

export function TiltGlareCard({ children, className = '', onClick, href }: TiltGlareCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [isHovered, setIsHovered] = useState(false);

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
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["100%", "0%"]);

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    // Normalize coordinates between -0.5 and 0.5
    const mouseX = (e.clientX - rect.left) / width - 0.5;
    const mouseY = (e.clientY - rect.top) / height - 0.5;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
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
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`relative block perspective-1000 ${className}`}
    >
      {/* Glare effect layer */}
      <motion.div
        className="absolute inset-0 z-20 pointer-events-none rounded-[inherit]"
        style={{
          background: "radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 60%)",
          left: glareX,
          top: glareY,
          width: "200%",
          height: "200%",
          transform: "translate(-50%, -50%)",
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.4s ease"
        }}
      />
      
      {/* Inner content wrapper for scale effect on hover */}
      <div 
        className="relative w-full h-full transform-style-3d transition-transform duration-500 rounded-[inherit]"
        style={{ transform: isHovered ? "translateZ(10px)" : "translateZ(0)" }}
      >
        {children}
      </div>
    </motion.a>
  );
}
