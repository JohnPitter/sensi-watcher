import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, RotateCcw, Clock } from 'lucide-react';
import type { Wall3D } from './Cenario3D';
import type { CrosshairStyle, EnemyColorId } from './Cenario3DUI';
import { CROSSHAIR_OPTIONS, ENEMY_COLORS, SENS_PRESETS, CrosshairPreview, CrosshairShape } from './Cenario3DUI';
import { useArenaPointerLock } from '../hooks/useArenaPointerLock';

const Cenario3D = lazy(() => import('./Cenario3D').then(m => ({ default: m.Cenario3D })));

const LS_CROSSHAIR = 'sensiwatch.cenario.crosshair';
const LS_ENEMYCOL  = 'sensiwatch.cenario.enemyColor';
const LS_SENS      = 'sensiwatch.mouse.sens';

type DrillId = 'gridshot' | 'flick' | 'microflick' | 'tracking' | 'cenario';
type Diff = 'easy' | 'medium' | 'hard';
type Phase = 'menu' | 'countdown' | 'playing' | 'results';

interface Tgt {
  id: number;
  x: number;   // virtual px (0..VW) for 2D modes; world X for cenario
  y: number;   // virtual px (0..VH) for 2D modes; ignored for cenario
  z?: number;  // world Z for cenario 3D mode
  r: number;
  born: number;
  vx?: number;
  vy?: number;
}

interface Hit { ms: number; off: number; }
interface Popup { id: number; xp: number; yp: number; pts: number; }

const VW = 800, VH = 500;

const DRILLS: Record<DrillId, { name: string; desc: string; tags: string[] }> = {
  gridshot:   { name: 'Gridshot',    desc: '6 alvos simultâneos. Limpe o grid mais rápido — 30 segundos.', tags: ['VELOCIDADE', 'PADRÃO'] },
  flick:      { name: 'Flick',       desc: 'Um alvo por vez, reaja antes de expirar — 30 alvos.', tags: ['REAÇÃO', 'FLICK'] },
  microflick: { name: 'Micro Flick', desc: 'Alvos minúsculos para precisão extrema — 20 alvos.', tags: ['PRECISÃO', 'MICRO'] },
  tracking:   { name: 'Tracking',    desc: 'Mantenha o cursor sobre o alvo em movimento — 30 segundos.', tags: ['TRACKING', 'CONTROLE'] },
  cenario:    { name: 'Cenário',     desc: 'Inimigos aparecem em ângulos de mapa real. Acerte a cabeça para pontuação máxima — 30s.', tags: ['MAPA', 'HEADSHOT'] },
};

const DIFFS: Record<Diff, {
  label: string; gridR: number; flickR: number; microR: number;
  trackR: number; trackV: number; ttl: number; cenarioR: number; cenarioTTL: number;
}> = {
  easy:   { label: 'Fácil',   gridR: 28, flickR: 26, microR: 12, trackR: 26, trackV: 2.2, ttl: 4000, cenarioR: 22, cenarioTTL: 3200 },
  medium: { label: 'Médio',   gridR: 20, flickR: 18, microR: 7,  trackR: 19, trackV: 3.6, ttl: 2600, cenarioR: 16, cenarioTTL: 2200 },
  hard:   { label: 'Difícil', gridR: 13, flickR: 11, microR: 4,  trackR: 13, trackV: 5.2, ttl: 1600, cenarioR: 11, cenarioTTL: 1400 },
};

const DUR = 30_000, FLICK_N = 30, MICRO_N = 20, CENARIO_N = 30;

// 3D world walls (positions/sizes in meters, x=0 is camera center, -Z = forward)
const WALLS_3D: Wall3D[] = [
  { x: -3.4, z: -8,   w: 1.2, h: 2.6, d: 1.2 },   // left pillar
  { x:  3.4, z: -8,   w: 1.2, h: 2.6, d: 1.2 },   // right pillar
  { x:  0,   z: -7,   w: 2.6, h: 1.3, d: 0.9 },   // center low wall
  { x: -2.6, z: -4.8, w: 0.9, h: 2.0, d: 0.9 },   // bottom-left block
  { x:  2.6, z: -4.8, w: 0.9, h: 2.0, d: 0.9 },   // bottom-right block
];

// 3D peek spots — positions where enemies pop up next to cover edges
const PEEK_SPOTS_3D: { x: number; z: number }[] = [
  { x: -4.3, z: -8   }, { x: -2.5, z: -8   },   // left pillar flanks
  { x:  2.5, z: -8   }, { x:  4.3, z: -8   },   // right pillar flanks
  { x: -1.7, z: -7   }, { x:  1.7, z: -7   },   // center low wall flanks
  { x: -3.3, z: -4.8 }, { x: -1.9, z: -4.8 },   // bottom-left block flanks
  { x:  1.9, z: -4.8 }, { x:  3.3, z: -4.8 },   // bottom-right block flanks
  { x:  0,   z: -5.5 },                          // center open
];

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

