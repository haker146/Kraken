import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import ContextMenu from '../components/ContextMenu';
import GameSettingsModal from '../components/GameSettingsModal';
import './Library.css';

const STATUS_META = {
  cracked: { label: '⚡ Cracked', cls: 'cracked' },
  clean:   { label: '✓ DRM-Free', cls: 'clean'  },
  locked:  { label: '🔒 Locked',  cls: 'locked' },
};

const cover = (appId) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;

export default function Library() {
  const [query, setQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [settingsGame, setSettingsGame] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setActiveGame, setActivePage } = useAppStore();

  const loadLibrary = () => {
    setLoading(true);
    setError(null);

    // QWebChannel (production) path
    if (window.Bridge) {
      window.Bridge.load_library();
      return;
    }

    // Electron path
    if (window.KrakenAPI) {
      window.KrakenAPI.call('load_library').then(res => {
        if (res?.ok) setGames(res.data || []);
        else setError(res?.error || 'Failed to load library');
        setLoading(false);
      }).catch(e => {
        setError(String(e));
        setLoading(false);
      });
      return;
    }

    // Dev HTTP path
    fetch('/api/load_library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args: [] }) })
      .then(r => r.json())
      .then(data => {
        // data comes back as task_finished payload via the normal bridge event
        setLoading(false);
      })
      .catch(() => {
        setError('Backend not reachable');
        setLoading(false);
      });
  };

  // Listen for task_finished events from QWebChannel
  useEffect(() => {
    const handler = (json) => {
      try {
        const evt = typeof json === 'string' ? JSON.parse(json) : json;
        if (evt.task === 'library_loaded') {
          const rawGames = evt.games || [];
          // Map backend fields to UI shape
          const mapped = rawGames.map(g => ({
            app_id:       String(g.app_id || g.appid || ''),
            name:         g.name || `App ${g.app_id}`,
            crack_status: g.crack_status || (g.cracked ? 'cracked' : 'clean'),
            drm:          g.drm || 'Unknown',
            crack_ver:    g.crack_ver || null,
            crack_src:    g.crack_src || null,
            crack_date:   g.crack_date || null,
            playtime:     g.playtime || '—',
            last_played:  g.last_played || '—',
            size:         g.size || '—',
            path:         g.path || '',
            image_url:    g.image_url || null,
          }));
          setGames(mapped);
          setLoading(false);
        }
      } catch { /* ignore */ }
    };

    let attempts = 0;
    let connected = false;

    const init = () => {
      if (window.Bridge?.task_finished?.connect) {
        window.Bridge.task_finished.connect(handler);
        connected = true;
        loadLibrary();
      } else if (window.KrakenAPI || attempts > 20) {
        // Fallback for Electron / Dev HTTP
        loadLibrary();
      } else {
        attempts++;
        setTimeout(init, 50);
      }
    };
    init();

    return () => {
      if (connected && window.Bridge?.task_finished?.disconnect) {
        try { window.Bridge.task_finished.disconnect(handler); } catch { /* */ }
      }
    };
  }, []);

  const filtered = games.filter(g =>
    g.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleContextMenu = (e, game) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, game });
  };

  const handleRemoveLibrary = (game) => {
    setGames(gs => gs.filter(g => g.app_id !== game.app_id));
  };

  if (loading) {
    return (
      <div className="library-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Loader2 size={22} className="spin" style={{ color: 'var(--c-accent)' }} />
        <span style={{ color: 'var(--t-muted)', fontSize: 14 }}>Loading your library…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="library-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.7 }}>
        <span style={{ fontSize: 36 }}>⚠️</span>
        <span style={{ fontSize: 14, color: 'var(--t-secondary)' }}>{error}</span>
        <button className="lib-refresh-btn" onClick={loadLibrary}>Retry</button>
      </div>
    );
  }

  return (
    <div className="library-page" onClick={() => setContextMenu(null)}>
      <div className="library-header">
        <div>
          <h2 className="library-title">Your Library</h2>
          <p className="library-subtitle">{filtered.length} game{filtered.length !== 1 ? 's' : ''} installed</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="library-search-wrap">
            <Search size={13} className="lib-search-icon" />
            <input
              className="lib-search"
              placeholder="Filter games…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button className="lib-refresh-btn" onClick={loadLibrary} title="Refresh library">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="library-empty">
          <span style={{ fontSize: 40 }}>📦</span>
          <p>No games in your library yet.</p>
          <p style={{ fontSize: 12, color: 'var(--t-muted)' }}>
            Use <strong>Store</strong> to download and unlock games.
          </p>
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map((game, i) => {
            const st = STATUS_META[game.crack_status] || STATUS_META.clean;
            const isFav = favorites.has(game.app_id);
            const imgSrc = game.image_url || cover(game.app_id);

            return (
              <motion.div
                key={game.app_id}
                className={`lib-card ${isFav ? 'favorited' : ''}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => { setActiveGame({ ...game, cover_url: imgSrc }); setActivePage('game-hub'); }}
                onContextMenu={(e) => handleContextMenu(e, game)}
              >
                <div className="lib-card-cover">
                  <img
                    src={imgSrc}
                    alt={game.name}
                    loading="lazy"
                    onError={e => { e.target.src = cover(game.app_id); }}
                  />
                  <div className="lib-card-hover">
                    <button className="lib-play-btn" onClick={e => e.stopPropagation()}>▶ Play</button>
                  </div>
                </div>

                {isFav && <span className="lib-fav-star">★</span>}
                <span className={`lib-status-badge ${st.cls}`}>{st.label}</span>

                <div className="lib-card-info">
                  <p className="lib-card-name">{game.name}</p>
                  <div className="lib-card-meta">
                    {game.playtime !== '—' && (
                      <span><Clock size={10} /> {game.playtime}</span>
                    )}
                    {game.size !== '—' && <span>{game.size}</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            game={contextMenu.game}
            onClose={() => setContextMenu(null)}
            onSettings={() => setSettingsGame(contextMenu.game)}
            onFavorite={() => setFavorites(f => {
              const next = new Set(f);
              next.has(contextMenu.game.app_id) ? next.delete(contextMenu.game.app_id) : next.add(contextMenu.game.app_id);
              return next;
            })}
            onRemoveLibrary={() => handleRemoveLibrary(contextMenu.game)}
            onRemoveDisk={() => handleRemoveLibrary(contextMenu.game)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsGame && (
          <GameSettingsModal
            game={settingsGame}
            onClose={() => setSettingsGame(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
