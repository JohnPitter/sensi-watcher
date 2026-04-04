import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, RotateCcw, Check, Copy, Gamepad2, SlidersHorizontal } from 'lucide-react';
import { games } from '../data/games';
import { calcCm360, convertSensitivity } from '../engine/sensitivity';
import { GameSelect } from './GameSelect';
import { NumberInput } from './NumberInput';
import { AimTrainer } from './AimTrainer';

type Mode = 'choose' | 'psa' | 'minigame';
type PsaPhase = 'testing' | 'result';
type MiniPhase = 'setup' | 'playing' | 'between' | 'result';

interface Round {
  sens: number;
  feedback: 'too-slow' | 'too-fast' | 'perfect';
}

interface MiniRound {
  sens: number;
  score: number;
  accuracy: number;
  avgReaction: number;
}

const DPI_PRESETS = [400, 800, 1600, 3200];

function getNextSens(low: number, high: number): number {
  return Math.round(((low + high) / 2) * 10000) / 10000;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 hover:opacity-50 transition-opacity"
    >
      {copied ? <Check size={14} /> : <Copy size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />}
    </button>
  );
}

function ResultDisplay({ game, sens, dpi, rounds, onRestart }: {
  game: typeof games[0]; sens: number; dpi: number; rounds: number; onRestart: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-4 py-10 border border-[rgba(255,255,255,0.2)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Sensibilidade ideal para {game.name}
        </span>
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="font-mono text-[56px] sm:text-[72px] font-light text-white"
          >
            {sens.toFixed(game.sensStep < 0.01 ? 3 : game.sensStep < 1 ? 2 : 0)}
          </motion.span>
          <CopyBtn text={sens.toFixed(game.sensStep < 0.01 ? 3 : game.sensStep < 1 ? 2 : 0)} />
        </div>
        <div className="flex items-center gap-6 font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span>cm/360: <span className="text-white">{calcCm360(dpi, sens, game.yaw).toFixed(1)}</span></span>
          <span>eDPI: <span className="text-white">{(dpi * sens).toFixed(0)}</span></span>
        </div>
        <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Encontrada em {rounds} rodadas
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Mesma sensibilidade em outros jogos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {games.filter(g => g.id !== game.id).map(target => {
            const converted = convertSensitivity(game, target, sens, dpi);
            return (
              <div key={target.id} className="flex items-center justify-between px-4 py-3 border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] transition-colors">
                <span className="text-[13px]">{target.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-medium">{converted.toFixed(target.sensStep < 0.01 ? 3 : target.sensStep < 1 ? 2 : 0)}</span>
                  <CopyBtn text={converted.toFixed(target.sensStep < 0.01 ? 3 : target.sensStep < 1 ? 2 : 0)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <button onClick={onRestart} className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[1.4px] px-5 py-3 border border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors">
          <RotateCcw size={14} /> Testar novamente
        </button>
      </div>
    </div>
  );
}

export function SensiFinder() {
  const [mode, setMode] = useState<Mode>('choose');
  const [gameId, setGameId] = useState('cs2');
  const [dpi, setDpi] = useState(800);

  // PSA state
  const [psaPhase, setPsaPhase] = useState<PsaPhase>('testing');
  const [psaRounds, setPsaRounds] = useState<Round[]>([]);
  const [lowSens, setLowSens] = useState(0);
  const [highSens, setHighSens] = useState(0);
  const [currentSens, setCurrentSens] = useState(0);
  const [psaFinal, setPsaFinal] = useState(0);

  // Minigame state
  const [miniPhase, setMiniPhase] = useState<MiniPhase>('setup');
  const [miniRounds, setMiniRounds] = useState<MiniRound[]>([]);
  const [miniCurrentRound, setMiniCurrentRound] = useState(0);
  const [miniSensValues, setMiniSensValues] = useState<number[]>([]);
  const [miniFinal, setMiniFinal] = useState(0);

  const game = games.find(g => g.id === gameId) ?? games[0];

  // PSA methods
  const startPSA = useCallback(() => {
    const low = game.sensRange[0];
    const high = game.sensRange[1];
    setLowSens(low);
    setHighSens(high);
    setCurrentSens(getNextSens(low, high));
    setPsaRounds([]);
    setPsaPhase('testing');
    setMode('psa');
  }, [game]);

  const handlePsaFeedback = useCallback((fb: 'too-slow' | 'too-fast' | 'perfect') => {
    const newRounds = [...psaRounds, { sens: currentSens, feedback: fb }];
    setPsaRounds(newRounds);

    if (fb === 'perfect' || newRounds.length >= 10) {
      setPsaFinal(currentSens);
      setPsaPhase('result');
      return;
    }

    let nLow = lowSens, nHigh = highSens;
    if (fb === 'too-slow') nLow = currentSens;
    else nHigh = currentSens;

    if (Math.abs(nHigh - nLow) <= game.sensStep * 2) {
      setPsaFinal(getNextSens(nLow, nHigh));
      setPsaPhase('result');
      return;
    }

    setLowSens(nLow);
    setHighSens(nHigh);
    setCurrentSens(getNextSens(nLow, nHigh));
  }, [psaRounds, currentSens, lowSens, highSens, game.sensStep]);

  useEffect(() => {
    if (mode !== 'psa' || psaPhase !== 'testing') return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'a') handlePsaFeedback('too-slow');
      if (e.key === 'ArrowRight' || e.key === 'd') handlePsaFeedback('too-fast');
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePsaFeedback('perfect'); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, psaPhase, handlePsaFeedback]);

  // Sensitivity factors per round: low sens feel, mid, high sens feel
  const SENSITIVITY_FACTORS = [0.6, 1.0, 1.8];

  // Minigame methods
  const startMinigame = useCallback(() => {
    // Generate 3 sensitivity values: low, medium, high within game range
    const range = game.sensRange;
    const low = range[0] + (range[1] - range[0]) * 0.2;
    const mid = range[0] + (range[1] - range[0]) * 0.4;
    const high = range[0] + (range[1] - range[0]) * 0.65;
    const values = [low, mid, high].map(v => Math.round(v * 100) / 100);
    setMiniSensValues(values);
    setMiniRounds([]);
    setMiniCurrentRound(0);
    setMiniPhase('playing');
    setMode('minigame');
  }, [game]);

  const handleMiniComplete = useCallback((results: { avgReaction: number; accuracy: number; score: number }) => {
    const sens = miniSensValues[miniCurrentRound];
    const newRounds = [...miniRounds, { sens, ...results }];
    setMiniRounds(newRounds);

    if (miniCurrentRound < miniSensValues.length - 1) {
      setMiniCurrentRound(miniCurrentRound + 1);
      setMiniPhase('between');
    } else {
      // Find best: highest score wins
      const best = newRounds.reduce((best, r) => r.score > best.score ? r : best, newRounds[0]);
      setMiniFinal(best.sens);
      setMiniPhase('result');
    }
  }, [miniSensValues, miniCurrentRound, miniRounds]);

  const restart = useCallback(() => {
    setMode('choose');
    setPsaPhase('testing');
    setMiniPhase('setup');
    setPsaRounds([]);
    setMiniRounds([]);
  }, []);

  const cm360 = calcCm360(dpi, currentSens || 1, game.yaw);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex flex-col gap-8"
    >
      <div className="flex items-center gap-3">
        <Target size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <h2 className="font-mono text-[14px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Encontrar sensibilidade ideal
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {/* MODE CHOOSER */}
        {mode === 'choose' && (
          <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Encontre sua sensibilidade ideal de duas formas: testando no jogo com feedback manual,
              ou jogando um minigame de mira aqui mesmo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[14px]" style={{ color: 'rgba(255,255,255,0.7)' }}>JOGO</label>
                <GameSelect label="" games={games} value={gameId} onChange={setGameId} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px]" style={{ color: 'rgba(255,255,255,0.7)' }}>DPI</label>
                <NumberInput label="" value={dpi} onChange={setDpi} min={100} max={16000} step={100} presets={DPI_PRESETS} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={startMinigame}
                className="flex flex-col gap-3 p-6 border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] transition-colors text-left"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <Gamepad2 size={24} />
                <span className="font-mono text-[14px] uppercase tracking-[1.4px]">Minigame de Mira</span>
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Clique em alvos que se movem. O sistema testa 3 sensibilidades e descobre qual te da melhor performance.
                </span>
              </button>
              <button
                onClick={startPSA}
                className="flex flex-col gap-3 p-6 border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] transition-colors text-left"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <SlidersHorizontal size={24} />
                <span className="font-mono text-[14px] uppercase tracking-[1.4px]">Teste Manual (PSA)</span>
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Teste no seu jogo e diga se a sens esta lenta ou rapida. Busca binaria em ~8 rodadas.
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* PSA MODE */}
        {mode === 'psa' && psaPhase === 'testing' && (
          <motion.div key="psa-test" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Rodada {psaRounds.length + 1}</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{game.name}</span>
            </div>

            <div className="flex flex-col items-center gap-4 py-8 border border-[rgba(255,255,255,0.1)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Configure sua sensibilidade para</span>
              <motion.span key={currentSens} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="font-mono text-[48px] sm:text-[64px] font-light text-white">
                {currentSens.toFixed(game.sensStep < 0.01 ? 3 : game.sensStep < 1 ? 2 : 0)}
              </motion.span>
              <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>cm/360: {cm360.toFixed(1)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => handlePsaFeedback('too-slow')} className="font-mono text-[13px] uppercase tracking-[1.4px] px-4 py-4 border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] transition-colors">
                <span className="flex flex-col items-center gap-1">
                  <span>Muito lenta</span>
                  <span className="text-[10px] normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>A / &larr;</span>
                </span>
              </button>
              <button onClick={() => handlePsaFeedback('perfect')} className="font-mono text-[13px] uppercase tracking-[1.4px] px-4 py-4 bg-white text-[#1f2228] hover:opacity-90 transition-opacity">
                <span className="flex flex-col items-center gap-1">
                  <span>Perfeita</span>
                  <span className="text-[10px] normal-case tracking-normal opacity-60">Enter / Space</span>
                </span>
              </button>
              <button onClick={() => handlePsaFeedback('too-fast')} className="font-mono text-[13px] uppercase tracking-[1.4px] px-4 py-4 border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] transition-colors">
                <span className="flex flex-col items-center gap-1">
                  <span>Muito rapida</span>
                  <span className="text-[10px] normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>D / &rarr;</span>
                </span>
              </button>
            </div>

            {psaRounds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {psaRounds.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 border border-[rgba(255,255,255,0.1)] font-mono text-[11px]">
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>R{i + 1}</span>
                    <span>{r.sens.toFixed(2)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{r.feedback === 'too-slow' ? '< lenta' : r.feedback === 'too-fast' ? '> rapida' : '= ok'}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={restart} className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[1.4px] self-start hover:opacity-50 transition-opacity" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <RotateCcw size={14} /> Voltar
            </button>
          </motion.div>
        )}

        {mode === 'psa' && psaPhase === 'result' && (
          <motion.div key="psa-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ResultDisplay game={game} sens={psaFinal} dpi={dpi} rounds={psaRounds.length} onRestart={restart} />
          </motion.div>
        )}

        {/* MINIGAME MODE */}
        {mode === 'minigame' && miniPhase === 'playing' && (
          <motion.div key="mini-play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Rodada {miniCurrentRound + 1} de {miniSensValues.length}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Sens: {miniSensValues[miniCurrentRound]?.toFixed(2)} | {game.name}
              </span>
            </div>

            <div className="flex flex-col items-center gap-2 py-3 border border-[rgba(255,255,255,0.1)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Testando sensibilidade</span>
              <span className="font-mono text-[32px] font-light text-white">{miniSensValues[miniCurrentRound]?.toFixed(2)}</span>
            </div>

            <AimTrainer sensitivityFactor={SENSITIVITY_FACTORS[miniCurrentRound] ?? 1.0} onComplete={handleMiniComplete} />

            <button onClick={restart} className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[1.4px] self-start hover:opacity-50 transition-opacity" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <RotateCcw size={14} /> Cancelar
            </button>
          </motion.div>
        )}

        {mode === 'minigame' && miniPhase === 'between' && (
          <motion.div key="mini-between" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 py-8">
            <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Rodada {miniCurrentRound} completa
            </span>

            {/* Previous round results */}
            <div className="flex flex-wrap gap-4">
              {miniRounds.map((r, i) => (
                <div key={i} className="flex flex-col items-center gap-1 px-4 py-3 border border-[rgba(255,255,255,0.1)]">
                  <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Sens {r.sens.toFixed(2)}</span>
                  <span className="font-mono text-[18px] text-white">{r.score}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{r.accuracy.toFixed(0)}% | {r.avgReaction.toFixed(0)}ms</span>
                </div>
              ))}
            </div>

            <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Proxima sensibilidade: <span className="font-mono text-white">{miniSensValues[miniCurrentRound]?.toFixed(2)}</span>
            </span>

            <button
              onClick={() => setMiniPhase('playing')}
              className="font-mono text-[14px] uppercase tracking-[1.4px] px-6 py-3 bg-white text-[#1f2228] hover:opacity-90 transition-opacity"
            >
              Proxima rodada
            </button>
          </motion.div>
        )}

        {mode === 'minigame' && miniPhase === 'result' && (
          <motion.div key="mini-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
            {/* Comparison table */}
            <div className="flex flex-col gap-4">
              <h3 className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Resultados por sensibilidade
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {miniRounds.map((r, i) => {
                  const isBest = r.sens === miniFinal;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center gap-2 p-4 border transition-colors ${
                        isBest ? 'border-[rgba(255,255,255,0.3)]' : 'border-[rgba(255,255,255,0.1)]'
                      }`}
                      style={{ background: isBest ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)' }}
                    >
                      {isBest && <span className="font-mono text-[10px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>Melhor</span>}
                      <span className="font-mono text-[24px] font-light text-white">{r.sens.toFixed(2)}</span>
                      <div className="flex gap-4 font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span>Score: {r.score}</span>
                        <span>{r.accuracy.toFixed(0)}%</span>
                        <span>{r.avgReaction.toFixed(0)}ms</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <ResultDisplay game={game} sens={miniFinal} dpi={dpi} rounds={miniRounds.length} onRestart={restart} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
