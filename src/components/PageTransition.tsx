import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

interface PageTransitionProps {
  pageKey: string;
  children: ReactNode;
}

function PageContent({ children, reducedMotion }: { children: ReactNode; reducedMotion: boolean }) {
  const [curtainVisible, setCurtainVisible] = useState(!reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    // Animation callbacks can be lost/throttled after background inactivity.
    // A decorative curtain has a deadline, never ownership of router progress.
    const timeout = window.setTimeout(() => setCurtainVisible(false), 600);
    return () => window.clearTimeout(timeout);
  }, [reducedMotion]);
  return <div className="relative w-full">
    <div id="page-content-wrapper" className="relative w-full route-content-enter">
      {children}
    </div>
    {!reducedMotion && curtainVisible && <div aria-hidden="true" data-page-curtain
      className="route-curtain fixed inset-0 z-[9999] bg-paper dark:bg-canvas pointer-events-none" />}
  </div>;
}

export function PageTransition({ pageKey, children }: PageTransitionProps) {
  const reducedMotion = Boolean(useReducedMotion());
  // The live Outlet must not be retained in an exiting presence tree: it still
  // follows router context, so new/suspended pages can join an old exit queue.
  // Mount the latest route immediately and clean up the previous page/Canvas.
  return <PageContent key={pageKey} reducedMotion={reducedMotion}>{children}</PageContent>;
}