function gridPositions(): { x: number; y: number }[] {
  const m = 80, zw = (VW - 2 * m) / 3, zh = (VH - 2 * m) / 2;
  const pts: { x: number; y: number }[] = [];
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++)
      pts.push({ x: m + c * zw + rnd(zw * 0.25, zw * 0.75), y: m + r * zh + rnd(zh * 0.25, zh * 0.75) });
  return pts.sort(() => Math.random() - 0.5);
}

function randPos(margin = 60): { x: number; y: number } {
  return { x: rnd(margin, VW - margin), y: rnd(margin, VH - margin) };
}

function calcScore(ms: number, off: number, drill: DrillId): number {
  const rB = Math.max(0, 1300 - ms);
  if (drill === 'cenario') {
    // headshot zone: inner 35% of radius
    const headshot = off < 0.35;
    return Math.round(rB + (headshot ? 500 : Math.max(0, 200 * (1 - off))));
  }
  const aB = Math.max(0, 200 * (1 - off));
  return Math.round((rB + aB) * (drill === 'microflick' ? 1.5 : 1));
}

function getRating(sc: number, drill: DrillId, diff: Diff): string {
  const T: Record<DrillId, Record<Diff, [number, number, number, number]>> = {
    gridshot:   { easy: [10000, 7000, 4000, 2000], medium: [8000, 5500, 3000, 1500], hard: [5500, 3500, 2000, 1000] },
    flick:      { easy: [9000, 6000, 3500, 1800],  medium: [7000, 4500, 2500, 1200], hard: [5000, 3000, 1500, 800]  },
    microflick: { easy: [6000, 4000, 2500, 1200],  medium: [5000, 3200, 1800, 900],  hard: [3500, 2200, 1200, 600]  },
    tracking:   { easy: [2800, 2000, 1200, 600],   medium: [2200, 1600, 1000, 500],  hard: [1800, 1200, 700, 300]   },
    cenario:    { easy: [11000, 7500, 4500, 2000], medium: [9000, 6000, 3500, 1500], hard: [6500, 4000, 2200, 1000] },
  };
  const [s, a, b, c] = T[drill][diff];
  return sc >= s ? 'S' : sc >= a ? 'A' : sc >= b ? 'B' : sc >= c ? 'C' : 'D';
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-4 border border-[rgba(255,255,255,0.1)]" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span className="font-mono text-[10px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      <span className="font-mono text-[22px] font-light text-white">{value}</span>
    </div>
  );
}

