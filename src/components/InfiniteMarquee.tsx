import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useVelocity, useAnimationFrame, useMotionValue } from 'motion/react';
import { useAnimationActivity } from '../hooks/useAnimationActivity';
// Simple wrap function to loop the value between min and max
const wrap = (min: number, max: number, v: number) => {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

interface InfiniteMarqueeProps {
  children: React.ReactNode;
  baseVelocity?: number;
}

export const InfiniteMarquee: React.FC<InfiniteMarqueeProps> = ({ children, baseVelocity = 1 }) => {
  const container = useRef<HTMLDivElement>(null);
  const { active, reducedMotion } = useAnimationActivity(container);
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400
  });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
    clamp: false
  });

  const x = useTransform(baseX, (v: number) => `${wrap(-25, 0, v)}%`);

  const directionFactor = useRef<number>(1);
  useAnimationFrame((_t, delta) => {
    if (!active || reducedMotion) return;
    let moveBy = directionFactor.current * baseVelocity * (Math.min(delta, 50) / 1000);
    const velocity = Math.max(-5, Math.min(5, velocityFactor.get()));

    if (velocity < 0) {
      directionFactor.current = -1;
    } else if (velocity > 0) {
      directionFactor.current = 1;
    }

    moveBy += directionFactor.current * moveBy * velocity;
    
    baseX.set(baseX.get() + moveBy * 5);
  });

  return (
    <div ref={container} className="overflow-hidden m-0 whitespace-nowrap flex flex-nowrap relative">
      <motion.div className="flex whitespace-nowrap flex-nowrap" style={{ x: reducedMotion ? 0 : x }}>
        <span className="block mr-8">{children}</span>
        <span aria-hidden="true" className="block mr-8">{children}</span>
        <span aria-hidden="true" className="block mr-8">{children}</span>
        <span aria-hidden="true" className="block mr-8">{children}</span>
      </motion.div>
    </div>
  );
};
