import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownUp } from 'lucide-react';
import { games } from '../data/games';
import { calcCm360, calcEDPI, convertSensitivity, getPlaystyle } from '../engine/sensitivity';
import { GameSelect } from './GameSelect';
import { NumberInput } from './NumberInput';
import { StatBlock } from './StatBlock';
import { AllGamesTable } from './AllGamesTable';

const DPI_PRESETS = [400, 800, 1600, 3200];

export function Converter() {
  const [sourceId, setSourceId] = useState('cs2');
  const [targetId, setTargetId] = useState('valorant');
  const [dpi, setDpi] = useState(800);
  const [sourceSens, setSourceSens] = useState(2);

  const sourceGame = useMemo(() => games.find((g) => g.id === sourceId)!, [sourceId]);
  const targetGame = useMemo(() => games.find((g) => g.id === targetId)!, [targetId]);

  const cm360 = useMemo(() => calcCm360(dpi, sourceSens, sourceGame.yaw), [dpi, sourceSens, sourceGame]);
  const edpi = useMemo(() => calcEDPI(dpi, sourceSens), [dpi, sourceSens]);
  const playstyle = useMemo(() => getPlaystyle(cm360), [cm360]);
  const convertedSens = useMemo(
    () => convertSensitivity(sourceGame, targetGame, sourceSens, dpi),
    [sourceGame, targetGame, sourceSens, dpi],
  );
  const convertedEdpi = useMemo(() => calcEDPI(dpi, convertedSens), [dpi, convertedSens]);

  const handleSwap = () => {
    const newSourceSens = convertedSens;
    setSourceId(targetId);
    setTargetId(sourceId);
    setSourceSens(Number(formatSens(newSourceSens, targetGame)));
  };

  const handleSourceGameChange = (id: string) => {
    const game = games.find((g) => g.id === id)!;
    setSourceId(id);
    setSourceSens(game.defaultSens);
  };

  const formatSens = (sens: number, game: { sensStep: number }): string => {
    if (game.sensStep >= 1) return Math.round(sens).toString();
    if (game.sensStep >= 0.1) return sens.toFixed(1);
    if (game.sensStep >= 0.01) return sens.toFixed(2);
    return sens.toFixed(3);
  };

  return (
    <motion.section
      className="flex flex-col gap-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Converter form */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">
        {/* Source */}
        <div className="flex flex-col gap-5">
          <h2
            className="font-mono text-[11px] uppercase tracking-[1.4px]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Source
          </h2>
          <GameSelect label="Game" games={games} value={sourceId} onChange={handleSourceGameChange} />
          <NumberInput
            label="Sensitivity"
            value={sourceSens}
            onChange={setSourceSens}
            step={sourceGame.sensStep}
            min={sourceGame.sensRange[0]}
            max={sourceGame.sensRange[1]}
          />
          <NumberInput
            label="DPI"
            value={dpi}
            onChange={setDpi}
            step={50}
            min={100}
            max={16000}
            presets={DPI_PRESETS}
          />

          {/* Source stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatBlock label="cm/360" value={cm360 > 0 ? cm360.toFixed(2) : '--'} />
            <StatBlock label="eDPI" value={edpi > 0 ? Math.round(edpi).toLocaleString() : '--'} />
          </div>
          <StatBlock
            label="Playstyle"
            value={cm360 > 0 ? playstyle.name : '--'}
            sub={cm360 > 0 ? `${playstyle.range} — ${playstyle.description}` : undefined}
          />
        </div>

        {/* Swap button */}
        <div className="flex lg:flex-col items-center justify-center py-4 lg:py-0 lg:mt-24">
          <button
            onClick={handleSwap}
            className="p-3 border border-[rgba(255,255,255,0.2)] bg-transparent text-white hover:opacity-50 transition-opacity cursor-pointer"
            style={{ borderRadius: 0 }}
            aria-label="Swap source and target"
          >
            <ArrowDownUp size={18} className="lg:rotate-0 rotate-90" />
          </button>
        </div>

        {/* Target */}
        <div className="flex flex-col gap-5">
          <h2
            className="font-mono text-[11px] uppercase tracking-[1.4px]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Target
          </h2>
          <GameSelect label="Game" games={games} value={targetId} onChange={setTargetId} />

          {/* Converted result */}
          <motion.div
            className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] p-6 flex flex-col gap-4"
            style={{ borderRadius: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span
              className="font-mono text-[11px] uppercase tracking-[1.4px]"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Converted Sensitivity
            </span>
            <motion.span
              key={`${convertedSens}-${targetId}`}
              className="font-mono text-[36px] text-white leading-none"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {convertedSens > 0 ? formatSens(convertedSens, targetGame) : '--'}
            </motion.span>
            <div className="flex gap-6">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  eDPI
                </span>
                <span className="font-mono text-[14px] text-white">
                  {convertedEdpi > 0 ? Math.round(convertedEdpi).toLocaleString() : '--'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  cm/360
                </span>
                <span className="font-mono text-[14px] text-white">
                  {cm360 > 0 ? cm360.toFixed(2) : '--'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* All games */}
      <AllGamesTable sourceGame={sourceGame} sourceSens={sourceSens} dpi={dpi} />
    </motion.section>
  );
}
