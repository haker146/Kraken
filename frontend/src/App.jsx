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
    let lastStatus = null;

    const fetchStatus = () => {
      bridge.call('get_steam_client_status').then(res => {
        if (!res) return;
        try {
          const data = typeof res === 'string' ? JSON.parse(res) : res;
          // Keep previous persona/avatar data when Steam goes momentarily
          // missing so a single failed VDF read doesn't clear the sidebar.
          const next = {
            connected:    data.running,
            path:         data.path,
            label:        data.label,
            running:      data.running,
            persona_name: data.persona_name || lastStatus?.persona_name || '',
            avatar_url:   data.avatar_url   || lastStatus?.avatar_url   || '',
          };
          // Only re-render if something actually changed
          const changed = !lastStatus
            || lastStatus.running      !== next.running
            || lastStatus.persona_name !== next.persona_name
            || lastStatus.avatar_url   !== next.avatar_url
            || lastStatus.label        !== next.label;
          if (changed) {
            lastStatus = next;
            setSteamStatus(next);
          }
        } catch (e) {
          console.error('[App] steam status parse error:', e);
        }
      }).catch(() => {});
    };

    // Wait for bridge to be ready before the first poll
    bridge.ready.then(() => {
      fetchStatus();
    });

    const interval = setInterval(fetchStatus, 8000);
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
