import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, ArrowRight, Gamepad2, SlidersHorizontal, BookOpen, Zap } from 'lucide-react';

interface LandingHeroProps {
  onNavigate: (tab: 'converter' | 'finder' | 'guide') => void;
}

// Simulated kill feed entries
const KILL_FEED = [
  { killer: 'TenZ', weapon: 'Vandal', victim: 'enemy_01' },
  { killer: 's1mple', weapon: 'AWP', victim: 'player_42' },
  { killer: 'you', weapon: 'AK-47', victim: 'target_03' },
  { killer: 'Shroud', weapon: 'R-301', victim: 'enemy_07' },
  { killer: 'you', weapon: 'Phantom', victim: 'target_12' },
];

// Animated crosshair that follows random positions
function AnimatedCrosshair() {
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const interval = setInterval(() => {
      setPos({
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60,
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="absolute pointer-events-none"
      animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      style={{ transform: 'translate(-50%, -50%)' }}
    >
      {/* Crosshair lines */}
      <div className="relative w-8 h-8">
        <div className="absolute top-0 left-1/2 w-px h-2.5 -translate-x-1/2 bg-white/60" />
        <div className="absolute bottom-0 left-1/2 w-px h-2.5 -translate-x-1/2 bg-white/60" />
        <div className="absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-white/60" />
        <div className="absolute right-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-white/60" />
        <div className="absolute top-1/2 left-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 bg-white/40 rounded-full" />
      </div>
    </motion.div>
  );
}

// Floating hit markers
function HitMarkers() {
  const [markers, setMarkers] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    let id = 0;
    const interval = setInterval(() => {
      id++;
      const newMarker = { id, x: 15 + Math.random() * 70, y: 15 + Math.random() * 70 };
      setMarkers(prev => [...prev.slice(-4), newMarker]);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <AnimatePresence>
        {markers.map(m => (
          <motion.div
            key={m.id}
            className="absolute pointer-events-none"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            initial={{ opacity: 1, scale: 0.5, rotate: 0 }}
            animate={{ opacity: 0, scale: 1.5, rotate: 45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line x1="4" y1="4" x2="7" y2="7" stroke="white" strokeWidth="1.5" />
              <line x1="12" y1="4" x2="9" y2="7" stroke="white" strokeWidth="1.5" />
              <line x1="4" y1="12" x2="7" y2="9" stroke="white" strokeWidth="1.5" />
              <line x1="12" y1="12" x2="9" y2="9" stroke="white" strokeWidth="1.5" />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}

export function LandingHero({ onNavigate }: LandingHeroProps) {
  const [visibleFeeds, setVisibleFeeds] = useState<number>(0);
  const [statsRevealed, setStatsRevealed] = useState(false);

  useEffect(() => {
    const feedInterval = setInterval(() => {
      setVisibleFeeds(prev => {
        if (prev >= KILL_FEED.length) { clearInterval(feedInterval); return prev; }
        return prev + 1;
      });
    }, 600);

    const statsTimer = setTimeout(() => setStatsRevealed(true), 2000);

    return () => { clearInterval(feedInterval); clearTimeout(statsTimer); };
  }, []);

  const handleFeatureClick = useCallback((tab: 'converter' | 'finder' | 'guide') => {
    onNavigate(tab);
  }, [onNavigate]);

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      {/* Hero section with FPS simulation */}
      <div className="relative">
        {/* FPS viewport simulation */}
        <div
          className="relative w-full overflow-hidden border border-[rgba(255,255,255,0.08)]"
          style={{
            aspectRatio: '16 / 7',
            background: 'rgba(255,255,255,0.02)',
            maxHeight: '420px',
          }}
        >
          {/* Scanlines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 4px)',
            }}
          />

          {/* Grid */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.03 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`v${i}`} x1={`${(i + 1) * 8.33}%`} y1="0" x2={`${(i + 1) * 8.33}%`} y2="100%" stroke="white" strokeWidth="1" />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={`${(i + 1) * 16.66}%`} x2="100%" y2={`${(i + 1) * 16.66}%`} stroke="white" strokeWidth="1" />
            ))}
          </svg>

          {/* Animated crosshair */}
          <AnimatedCrosshair />

          {/* Hit markers */}
          <HitMarkers />

          {/* Kill feed (top right) */}
          <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
            <AnimatePresence>
              {KILL_FEED.slice(0, visibleFeeds).map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 px-2 py-1 font-mono text-[10px]"
                  style={{ background: entry.killer === 'you' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)' }}
                >
                  <span style={{ color: entry.killer === 'you' ? '#fff' : 'rgba(255,255,255,0.5)' }}>{entry.killer}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>[{entry.weapon}]</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{entry.victim}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* HUD elements (bottom) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-4 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span>HP 100</span>
              <span>AMMO 24/90</span>
            </div>
            <div className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              128 tick | 12ms
            </div>
          </div>

          {/* Center title overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-3">
                <Crosshair size={24} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
              <h1 className="font-mono text-[36px] sm:text-[52px] lg:text-[68px] font-light tracking-tight text-white leading-none">
                SENSI WATCHER
              </h1>
              <p
                className="font-mono text-[11px] sm:text-[12px] uppercase tracking-[2px] mt-1"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Encontre sua sensibilidade perfeita
              </p>
            </motion.div>
          </div>
        </div>

        {/* Stats bar below viewport */}
        <AnimatePresence>
          {statsRevealed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between px-4 py-2.5 border-x border-b border-[rgba(255,255,255,0.08)]"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              {[
                { label: 'JOGOS', value: '15' },
                { label: 'CONVERSOES', value: 'INFINITAS' },
                { label: 'METODOS', value: '2' },
                { label: 'PRECO', value: 'GRATIS' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.15 }}
                  className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[1.4px]"
                >
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</span>
                  <span className="text-white font-medium">{stat.value}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={() => handleFeatureClick('converter')}
          className="flex flex-col gap-4 p-6 border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] transition-all text-left group"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex items-center justify-between">
            <SlidersHorizontal size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
          <div>
            <h3 className="font-mono text-[13px] uppercase tracking-[1.4px] text-white mb-2">Converter Sens</h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Porte sua sensibilidade entre 15 jogos. CS2, Valorant, Apex, Overwatch e mais.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {['CS2', 'VALORANT', 'APEX', '+12'].map(tag => (
              <span key={tag} className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-0.5 border border-[rgba(255,255,255,0.1)]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {tag}
              </span>
            ))}
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          onClick={() => handleFeatureClick('finder')}
          className="flex flex-col gap-4 p-6 border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] transition-all text-left group"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex items-center justify-between">
            <Gamepad2 size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
          <div>
            <h3 className="font-mono text-[13px] uppercase tracking-[1.4px] text-white mb-2">Encontrar Sens Ideal</h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Minigame de mira ou teste PSA. Descubra a sensibilidade perfeita para seu estilo.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {['MINIGAME', 'PSA', 'AUTO'].map(tag => (
              <span key={tag} className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-0.5 border border-[rgba(255,255,255,0.1)]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {tag}
              </span>
            ))}
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          onClick={() => handleFeatureClick('guide')}
          className="flex flex-col gap-4 p-6 border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] transition-all text-left group"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex items-center justify-between">
            <BookOpen size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
          <div>
            <h3 className="font-mono text-[13px] uppercase tracking-[1.4px] text-white mb-2">Guia de Playstyle</h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Escala visual de cm/360, referencias de pro players e dicas para ajustar sua sens.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {['CM/360', 'PROS', 'TIPS'].map(tag => (
              <span key={tag} className="font-mono text-[9px] uppercase tracking-[1px] px-2 py-0.5 border border-[rgba(255,255,255,0.1)]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {tag}
              </span>
            ))}
          </div>
        </motion.button>
      </div>

      {/* Quick action */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="flex items-center justify-center gap-3"
      >
        <Zap size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
        <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Selecione uma opcao acima para comecar
        </span>
      </motion.div>
    </div>
  );
}
