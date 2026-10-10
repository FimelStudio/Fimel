import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useFinePointer, usePageVisible } from '../hooks/useAnimationActivity';

export default function CustomCursor({ isDark }: { isDark: boolean }) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();
  const pageVisible = usePageVisible();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!finePointer || !pageVisible || reducedMotion) return;

    const cursor = cursorRef.current;
    const follower = followerRef.current;
    const textEl = textRef.current;
    if (!cursor || !follower || !textEl) return;
    // Theme changes can occur while the toggle remains under the pointer. Reset
    // the previous hover's inline colors without changing the cursor position.
    gsap.set(cursor, { scale: 1 });
    gsap.set(follower, {
      scale: 1,
      backgroundColor: 'transparent',
      mixBlendMode: 'normal',
      border: isDark ? '1px solid rgba(145,152,161,0.7)' : '1px solid rgba(10,10,10,0.4)',
    });
    gsap.set(textEl, { opacity: 0 });
    textEl.textContent = '';

    const xToCursor = gsap.quickTo(cursor, "x", { duration: 0.1, ease: "power3" });
    const yToCursor = gsap.quickTo(cursor, "y", { duration: 0.1, ease: "power3" });
    
    const xToFollower = gsap.quickTo(follower, "x", { duration: 0.5, ease: "power3" });
    const yToFollower = gsap.quickTo(follower, "y", { duration: 0.5, ease: "power3" });

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let hoveredTarget: HTMLElement | null = null;
    const onMouseMove = (e: MouseEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        xToCursor(pointerX);
        yToCursor(pointerY);
        xToFollower(pointerX);
        yToFollower(pointerY);
      });
    };

    const enterHover = (target: HTMLElement) => {
      const dataText = target.getAttribute('data-cursor');
      const isHoverTarget = target.classList.contains('hover-target');
      
      if (dataText) {
        textEl.textContent = dataText;
        gsap.to(cursor, { scale: 0, duration: 0.3 });
        
        if (isHoverTarget) {
          gsap.to(follower, { 
            scale: 3, 
            backgroundColor: isDark ? "rgba(240,246,252,1)" : "rgba(10,10,10,1)",
            mixBlendMode: "difference",
            border: "none", 
            duration: 0.4,
            ease: "expo.out"
          });
        } else {
          gsap.to(follower, { 
            scale: 4, 
            backgroundColor: isDark ? "rgba(240,246,252,1)" : "rgba(10,10,10,1)",
            mixBlendMode: "normal",
            border: "none", 
            duration: 0.4,
            ease: "expo.out"
          });
        }
        gsap.to(textEl, { opacity: 1, duration: 0.3, delay: 0.1 });
      } else {
        textEl.textContent = '';
        gsap.to(cursor, { scale: 0, duration: 0.3 });
        gsap.to(follower, { 
          scale: 2.5, 
          backgroundColor: isDark ? "rgba(240,246,252,1)" : "rgba(10,10,10,1)",
          mixBlendMode: "difference", 
          border: "none", 
          duration: 0.3 
        });
        gsap.to(textEl, { opacity: 0, duration: 0.1 });
      }
    };

    const leaveHover = () => {
      textEl.textContent = '';
      gsap.to(cursor, { scale: 1, duration: 0.3 });
      gsap.to(follower, { 
        scale: 1, 
        backgroundColor: "transparent", 
        mixBlendMode: "normal", 
        border: isDark ? "1px solid rgba(145,152,161,0.7)" : "1px solid rgba(10,10,10,0.4)",
        duration: 0.3 
      });
      gsap.to(textEl, { opacity: 0, duration: 0.1 });
    };

    // Event delegation on window for high-performance hover detection
    const onMouseOver = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('a, button, .hover-target, [data-cursor]') : null;
      if (target && target !== hoveredTarget) {
        hoveredTarget = target;
        enterHover(target);
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      const fromTarget = e.target instanceof Element ? e.target.closest<HTMLElement>('a, button, .hover-target, [data-cursor]') : null;
      const toTarget = e.relatedTarget instanceof Element ? e.relatedTarget.closest<HTMLElement>('a, button, .hover-target, [data-cursor]') : null;
      if (fromTarget && fromTarget !== toTarget) {
        hoveredTarget = null;
        leaveHover();
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseover", onMouseOver, { passive: true });
    window.addEventListener("mouseout", onMouseOut, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("mouseout", onMouseOut);
      cancelAnimationFrame(frame);
      xToCursor.tween.kill();
      yToCursor.tween.kill();
      xToFollower.tween.kill();
      yToFollower.tween.kill();
      gsap.killTweensOf([cursor, follower, textEl]);
    };
  }, [isDark, finePointer, pageVisible, reducedMotion]);

  if (!finePointer || reducedMotion) return null;

  return (
    <>
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 w-2 h-2 -ml-1 -mt-1 bg-obsidian dark:bg-content rounded-full pointer-events-none z-[9999] hidden lg:block"
        style={{ transformOrigin: 'center center' }}
      ></div>
      <div 
        ref={followerRef} 
        className="fixed top-0 left-0 w-8 h-8 -ml-4 -mt-4 border border-obsidian/40 dark:border-content-muted/70 rounded-full pointer-events-none z-[9998] hidden lg:flex items-center justify-center transition-colors duration-300"
        style={{ transformOrigin: 'center center' }}
      >
        <span ref={textRef} className="opacity-0 font-mono text-[4px] tracking-widest uppercase font-bold text-white dark:text-canvas whitespace-nowrap pointer-events-none">
        </span>
      </div>
    </>
  );
}
