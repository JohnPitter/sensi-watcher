import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import { Converter } from './components/Converter';
import { SensiFinder } from './components/SensiFinder';
import { PlaystyleGuide } from './components/PlaystyleGuide';
import { LandingHero } from './components/LandingHero';
import { AimLab } from './components/AimLab';

type Tab = 'home' | 'converter' | 'finder' | 'guide' | 'trainer';

const NAV_TABS: { id: Tab; label: string }[] = [
  { id: 'converter', label: 'CONVERTER' },
  { id: 'finder', label: 'ENCONTRAR SENS' },
  { id: 'trainer', label: 'TREINO' },
  { id: 'guide', label: 'GUIA' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  function handleNavigate(tab: 'converter' | 'finder' | 'guide' | 'trainer') {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: '#1f2228', color: '#ffffff' }}>
      {/* Sticky navbar */}
      <nav
        className="sticky top-0 z-50 w-full border-b border-[rgba(255,255,255,0.08)]"
        style={{ background: '#1f2228' }}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 flex items-center justify-between h-14">
          {/* Logo — clickable, returns to home */}
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 shrink-0 hover:opacity-50 transition-opacity"
          >
            <Crosshair size={16} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="font-mono text-[12px] sm:text-[13px] uppercase tracking-[1.4px] text-white font-medium">
              Sensi Watcher
            </span>
          </button>

          {/* Tab navigation */}
          <div className="flex items-center gap-0">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative font-mono text-[10px] sm:text-[11px] uppercase tracking-[1.4px] px-3 sm:px-5 py-4 transition-opacity cursor-pointer"
                style={{
                  color: activeTab === tab.id ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.35)',
                }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-white"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content area */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <LandingHero onNavigate={handleNavigate} />
            </motion.div>
          )}

          {activeTab === 'converter' && (
            <motion.div
              key="converter"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <Converter />
            </motion.div>
          )}

          {activeTab === 'finder' && (
            <motion.div
              key="finder"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <SensiFinder />
            </motion.div>
          )}

          {activeTab === 'trainer' && (
            <motion.div
              key="trainer"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <AimLab />
            </motion.div>
          )}

          {activeTab === 'guide' && (
            <motion.div
              key="guide"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <PlaystyleGuide currentCm360={0} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.06)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <p
            className="font-mono text-[11px] uppercase tracking-[1.4px]"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            Sensi Watcher — Built for precision
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
