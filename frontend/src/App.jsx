import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Store from './pages/Store';
import GameHub from './pages/GameHub';
import Library from './pages/Library';
import { useAppStore } from './store/useAppStore';
import './App.css';

const PAGES = {
  home:       <Home />,
  store:      <Store />,
  'game-hub': <GameHub />,
  library:    <Library />,
  fixgame:   <PlaceholderPage label="Fix Game" />,
  downgrade: <PlaceholderPage label="Downgrade" />,
  cloudsaves:<PlaceholderPage label="Cloud Saves" />,
  tools:     <PlaceholderPage label="Tools" />,
  settings:  <PlaceholderPage label="Settings" />,
  logs:      <PlaceholderPage label="Logs" />,
};

function PlaceholderPage({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', flexDirection: 'column', gap: 12, opacity: 0.3,
    }}>
      <span style={{ fontSize: 48 }}>🚧</span>
      <span style={{ fontSize: 18, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--t-muted)' }}>Coming soon</span>
    </div>
  );
}

export default function App() {
  const activePage = useAppStore(s => s.activePage);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            className="app-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {PAGES[activePage] || PAGES.home}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
