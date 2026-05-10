import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Canvas } from '@react-three/fiber';
import { Float, Box, Stars } from '@react-three/drei';
import { ArrowUpRight, MousePointerClick, Diamond, Sword, Map, Code, Sun, Moon } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// --- 3D Background Component ---
function ParticleCubes({ isDark }: { isDark: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 45 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={isDark ? 0.4 : 0.8} />
      <directionalLight position={[10, 10, 10]} intensity={isDark ? 2 : 1.5} color="#9b59b6" />
      <directionalLight position={[-10, -10, -10]} intensity={isDark ? 2 : 1.5} color="#00d2d3" />
      
      {isDark && <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />}

      {Array.from({ length: 40 }).map((_, i) => (
        <Float
          key={i}
          speed={Math.random() * 2 + 1}
          rotationIntensity={Math.random() * 2}
          floatIntensity={Math.random() * 3}
          position={[
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 20 - 5
          ]}
        >
          <Box args={[Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2]}>
            <meshPhysicalMaterial 
              color={i % 3 === 0 ? (isDark ? "#0a0a0a" : "#ffffff") : i % 3 === 1 ? "#9b59b6" : "#00d2d3"}
              roughness={isDark ? 0.1 : 0.2}
              metalness={isDark ? 0.8 : 0.5}
              transmission={i % 3 !== 0 ? 0.9 : 0}
              thickness={1}
              envMapIntensity={2}
              clearcoat={1}
              clearcoatRoughness={0.1}
            />
          </Box>
        </Float>
      ))}
    </Canvas>
  );
}

