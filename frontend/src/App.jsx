import React, { Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import { useAppStore } from './store/useAppStore';
import { bridge } from './lib/bridge';
import { applyUiTheme, readStoredUiTheme } from './lib/theme';
import { FEATURED, preloadSteamArt } from './data/homeFeatured';
import LumaCoreModal from './components/LumaCoreModal';
import DevConsole from './components/DevConsole';
import ToastHost from './components/ToastHost';
import ThemeAtmosphere from './components/ThemeAtmosphere';
import { GameContextHost } from './components/ContextMenu';
import DownloadBar from './components/DownloadBar';
import ProviderKeyDialog from './components/ProviderKeyDialog';
import TutorialOverlay from './components/TutorialOverlay';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Store = lazy(() => import('./pages/Store'));
const GameHub = lazy(() => import('./pages/GameHub'));
const Library = lazy(() => import('./pages/Library'));
const Settings = lazy(() => import('./pages/Settings'));
const CloudSaves = lazy(() => import('./pages/CloudSaves'));
const Logs = lazy(() => import('./pages/Logs'));
const FixGame = lazy(() => import('./pages/FixGame'));
const Tools = lazy(() => import('./pages/Tools'));

const PERSISTED = new Set(['home', 'store', 'library']);

function renderPage(id) {
  switch (id) {
    case 'store': return <Store />;
    case 'game-hub': return <GameHub />;
    case 'library': return <Library />;
    case 'fixgame': return <FixGame />;
    case 'cloudsaves': return <CloudSaves />;
    case 'tools': return <Tools />;
    case 'settings': return <Settings />;
    case 'logs': return <Logs />;
    default: return <Home />;
  }
}

function PageFallback() {
  return (
    <div className="page-fallback">
      <div className="page-fallback-spin" />
      <span>Loading…</span>
    </div>
  );
}

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page-fallback">
          <span>This page failed to load.</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

function setBootMessage(text) {
  const msg = document.querySelector('#boot-splash .boot-msg');
  if (msg) msg.textContent = text;
}

function dismissBootChrome() {
  if (window.__KRAKEN_BOOTED) return;
  window.__KRAKEN_BOOTED = true;
  try { window.Bridge?.signal_ready?.(); } catch { /* ignore */ }
  const el = document.getElementById('boot-splash');
  if (el && !el.classList.contains('boot-out')) {
    el.classList.add('boot-out');
    setTimeout(() => el.remove(), 420);
  }
}

function feedHasItems(feed) {
  if (!feed || typeof feed !== 'object') return false;
  return ['top_sellers', 'most_played', 'new_releases'].some(
    (key) => Array.isArray(feed[key]) && feed[key].length > 0,
  );
}

async function waitForHomeWarmup() {
  setBootMessage('Loading storefront…');
  let feedReady = false;
  try {
    const raw = window.Bridge?.get_home_feed_cached?.();
    const data = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
    feedReady = feedHasItems(data);
  } catch { /* ignore */ }

  if (!feedReady) {
    try { window.Bridge?.get_home_feed?.(); } catch { /* ignore */ }
    feedReady = await new Promise((resolve) => {
      const finish = (ok) => {
        try { window.Bridge?.task_finished?.disconnect?.(handler); } catch { /* ignore */ }
        resolve(ok);
      };
      const handler = (raw) => {
        try {
          const evt = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (evt?.task === 'home_feed') finish(feedHasItems(evt.data));
        } catch { /* ignore */ }
      };
      try { window.Bridge?.task_finished?.connect?.(handler); } catch { /* ignore */ }
      setTimeout(() => finish(false), 4500);
    });
  }

  setBootMessage('Warming artwork…');
  await Promise.race([
    Promise.all(FEATURED.slice(0, 4).map((g) => preloadSteamArt(g.id, 'hero'))),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  return feedReady;
}

export default function App() {
  const activePage = useAppStore(s => s.activePage);
  const setSteamStatus = useAppStore(s => s.setSteamStatus);
  const setLumaCore = useAppStore(s => s.setLumaCore);
  const setUiTheme = useAppStore(s => s.setUiTheme);
  const [lumaModalOpen, setLumaModalOpen] = React.useState(false);
  const [devConsoleOpen, setDevConsoleOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpenLC = () => setLumaModalOpen(true);
    const handleOpenConsole = () => setDevConsoleOpen(prev => !prev);
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.key === '`') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        setDevConsoleOpen(prev => !prev);
      }
    };

    window.addEventListener('open_lumacore_modal', handleOpenLC);
    window.addEventListener('open_dev_console', handleOpenConsole);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open_lumacore_modal', handleOpenLC);
      window.removeEventListener('open_dev_console', handleOpenConsole);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    applyUiTheme(readStoredUiTheme());
    const fallback = setTimeout(() => {
      setBootMessage('Opening Kraken…');
      dismissBootChrome();
    }, 8000);
    return () => clearTimeout(fallback);
  }, []);

  React.useEffect(() => {
    let lastStatus = null;

    const fetchStatus = () => {
      bridge.call('get_steam_client_status').then(res => {
        if (!res) return;
        try {
          const data = typeof res === 'string' ? JSON.parse(res) : res;
          const next = {
            connected:    data.running,
            path:         data.path,
            label:        data.label,
            running:      data.running,
            persona_name: data.persona_name || lastStatus?.persona_name || '',
            avatar_url:   data.avatar_url   || lastStatus?.avatar_url   || '',
          };
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

    const unsubLib = bridge.on('task_finished', (raw) => {
      try {
        const evt = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (evt.task === 'library_loaded') {
          useAppStore.getState().applyLibraryPayload(evt.games);
        }
        if (evt.task === 'lumacore_patterns_updated' || evt.task === 'restart_steam') {
          useAppStore.getState().setLumaCore({
            restart_needed: evt.task === 'lumacore_patterns_updated' ? true : false,
            steam_updated: !!evt.steam_updated,
          });
        }
        if (evt.task === 'auto_lc_setup' && evt.success) {
          bridge.call('lumacore_check_update', 'force').then((res) => {
            if (!res) return;
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            useAppStore.getState().setLumaCore({
              installed: data.installed || '',
              latest: data.latest || '',
              update_available: !!data.update_available,
              missing: !data.installed && !data.error,
              restart_needed: !!data.restart_needed,
              steam_updated: !!data.steam_updated,
            });
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    });

    bridge.ready.then(async () => {
      try {
        const raw = await bridge.call('get_settings');
        const data = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
        const theme = applyUiTheme(data?.ui_theme || readStoredUiTheme());
        setUiTheme(theme);
      } catch {
        const theme = applyUiTheme(readStoredUiTheme());
        setUiTheme(theme);
      }
      await waitForHomeWarmup();
      dismissBootChrome();
      fetchStatus();
      try { window.Bridge?.load_library?.(); } catch { /* ignore */ }
      try {
        const fav = await bridge.call('get_kraken_favorites');
        const ids = typeof fav === 'string' ? JSON.parse(fav || '[]') : fav;
        if (Array.isArray(ids)) useAppStore.getState().setFavorites(ids);
      } catch { /* ignore */ }
      import('./pages/Store');
      import('./pages/Library');

      setTimeout(() => {
        bridge.call('lumacore_check_update', '').then(res => {
          if (!res) return;
          try {
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            const missing = !data.installed && !data.error;
            setLumaCore({
              installed: data.installed || '',
              latest: data.latest || '',
              update_available: !!data.update_available,
              missing,
              restart_needed: !!data.restart_needed,
              steam_updated: !!data.steam_updated,
            });
            const prompted = sessionStorage.getItem('kraken_lc_prompted');
            if (!prompted && missing) {
              setLumaModalOpen(true);
            }
            sessionStorage.setItem('kraken_lc_prompted', '1');
          } catch { /* ignore */ }
        }).catch(() => {});
      }, 1800);
    });

    const interval = setInterval(fetchStatus, 15000);
    return () => {
      clearInterval(interval);
      unsubLib?.();
    };
  }, []);

  const [seen, setSeen] = React.useState(() => new Set(['home']));
  React.useEffect(() => {
    if (!PERSISTED.has(activePage)) return;
    setSeen(prev => {
      if (prev.has(activePage)) return prev;
      const next = new Set(prev);
      next.add(activePage);
      return next;
    });
  }, [activePage]);

  return (
    <div className="app-layout">
      <ThemeAtmosphere />
      <Sidebar />
      <main className="app-content">
        {['home', 'store', 'library'].map(id => (
          seen.has(id) ? (
            <div
              key={id}
              className={`app-page ${activePage === id ? 'is-active' : 'is-hidden'}`}
              hidden={activePage !== id}
            >
              <PageErrorBoundary resetKey={id}>
                <Suspense fallback={<PageFallback />}>
                  {renderPage(id)}
                </Suspense>
              </PageErrorBoundary>
            </div>
          ) : null
        ))}
        {!PERSISTED.has(activePage) && (
          <div className="app-page is-active">
            <PageErrorBoundary resetKey={activePage}>
              <Suspense fallback={<PageFallback />}>
                {renderPage(activePage)}
              </Suspense>
            </PageErrorBoundary>
          </div>
        )}
      </main>

      <LumaCoreModal
        isOpen={lumaModalOpen}
        onClose={() => setLumaModalOpen(false)}
      />
      <DevConsole
        isOpen={devConsoleOpen}
        onClose={() => setDevConsoleOpen(false)}
      />
      <DownloadBar />
      <ToastHost />
      <ProviderKeyDialog />
      <TutorialOverlay />
      <GameContextHost />
    </div>
  );
}
