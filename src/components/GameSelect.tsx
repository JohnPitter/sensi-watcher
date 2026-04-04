import { ChevronDown } from 'lucide-react';
import type { Game } from '../data/games';

interface GameSelectProps {
  label: string;
  games: Game[];
  value: string;
  onChange: (id: string) => void;
}

export function GameSelect({ label, games, value, onChange }: GameSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="font-mono text-[11px] uppercase tracking-[1.4px]"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-none px-4 py-3 pr-10 text-white font-sans text-[15px] outline-none focus:border-[rgba(255,255,255,0.3)] transition-colors cursor-pointer"
        >
          {games.map((g) => (
            <option key={g.id} value={g.id} className="bg-[#1f2228] text-white">
              {g.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        />
      </div>
    </div>
  );
}