// --- Main App ---
function App() {
  const mainRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false); // Default to Light Mode

  // Apply dark mode class to HTML
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Fake Loading Sequence
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // GSAP Animations
  useEffect(() => {
    if (loading) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(".hero-title",
        { y: 150, opacity: 0, skewY: 5 },
        { y: 0, opacity: 1, skewY: 0, duration: 1.5, ease: "power4.out", stagger: 0.15 }
      );
      gsap.fromTo(".hero-sub",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1.5, delay: 0.6, ease: "power3.out" }
      );

      gsap.utils.toArray<HTMLElement>('.reveal-up').forEach((elem) => {
        gsap.fromTo(elem,
          { y: 80, opacity: 0 },
          {
            scrollTrigger: {
              trigger: elem,
              start: "top 85%",
              end: "bottom 20%",
              toggleActions: "play none none reverse"
            },
            y: 0,
            opacity: 1,
            duration: 1.2,
            ease: "expo.out"
          }
        );
      });
    }, mainRef);

    return () => ctx.revert();
  }, [loading]);

  return (
    <div ref={mainRef} className="w-full font-sans transition-colors duration-700 selection:bg-diamond selection:text-white dark:selection:text-obsidian">
      
      {/* 1. Cinematic Preloader */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-paper dark:bg-obsidian transition-transform duration-1000 ease-[cubic-bezier(0.7,0,0.3,1)] ${loading ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16 transform rotate-45">
            <div className="absolute inset-0 border-2 border-obsidian/20 dark:border-white/20"></div>
            <div className="absolute inset-0 border-2 border-diamond animate-[spin_2s_linear_infinite]"></div>
          </div>
          <p className="tracking-[0.4em] text-xs font-mono text-gray-500 animate-pulse">GENERATING WORLD...</p>
        </div>
      </div>

      <div className={`${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-1000`}>
        
        {/* Navigation */}
        <nav className="fixed top-0 left-0 w-full z-40 flex items-center justify-between px-6 py-8 md:px-12 pointer-events-none mix-blend-difference text-white">
          <div className="text-xl font-bold tracking-[0.3em] uppercase pointer-events-auto">FIMEL.</div>
          <div className="hidden md:flex gap-10 text-xs tracking-widest uppercase font-mono pointer-events-auto">
            <a href="#about" className="hover:text-diamond transition-colors">About</a>
            <a href="#works" className="hover:text-diamond transition-colors">Works</a>
            <a href="#contact" className="hover:text-diamond transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-6 pointer-events-auto">
            <button onClick={() => setIsDark(!isDark)} className="hover:text-diamond transition-colors">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="block md:hidden">
              <span className="text-xs uppercase font-mono tracking-widest border-b border-white">Menu</span>
            </div>
          </div>
        </nav>

        {/* 2. Hero Section */}
        <section className="relative w-full h-screen overflow-hidden flex flex-col justify-center px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian transition-colors duration-700">
          <div className="absolute inset-0 z-0 opacity-70 pointer-events-none">
            <ParticleCubes isDark={isDark} />
          </div>
          
          <div className="relative z-10 max-w-screen-2xl w-full flex flex-col items-start gap-2">
            <div className="overflow-hidden p-2 -m-2">
              <h1 className="hero-title text-[14vw] lg:text-[11vw] leading-[0.85] font-extrabold tracking-tighter uppercase text-obsidian dark:text-white transition-colors duration-700">
                CRAFTING
              </h1>
            </div>
            <div className="overflow-hidden p-2 -m-2">
              <h1 className="hero-title text-[14vw] lg:text-[11vw] leading-[0.85] font-extrabold tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-amethyst via-diamond to-obsidian dark:to-white lg:ml-[10vw]">
                WORLDS
              </h1>
            </div>
            
            <div className="hero-sub mt-12 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10 max-w-3xl">
              <div className="w-16 h-[2px] bg-diamond hidden md:block"></div>
              <p className="text-base md:text-xl font-light tracking-wide text-gray-600 dark:text-gray-400 leading-relaxed font-sans transition-colors duration-700">
                重塑方块美学。<br/>
                基于 Minecraft 引擎，构建极具艺术感与沉浸感的多维交互体验空间。
              </p>
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 hero-sub">
            <span className="text-[10px] tracking-[0.3em] uppercase font-mono rotate-90 mb-6 text-obsidian dark:text-white transition-colors duration-700">Scroll</span>
            <div className="w-[1px] h-16 bg-gradient-to-b from-obsidian dark:from-white to-transparent transition-colors duration-700"></div>
          </div>
        </section>

        {/* 3. Marquee Banner */}
        <div className="w-full overflow-hidden bg-obsidian dark:bg-white text-white dark:text-obsidian py-5 flex whitespace-nowrap z-10 relative transition-colors duration-700">
          <div className="animate-marquee flex gap-12 items-center text-2xl font-bold uppercase tracking-widest shrink-0 px-6">
            <span>PvP Arenas</span> <Diamond size={20} /> 
            <span>RPG Adventures</span> <Diamond size={20} /> 
            <span>Puzzle Maps</span> <Diamond size={20} /> 
            <span>Voxel Design</span> <Diamond size={20} />
            <span>Minecraft Java Edition</span> <Diamond size={20} />
          </div>
          <div className="animate-marquee flex gap-12 items-center text-2xl font-bold uppercase tracking-widest shrink-0 px-6" aria-hidden="true">
            <span>PvP Arenas</span> <Diamond size={20} /> 
            <span>RPG Adventures</span> <Diamond size={20} /> 
            <span>Puzzle Maps</span> <Diamond size={20} /> 
            <span>Voxel Design</span> <Diamond size={20} />
            <span>Minecraft Java Edition</span> <Diamond size={20} />
          </div>
        </div>

        {/* 4. About Section */}
        <section id="about" className="py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian relative transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto flex flex-col lg:flex-row gap-20">
            <div className="w-full lg:w-[55%] space-y-10">
              <div className="reveal-up font-mono text-amethyst tracking-[0.2em] text-sm flex items-center gap-6">
                <span className="w-12 h-[1px] bg-amethyst"></span>
                STUDIO MANIFESTO
              </div>
              <h2 className="reveal-up text-4xl md:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-obsidian dark:text-white transition-colors duration-700">
                打破传统边界，<br />
                重塑沙盒交互。
              </h2>
              <p className="reveal-up text-lg md:text-xl text-gray-600 dark:text-gray-400 font-light leading-relaxed transition-colors duration-700">
                Fimel 工作室成立于 2019 年。我们曾于网易版缔造多部现象级地图佳作。近年来，团队主攻 Java 原生端，以超越常理的指令逻辑与震撼的体素建筑，在 PVP 竞技、RPG 剧情及硬核解密三大领域不断刷新玩家认知。
              </p>
              <div className="reveal-up grid grid-cols-2 gap-12 pt-12 border-t border-obsidian/10 dark:border-white/10 transition-colors duration-700">
                <div>
                  <div className="text-5xl font-black text-diamond mb-3">2019</div>
                  <div className="text-xs tracking-widest font-mono text-gray-500 uppercase">Established Year</div>
                </div>
                <div>
                  <div className="text-5xl font-black text-diamond mb-3">10+</div>
                  <div className="text-xs tracking-widest font-mono text-gray-500 uppercase">Masterpiece Maps</div>
                </div>
              </div>
            </div>
            
            <div className="w-full lg:w-[45%] relative h-[60vh] lg:h-auto overflow-hidden rounded-sm group reveal-up bg-[#e5e5e5] dark:bg-[#050505] p-10 flex items-center justify-center transition-colors duration-700">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(155,89,182,0.15),transparent_70%)] opacity-50"></div>
              <div className="relative z-10 w-48 h-48 sm:w-64 sm:h-64 border border-obsidian/20 dark:border-white/20 transform rotate-45 transition-all duration-[2000ms] group-hover:rotate-180 flex items-center justify-center bg-white/40 dark:bg-white/5 backdrop-blur-md">
                <div className="w-3/4 h-3/4 border-2 border-diamond/50 -rotate-[15deg]"></div>
                <div className="absolute inset-0 border border-amethyst/30 rotate-[30deg]"></div>
              </div>
              <div className="absolute bottom-6 right-6 text-xs text-obsidian/30 dark:text-white/20 font-mono transition-colors duration-700">RENDER_OBJ: CORE_BLOCK</div>
            </div>
          </div>
        </section>

        {/* 5. Core Domains Service Stack */}
        <section className="py-32 bg-[#e5e5e5] dark:bg-[#050505] border-y border-obsidian/5 dark:border-white/5 px-6 md:px-16 lg:px-24 transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto">
            <div className="reveal-up font-mono text-diamond tracking-[0.2em] text-sm flex items-center gap-6 mb-20">
              <span className="w-12 h-[1px] bg-diamond"></span>
              CORE EXPERTISE
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-16 gap-x-10">
              {[
                { icon: Sword, title: "PVP 战斗构建", desc: "毫秒级判定的战斗系统与职业平衡设计，结合地貌结构打造极致的肾上腺素飙升竞技擂台。" },
                { icon: Map, title: "RPG 史诗构筑", desc: "庞大的箱庭世界观、错综复杂的技能树与定制模型交互，带来主机级动作冒险剧情演绎。" },
                { icon: Code, title: "硬核逻辑解密", desc: "跳出三维空间的视觉与思维欺骗，结合原生红石与高阶指令数据包的三维空间解谜系统。" }
              ].map((item, idx) => (
                <div key={idx} className="reveal-up group relative p-10 bg-white/40 dark:bg-black/40 border border-obsidian/5 dark:border-white/5 hover:border-obsidian/20 dark:hover:border-white/20 transition-colors duration-700">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-diamond via-amethyst to-transparent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700"></div>
                  <item.icon className="w-10 h-10 text-obsidian/30 dark:text-white/30 group-hover:text-obsidian dark:group-hover:text-white transition-colors duration-500 mb-10" strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-5 tracking-wide text-obsidian dark:text-white">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed text-sm md:text-base transition-colors duration-700">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Selected Works */}
        <section id="works" className="py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-paper dark:bg-obsidian transition-colors duration-700">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-8">
              <h2 className="reveal-up text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.9] text-obsidian dark:text-white transition-colors duration-700">Selected<br/>Works</h2>
              <a href="#contact" className="reveal-up flex items-center gap-3 pb-2 border-b border-obsidian dark:border-white hover:text-diamond hover:border-diamond dark:hover:border-diamond transition-colors group font-mono uppercase tracking-widest text-xs text-obsidian dark:text-white">
                Inquire For Access <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            <div className="space-y-32">
              {[
                { title: "PROJECT ZERO", category: "PVP Arena Map", year: "2024", accent: "group-hover:text-red-500 dark:group-hover:text-red-400", bg: "from-red-500/10" },
                { title: "ECHOES OF END", category: "RPG Adventure", year: "2023", accent: "group-hover:text-amethyst", bg: "from-amethyst/10" },
                { title: "THE TESSERACT", category: "Puzzle / Logic", year: "2022", accent: "group-hover:text-diamond", bg: "from-diamond/10" },
              ].map((work, idx) => (
                <div key={idx} className="reveal-up group relative flex flex-col md:flex-row gap-12 lg:gap-20 items-center">
                  <div className="w-full md:w-1/2 lg:w-[60%] h-[50vh] overflow-hidden bg-[#e0e0e0] dark:bg-[#0a0a0a] relative isolate rounded-sm border border-obsidian/5 dark:border-white/5 transition-colors duration-700">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.03)_20px,rgba(0,0,0,0.03)_40px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(255,255,255,0.02)_20px,rgba(255,255,255,0.02)_40px)] group-hover:scale-110 transition-transform duration-[1.5s] ease-out"></div>
                    <div className={`absolute inset-0 bg-gradient-to-br ${work.bg} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
                    <div className="absolute inset-0 flex items-center justify-center mix-blend-overlay">
                       <span className="text-obsidian/20 dark:text-white/20 font-black text-6xl md:text-8xl tracking-tighter transition-colors duration-700">MC_DATA_{idx+1}</span>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-1/2 lg:w-[40%] flex flex-col justify-center space-y-8">
                    <div className="text-xs uppercase font-mono tracking-widest text-gray-500 border-b border-obsidian/10 dark:border-white/10 pb-4 flex justify-between transition-colors duration-700">
                      <span>{work.category}</span>
                      <span>{work.year}</span>
                    </div>
                    <h3 className={`text-4xl md:text-5xl lg:text-7xl font-bold uppercase tracking-tighter transition-colors duration-500 text-obsidian dark:text-white ${work.accent}`}>
                      {work.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 font-light font-sans max-w-md text-base md:text-lg leading-relaxed transition-colors duration-700">
                      探索这座地图的深层设定与指令架构。打破实体模型限制，通过数据包与资源包的极致融合，重新定义沙盒游玩体验。
                    </p>
                    <button className="w-fit flex items-center gap-3 text-xs md:text-sm uppercase tracking-[0.2em] font-mono group-hover:text-obsidian dark:group-hover:text-white text-gray-500 transition-colors mt-4">
                      <MousePointerClick className="w-4 h-4" /> View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Colossal Footer */}
        <footer id="contact" className="py-32 px-6 md:px-12 flex flex-col items-center justify-center bg-[#e5e5e5] dark:bg-black border-t border-obsidian/10 dark:border-white/10 relative overflow-hidden transition-colors duration-700">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,210,211,0.05),transparent_60%)] pointer-events-none"></div>
          
          <div className="z-10 text-center space-y-10 mb-32 max-w-3xl reveal-up">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-obsidian dark:text-white transition-colors duration-700">Ready to<br/>Craft?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg md:text-xl font-light transition-colors duration-700">
              无论是架构一场史诗级的 RPG 战役，<br />还是打造您的专属服务器地图生态，联络我们。
            </p>
            <a href="mailto:hello@fimel.studio" className="inline-block mt-8 text-2xl md:text-5xl font-light text-obsidian dark:text-white hover:text-diamond dark:hover:text-diamond hover:italic transition-all duration-300 border-b border-obsidian/20 dark:border-white/20 hover:border-diamond pb-2">
              hello@fimel.studio
            </a>
          </div>

          <div className="w-full max-w-screen-2xl border-t border-obsidian/10 dark:border-white/10 pt-10 flex flex-col md:flex-row items-center justify-between gap-8 text-xs text-gray-500 font-mono uppercase tracking-widest z-10 reveal-up transition-colors duration-700">
            <p>© 2019-2026 FIMEL STUDIO. ALL RIGHTS RESERVED.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-obsidian dark:hover:text-white transition-colors">X (Twitter)</a>
              <a href="#" className="hover:text-obsidian dark:hover:text-white transition-colors">Bilibili</a>
              <a href="#" className="hover:text-obsidian dark:hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
          
          {/* Huge Monolithic Background Text */}
          <div className="absolute -bottom-[5%] left-0 w-full text-center pointer-events-none opacity-[0.03] dark:opacity-[0.03] text-black dark:text-white select-none transition-colors duration-700">
            <span className="text-[25vw] font-black uppercase tracking-tighter leading-none block">FIMEL</span>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default App;