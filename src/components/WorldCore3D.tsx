import { useCallback, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useAnimationActivity } from '../hooks/useAnimationActivity';
import { SceneReady } from './SceneReady';
import { useSceneFailureGuard, type SceneLifecycleProps } from './sceneLifecycle';

function CoreGeometry({ isDark, reducedMotion }: { isDark: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  
  // 跟随鼠标产生微小的磁性偏转
  useFrame((state) => {
    if (reducedMotion) return;
    if (group.current) {
      const targetX = state.pointer.y * 0.5;
      const targetY = state.pointer.x * 0.5;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.05);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.05);
    }
  });

  const lineColor = isDark ? '#f0f6fc' : '#0a0a0a';
  const diamondColor = '#00d2d3';
  const amethystColor = '#9b59b6';

  return (
    <group ref={group}>
      <Float speed={reducedMotion ? 0 : 2} rotationIntensity={reducedMotion ? 0 : 1.5} floatIntensity={reducedMotion ? 0 : 1.5}>
        {/* 外层结构：代表 Minecraft 的基础方块系统 */}
        <mesh>
          <boxGeometry args={[3, 3, 3]} />
          <meshBasicMaterial color={lineColor} wireframe transparent opacity={0.05} />
          <Edges color={lineColor} threshold={15} />
        </mesh>
        
        {/* 内层核心 1：代表 Gameplay (钻石青色) */}
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <octahedronGeometry args={[1.2, 0]} />
          <meshBasicMaterial color={diamondColor} wireframe transparent opacity={0.2} />
          <Edges color={diamondColor} />
        </mesh>
        
        {/* 内层核心 2：代表 World Systems (紫水晶色) */}
        <mesh rotation={[-Math.PI / 4, -Math.PI / 4, 0]} scale={0.7}>
          <octahedronGeometry args={[1.2, 0]} />
          <meshBasicMaterial color={amethystColor} wireframe transparent opacity={0.4} />
          <Edges color={amethystColor} />
        </mesh>
      </Float>
    </group>
  );
}

export function WorldCore3D({ isDark, onReady, onUnavailable }: { isDark: boolean } & SceneLifecycleProps) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const { active, reducedMotion, constrained } = useAnimationActivity(container);
  useSceneFailureGuard(container, onUnavailable);
  const markReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);
  return (
    <div ref={container} className="absolute inset-0 z-10 w-full h-full cursor-crosshair pointer-events-auto" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: !constrained }} dpr={constrained ? 1 : [1, 1.5]} frameloop={active && ready && !reducedMotion ? 'always' : 'demand'}>
        <ambientLight intensity={1} />
        <CoreGeometry isDark={isDark} reducedMotion={reducedMotion} />
        <SceneReady onReady={markReady} />
      </Canvas>
    </div>
  );
}
