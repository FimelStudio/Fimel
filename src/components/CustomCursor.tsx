import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function CustomCursor({ isDark }: { isDark: boolean }) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const follower = followerRef.current;
    if (!cursor || !follower) return;

    // Fast movement for the dot
    const xToCursor = gsap.quickTo(cursor, "x", { duration: 0.1, ease: "power3" });
    const yToCursor = gsap.quickTo(cursor, "y", { duration: 0.1, ease: "power3" });
    
    // Smooth lagging movement for the ring
    const xToFollower = gsap.quickTo(follower, "x", { duration: 0.5, ease: "power3" });
    const yToFollower = gsap.quickTo(follower, "y", { duration: 0.5, ease: "power3" });

    let isHovering = false;

    const onMouseMove = (e: MouseEvent) => {
      xToCursor(e.clientX);
      yToCursor(e.clientY);
      xToFollower(e.clientX);
      yToFollower(e.clientY);
    };

    const enterHover = () => {
      isHovering = true;
      gsap.to(cursor, { scale: 0, duration: 0.3 });
      gsap.to(follower, { scale: 2.5, backgroundColor: isDark ? "rgba(255,255,255,1)" : "rgba(10,10,10,1)", mixBlendMode: "difference", border: "none", duration: 0.3 });
    };

    const leaveHover = () => {
      isHovering = false;
      gsap.to(cursor, { scale: 1, duration: 0.3 });
      gsap.to(follower, { scale: 1, backgroundColor: "transparent", mixBlendMode: "normal", border: isDark ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(10,10,10,0.4)", duration: 0.3 });
    };

    window.addEventListener("mousemove", onMouseMove);

    // Apply hover effect exactly on links and buttons
    const hoverElements = document.querySelectorAll('a, button, .hover-target');
    hoverElements.forEach((el) => {
      el.addEventListener('mouseenter', enterHover);
      el.addEventListener('mouseleave', leaveHover);
    });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      hoverElements.forEach((el) => {
        el.removeEventListener('mouseenter', enterHover);
        el.removeEventListener('mouseleave', leaveHover);
      });
    };
  }, [isDark]);

  return (
    <>
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 w-2 h-2 -ml-1 -mt-1 bg-obsidian dark:bg-white rounded-full pointer-events-none z-[9999] hidden lg:block"
        style={{ transformOrigin: 'center center' }}
      ></div>
      <div 
        ref={followerRef} 
        className="fixed top-0 left-0 w-8 h-8 -ml-4 -mt-4 border border-obsidian/40 dark:border-white/40 rounded-full pointer-events-none z-[9998] hidden lg:block transition-colors duration-300"
        style={{ transformOrigin: 'center center' }}
      ></div>
    </>
  );
}
