import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import { Converter } from './components/Converter';

function App() {
  return (
    <div className="min-h-screen font-sans" style={{ background: '#1f2228', color: '#ffffff' }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-12 flex flex-col gap-16">
        {/* Hero */}
        <motion.header
          className="flex flex-col gap-4 items-start"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <Crosshair size={20} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span
              className="font-mono text-[11px] uppercase tracking-[1.4px]"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Sensitivity Converter
            </span>
          </div>
          <h1 className="font-mono text-[48px] sm:text-[64px] lg:text-[80px] font-light leading-[0.9] tracking-tight text-white">
            SENS
          </h1>
          <p
            className="font-sans text-[16px] max-w-[480px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Convert your mouse sensitivity between FPS games.
            Same muscle memory, every game.
          </p>
        </motion.header>

        {/* Separator */}
        <div className="border-t border-[rgba(255,255,255,0.06)]" />

        {/* Converter (includes all games table + playstyle guide) */}
        <Converter />

        {/* Footer */}
        <footer className="border-t border-[rgba(255,255,255,0.06)] pt-8">
          <p
            className="font-mono text-[11px] uppercase tracking-[1.4px]"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Sens Converter — Built for precision
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
