import { useRef, type ReactElement } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { useFinePointer } from '../hooks/useAnimationActivity';

interface MagneticProps {
  children: ReactElement;
  springOptions?: { stiffness: number; damping: number; mass: number };
  intensity?: number;
}

export function Magnetic({ 
  children, 
  springOptions = { stiffness: 150, damping: 15, mass: 0.1 },
  intensity = 0.2
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const bounds = useRef<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const enabled = finePointer && !reducedMotion;
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springX = useSpring(x, springOptions);
  const springY = useSpring(y, springOptions);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled || !bounds.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = bounds.current;
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    x.set(middleX * intensity);
    y.set(middleY * intensity);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    bounds.current = null;
  };

  const handleMouseEnter = () => {
    if (enabled) bounds.current = ref.current?.getBoundingClientRect() ?? null;
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{ x: enabled ? springX : 0, y: enabled ? springY : 0 }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}
