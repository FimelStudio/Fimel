import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useAnimationActivity } from '../hooks/useAnimationActivity';
import type { SceneLifecycleProps } from './sceneLifecycle';

type LoadedScene = ComponentType<SceneLifecycleProps & { isDark: boolean }>;
type SceneLoader = () => Promise<LoadedScene>;
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

// Do not move these imports into module scope or React.lazy: their network,
// evaluation, and WebGL work must start after the foreground has painted.
const loadParticles: SceneLoader = () => import('./ParticleBackground').then(module => module.ParticleCubes);
const loadWorldCore: SceneLoader = () => import('./WorldCore3D').then(module => module.WorldCore3D);

class SceneErrorBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() {
    // A decorative canvas must never escape into the page/router boundary.
    this.props.onFailure();
  }

  render() { return this.state.failed ? null : this.props.children; }
}

function supportsWebGL2() {
  const canvas = document.createElement('canvas');
  try {
    const gl = canvas.getContext('webgl2', { powerPreference: 'low-power' });
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function DeferredScene({ isDark, loader, kind }: { isDark: boolean; loader: SceneLoader; kind: 'particles' | 'core' }) {
  const container = useRef<HTMLDivElement>(null);
  const { active, reducedMotion, constrained } = useAnimationActivity(container);
  const [Scene, setScene] = useState<LoadedScene | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  const staticOnly = reducedMotion || saveData;
  const markReady = useCallback(() => setReady(true), []);
  const markFailed = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (!active || staticOnly || Scene || failed) return;
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let delayTimer = 0;
    let idleId: number | undefined;
    const idleWindow = window as IdleWindow;

    const start = () => {
      if (cancelled || document.hidden) return;
      if (!supportsWebGL2()) { setFailed(true); return; }
      setLoading(true);
      void loader().then(Loaded => {
        if (!cancelled) setScene(() => Loaded);
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
    };

    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        // The short first-visit intro has already exited before any Three code
        // is requested. Low-tier hardware gets a longer foreground-only window.
        delayTimer = window.setTimeout(() => {
          if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(start, { timeout: 1000 });
          else delayTimer = window.setTimeout(start, 0);
        }, constrained ? 2500 : 1500);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      clearTimeout(delayTimer);
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
    };
  }, [Scene, active, constrained, failed, loader, staticOnly]);

  useEffect(() => {
    if (!active || staticOnly || !loading || ready || failed) return;
    // Includes slow module downloads, WebGL setup, and suspended textures. The
    // watchdog is local: it never controls document loading or navigation.
    const timeout = window.setTimeout(markFailed, 8000);
    return () => clearTimeout(timeout);
  }, [active, failed, loading, markFailed, ready, staticOnly]);

  const status = failed ? 'fallback' : staticOnly ? 'static' : ready ? 'ready' : loading ? 'loading' : 'waiting';
  return (
    <div ref={container} className="relative h-full w-full pointer-events-none" aria-hidden="true" data-deferred-scene={kind} data-scene-state={status}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: kind === 'particles' ? (isDark ? '#0d1117' : '#f4f4f5') : 'transparent' }} />
      {!failed && !staticOnly && Scene && (ready || active) && (
        <SceneErrorBoundary onFailure={markFailed}>
          <Suspense fallback={null}>
            <Scene isDark={isDark} onReady={markReady} onUnavailable={markFailed} />
          </Suspense>
        </SceneErrorBoundary>
      )}
    </div>
  );
}

export function DeferredParticleScene({ isDark }: { isDark: boolean }) {
  return <DeferredScene isDark={isDark} loader={loadParticles} kind="particles" />;
}

export function DeferredWorldCore({ isDark }: { isDark: boolean }) {
  return <DeferredScene isDark={isDark} loader={loadWorldCore} kind="core" />;
}
