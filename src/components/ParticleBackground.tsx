/* eslint-disable */
import React, { useRef, useState } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { Float, Box, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const BLOCK_TEXTURES = [
  { id: 'grass', top: 'block_top.png', side: 'block_side.png', bottom: 'dirt.png' },
  { id: 'stone', top: 'stone.png', side: 'stone.png', bottom: 'stone.png' },
  { id: 'oak_planks', top: 'oak_planks.png', side: 'oak_planks.png', bottom: 'oak_planks.png' },
  { id: 'oak_log', top: 'oak_log_top.png', side: 'oak_log.png', bottom: 'oak_log_top.png' },
  { id: 'diamond_block', top: 'diamond_block.png', side: 'diamond_block.png', bottom: 'diamond_block.png' },
  { id: 'crafting_table', top: 'crafting_table_top.png', side: 'crafting_table_side.png', bottom: 'oak_planks.png' },
  { id: 'dirt', top: 'dirt.png', side: 'dirt.png', bottom: 'dirt.png' },
  { id: 'sand', top: 'sand.png', side: 'sand.png', bottom: 'sand.png' },
  { id: 'gravel', top: 'gravel.png', side: 'gravel.png', bottom: 'gravel.png' },
  { id: 'ice', top: 'ice.png', side: 'ice.png', bottom: 'ice.png' },
  { id: 'cobblestone', top: 'cobblestone.png', side: 'cobblestone.png', bottom: 'cobblestone.png' },
  { id: 'emerald_block', top: 'emerald_block.png', side: 'emerald_block.png', bottom: 'emerald_block.png' },
  { id: 'gold_block', top: 'gold_block.png', side: 'gold_block.png', bottom: 'gold_block.png' },
  { id: 'redstone_block', top: 'redstone_block.png', side: 'redstone_block.png', bottom: 'redstone_block.png' },
  { id: 'iron_block', top: 'iron_block.png', side: 'iron_block.png', bottom: 'iron_block.png' },
  { id: 'obsidian', top: 'obsidian.png', side: 'obsidian.png', bottom: 'obsidian.png' },
  { id: 'cherry_leaves', top: 'cherry_leaves.png', side: 'cherry_leaves.png', bottom: 'cherry_leaves.png' },
  { id: 'cactus', top: 'cactus_top.png', side: 'cactus_side.png', bottom: 'cactus_bottom.png' },
  { id: 'TNT', top: 'TNT_top.png', side: 'TNT_side.png', bottom: 'TNT_bottom.png' }
];

const generateExplosionParticles = () => {
  return Array.from({ length: 15 }).map(() => ({
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(Math.random() * 8 + 4),
    scale: Math.random() * 2.0 + 1.0,
    lifetime: Math.random() * 0.8 + 0.2,
    maxLife: 1.0
  }));
};

function ExplosionEffect({ position }: { position: [number, number, number] }) {
  const basePath = import.meta.env.BASE_URL;
  const texture = useTexture(`${basePath}textures/explosion.png`);
  
  React.useEffect(() => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
  }, [texture]);

  const groupRef = useRef<THREE.Group>(null);
  
  const particles = React.useMemo(() => generateExplosionParticles(), []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const p = particles[i];
        if (p.lifetime > 0) {
          p.lifetime -= delta;
          child.position.addScaledVector(p.velocity, delta);
          const progress = Math.max(0, p.lifetime / p.maxLife);
          child.scale.setScalar(p.scale * (1 + (1 - progress)));
          (child as THREE.Sprite).material.opacity = progress;
        } else {
          (child as THREE.Sprite).material.opacity = 0;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {particles.map((_, i) => (
        <sprite key={i}>
          <spriteMaterial map={texture} transparent opacity={1} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

const generateSmokeParticles = () => {
  return Array.from({ length: 8 }).map(() => ({
    startPos: new THREE.Vector3((Math.random()-0.5), 0.5, (Math.random()-0.5)),
    velocity: new THREE.Vector3((Math.random()-0.5)*0.5, Math.random() * 1.5 + 1.0, (Math.random()-0.5)*0.5),
    lifetime: Math.random() * -1.0,
    maxLife: 1.2
  }));
};

function SmokeEffect({ position }: { position: [number, number, number] }) {
  const basePath = import.meta.env.BASE_URL;
  const texture = useTexture(`${basePath}textures/smoke.png`);
  
  React.useEffect(() => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
  }, [texture]);
  
  const groupRef = useRef<THREE.Group>(null);
  const [particles] = React.useState(generateSmokeParticles);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const p = particles[i];
        p.lifetime += delta;
        if (p.lifetime > p.maxLife) {
          p.lifetime = 0;
          p.startPos.set((Math.random()-0.5), 0.5, (Math.random()-0.5));
          child.position.copy(p.startPos);
        }
        
        if (p.lifetime > 0) {
          child.position.addScaledVector(p.velocity, delta);
          const progress = p.lifetime / p.maxLife;
          const fade = progress < 0.2 ? progress / 0.2 : 1.0 - (progress - 0.2) / 0.8;
          child.scale.setScalar(0.5 + progress * 1.5);
          (child as THREE.Sprite).material.opacity = fade * 0.7;
        } else {
          (child as THREE.Sprite).material.opacity = 0;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {particles.map((p, i) => (
        <sprite key={i} position={p.startPos}>
          <spriteMaterial map={texture} transparent opacity={0} color="#333333" depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

export interface CubeData {
  speed: number;
  rotationIntensity: number;
  floatIntensity: number;
  position: [number, number, number];
  size: [number, number, number];
  colorType: number;
  textureIndex: number;
}

function MinecraftBlock({ cube, isDark }: { cube: CubeData, isDark: boolean }) {
  const basePath = import.meta.env.BASE_URL;
  const config = BLOCK_TEXTURES[cube.textureIndex];
  const isTNT = config.id === 'TNT';
  
  const [primed, setPrimed] = useState(false);
  const [exploded, setExploded] = useState(false);
  const fuseTime = useRef(0);
  
  const textures = useTexture({
    mapTop: `${basePath}textures/${config.top}`,
    mapSide: `${basePath}textures/${config.side}`,
    mapBottom: `${basePath}textures/${config.bottom}`,
  });

  React.useMemo(() => {
    Object.values(textures).forEach((tex) => {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
    });
  }, [textures, cube.colorType, isDark]);

  const { mapTop, mapSide, mapBottom } = textures;

  const materials = React.useMemo(() => {
    const initColor = new THREE.Color(
      cube.colorType === 0 
        ? (isDark ? "#d0d0d0" : "#ffffff") 
        : cube.colorType === 1 
          ? (isDark ? "#d8cbe0" : "#ffffff") 
          : (isDark ? "#cbd8d8" : "#ffffff")
    );
    const topColor = config.id === 'grass' ? new THREE.Color("#7cb342").multiply(initColor) : initColor;
    const sideColor = config.id === 'cherry_leaves' ? new THREE.Color("#ffb4d6").multiply(initColor) : initColor;

    const commonProps = { 
      roughness: isDark ? 0.6 : 0.8, 
      metalness: 0.1,
      color: initColor
    };
    return [
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps, color: sideColor }),
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps, color: sideColor }),
      new THREE.MeshStandardMaterial({ map: mapTop, ...commonProps, color: topColor }),
      new THREE.MeshStandardMaterial({ map: mapBottom, ...commonProps }),
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps, color: sideColor }),
      new THREE.MeshStandardMaterial({ map: mapSide, ...commonProps, color: sideColor }),
    ];
  }, [mapSide, mapTop, mapBottom, config.id]);

  const meshRef = useRef<THREE.Mesh>(null);
  const expandRef = useRef(1);

  useFrame((_, delta) => {
    if (exploded) return;

    if (meshRef.current) {
      if (primed) {
        fuseTime.current += delta;
        if (fuseTime.current >= 4) {
          setExploded(true);
          setPrimed(false);
          const audio = new Audio(`${basePath}sound/Explosion2.ogg`);
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } else {
          const progress = fuseTime.current / 4;
          const flashRate = Math.max(2, 10 * progress);
          const isWhite = Math.sin(fuseTime.current * flashRate * Math.PI) > 0;
          
          expandRef.current = 1 + (0.15 * progress);
          meshRef.current.scale.set(expandRef.current, expandRef.current, expandRef.current);
          
          const mats = meshRef.current.material;
          if (Array.isArray(mats)) {
            mats.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                mat.emissive.set(isWhite ? "#ffffff" : "#000000");
                mat.emissiveIntensity = isWhite ? 0.6 : 0;
              }
            });
          }
        }
      } else {
        const targetColor = new THREE.Color(
          cube.colorType === 0 
            ? (isDark ? "#d0d0d0" : "#ffffff") 
            : cube.colorType === 1 
              ? (isDark ? "#d8cbe0" : "#ffffff") 
              : (isDark ? "#cbd8d8" : "#ffffff")
        );
        const topTargetColor = config.id === 'grass' ? new THREE.Color("#7cb342").multiply(targetColor) : targetColor;
        const sideTargetColor = config.id === 'cherry_leaves' ? new THREE.Color("#ffb4d6").multiply(targetColor) : targetColor;

        const targetRoughness = isDark ? 0.6 : 0.8;

        const mats = meshRef.current.material;
        if (Array.isArray(mats)) {
          mats.forEach((mat, index: number) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              const finalColor = index === 2 ? topTargetColor : (index === 3 && config.id !== 'cherry_leaves' ? targetColor : sideTargetColor);
              mat.color.lerp(finalColor, delta * 3);
              mat.roughness = THREE.MathUtils.lerp(mat.roughness, targetRoughness, delta * 3);
              mat.emissive.set("#000000");
            }
          });
        }
      }
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    if (isTNT && !primed && !exploded) {
      e.stopPropagation();
      setPrimed(true);
      const audio = new Audio(`${basePath}sound/Fuse.ogg`);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  };

  if (exploded) {
    return (
      <Float speed={0} rotationIntensity={0} floatIntensity={0} position={cube.position}>
        <ExplosionEffect position={[0, 0, 0]} />
      </Float>
    );
  }

  return (
    <Float
      speed={primed ? 0 : cube.speed}
      rotationIntensity={primed ? 0 : cube.rotationIntensity}
      floatIntensity={primed ? 0 : cube.floatIntensity}
      position={cube.position}
    >
      {primed && !exploded && <SmokeEffect position={[0, 0, 0]} />}
      <Box 
        ref={meshRef} 
        args={cube.size} 
        material={materials} 
        onClick={handleClick}
        onPointerOver={() => { if (isTNT && !primed && !exploded) document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { if (isTNT) document.body.style.cursor = 'auto'; }}
      />
    </Float>
  );
}

function SceneLights({ isDark }: { isDark: boolean }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirLight1Ref = useRef<THREE.DirectionalLight>(null);
  const dirLight2Ref = useRef<THREE.DirectionalLight>(null);

  useFrame((_, delta) => {
    const lerpFactor = delta * 3;
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, isDark ? 0.4 : 0.6, lerpFactor);
    }
    if (dirLight1Ref.current) {
      dirLight1Ref.current.intensity = THREE.MathUtils.lerp(dirLight1Ref.current.intensity, isDark ? 5 : 1.2, lerpFactor);
      dirLight1Ref.current.color.lerp(new THREE.Color(isDark ? "#9b59b6" : "#ffffff"), lerpFactor);
    }
    if (dirLight2Ref.current) {
      dirLight2Ref.current.intensity = THREE.MathUtils.lerp(dirLight2Ref.current.intensity, isDark ? 5 : 0.6, lerpFactor);
      dirLight2Ref.current.color.lerp(new THREE.Color(isDark ? "#00d2d3" : "#ffffff"), lerpFactor);
    }
  });

  const [initIsDark] = useState(isDark);

  return (
    <>
      <ambientLight ref={ambientRef} intensity={initIsDark ? 0.4 : 0.6} />
      <directionalLight ref={dirLight1Ref} position={[10, 10, 10]} intensity={initIsDark ? 5 : 1.2} color={initIsDark ? "#9b59b6" : "#ffffff"} />
      <directionalLight ref={dirLight2Ref} position={[-10, -10, -10]} intensity={initIsDark ? 5 : 0.6} color={initIsDark ? "#00d2d3" : "#ffffff"} />
    </>
  );
}

const generateCubes = () => {
  const generated: CubeData[] = [];
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const count = isMobile ? 120 : 400; 
  
  for (let i = 0; i < count; i++) {
    const textureIndex = i % BLOCK_TEXTURES.length;
    
    // Better scale distribution: 50% small, 35% medium, 15% huge
    const rand = Math.random();
    let sizeScale = 1;
    let isSmall = false;
    if (rand < 0.5) {
      sizeScale = Math.random() * 0.3 + 0.2;
      isSmall = true;
    } else if (rand < 0.85) {
      sizeScale = Math.random() * 0.8 + 0.5;
    } else {
      sizeScale = Math.random() * 2.0 + 1.2;
    }

    let finalPos = [0, 0, 0] as [number, number, number];

    for (let attempt = 0; attempt < 40; attempt++) {
      const testPos = [
        (Math.random() - 0.5) * (isMobile ? 35 : 90),
        (Math.random() - 0.5) * (isMobile ? 50 : 50),
        (Math.random() - 0.5) * 45 - 5
      ] as [number, number, number];

      let isValid = true;
      if (!isSmall) {
        for (const existingCube of generated) {
          const dx = existingCube.position[0] - testPos[0];
          const dy = existingCube.position[1] - testPos[1];
          const dz = existingCube.position[2] - testPos[2];
          const distSq = dx * dx + dy * dy + dz * dz;

          const minAllowedDistSq = existingCube.textureIndex === textureIndex ? 18 : 6;
          if (distSq < minAllowedDistSq && existingCube.size[0] > 0.5) {
            isValid = false;
            break;
          }
        }
      }

      if (isValid || attempt === 39) {
        finalPos = testPos;
        break;
      }
    }

    generated.push({
      speed: Math.random() * 2.0 + 0.2,
      rotationIntensity: Math.random() * 2.0,
      floatIntensity: Math.random() * 2.5,
      position: finalPos,
      size: Array(3).fill(sizeScale) as [number, number, number],
      colorType: i % 3,
      textureIndex: textureIndex
    });
  }
  return generated;
};

function CameraRig() {
  const isInitial = React.useRef(true);

  useFrame((state, delta) => {
    if (isInitial.current) {
      // Start the camera far right, high up, and zoomed out to create a dramatic "drop-in" spatial slide
      state.camera.position.set(25, 20, 40);
      isInitial.current = false;
    }

    // Exponential smoothing (lerp) automatically creates a beautiful ease-out sliding effect
    // as it travels from the extreme starting position to the mouse-driven target position.
    const targetX = state.pointer.x * 4;
    const targetY = state.pointer.y * 4;

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, delta * 1.2);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, delta * 1.2);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, 15, delta * 1.2);
    
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function ParticleCubes({ isDark }: { isDark: boolean }) {
  const [cubes] = React.useState(generateCubes);

  return (
    <Canvas 
      camera={{ position: [0, 0, 15], fov: 45 }} 
      gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
    >
      <color attach="background" args={[isDark ? '#0a0a0a' : '#f4f4f5']} />
      <CameraRig />
      <SceneLights isDark={isDark} />
      {isDark && <Stars radius={50} depth={50} count={1200} factor={3} saturation={0} fade speed={1} />}
      <React.Suspense fallback={null}>
        {cubes.map((cube, i) => (
          <MinecraftBlock key={i} cube={cube} isDark={isDark} />
        ))}
      </React.Suspense>
    </Canvas>
  );
}
