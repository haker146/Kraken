import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Store from './pages/Store';
import GameHub from './pages/GameHub';
import Library from './pages/Library';
import { useAppStore } from './store/useAppStore';
import { bridge } from './lib/bridge';
import Settings from './pages/Settings';
import CloudSaves from './pages/CloudSaves';
import './App.css';

const PAGES = {
  home:       <Home />,
  store:      <Store />,
  'game-hub': <GameHub />,
  library:    <Library />,
  fixgame:   <PlaceholderPage label="Fix Game" />,
  downgrade: <PlaceholderPage label="Downgrade" />,
  cloudsaves:<CloudSaves />,
  tools:     <PlaceholderPage label="Tools" />,
  settings:  <Settings />,
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
  const setSteamStatus = useAppStore(s => s.setSteamStatus);

  React.useEffect(() => {
    const fetchStatus = () => {
      bridge.call('get_steam_client_status').then(res => {
        if (res) {
          try {
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            setSteamStatus({
              connected: data.running,
              path: data.path,
              label: data.label,
              running: data.running,
              persona_name: data.persona_name,
              avatar_url: data.avatar_url
            });
          } catch (e) {
            console.error(e);
          }
        }
      }).catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

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
