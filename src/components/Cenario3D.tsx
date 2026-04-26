import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { CrosshairShape, type CrosshairStyle } from './Cenario3DUI';
import { useArenaPointerLock } from '../hooks/useArenaPointerLock';
export { CROSSHAIR_OPTIONS, ENEMY_COLORS, CrosshairPreview, SENS_PRESETS } from './Cenario3DUI';
export type { CrosshairStyle, EnemyColorId } from './Cenario3DUI';

export interface Tgt3D {
  id: number;
  x: number;
  z: number;
  born: number;
}

export interface Wall3D {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

interface Cenario3DProps {
  targets: Tgt3D[];
  walls: Wall3D[];
  ttl: number;
  paused?: boolean;
  crosshair?: CrosshairStyle;
  enemyHead?: string;
  enemyBody?: string;
  sensitivity?: number;
  onHit: (tgt: Tgt3D, isHead: boolean, screenX: number, screenY: number) => void;
  onMiss: () => void;
}

// Design-system palette (defaults)
const COL_FLOOR    = '#0d121a';
const COL_FLOOR_HI = '#1a2330';
const COL_GRID     = '#1c2a3a';
const COL_WALL     = '#2a3045';
const COL_WALL_TOP = '#4a5575';
const COL_HEAD_DEF = '#50d7eb';
const COL_BODY_DEF = '#3cb9d2';
const COL_FOG      = '#0a0e15';

function Wall({ x, z, w, h, d }: Wall3D) {
  return (
    <group position={[x, 0, z]}>
      {/* Main body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={COL_WALL} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Top edge highlight (gives "3D block" look like the design system covers) */}
      <mesh position={[0, h, 0]}>
        <boxGeometry args={[w + 0.01, 0.04, d + 0.01]} />
        <meshStandardMaterial color={COL_WALL_TOP} emissive={COL_WALL_TOP} emissiveIntensity={0.4} />
      </mesh>
      {/* Subtle vertical edge accents */}
      <lineSegments position={[0, h / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color={COL_WALL_TOP} transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

interface HumanoidProps {
  tgt: Tgt3D;
  ttl: number;
  headColor: string;
  bodyColor: string;
  onHit: (tgt: Tgt3D, isHead: boolean, screenX: number, screenY: number) => void;
}

function Humanoid({ tgt, ttl, headColor, bodyColor, onHit }: HumanoidProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const [hover, setHover] = useState<'head' | 'body' | null>(null);

  useFrame(() => {
    const ageMs = Date.now() - tgt.born;
    const elapsed = ageMs / ttl;
    const popFrac = Math.min(1, ageMs / 220);
    const popY = 1 - Math.pow(1 - popFrac, 3);

    if (groupRef.current) {
      groupRef.current.position.y = -0.9 * (1 - popY);
    }

    let op = popY;
    if (elapsed > 0.72) {
      const blink = Math.sin((elapsed - 0.72) * 70) > 0 ? 1 : 0.45;
      op *= blink;
    }
    if (headMatRef.current) headMatRef.current.opacity = op;
    if (bodyMatRef.current) bodyMatRef.current.opacity = op;
    if (ringMatRef.current) ringMatRef.current.opacity = op * 0.2;

    if (headMatRef.current) headMatRef.current.emissiveIntensity = hover === 'head' ? 1.2 : 0.7;
    if (bodyMatRef.current) bodyMatRef.current.emissiveIntensity = hover === 'body' ? 0.6 : 0.32;
  });

  const handleHeadClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onHit(tgt, true, (e as unknown as MouseEvent).clientX, (e as unknown as MouseEvent).clientY);
  };
  const handleBodyClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onHit(tgt, false, (e as unknown as MouseEvent).clientX, (e as unknown as MouseEvent).clientY);
  };

  return (
    <group ref={groupRef} position={[tgt.x, 0, tgt.z]}>
      {/* Head */}
      <mesh
        position={[0, 1.72, 0]}
        onClick={handleHeadClick}
        onPointerOver={() => setHover('head')}
        onPointerOut={() => setHover(null)}
      >
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial
          ref={headMatRef}
          color={headColor}
          emissive={headColor}
          transparent
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* Body */}
      <mesh
        position={[0, 0.9, 0]}
        onClick={handleBodyClick}
        onPointerOver={() => setHover('body')}
        onPointerOut={() => setHover(null)}
      >
        <capsuleGeometry args={[0.22, 0.85, 6, 16]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color={bodyColor}
          emissive={bodyColor}
          transparent
          roughness={0.5}
          metalness={0.15}
        />
      </mesh>

      {/* Ground glow ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.34, 24]} />
        <meshBasicMaterial ref={ringMatRef} color={headColor} transparent />
      </mesh>
    </group>
  );
}

interface SceneProps {
  targets: Tgt3D[];
  walls: Wall3D[];
  ttl: number;
  headColor: string;
  bodyColor: string;
  onHit: (tgt: Tgt3D, isHead: boolean, screenX: number, screenY: number) => void;
}

function Scene({ targets, walls, ttl, headColor, bodyColor, onHit }: SceneProps) {
  return (
    <>
      <color attach="background" args={[COL_FOG]} />
      <fog attach="fog" args={[COL_FOG, 6, 22]} />

      {/* Ambient + key light */}
      <ambientLight intensity={0.45} color="#6b8aab" />
      <directionalLight
        position={[6, 12, -2]}
        intensity={0.75}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 4, -7]} intensity={0.4} color={headColor} distance={14} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={COL_FLOOR} roughness={0.95} />
      </mesh>

      {/* Floor grid (matches design system grid lines) */}
      <gridHelper
        args={[40, 40, COL_GRID, COL_GRID]}
        position={[0, 0.001, 0]}
      />

      {/* Far back wall */}
      <mesh position={[0, 3, -14]}>
        <boxGeometry args={[40, 6, 0.4]} />
        <meshStandardMaterial color={COL_WALL} roughness={0.9} />
      </mesh>
      {/* Side walls (subtle) */}
      <mesh position={[-12, 3, -7]}>
        <boxGeometry args={[0.4, 6, 14]} />
        <meshStandardMaterial color={COL_WALL} roughness={0.9} />
      </mesh>
      <mesh position={[12, 3, -7]}>
        <boxGeometry args={[0.4, 6, 14]} />
        <meshStandardMaterial color={COL_WALL} roughness={0.9} />
      </mesh>
      {/* Ceiling-ish horizon panel for depth */}
      <mesh position={[0, 6, -7]}>
        <boxGeometry args={[24, 0.05, 14]} />
        <meshStandardMaterial color={COL_FLOOR_HI} transparent opacity={0.15} />
      </mesh>

      {/* Cover walls */}
      {walls.map((w, i) => <Wall key={i} {...w} />)}

      {/* Targets */}
      {targets.map(t => <Humanoid key={t.id} tgt={t} ttl={ttl} headColor={headColor} bodyColor={bodyColor} onHit={onHit} />)}
    </>
  );
}

export function Cenario3D({
  targets, walls, ttl,
  crosshair = 'cross',
  enemyHead = COL_HEAD_DEF,
  enemyBody = COL_BODY_DEF,
  sensitivity = 1.0,
  onHit, onMiss,
}: Cenario3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const { isLocked, cursorRef, requestLock } = useArenaPointerLock({
    arenaRef: wrapRef,
    sensitivity,
    active: true,
  });

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden border border-[rgba(255,255,255,0.1)]"
      style={{
        aspectRatio: '800 / 500',
        background: COL_FOG,
        cursor: isLocked ? 'none' : 'default',
      }}
    >
      <Canvas
        camera={{ position: [0, 1.6, 0], fov: 78, near: 0.05, far: 60 }}
        onCreated={({ camera }) => {
          // Make the camera look forward (-Z) instead of R3F's default lookAt(0,0,0)
          // which from (0, 1.6, 0) ends up looking straight down at the floor.
          camera.rotation.set(0, 0, 0);
        }}
        onPointerMissed={() => onMiss()}
        gl={{ antialias: true, alpha: false }}
        shadows
        dpr={[1, 2]}
      >
        <Scene
          targets={targets}
          walls={walls}
          ttl={ttl}
          headColor={enemyHead}
          bodyColor={enemyBody}
          onHit={onHit}
        />
      </Canvas>

      {/* Custom crosshair — driven by useArenaPointerLock when locked */}
      <div
        ref={cursorRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: 22,
          height: 22,
          opacity: isLocked ? 1 : 0,
          transition: 'opacity 0.15s',
          willChange: 'transform',
          zIndex: 5,
        }}
      >
        <CrosshairShape style={crosshair} accentColor={enemyHead} />
      </div>

      {/* "CLIQUE PARA APONTAR" overlay when not locked */}
      {!isLocked && (
        <button
          type="button"
          onClick={requestLock}
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(10,14,21,0.2)', zIndex: 10, border: 'none' }}
        >
          <span
            className="font-mono text-[12px] uppercase tracking-[1.4px] px-4 py-2.5 border border-[rgba(255,255,255,0.2)]"
            style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(10,14,21,0.85)' }}
          >
            Clique para apontar · sens {sensitivity}× · ESC para sair
          </span>
        </button>
      )}

      {/* Bottom-corner mode labels */}
      <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[1.4px] pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }}>
        3D · CENÁRIO
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[1.4px] pointer-events-none" style={{ color: enemyHead, opacity: 0.55 }}>
        HEAD = 700pts
      </div>
    </div>
  );
}
