import { motion } from 'framer-motion';

interface StatBlockProps {
  label: string;
  value: string;
  sub?: string;
}

export function StatBlock({ label, value, sub }: StatBlockProps) {
  return (
    <motion.div
      className="flex flex-col gap-1 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] p-4"
      style={{ borderRadius: 0 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <span
        className="font-mono text-[11px] uppercase tracking-[1.4px]"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </span>
      <motion.span
        key={value}
        className="font-mono text-[22px] text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        {value}
      </motion.span>
      {sub && (
        <span
          className="font-sans text-[12px]"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          {sub}
        </span>
      )}
    </motion.div>
  );
}
