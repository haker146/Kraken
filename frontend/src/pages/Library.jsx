import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, RefreshCw, Loader2, AlertTriangle, Download } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import SteamImage from '../components/SteamImage';
import { useCrackDB } from '../hooks/useCrackDB';
import { gameNeedsDownload, installViaSteam } from '../lib/libraryActions';
import './Library.css';

function buildVsCrack(game, lookupGame) {
  const rec = lookupGame(game.app_id);
  const installed = String(game.buildid || '').trim();
  const crack = String(rec?.required_build || '').trim();
  if (installed && crack && installed === crack) {
    return { tone: 'green', label: 'Build match', title: `Installed ${installed} matches crack ${crack}` };
  }
  if (installed && crack && installed !== crack) {
    return { tone: 'red', label: 'Wrong build', title: `Installed ${installed} vs crack ${crack}` };
  }
  if (game.has_update) {
    return { tone: 'yellow', label: 'Update', title: 'Newer Steam/manifest build available' };
  }
  if (!installed || !crack) {
    return { tone: 'yellow', label: installed ? `Build ${installed}` : 'Build unknown', title: crack ? `Crack build ${crack}` : 'Installed or crack build is unknown' };
  }
  return { tone: 'yellow', label: 'Build unknown', title: 'Could not compare installed build vs crack' };
}

const STATUS_META = {
  cracked: { label: '⚡ Cracked', cls: 'cracked' },
  clean:   { label: '✓ DRM-Free', cls: 'clean'  },
  locked:  { label: '🔒 Locked',  cls: 'locked' },
};

const cover = (appId) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;

export default function Library() {
  const [query, setQuery] = useState('');
  const games = useAppStore((s) => s.games);
  const applyLibraryPayload = useAppStore((s) => s.applyLibraryPayload);
  const [loading, setLoading] = useState(() => !(useAppStore.getState().games || []).length);
  const [error, setError] = useState(null);
  const { setActiveGame, setActivePage, setHubBackPage, openGameCtx, favorites } = useAppStore();
  const { lookupGame } = useCrackDB({ prefetch: true });

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
        if (res?.ok) {
          applyLibraryPayload(res.data || []);
        } else setError(res?.error || 'Failed to load library');
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
          applyLibraryPayload(evt.games || []);
          setError(null);
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
    const timeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) setError('Library took too long to load. Try Refresh.');
        return false;
      });
    }, 20000);

    return () => {
      clearTimeout(timeout);
      if (connected && window.Bridge?.task_finished?.disconnect) {
        try { window.Bridge.task_finished.disconnect(handler); } catch { /* */ }
      }
    };
  }, []);

  const filtered = games.filter(g =>
    g.name.toLowerCase().includes(query.toLowerCase())
  );

  const handlePlayGame = (game) => {
    if (!game) return;
    if (gameNeedsDownload(game)) {
      installViaSteam(game.app_id);
      return;
    }
    if (window.Bridge?.launch_game) {
      window.Bridge.launch_game(String(game.app_id));
    }
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
    <div className="library-page">
      <div className="library-header">
        <div>
          <h2 className="library-title">Your Library</h2>
          <p className="library-subtitle">
            {filtered.length} game{filtered.length !== 1 ? 's' : ''}
            {games.filter(gameNeedsDownload).length
              ? ` · ${games.filter(gameNeedsDownload).length} waiting to download`
              : ' in library'}
          </p>
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

      {games.some((g) => g.has_update) && (
        <div className="lib-update-banner">
          <AlertTriangle size={14} />
          <span>
            {games.filter((g) => g.has_update).length} game
            {games.filter((g) => g.has_update).length === 1 ? '' : 's'} have a newer Steam/manifest build.
            Open a title to pin the crack build or grab the new manifest.
          </span>
        </div>
      )}

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
            const isFav = (favorites || []).includes(String(game.app_id));
            const coverSrc = game.cover_url || cover(game.app_id);
            const match = buildVsCrack(game, lookupGame);
            const needsDl = gameNeedsDownload(game);

            return (
              <motion.div
                key={game.app_id}
                className={`lib-card ${isFav ? 'favorited' : ''} build-${match.tone} ${needsDl ? 'needs-download' : ''}`}
                title={game.name}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 14) * 0.035, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => { setHubBackPage('library'); setActiveGame({ ...game, cover_url: coverSrc, image_url: game.image_url }); setActivePage('game-hub'); }}
                onContextMenu={(e) => openGameCtx(e, game)}
              >
                <div className="lib-card-cover">
                  <SteamImage
                    appId={game.app_id}
                    src={coverSrc}
                    alt={game.name}
                    kind="cover"
                  />
                  <div className="lib-card-hover">
                    <button
                      className={`lib-play-btn ${needsDl ? 'is-download' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handlePlayGame(game); }}
                    >
                      {needsDl ? <><Download size={13} /> Download</> : '▶ Play'}
                    </button>
                  </div>
                </div>

                {isFav && <span className="lib-fav-star">★</span>}
                <span className={`lib-status-badge ${needsDl ? 'queued' : st.cls}`}>
                  {needsDl ? 'Not downloaded' : st.label}
                </span>
                <span className={`lib-build-badge ${match.tone}`} title={match.title}>
                  {match.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}

    </div>
  );
}
