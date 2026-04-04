import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PLAYSTYLE_RANGES } from '../engine/sensitivity';

interface PlaystyleGuideProps {
  currentCm360: number;
}

export function PlaystyleGuide({ currentCm360 }: PlaystyleGuideProps) {
  const scaleMax = 80;

  const markerPos = useMemo(() => {
    const clamped = Math.min(Math.max(currentCm360, 0), scaleMax);
    return (clamped / scaleMax) * 100;
  }, [currentCm360]);

  const proExamples = [
    { name: 's1mple (CS2)', cm360: '42 cm/360' },
    { name: 'TenZ (Valorant)', cm360: '34 cm/360' },
    { name: 'Carpe (OW2)', cm360: '28 cm/360' },
    { name: 'aceu (Apex)', cm360: '22 cm/360' },
    { name: 'Shroud', cm360: '28 cm/360' },
  ];

  const tips = [
    'Start with a medium sensitivity (25-35 cm/360) and adjust from there.',
    'Use aim trainers like Aimlabs or Kovaaks to test new sensitivities.',
    'Give each new sensitivity at least 3-5 days before switching again.',
    'Your mousepad size limits your effective cm/360 range.',
    'Lower sensitivities favor precision; higher ones favor mobility.',
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h2 className="font-mono text-[13px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Sensitivity Scale
        </h2>
        <div className="relative bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] p-6" style={{ borderRadius: 0 }}>
          {/* Scale bar */}
          <div className="relative h-8 bg-[rgba(255,255,255,0.05)] mb-6" style={{ borderRadius: 0 }}>
            {PLAYSTYLE_RANGES.map((range) => {
              const left = (range.min / scaleMax) * 100;
              const width = ((range.max - range.min) / scaleMax) * 100;
              return (
                <div
                  key={range.name}
                  className="absolute top-0 h-full border-r border-[rgba(255,255,255,0.1)] flex items-center justify-center"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[1px] hidden sm:block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {range.description}
                  </span>
                </div>
              );
            })}
            {/* Current position marker */}
            {currentCm360 > 0 && (
              <motion.div
                className="absolute top-0 h-full w-[2px] bg-white"
                style={{ left: `${markerPos}%` }}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[11px] text-white whitespace-nowrap"
                >
                  {currentCm360.toFixed(1)}
                </div>
              </motion.div>
            )}
          </div>
          {/* Labels */}
          <div className="flex justify-between font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span>FAST</span>
            <span>SLOW</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pro examples */}
        <div className="flex flex-col gap-4">
          <h3 className="font-mono text-[13px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Pro Player References
          </h3>
          <div className="flex flex-col gap-2">
            {proExamples.map((pro, i) => (
              <motion.div
                key={pro.name}
                className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] px-4 py-3"
                style={{ borderRadius: 0 }}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <span className="font-sans text-[14px] text-white">{pro.name}</span>
                <span className="font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{pro.cm360}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="flex flex-col gap-4">
          <h3 className="font-mono text-[13px] uppercase tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Tips
          </h3>
          <div className="flex flex-col gap-2">
            {tips.map((tip, i) => (
              <motion.div
                key={i}
                className="flex gap-3 items-start bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] px-4 py-3"
                style={{ borderRadius: 0 }}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <span className="font-mono text-[11px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-sans text-[14px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {tip}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
