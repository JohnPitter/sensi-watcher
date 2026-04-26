import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CrosshairShape, type CrosshairStyle } from './Cenario3DUI';
export { CROSSHAIR_OPTIONS, ENEMY_COLORS, CrosshairPreview } from './Cenario3DUI';
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

// Subtle parallax camera that nudges very slightly toward cursor position
// for depth feel — does NOT replace cursor aiming. Click raycast uses cursor.
function ParallaxCamera() {
  const { camera, gl } = useThree();
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetYaw.current = -nx * 0.08;
      targetPitch.current = -ny * 0.05;
    }
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [gl]);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 8);
    yaw.current   += (targetYaw.current   - yaw.current)   * k;
    pitch.current += (targetPitch.current - pitch.current) * k;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
  });

  return null;
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

      <ParallaxCamera />

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
  onHit, onMiss,
}: Cenario3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const [insideCanvas, setInsideCanvas] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function onMove(e: MouseEvent) {
      const ch = crosshairRef.current;
      if (!ch || !wrap) return;
      const r = wrap.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      ch.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    function onEnter() { setInsideCanvas(true); }
    function onLeave() { setInsideCanvas(false); }

    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseenter', onEnter);
    wrap.addEventListener('mouseleave', onLeave);
    return () => {
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseenter', onEnter);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden border border-[rgba(255,255,255,0.1)]"
      style={{
        aspectRatio: '800 / 500',
        background: COL_FOG,
        cursor: insideCanvas ? 'none' : 'default',
      }}
    >
      <Canvas
        camera={{ position: [0, 1.6, 0], fov: 78, near: 0.05, far: 60 }}
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

      {/* Crosshair — follows cursor */}
      <div
        ref={crosshairRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: 22,
          height: 22,
          opacity: insideCanvas ? 1 : 0,
          transition: 'opacity 0.15s',
          willChange: 'transform',
        }}
      >
        <CrosshairShape style={crosshair} accentColor={enemyHead} />
      </div>

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
