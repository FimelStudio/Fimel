import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function CustomCursor({ isDark }: { isDark: boolean }) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [cursorText, setCursorText] = useState('');
  const [isTouchDevice] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    if (isTouchDevice) return;

    const cursor = cursorRef.current;
    const follower = followerRef.current;
    const textEl = textRef.current;
    if (!cursor || !follower || !textEl) return;

    const xToCursor = gsap.quickTo(cursor, "x", { duration: 0.1, ease: "power3" });
    const yToCursor = gsap.quickTo(cursor, "y", { duration: 0.1, ease: "power3" });
    
    const xToFollower = gsap.quickTo(follower, "x", { duration: 0.5, ease: "power3" });
    const yToFollower = gsap.quickTo(follower, "y", { duration: 0.5, ease: "power3" });

    const onMouseMove = (e: MouseEvent) => {
      xToCursor(e.clientX);
      yToCursor(e.clientY);
      xToFollower(e.clientX);
      yToFollower(e.clientY);
    };

    const enterHover = (target: HTMLElement) => {
      const dataText = target.getAttribute('data-cursor');
      const isHoverTarget = target.classList.contains('hover-target');
      
      if (dataText) {
        setCursorText(dataText);
        gsap.to(cursor, { scale: 0, duration: 0.3 });
        
        if (isHoverTarget) {
          gsap.to(follower, { 
            scale: 3, 
            backgroundColor: isDark ? "rgba(255,255,255,1)" : "rgba(10,10,10,1)", 
            mixBlendMode: "difference",
            border: "none", 
            duration: 0.4,
            ease: "expo.out"
          });
        } else {
          gsap.to(follower, { 
            scale: 4, 
            backgroundColor: isDark ? "rgba(255,255,255,1)" : "rgba(10,10,10,1)", 
            mixBlendMode: "normal",
            border: "none", 
            duration: 0.4,
            ease: "expo.out"
          });
        }
        gsap.to(textEl, { opacity: 1, duration: 0.3, delay: 0.1 });
      } else {
        setCursorText('');
        gsap.to(cursor, { scale: 0, duration: 0.3 });
        gsap.to(follower, { 
          scale: 2.5, 
          backgroundColor: isDark ? "rgba(255,255,255,1)" : "rgba(10,10,10,1)", 
          mixBlendMode: "difference", 
          border: "none", 
          duration: 0.3 
        });
        gsap.to(textEl, { opacity: 0, duration: 0.1 });
      }
    };

    const leaveHover = () => {
      setCursorText('');
      gsap.to(cursor, { scale: 1, duration: 0.3 });
      gsap.to(follower, { 
        scale: 1, 
        backgroundColor: "transparent", 
        mixBlendMode: "normal", 
        border: isDark ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(10,10,10,0.4)", 
        duration: 0.3 
      });
      gsap.to(textEl, { opacity: 0, duration: 0.1 });
    };

    // Event delegation on window for high-performance hover detection
    const onMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('a, button, .hover-target, [data-cursor]');
      if (target) {
        enterHover(target);
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      const fromTarget = (e.target as HTMLElement | null)?.closest<HTMLElement>('a, button, .hover-target, [data-cursor]');
      const toTarget = (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>('a, button, .hover-target, [data-cursor]');
      if (fromTarget && fromTarget !== toTarget) {
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
    };
  }, [isDark, isTouchDevice]);

  if (isTouchDevice) return null;

  return (
    <>
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 w-2 h-2 -ml-1 -mt-1 bg-obsidian dark:bg-white rounded-full pointer-events-none z-[9999] hidden lg:block"
        style={{ transformOrigin: 'center center' }}
      ></div>
      <div 
        ref={followerRef} 
        className="fixed top-0 left-0 w-8 h-8 -ml-4 -mt-4 border border-obsidian/40 dark:border-white/40 rounded-full pointer-events-none z-[9998] hidden lg:flex items-center justify-center transition-colors duration-300"
        style={{ transformOrigin: 'center center' }}
      >
        <span ref={textRef} className="opacity-0 font-mono text-[4px] tracking-widest uppercase font-bold text-white dark:text-obsidian whitespace-nowrap pointer-events-none">
          {cursorText}
        </span>
      </div>
    </>
  );
}
