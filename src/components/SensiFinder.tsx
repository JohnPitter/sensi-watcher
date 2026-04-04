import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, RotateCcw, Check, ArrowRight, Copy } from 'lucide-react';
import { games } from '../data/games';
import { calcCm360, convertSensitivity } from '../engine/sensitivity';
import { GameSelect } from './GameSelect';
import { NumberInput } from './NumberInput';

type Phase = 'setup' | 'testing' | 'result';
type Feedback = 'too-slow' | 'too-fast' | null;

interface Round {
  sens: number;
  feedback: 'too-slow' | 'too-fast' | 'perfect';
}

const DPI_PRESETS = [400, 800, 1600, 3200];

// PSA (Perfect Sensitivity Approximation) method:
// Binary search — start with a range, user says "too slow" or "too fast",
// we narrow the range each round until convergence.
function getNextSens(low: number, high: number): number {
  return Math.round(((low + high) / 2) * 10000) / 10000;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 hover:opacity-50 transition-opacity"
      title="Copiar"
    >
      {copied ? <Check size={14} /> : <Copy size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />}
    </button>
  );
}

export function SensiFinder() {
  const [gameId, setGameId] = useState('cs2');
  const [dpi, setDpi] = useState(800);
  const [phase, setPhase] = useState<Phase>('setup');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [lowSens, setLowSens] = useState(0);
  const [highSens, setHighSens] = useState(0);
  const [currentSens, setCurrentSens] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [finalSens, setFinalSens] = useState(0);
  const roundRef = useRef(0);

  const game = games.find(g => g.id === gameId) ?? games[0];

  const startTest = useCallback(() => {
    const low = game.sensRange[0];
    const high = game.sensRange[1];
    // Start at a reasonable medium point
    const mid = getNextSens(low, high);
    setLowSens(low);
    setHighSens(high);
    setCurrentSens(mid);
    setRounds([]);
    setFeedback(null);
    roundRef.current = 0;
    setPhase('testing');
  }, [game]);

  const handleFeedback = useCallback((fb: 'too-slow' | 'too-fast' | 'perfect') => {
    const newRound: Round = { sens: currentSens, feedback: fb };
    const newRounds = [...rounds, newRound];
    setRounds(newRounds);

    if (fb === 'perfect' || newRounds.length >= 10) {
      setFinalSens(currentSens);
      setPhase('result');
      return;
    }

    let newLow = lowSens;
    let newHigh = highSens;

    if (fb === 'too-slow') {
      // Sens too low → need higher sens (lower cm/360)
      newLow = currentSens;
    } else {
      // Sens too fast → need lower sens (higher cm/360)
      newHigh = currentSens;
    }

    // Check convergence
    const diff = Math.abs(newHigh - newLow);
    const threshold = game.sensStep * 2;
    if (diff <= threshold) {
      const final = getNextSens(newLow, newHigh);
      setFinalSens(final);
      setPhase('result');
      return;
    }

    const next = getNextSens(newLow, newHigh);
    setLowSens(newLow);
    setHighSens(newHigh);
    setCurrentSens(next);
    setFeedback(null);
    roundRef.current += 1;
  }, [currentSens, rounds, lowSens, highSens, game.sensStep]);

  const restart = useCallback(() => {
    setPhase('setup');
    setRounds([]);
    setFeedback(null);
    setFinalSens(0);
  }, []);

  // Keyboard shortcuts during testing
  useEffect(() => {
    if (phase !== 'testing') return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'a') handleFeedback('too-slow');
      if (e.key === 'ArrowRight' || e.key === 'd') handleFeedback('too-fast');
      if (e.key === 'Enter' || e.key === ' ') handleFeedback('perfect');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, handleFeedback]);

  const cm360 = calcCm360(dpi, finalSens || currentSens, game.yaw);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <h2 className="font-mono text-[14px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Encontrar sensibilidade ideal
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {/* SETUP PHASE */}
        {phase === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6"
          >
            <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Use o metodo PSA (Perfect Sensitivity Approximation) para encontrar sua sensibilidade ideal.
              O sistema vai testar diferentes valores e voce diz se esta muito lento ou muito rapido.
              Em ~8 rodadas, convergimos na sua sens perfeita.
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

            <div className="flex flex-col gap-3 p-4 border border-[rgba(255,255,255,0.1)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h3 className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Como funciona</h3>
              <ol className="flex flex-col gap-2 text-[14px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <li className="flex gap-3"><span className="font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>01</span> Abra seu jogo e entre numa partida/treinamento</li>
                <li className="flex gap-3"><span className="font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>02</span> A cada rodada, configure a sensibilidade mostrada</li>
                <li className="flex gap-3"><span className="font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>03</span> Mova o mouse e tente mirar em alvos</li>
                <li className="flex gap-3"><span className="font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>04</span> Diga se a sens esta lenta demais, rapida demais, ou perfeita</li>
                <li className="flex gap-3"><span className="font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>05</span> Em ~8 rodadas voce tera sua sens ideal</li>
              </ol>
            </div>

            <button
              onClick={startTest}
              className="font-mono text-[14px] uppercase tracking-[1.4px] px-6 py-3 bg-white text-[#1f2228] hover:opacity-90 transition-opacity self-start"
            >
              Iniciar teste
            </button>
          </motion.div>
        )}

        {/* TESTING PHASE */}
        {phase === 'testing' && (
          <motion.div
            key="testing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-8"
          >
            {/* Progress */}
            <div className="flex items-center gap-4">
              <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Rodada {rounds.length + 1}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {game.name}
              </span>
            </div>

            {/* Current sens display */}
            <div className="flex flex-col items-center gap-4 py-8 border border-[rgba(255,255,255,0.1)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Configure sua sensibilidade para
              </span>
              <motion.span
                key={currentSens}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-mono text-[48px] sm:text-[64px] font-light text-white"
              >
                {currentSens.toFixed(game.sensStep < 0.01 ? 3 : game.sensStep < 1 ? 2 : 0)}
              </motion.span>
              <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                cm/360: {cm360.toFixed(1)} | eDPI: {(dpi * currentSens).toFixed(0)}
              </span>
            </div>

            {/* Feedback prompt */}
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Teste essa sensibilidade no jogo. Como esta?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleFeedback('too-slow')}
                  onMouseEnter={() => setFeedback('too-slow')}
                  onMouseLeave={() => setFeedback(null)}
                  className={`font-mono text-[13px] uppercase tracking-[1.4px] px-4 py-4 border transition-all ${
                    feedback === 'too-slow'
                      ? 'border-white/30 bg-[rgba(255,255,255,0.08)]'
                      : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]'
                  }`}
                >
                  <span className="flex flex-col items-center gap-2">
                    <span>Muito lenta</span>
                    <span className="text-[10px] normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Preciso mover muito o mouse (A / &larr;)
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => handleFeedback('perfect')}
                  className="font-mono text-[13px] uppercase tracking-[1.4px] px-4 py-4 bg-white text-[#1f2228] hover:opacity-90 transition-opacity"
                >
                  <span className="flex flex-col items-center gap-2">
                    <span>Perfeita</span>
                    <span className="text-[10px] normal-case tracking-normal opacity-60">
                      Essa sens esta boa (Enter / Space)
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => handleFeedback('too-fast')}
                  onMouseEnter={() => setFeedback('too-fast')}
                  onMouseLeave={() => setFeedback(null)}
                  className={`font-mono text-[13px] uppercase tracking-[1.4px] px-4 py-4 border transition-all ${
                    feedback === 'too-fast'
                      ? 'border-white/30 bg-[rgba(255,255,255,0.08)]'
                      : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]'
                  }`}
                >
                  <span className="flex flex-col items-center gap-2">
                    <span>Muito rapida</span>
                    <span className="text-[10px] normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      A mira escapa do alvo (D / &rarr;)
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* Round history */}
            {rounds.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Historico
                </span>
                <div className="flex flex-wrap gap-2">
                  {rounds.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 border border-[rgba(255,255,255,0.1)] font-mono text-[11px]"
                    >
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>R{i + 1}</span>
                      <span>{r.sens.toFixed(2)}</span>
                      <span style={{ color: r.feedback === 'too-slow' ? 'rgba(255,255,255,0.4)' : r.feedback === 'too-fast' ? 'rgba(255,255,255,0.4)' : '#fff' }}>
                        {r.feedback === 'too-slow' ? '< lenta' : r.feedback === 'too-fast' ? '> rapida' : '= ok'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={restart}
              className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[1.4px] self-start hover:opacity-50 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <RotateCcw size={14} /> Recomecar
            </button>
          </motion.div>
        )}

        {/* RESULT PHASE */}
        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col items-center gap-4 py-10 border border-[rgba(255,255,255,0.2)]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Sua sensibilidade ideal para {game.name}
              </span>
              <div className="flex items-center gap-3">
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="font-mono text-[56px] sm:text-[72px] font-light text-white"
                >
                  {finalSens.toFixed(game.sensStep < 0.01 ? 3 : game.sensStep < 1 ? 2 : 0)}
                </motion.span>
                <CopyBtn text={finalSens.toFixed(game.sensStep < 0.01 ? 3 : game.sensStep < 1 ? 2 : 0)} />
              </div>
              <div className="flex items-center gap-6 font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span>cm/360: <span className="text-white">{calcCm360(dpi, finalSens, game.yaw).toFixed(1)}</span></span>
                <span>eDPI: <span className="text-white">{(dpi * finalSens).toFixed(0)}</span></span>
              </div>
              <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Encontrada em {rounds.length} rodadas
              </span>
            </div>

            {/* Converted for all games */}
            <div className="flex flex-col gap-4">
              <h3 className="font-mono text-[12px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Mesma sensibilidade em outros jogos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {games.filter(g => g.id !== gameId).map(target => {
                  const converted = convertSensitivity(game, target, finalSens, dpi);
                  return (
                    <div
                      key={target.id}
                      className="flex items-center justify-between px-4 py-3 border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] transition-colors"
                    >
                      <span className="text-[13px]">{target.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[14px] font-medium text-white">
                          {converted.toFixed(target.sensStep < 0.01 ? 3 : target.sensStep < 1 ? 2 : 0)}
                        </span>
                        <CopyBtn text={converted.toFixed(target.sensStep < 0.01 ? 3 : target.sensStep < 1 ? 2 : 0)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={restart}
                className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[1.4px] px-5 py-3 border border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              >
                <RotateCcw size={14} /> Testar novamente
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('converter');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[1.4px] px-5 py-3 border border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              >
                <ArrowRight size={14} /> Usar no conversor
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
