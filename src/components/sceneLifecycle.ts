import { useEffect, type RefObject } from 'react';

export type SceneLifecycleProps = {
  onReady?: () => void;
  onUnavailable?: () => void;
};

export function useSceneFailureGuard(container: RefObject<HTMLDivElement | null>, onUnavailable?: () => void) {
  useEffect(() => {
    const element = container.current;
    if (!element || !onUnavailable) return;
    const fail = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    // Capture handles non-bubbling WebGL events from the nested canvas too.
    element.addEventListener('webglcontextlost', fail, true);
    element.addEventListener('webglcontextcreationerror', fail, true);
    return () => {
      element.removeEventListener('webglcontextlost', fail, true);
      element.removeEventListener('webglcontextcreationerror', fail, true);
    };
  }, [container, onUnavailable]);
}