export function AimLab() {
  const [phase, setPhase]     = useState<Phase>('menu');
  const [drill, setDrill]     = useState<DrillId>('gridshot');
  const [diff, setDiff]       = useState<Diff>('medium');
  const [cd, setCd]           = useState(3);
  const [targets, setTargets] = useState<Tgt[]>([]);
  const [score, setScore]     = useState(0);
  const [hits, setHits]       = useState<Hit[]>([]);
  const [misses, setMisses]   = useState(0);
  const [timeLeft, setTL]     = useState(DUR);
  const [cleared, setCleared] = useState(0);
  const [waves, setWaves]     = useState(0);
  const [popups, setPopups]   = useState<Popup[]>([]);
  const [trackPct, setTrackPct] = useState(0);
  const [isOnTarget, setIsOnTarget] = useState(false);
  const [headshots, setHeadshots] = useState(0);

  // Cenario customization (persisted)
  const [crosshair, setCrosshair] = useState<CrosshairStyle>(() => {
    if (typeof window === 'undefined') return 'cross';
    return (localStorage.getItem(LS_CROSSHAIR) as CrosshairStyle) || 'cross';
  });
  const [enemyColor, setEnemyColor] = useState<EnemyColorId>(() => {
    if (typeof window === 'undefined') return 'cyan';
    return (localStorage.getItem(LS_ENEMYCOL) as EnemyColorId) || 'cyan';
  });
  const [mouseSens, setMouseSens] = useState<number>(() => {
    if (typeof window === 'undefined') return 1.0;
    const v = parseFloat(localStorage.getItem(LS_SENS) || '1');
    return isFinite(v) && v > 0 ? v : 1.0;
  });
  useEffect(() => { localStorage.setItem(LS_CROSSHAIR, crosshair); }, [crosshair]);
  useEffect(() => { localStorage.setItem(LS_ENEMYCOL, enemyColor); }, [enemyColor]);
  useEffect(() => { localStorage.setItem(LS_SENS, String(mouseSens)); }, [mouseSens]);
  const enemyPreset = ENEMY_COLORS.find(c => c.id === enemyColor) ?? ENEMY_COLORS[0];

  const hsRef = useRef(0);

  const arenaRef    = useRef<HTMLDivElement>(null);
  const rAF         = useRef(0);
  const timerI      = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const expireI     = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const nid         = useRef(1);
  const mouse       = useRef({ x: VW / 2, y: VH / 2 });
  const prevOnTgt   = useRef(false);

  // Mutable game-state refs to avoid stale closures in loops
  const sRef  = useRef(0);
  const hRef  = useRef<Hit[]>([]);
  const mRef  = useRef(0);
  const tRef  = useRef<Tgt[]>([]);
  const clRef = useRef(0);
  const wvRef = useRef(0);
  const tfRef = useRef({ total: 0, on: 0 });
  const game  = useRef<{ drill: DrillId; diff: Diff; cfg: typeof DIFFS[Diff] } | null>(null);

  const setTgts = useCallback((ts: Tgt[]) => {
    tRef.current = ts;
    setTargets(ts);
  }, []);

  const popPts = useCallback((pts: number, cx: number, cy: number) => {
    const ar = arenaRef.current;
    if (!ar) return;
    const rc = ar.getBoundingClientRect();
    const xp = ((cx - rc.left) / rc.width) * 100;
    const yp = ((cy - rc.top) / rc.height) * 100;
    const id = performance.now() + Math.random();
    setPopups(p => [...p, { id, xp, yp, pts }]);
    setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 700);
  }, []);

  const finish = useCallback(() => {
    cancelAnimationFrame(rAF.current);
    clearInterval(timerI.current);
    clearInterval(expireI.current);
    setPhase('results');
  }, []);

  const cancelGame = useCallback(() => {
    cancelAnimationFrame(rAF.current);
    clearInterval(timerI.current);
    clearInterval(expireI.current);
    setPhase('menu');
  }, []);

  const spawnGrid = useCallback(() => {
    const cfg = game.current!.cfg;
    const now = Date.now();
    const ts: Tgt[] = gridPositions().map(p => ({ id: nid.current++, x: p.x, y: p.y, r: cfg.gridR, born: now }));
    setTgts(ts);
  }, [setTgts]);

  const spawnFlick = useCallback((px?: number, py?: number) => {
    const g = game.current!;
    const r = g.drill === 'microflick' ? g.cfg.microR : g.cfg.flickR;
    let pos: { x: number; y: number };
    do { pos = randPos(r + 30); } while (
      px !== undefined && Math.abs(pos.x - px) < 150 && Math.abs(pos.y - (py ?? 0)) < 100
    );
    const t: Tgt = { id: nid.current++, x: pos.x, y: pos.y, r, born: Date.now() };
    setTgts([t]);
  }, [setTgts]);

  const spawnTrack = useCallback(() => {
    const cfg = game.current!.cfg;
    const angle = rnd(0, Math.PI * 2);
    const t: Tgt = {
      id: nid.current++,
      x: rnd(100, VW - 100), y: rnd(100, VH - 100),
      r: cfg.trackR, born: Date.now(),
      vx: Math.cos(angle) * cfg.trackV, vy: Math.sin(angle) * cfg.trackV,
    };
    setTgts([t]);
  }, [setTgts]);

  const spawnCenarioTargets = useCallback((existing: Tgt[], total: number): Tgt[] => {
    const occupiedKeys = new Set(existing.map(t => `${t.x},${t.z}`));
    const available = PEEK_SPOTS_3D.filter(s => !occupiedKeys.has(`${s.x},${s.z}`));
    const pool = available.length > 0 ? available : PEEK_SPOTS_3D;
    const needed = Math.min(2 - existing.length, CENARIO_N - total);
    const result = [...existing];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < needed && i < shuffled.length; i++) {
      result.push({ id: nid.current++, x: shuffled[i].x, y: 0, z: shuffled[i].z, r: 1, born: Date.now() });
    }
    tRef.current = result;
    setTargets(result);
    return result;
  }, []);

  const startGame = useCallback(() => {
    game.current = { drill, diff, cfg: DIFFS[diff] };
    setTgts([]);
    setScore(0); setHits([]); setMisses(0); setTL(DUR);
    setCleared(0); setWaves(0); setPopups([]); setTrackPct(0); setIsOnTarget(false);
    setHeadshots(0);
    sRef.current = 0; hRef.current = []; mRef.current = 0; clRef.current = 0;
    wvRef.current = 0; tfRef.current = { total: 0, on: 0 }; nid.current = 1; hsRef.current = 0;
    setCd(3);
    setPhase('countdown');
    let c = 3;
    const iv = setInterval(() => {
      c--;
      setCd(c);
      if (c <= 0) { clearInterval(iv); setPhase('playing'); }
    }, 800);
  }, [drill, diff, setTgts]);

  // Initialize and run timers when phase becomes 'playing'
  useEffect(() => {
    if (phase !== 'playing') return;
    const g = game.current!;

    if (g.drill === 'gridshot') spawnGrid();
    else if (g.drill === 'flick' || g.drill === 'microflick') spawnFlick();
    else if (g.drill === 'cenario') spawnCenarioTargets([], 0);
    else spawnTrack();

    if (g.drill === 'gridshot' || g.drill === 'tracking' || g.drill === 'cenario') {
      const t0 = Date.now();
      timerI.current = setInterval(() => {
        const rem = Math.max(0, DUR - (Date.now() - t0));
        setTL(rem);
        if (rem <= 0) { clearInterval(timerI.current); finish(); }
      }, 50);
    }

    if (g.drill === 'flick' || g.drill === 'microflick') {
      expireI.current = setInterval(() => {
        const now = Date.now();
        const tgt = tRef.current[0];
        if (tgt && now - tgt.born >= g.cfg.ttl) {
          mRef.current++;
          setMisses(m => m + 1);
          const maxN = g.drill === 'microflick' ? MICRO_N : FLICK_N;
          const newCl = clRef.current + 1;
          clRef.current = newCl;
          setCleared(newCl);
          if (newCl >= maxN) { clearInterval(expireI.current); finish(); }
          else spawnFlick();
        }
      }, 60);
    }

    if (g.drill === 'cenario') {
      expireI.current = setInterval(() => {
        const now = Date.now();
        const expired = tRef.current.filter(t => now - t.born >= g.cfg.cenarioTTL);
        if (expired.length > 0) {
          const surviving = tRef.current.filter(t => now - t.born < g.cfg.cenarioTTL);
          mRef.current += expired.length;
          setMisses(m => m + expired.length);
          const newCl = clRef.current + expired.length;
          clRef.current = newCl;
          setCleared(newCl);
          spawnCenarioTargets(surviving, newCl);
        }
      }, 60);
    }

    return () => {
      clearInterval(timerI.current);
      clearInterval(expireI.current);
      cancelAnimationFrame(rAF.current);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracking animation loop
  useEffect(() => {
    if (phase !== 'playing' || game.current?.drill !== 'tracking') return;

    function loop() {
      const updated = tRef.current.map(t => {
        let nx = t.x + (t.vx ?? 0);
        let ny = t.y + (t.vy ?? 0);
        let nvx = t.vx ?? 0, nvy = t.vy ?? 0;
        if (nx < t.r || nx > VW - t.r) { nvx = -nvx; nx = Math.max(t.r, Math.min(VW - t.r, nx)); }
        if (ny < t.r || ny > VH - t.r) { nvy = -nvy; ny = Math.max(t.r, Math.min(VH - t.r, ny)); }
        return { ...t, x: nx, y: ny, vx: nvx, vy: nvy };
      });
      tRef.current = updated;
      setTargets(updated);

      const t = updated[0];
      if (t) {
        tfRef.current.total++;
        const dist = Math.sqrt((mouse.current.x - t.x) ** 2 + (mouse.current.y - t.y) ** 2);
        const on = dist < t.r;
        if (on !== prevOnTgt.current) {
          prevOnTgt.current = on;
          setIsOnTarget(on);
        }
        if (on) {
          tfRef.current.on++;
          sRef.current += 3;
          setScore(s => s + 3);
          if (tfRef.current.total % 10 === 0) {
            setTrackPct(Math.round((tfRef.current.on / tfRef.current.total) * 100));
          }
        }
      }

      rAF.current = requestAnimationFrame(loop);
    }

    rAF.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rAF.current);
  }, [phase]);

  const handleHit = useCallback((tgt: Tgt, e: React.MouseEvent, cenarioHead?: boolean) => {
    e.stopPropagation();
    const g = game.current!;
    const ms = Date.now() - tgt.born;
    let pts: number;
    let off: number;

    if (g.drill === 'cenario') {
      const isHead = cenarioHead === true;
      const rB = Math.max(0, 1300 - ms);
      pts = Math.round(rB + (isHead ? 700 : 120));
      off = isHead ? 0 : 0.7;
      if (isHead) { hsRef.current++; setHeadshots(h => h + 1); }
    } else {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      off = Math.min(1, Math.sqrt(dx * dx + dy * dy) / tgt.r);
      pts = calcScore(ms, off, g.drill);
    }

    sRef.current += pts;
    setScore(s => s + pts);
    const nh = [...hRef.current, { ms, off }];
    hRef.current = nh;
    setHits(nh);
    popPts(pts, e.clientX, e.clientY);

    if (g.drill === 'gridshot') {
      const rem = tRef.current.filter(t => t.id !== tgt.id);
      tRef.current = rem;
      setTargets(rem);
      if (rem.length === 0) {
        wvRef.current++;
        setWaves(w => w + 1);
        spawnGrid();
      }
    } else if (g.drill === 'cenario') {
      const surviving = tRef.current.filter(t => t.id !== tgt.id);
      const newCl = clRef.current + 1;
      clRef.current = newCl;
      setCleared(newCl);
      spawnCenarioTargets(surviving, newCl);
    } else {
      const maxN = g.drill === 'microflick' ? MICRO_N : FLICK_N;
      const newCl = clRef.current + 1;
      clRef.current = newCl;
      setCleared(newCl);
      if (newCl >= maxN) { clearInterval(expireI.current); finish(); }
      else spawnFlick(tgt.x, tgt.y);
    }
  }, [popPts, spawnGrid, spawnFlick, spawnCenarioTargets, finish]);

  const handleMiss = useCallback((e: React.MouseEvent) => {
    if (phase !== 'playing') return;
    const g = game.current;
    if (!g || (g.drill !== 'flick' && g.drill !== 'microflick' && g.drill !== 'cenario')) return;
    if ((e.target as HTMLElement) !== arenaRef.current) return;
    mRef.current++;
    setMisses(m => m + 1);
  }, [phase]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const ar = arenaRef.current;
    if (!ar) return;
    const rc = ar.getBoundingClientRect();
    mouse.current = {
      x: ((e.clientX - rc.left) / rc.width) * VW,
      y: ((e.clientY - rc.top) / rc.height) * VH,
    };
  }, []);

  // Pointer lock for 2D arena (gridshot / flick / microflick / tracking).
  // Cenario3D has its own internal pointer lock since the arena lives there.
  const arena2DActive = phase === 'playing' && game.current?.drill !== 'cenario';
  const { isLocked: arena2DLocked, cursorRef: arena2DCursorRef } = useArenaPointerLock({
    arenaRef,
    sensitivity: mouseSens,
    active: arena2DActive,
    onMove: (vx, vy, w, h) => {
      // Feed virtual cursor into mouse.current so the tracking drill sees it
      mouse.current = { x: (vx / w) * VW, y: (vy / h) * VH };
    },
  });

  // 3D cenario: hit comes from Three.js scene with screen coords for popup
  const handleCenario3DHit = useCallback((tgt: { id: number; x: number; z: number; born: number }, isHead: boolean, sx: number, sy: number) => {
    const realTgt = tRef.current.find(t => t.id === tgt.id);
    if (!realTgt) return;
    const ms = Date.now() - realTgt.born;
    const rB = Math.max(0, 1300 - ms);
    const pts = Math.round(rB + (isHead ? 700 : 120));

    if (isHead) { hsRef.current++; setHeadshots(h => h + 1); }
    sRef.current += pts;
    setScore(s => s + pts);
    const off = isHead ? 0 : 0.7;
    const nh = [...hRef.current, { ms, off }];
    hRef.current = nh;
    setHits(nh);
    popPts(pts, sx, sy);

    const surviving = tRef.current.filter(t => t.id !== tgt.id);
    const newCl = clRef.current + 1;
    clRef.current = newCl;
    setCleared(newCl);
    spawnCenarioTargets(surviving, newCl);
  }, [popPts, spawnCenarioTargets]);

  const handleCenario3DMiss = useCallback(() => {
    if (game.current?.drill !== 'cenario') return;
    mRef.current++;
    setMisses(m => m + 1);
  }, []);

  const g = game.current;
  const totalShots = hits.length + misses;
  const accuracy = totalShots > 0 ? Math.round((hits.length / totalShots) * 100) : 0;
  const avgMs = hits.length > 0 ? Math.round(hits.reduce((s, h) => s + h.ms, 0) / hits.length) : 0;
  const maxN = g?.drill === 'microflick' ? MICRO_N : FLICK_N;
  const progress = (g?.drill === 'flick' || g?.drill === 'microflick')
    ? cleared / maxN
    : (DUR - timeLeft) / DUR;
  const rat = phase === 'results' && g ? getRating(score, g.drill, g.diff) : '';

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <Target size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <h2 className="font-mono text-[14px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Treino de Mira
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {/* MENU */}
        {phase === 'menu' && (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Modo</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(Object.entries(DRILLS) as [DrillId, typeof DRILLS[DrillId]][]).map(([id, d]) => (
                  <button
                    key={id}
                    onClick={() => setDrill(id)}
                    className="flex flex-col gap-3 p-5 border text-left transition-all"
                    style={{
                      borderColor: drill === id ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)',
                      background: drill === id ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span className="font-mono text-[13px] uppercase tracking-[1.4px] text-white">{d.name}</span>
                    <span className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{d.desc}</span>
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {d.tags.map(tag => (
                        <span key={tag} className="font-mono text-[9px] px-2 py-0.5 border border-[rgba(255,255,255,0.12)]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Dificuldade</span>
              <div className="flex gap-2">
                {(Object.entries(DIFFS) as [Diff, typeof DIFFS[Diff]][]).map(([id, d]) => (
                  <button
                    key={id}
                    onClick={() => setDiff(id)}
                    className="font-mono text-[12px] uppercase tracking-[1.4px] px-5 py-2.5 border transition-all"
                    style={{
                      borderColor: diff === id ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
                      color: diff === id ? '#fff' : 'rgba(255,255,255,0.4)',
                      background: diff === id ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sensibilidade (global, all modes) */}
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Sensibilidade do Mouse
              </span>
              <div className="flex gap-2 flex-wrap">
                {SENS_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setMouseSens(p.value)}
                    className="font-mono text-[12px] uppercase tracking-[1.4px] px-4 py-2.5 border transition-all"
                    style={{
                      borderColor: mouseSens === p.value ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
                      color: mouseSens === p.value ? '#fff' : 'rgba(255,255,255,0.4)',
                      background: mouseSens === p.value ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Multiplicador aplicado via pointer lock — afeta todos os modos.
              </span>
            </div>

            {/* Mira (global, all modes) */}
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Mira</span>
              <div className="flex gap-2 flex-wrap">
                {CROSSHAIR_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setCrosshair(opt.id)}
                    className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[1.4px] px-3 py-2 border transition-all"
                    style={{
                      borderColor: crosshair === opt.id ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
                      color: crosshair === opt.id ? '#fff' : 'rgba(255,255,255,0.4)',
                      background: crosshair === opt.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <CrosshairPreview style={opt.id} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cor dos inimigos — só faz sentido no Cenário 3D */}
            {drill === 'cenario' && (
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Cor dos Inimigos</span>
                <div className="flex gap-2 flex-wrap">
                  {ENEMY_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setEnemyColor(c.id)}
                      className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[1.4px] px-3 py-2 border transition-all"
                      style={{
                        borderColor: enemyColor === c.id ? c.head : 'rgba(255,255,255,0.1)',
                        color: enemyColor === c.id ? '#fff' : 'rgba(255,255,255,0.4)',
                        background: enemyColor === c.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                      }}
                    >
                      <span
                        className="rounded-full"
                        style={{
                          width: 14, height: 14,
                          background: c.head,
                          boxShadow: enemyColor === c.id ? `0 0 8px ${c.head}` : 'none',
                        }}
                      />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startGame}
              className="font-mono text-[14px] uppercase tracking-[1.4px] px-8 py-3 bg-white text-[#1f2228] hover:opacity-90 transition-opacity self-start"
            >
              Iniciar Treino
            </button>
          </motion.div>
        )}

        {/* COUNTDOWN */}
        {phase === 'countdown' && (
          <motion.div key="cd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-24">
            <AnimatePresence mode="wait">
              {cd > 0 && (
                <motion.span
                  key={cd}
                  initial={{ opacity: 0, scale: 2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono text-[80px] font-light text-white"
                >
                  {cd}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && (
          <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            {/* HUD */}
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <div className="flex items-center gap-5">
                <span>Score: <span className="text-white">{score.toLocaleString()}</span></span>
                {g?.drill === 'tracking' && <span>Na mira: <span className="text-white">{trackPct}%</span></span>}
                {(g?.drill === 'flick' || g?.drill === 'microflick') && (
                  <span>Alvos: <span className="text-white">{cleared}/{maxN}</span></span>
                )}
                {g?.drill === 'gridshot' && <span>Waves: <span className="text-white">{waves}</span></span>}
                {g?.drill === 'cenario' && <span>HS: <span className="text-white">{headshots}</span></span>}
              </div>
              <div className="flex items-center gap-4">
                {(g?.drill === 'gridshot' || g?.drill === 'tracking' || g?.drill === 'cenario') && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={11} />
                    {(timeLeft / 1000).toFixed(1)}s
                  </span>
                )}
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>{g?.diff ? DIFFS[g.diff].label : ''}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div className="h-full bg-white" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.1 }} />
            </div>

            {/* Arena — 3D for cenario, 2D for everything else */}
            {g?.drill === 'cenario' ? (
              <div ref={arenaRef} className="relative w-full">
                <Suspense fallback={
                  <div className="flex items-center justify-center border border-[rgba(255,255,255,0.1)]" style={{ aspectRatio: '800 / 500', background: '#0a0e15' }}>
                    <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Carregando 3D…</span>
                  </div>
                }>
                  <Cenario3D
                    targets={targets.filter(t => t.z !== undefined).map(t => ({ id: t.id, x: t.x, z: t.z!, born: t.born }))}
                    walls={WALLS_3D}
                    ttl={g.cfg.cenarioTTL}
                    crosshair={crosshair}
                    enemyHead={enemyPreset.head}
                    enemyBody={enemyPreset.body}
                    sensitivity={mouseSens}
                    onHit={handleCenario3DHit}
                    onMiss={handleCenario3DMiss}
                  />
                </Suspense>
                {/* Score popups overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <AnimatePresence>
                    {popups.map(p => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 0, y: -28 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.65 }}
                        className="absolute font-mono text-[12px] font-bold pointer-events-none select-none"
                        style={{
                          left: `${p.xp}%`,
                          top: `${p.yp}%`,
                          color: p.pts > 1500 ? 'rgba(80,215,235,1)' : p.pts > 900 ? '#fff' : 'rgba(255,255,255,0.7)',
                          textShadow: '0 0 8px rgba(0,0,0,0.6)',
                        }}
                      >
                        +{p.pts}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
            <div
              ref={arenaRef}
              onClick={handleMiss}
              onMouseMove={handleMouseMove}
              className="relative overflow-hidden select-none border border-[rgba(255,255,255,0.1)]"
              style={{
                width: '100%',
                aspectRatio: `${VW} / ${VH}`,
                background: 'rgba(255,255,255,0.02)',
                cursor: arena2DLocked ? 'none' : 'crosshair',
              }}
            >
              {/* Grid lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.035 }}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <line key={`v${i}`} x1={`${(i + 1) * 10}%`} y1="0%" x2={`${(i + 1) * 10}%`} y2="100%" stroke="white" strokeWidth="1" />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`h${i}`} x1="0%" y1={`${(i + 1) * 16.67}%`} x2="100%" y2={`${(i + 1) * 16.67}%`} stroke="white" strokeWidth="1" />
                ))}
              </svg>

              {/* Virtual cursor (driven by useArenaPointerLock when locked) */}
              <div
                ref={arena2DCursorRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: 22, height: 22,
                  opacity: arena2DLocked ? 1 : 0,
                  transition: 'opacity 0.15s',
                  willChange: 'transform',
                  zIndex: 5,
                }}
              >
                <CrosshairShape style={crosshair} accentColor={enemyPreset.head} />
              </div>

              {/* "CLIQUE PARA APONTAR" overlay when not locked */}
              {!arena2DLocked && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(31,34,40,0.55)', zIndex: 4 }}>
                  <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Clique para apontar · ESC para sair · sens {mouseSens}×
                  </span>
                </div>
              )}

              {/* Targets */}
              <AnimatePresence>
                {targets.map(tgt => {
                  const aW = arenaRef.current?.clientWidth ?? VW;
                  const aH = arenaRef.current?.clientHeight ?? VH;
                  const scaleF = Math.min(aW / VW, aH / VH);
                  const scaledR = tgt.r * scaleF;
                  const isTracking = g?.drill === 'tracking';
                  const ttl = g?.cfg.ttl ?? 2600;
                  const lifeFrac = isTracking ? 1 : Math.max(0, 1 - (Date.now() - tgt.born) / ttl);
                  const circ = Math.PI * scaledR * 1.8;

                  return (
                    <motion.div
                      key={tgt.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                      onClick={isTracking ? undefined : (e) => handleHit(tgt, e)}
                      className={`absolute rounded-full ${isTracking ? '' : 'cursor-pointer'}`}
                      style={{
                        left: `${(tgt.x / VW) * 100}%`,
                        top: `${(tgt.y / VH) * 100}%`,
                        width: scaledR * 2,
                        height: scaledR * 2,
                        transform: 'translate(-50%, -50%)',
                        background: isTracking
                          ? (isOnTarget ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)')
                          : 'rgba(255,255,255,0.92)',
                        border: isTracking ? `1.5px solid rgba(255,255,255,${isOnTarget ? '0.7' : '0.35'})` : 'none',
                        boxShadow: isTracking
                          ? (isOnTarget ? '0 0 18px rgba(255,255,255,0.35)' : '0 0 8px rgba(255,255,255,0.08)')
                          : '0 0 20px rgba(255,255,255,0.1)',
                        transition: isTracking ? 'box-shadow 0.1s, background 0.1s, border-color 0.1s' : undefined,
                      }}
                    >
                      {!isTracking && (
                        <>
                          <div className="absolute rounded-full" style={{ inset: '28%', border: '1.5px solid #1f2228', opacity: 0.4 }} />
                          <div className="absolute rounded-full" style={{ width: 4, height: 4, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#1f2228' }} />
                          <svg className="absolute inset-0 w-full h-full -rotate-90" style={{ opacity: 0.3 }}>
                            <circle
                              cx="50%" cy="50%" r="45%"
                              fill="none" stroke="#1f2228" strokeWidth="2"
                              strokeDasharray={circ}
                              strokeDashoffset={circ * (1 - lifeFrac)}
                            />
                          </svg>
                        </>
                      )}
                      {isTracking && (
                        <div className="absolute rounded-full" style={{ width: 6, height: 6, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(255,255,255,0.8)' }} />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Score popups */}
              <AnimatePresence>
                {popups.map(p => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -28 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.65 }}
                    className="absolute font-mono text-[11px] font-bold pointer-events-none select-none"
                    style={{
                      left: `${p.xp}%`,
                      top: `${p.yp}%`,
                      color: p.pts > 1500 ? 'rgba(80,215,235,1)' : p.pts > 900 ? '#fff' : 'rgba(255,255,255,0.55)',
                    }}
                  >
                    +{p.pts}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            )}

            {/* Live stats */}
            {(hits.length > 0 || misses > 0) && (
              <div className="flex justify-center gap-6 font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {totalShots > 0 && <span>Precisão: {accuracy}%</span>}
                {avgMs > 0 && <span>Reação: {avgMs}ms</span>}
                {g?.drill === 'tracking' && tfRef.current.total > 0 && <span>Na mira: {trackPct}%</span>}
              </div>
            )}

            <button
              onClick={cancelGame}
              className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.4px] self-start hover:opacity-50 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <RotateCcw size={11} /> Cancelar
            </button>
          </motion.div>
        )}

        {/* RESULTS */}
        {phase === 'results' && g && (
          <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
            <div className="flex flex-col items-center gap-4 py-10 border border-[rgba(255,255,255,0.15)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {DRILLS[g.drill].name} · {DIFFS[g.diff].label}
              </span>
              <div className="flex items-end gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="text-center"
                >
                  <div className="font-mono text-[60px] sm:text-[80px] font-light text-white leading-none">
                    {score.toLocaleString()}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[1.4px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Pontos
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
                  className="font-mono text-[48px] sm:text-[64px] font-light pb-2"
                  style={{
                    color: rat === 'S' ? '#fff' : rat === 'A' ? 'rgba(255,255,255,0.82)' : rat === 'B' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  {rat}
                </motion.div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(g.drill === 'flick' || g.drill === 'microflick') && (
                <>
                  <StatCard label="Precisão" value={`${accuracy}%`} />
                  <StatCard label="Reação Média" value={hits.length > 0 ? `${avgMs}ms` : '—'} />
                  <StatCard label="Acertos" value={`${hits.length}/${maxN}`} />
                  <StatCard label="Erros" value={String(misses)} />
                </>
              )}
              {g.drill === 'gridshot' && (
                <>
                  <StatCard label="Waves" value={String(waves)} />
                  <StatCard label="Alvos" value={String(hits.length)} />
                  <StatCard label="Precisão" value={`${accuracy}%`} />
                  <StatCard label="Reação Média" value={hits.length > 0 ? `${avgMs}ms` : '—'} />
                </>
              )}
              {g.drill === 'tracking' && (
                <>
                  <StatCard label="Na Mira" value={`${trackPct}%`} />
                  <StatCard label="Score/seg" value={Math.round(score / 30).toLocaleString()} />
                  <StatCard label="Dificuldade" value={DIFFS[g.diff].label} />
                  <StatCard label="Duração" value="30s" />
                </>
              )}
              {g.drill === 'cenario' && (
                <>
                  <StatCard label="Headshots" value={String(headshots)} />
                  <StatCard label="Precisão" value={`${accuracy}%`} />
                  <StatCard label="Reação Média" value={hits.length > 0 ? `${avgMs}ms` : '—'} />
                  <StatCard label="HS Rate" value={hits.length > 0 ? `${Math.round((headshots / hits.length) * 100)}%` : '—'} />
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={startGame}
                className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[1.4px] px-6 py-3 bg-white text-[#1f2228] hover:opacity-90 transition-opacity"
              >
                <RotateCcw size={14} /> Jogar Novamente
              </button>
              <button
                onClick={() => setPhase('menu')}
                className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[1.4px] px-6 py-3 border border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              >
                Mudar Modo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
