import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion, MotionValue } from "motion/react";

export function ScrollTextReveal({ children, className }: { children: string, className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "center 50%"]
  });

  // Tokenize the string: group english letters/numbers into words, keep everything else as single chars.
  // This prevents English words from breaking in the middle, while allowing Chinese to wrap naturally.
  const tokens = Array.from((children || "").matchAll(/([a-zA-Z0-9]+|[^a-zA-Z0-9])/g)).map(m => m[0]);
  let totalChars = 0;
  tokens.forEach(t => totalChars += t.length);

  let charIndex = 0;

  return (
    <p ref={ref} className={className}>
      {tokens.map((token, tokenIdx) => {
        // If it's a space, render it with whitespace-pre so flex doesn't swallow it
        if (token === " ") {
          charIndex++;
          return <span key={tokenIdx}> </span>;
        }

        // Render the token (either a single Chinese char or an English word)
        const tokenElement = (
          <span key={tokenIdx} className="inline-block">
            {Array.from(token).map((char, charIdx) => {
              const start = charIndex / totalChars;
              const end = start + (3 / totalChars);
              charIndex++;
              return (
                <Char 
                  key={charIdx} 
                  char={char} 
                  progress={scrollYProgress} 
                  range={[start, end]} 
                  reduce={reduce} 
                />
              );
            })}
          </span>
        );
        return tokenElement;
      })}
    </p>
  );
}

function Char({ 
  char, 
  progress, 
  range, 
  reduce 
}: { 
  char: string, 
  progress: MotionValue<number>, 
  range: [number, number], 
  reduce: boolean | null 
}) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span style={{ opacity: reduce ? 1 : opacity }}>
      {char}
    </motion.span>
  );
}
