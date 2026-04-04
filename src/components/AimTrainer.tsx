import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AimTarget {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  dx: number;
  dy: number;
  spawnedAt: number;
}

interface HitResult {
  reactionMs: number;
  distance: number; // how far from center the click was
}

interface AimTrainerProps {
  onComplete: (results: { avgReaction: number; accuracy: number; score: number }) => void;
}

const ARENA_W = 700;
const ARENA_H = 420;
const ROUND_TARGETS = 20;
const TARGET_LIFETIME = 3000;
const TARGET_MIN_SIZE = 28;
const TARGET_MAX_SIZE = 48;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function spawnTarget(id: number): AimTarget {
  const size = randomBetween(TARGET_MIN_SIZE, TARGET_MAX_SIZE);
  const speed = randomBetween(0.3, 1.5);
  const angle = Math.random() * Math.PI * 2;
  return {
    id,
    x: randomBetween(size, ARENA_W - size),
    y: randomBetween(size, ARENA_H - size),
    size,
    speed,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    spawnedAt: Date.now(),
  };
}

export function AimTrainer({ onComplete }: AimTrainerProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [targets, setTargets] = useState<AimTarget[]>([]);
  const [hits, setHits] = useState<HitResult[]>([]);
  const [misses, setMisses] = useState(0);
  const [score, setScore] = useState(0);
  const [targetsSpawned, setTargetsSpawned] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const arenaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);

  // Start game
  const startGame = useCallback(() => {
    setCountdown(3);
    setPhase('ready');
    setTargets([]);
    setHits([]);
    setMisses(0);
    setScore(0);
    setTargetsSpawned(0);

    let c = 3;
    const interval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c === 0) {
        clearInterval(interval);
        setPhase('playing');
        lastSpawnRef.current = Date.now();
      }
    }, 800);
  }, []);

  // Spawn targets over time
  useEffect(() => {
    if (phase !== 'playing') return;

    spawnTimerRef.current = window.setInterval(() => {
      setTargetsSpawned(prev => {
        if (prev >= ROUND_TARGETS) return prev;
        setTargets(t => {
          // Remove expired targets
          const now = Date.now();
          const alive = t.filter(target => now - target.spawnedAt < TARGET_LIFETIME);
          // Spawn new if under limit
          if (alive.length < 3 && prev < ROUND_TARGETS) {
            return [...alive, spawnTarget(prev + 1)];
          }
          return alive;
        });
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(spawnTimerRef.current);
  }, [phase]);

  // Animate targets movement
  useEffect(() => {
    if (phase !== 'playing') return;

    function animate() {
      setTargets(prev => prev.map(t => {
        let nx = t.x + t.dx;
        let ny = t.y + t.dy;
        let ndx = t.dx;
        let ndy = t.dy;

        // Bounce off walls
        if (nx <= t.size / 2 || nx >= ARENA_W - t.size / 2) { ndx = -ndx; nx = Math.max(t.size / 2, Math.min(nx, ARENA_W - t.size / 2)); }
        if (ny <= t.size / 2 || ny >= ARENA_H - t.size / 2) { ndy = -ndy; ny = Math.max(t.size / 2, Math.min(ny, ARENA_H - t.size / 2)); }

        return { ...t, x: nx, y: ny, dx: ndx, dy: ndy };
      }).filter(t => Date.now() - t.spawnedAt < TARGET_LIFETIME));

      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase]);

  // Check game end
  useEffect(() => {
    if (phase !== 'playing') return;
    if (targetsSpawned >= ROUND_TARGETS && targets.length === 0 && hits.length + misses > 0) {
      setPhase('done');
      const totalShots = hits.length + misses;
      const accuracy = totalShots > 0 ? (hits.length / totalShots) * 100 : 0;
      const avgReaction = hits.length > 0 ? hits.reduce((sum, h) => sum + h.reactionMs, 0) / hits.length : 0;
      onComplete({ avgReaction, accuracy, score });
    }
  }, [phase, targetsSpawned, targets, hits, misses, score, onComplete]);

  // Handle click on target
  const handleTargetClick = useCallback((target: AimTarget, e: React.MouseEvent) => {
    e.stopPropagation();
    const reaction = Date.now() - target.spawnedAt;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    setHits(prev => [...prev, { reactionMs: reaction, distance }]);
    setTargets(prev => prev.filter(t => t.id !== target.id));

    // Score: faster + more centered = more points
    const timeBonus = Math.max(0, 1000 - reaction);
    const accuracyBonus = Math.max(0, 100 - distance * 3);
    setScore(prev => prev + Math.round(timeBonus + accuracyBonus));
  }, []);

  // Handle miss (click on empty area)
  const handleArenaMiss = useCallback(() => {
    if (phase === 'playing') {
      setMisses(prev => prev + 1);
    }
  }, [phase]);

  const progress = targetsSpawned / ROUND_TARGETS;

  return (
    <div className="flex flex-col gap-4">
      {/* HUD */}
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <span>Alvos: {hits.length}/{ROUND_TARGETS}</span>
        <span>Score: {score}</span>
        <span>Erros: {misses}</span>
      </div>

      {/* Progress bar */}
      <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <motion.div
          className="h-full bg-white"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Arena */}
      <div
        ref={arenaRef}
        onClick={handleArenaMiss}
        className="relative overflow-hidden cursor-crosshair select-none border border-[rgba(255,255,255,0.1)]"
        style={{
          width: '100%',
          maxWidth: ARENA_W,
          aspectRatio: `${ARENA_W} / ${ARENA_H}`,
          background: 'rgba(255,255,255,0.02)',
          margin: '0 auto',
        }}
      >
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.04 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`v${i}`} x1={`${(i + 1) * 10}%`} y1="0" x2={`${(i + 1) * 10}%`} y2="100%" stroke="white" strokeWidth="1" />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={`${(i + 1) * 16.66}%`} x2="100%" y2={`${(i + 1) * 16.66}%`} stroke="white" strokeWidth="1" />
          ))}
        </svg>

        {/* Crosshair in center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.1 }}>
          <div className="w-6 h-px bg-white" />
          <div className="absolute w-px h-6 bg-white" />
        </div>

        {/* Countdown */}
        {phase === 'ready' && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              key={countdown}
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono text-[64px] font-light text-white"
            >
              {countdown}
            </motion.span>
          </div>
        )}

        {/* Targets */}
        <AnimatePresence>
          {targets.map(target => {
            const containerWidth = arenaRef.current?.clientWidth ?? ARENA_W;
            const containerHeight = arenaRef.current?.clientHeight ?? ARENA_H;
            const scaleX = containerWidth / ARENA_W;
            const scaleY = containerHeight / ARENA_H;
            const scaledSize = target.size * Math.min(scaleX, scaleY);

            return (
              <motion.div
                key={target.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                onClick={(e) => handleTargetClick(target, e)}
                className="absolute rounded-full cursor-pointer"
                style={{
                  left: `${(target.x / ARENA_W) * 100}%`,
                  top: `${(target.y / ARENA_H) * 100}%`,
                  width: scaledSize,
                  height: scaledSize,
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow: '0 0 20px rgba(255,255,255,0.15)',
                }}
              >
                {/* Inner ring */}
                <div
                  className="absolute rounded-full"
                  style={{
                    inset: '25%',
                    border: '1.5px solid #1f2228',
                    opacity: 0.5,
                  }}
                />
                {/* Center dot */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 4,
                    height: 4,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#1f2228',
                  }}
                />
                {/* Lifetime decay ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" style={{ opacity: 0.3 }}>
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="#1f2228"
                    strokeWidth="2"
                    strokeDasharray={`${Math.PI * scaledSize * 0.9}`}
                    strokeDashoffset={`${Math.PI * scaledSize * 0.9 * Math.max(0, 1 - (Date.now() - target.spawnedAt) / TARGET_LIFETIME)}`}
                  />
                </svg>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Done overlay */}
        {phase === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(31,34,40,0.8)' }}>
            <span className="font-mono text-[18px] font-light" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Teste completo
            </span>
          </div>
        )}

        {/* Start prompt */}
        {phase === 'ready' && countdown <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[14px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Preparando...
            </span>
          </div>
        )}
      </div>

      {/* Stats during play */}
      {phase === 'playing' && hits.length > 0 && (
        <div className="flex justify-center gap-6 font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span>Tempo medio: {Math.round(hits.reduce((s, h) => s + h.reactionMs, 0) / hits.length)}ms</span>
          <span>Precisao: {Math.round((hits.length / (hits.length + misses)) * 100)}%</span>
        </div>
      )}

      {/* Start button if first time */}
      {phase === 'ready' && countdown === 3 && (
        <button
          onClick={startGame}
          className="font-mono text-[14px] uppercase tracking-[1.4px] px-6 py-3 bg-white text-[#1f2228] hover:opacity-90 transition-opacity self-center"
        >
          Comecar minigame
        </button>
      )}
    </div>
  );
}
