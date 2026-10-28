import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useFinePointer } from '../hooks/useAnimationActivity';
import { assetUrl } from '../content/projects';

export function InteractiveStudioImage() {
  const { t } = useTranslation();
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const bounds = useRef<DOMRect | null>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 120, damping: 22 });
  const rotateY = useSpring(y, { stiffness: 120, damping: 22 });
  const active = finePointer && !reducedMotion;
  const reset = () => { bounds.current = null; x.set(0); y.set(0); };
  return <div className="min-w-0 py-2" style={{ perspective: 1000 }} data-studio-visual>
    <motion.div className="overflow-hidden rounded-sm border border-obsidian/10 dark:border-line bg-white dark:bg-surface" style={{ rotateX: active ? rotateX : 0, rotateY: active ? rotateY : 0 }}
      onPointerEnter={event => { if (active && event.pointerType === 'mouse') bounds.current = event.currentTarget.getBoundingClientRect(); }}
      onPointerMove={event => {
        if (!active || event.pointerType !== 'mouse' || !bounds.current) return;
        const rect = bounds.current;
        x.set((0.5 - (event.clientY - rect.top) / rect.height) * 7);
        y.set(((event.clientX - rect.left) / rect.width - 0.5) * 7);
      }} onPointerLeave={reset} onPointerCancel={reset}>
      <img src={assetUrl('assets/images/home/fimel-card-scene.png')} alt={t('home.studio_image_alt')} width={3840} height={2160} loading="lazy" decoding="async" className="block aspect-video w-full object-cover" draggable={false}/>
    </motion.div>
  </div>;
}
