import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { games } from '../data/games';
import { convertSensitivity, calcEDPI } from '../engine/sensitivity';
import type { Game } from '../data/games';

interface AllGamesTableProps {
  sourceGame: Game;
  sourceSens: number;
  dpi: number;
}

export function AllGamesTable({ sourceGame, sourceSens, dpi }: AllGamesTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const results = useMemo(() => {
    return games
      .filter((g) => g.id !== sourceGame.id)
      .map((g) => {
        const sens = convertSensitivity(sourceGame, g, sourceSens, dpi);
        const edpi = calcEDPI(dpi, sens);
        return { game: g, sens, edpi };
      });
  }, [sourceGame, sourceSens, dpi]);

  const handleCopy = (id: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const formatSens = (sens: number, game: Game): string => {
    if (game.sensStep >= 1) return Math.round(sens).toString();
    if (game.sensStep >= 0.1) return sens.toFixed(1);
    if (game.sensStep >= 0.01) return sens.toFixed(2);
    return sens.toFixed(3);
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-mono text-[13px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
        All Games
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {results.map((r, i) => {
          const sensStr = formatSens(r.sens, r.game);
          return (
            <motion.div
              key={r.game.id}
              className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] p-4 flex flex-col gap-3 group"
              style={{ borderRadius: 0 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <div className="flex items-center justify-between">
                <span className="font-sans text-[14px] text-white">{r.game.name}</span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[1px] px-2 py-0.5 border border-[rgba(255,255,255,0.1)]"
                  style={{ color: 'rgba(255,255,255,0.4)', borderRadius: 0 }}
                >
                  {r.game.category}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="font-mono text-[20px] text-white">{sensStr}</span>
                  <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    eDPI {Math.round(r.edpi).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(r.game.id, sensStr)}
                  className="p-2 border border-[rgba(255,255,255,0.1)] bg-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:opacity-50"
                  style={{ borderRadius: 0 }}
                  aria-label={`Copy ${r.game.name} sensitivity`}
                >
                  {copiedId === r.game.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
