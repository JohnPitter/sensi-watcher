interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  presets?: number[];
}

export function NumberInput({
  label,
  value,
  onChange,
  step = 0.01,
  min = 0,
  max,
  presets,
}: NumberInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="font-mono text-[11px] uppercase tracking-[1.4px]"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        step={step}
        min={min}
        max={max}
        className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-none px-4 py-3 text-white font-mono text-[15px] outline-none focus:border-[rgba(255,255,255,0.3)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {presets && presets.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`font-mono text-[11px] uppercase tracking-[1.4px] px-3 py-1.5 border transition-opacity cursor-pointer ${
                value === p
                  ? 'bg-white text-[#1f2228] border-white'
                  : 'bg-transparent text-white border-[rgba(255,255,255,0.2)] hover:opacity-50'
              }`}
              style={{ borderRadius: 0 }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
