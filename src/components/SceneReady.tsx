import { useEffect } from 'react';

/** Mounted INSIDE the asset Suspense boundary, never before textures resolve. */
export function SceneReady({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => onReady?.());
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [onReady]);
  return null;
}
