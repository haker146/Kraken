import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, SlidersHorizontal, Zap, Shield, ShieldAlert, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import './Store.css';

const FILTERS = [
  { id: 'all',         label: 'All Games' },
  { id: 'cracked',     label: '⚡ Cracked' },
  { id: 'not_cracked', label: '🔒 Not Cracked' },
  { id: 'clean',       label: '✓ DRM-Free' },
];

const DRM_COLORS = {
  'Denuvo':               { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.25)' },
  'Denuvo + VMProtect':   { bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.35)' },
  'Steam DRM':            { bg: 'rgba(56,189,248,0.1)',   color: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  'EAC':                  { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'BattleEye':            { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'Rockstar DRM':         { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'Rockstar Social Club DRM': { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'None':                 { bg: 'rgba(74,222,128,0.1)',   color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
};

function getDrmIcon(drm, size = 11) {
  if (!drm) return <Shield size={size} />;
  const s = drm.toLowerCase();
  if (s.includes('denuvo'))  return <ShieldAlert size={size} />;
  if (s.includes('steam'))   return <ShieldCheck size={size} />;
  if (s === 'none')          return <ShieldOff size={size} />;
  return <Shield size={size} />;
}

function CrackStatusChip({ status, ver, src, date }) {
  if (status === 'cracked') return (
    <div className="crack-chip cracked">
      <Zap size={11} /> Cracked {ver && <span className="chip-ver">v{ver}</span>}
      {src && <span className="chip-src">{src}</span>}
    </div>
  );
  if (status === 'clean') return (
    <div className="crack-chip clean"><ShieldOff size={11} /> DRM-Free</div>
  );
  return (
    <div className="crack-chip locked"><ShieldAlert size={11} /> Not Cracked</div>
  );
}

function StoreRow({ game, index }) {
  const { setActiveGame, setActivePage } = useAppStore();
  const drm = game.drm || 'Unknown';
  const drmStyle = DRM_COLORS[drm]
    || (drm.toLowerCase().includes('denuvo') ? DRM_COLORS['Denuvo'] : null)
    || (drm.toLowerCase().includes('steam')  ? DRM_COLORS['Steam DRM'] : null)
    || { bg: 'rgba(113,113,122,0.1)', color: '#71717a', border: 'rgba(113,113,122,0.2)' };

  const thumb = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/header.jpg`;
  const fallback = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/capsule_616x353.jpg`;

  return (
    <div
      className="store-row"
      onClick={() => {
        setActiveGame({
          ...game,
          cover_url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/library_600x900.jpg`,
        });
        setActivePage('game-hub');
      }}
    >
      {/* Thumbnail */}
      <div className="store-row-thumb">
        <img
          src={thumb}
          alt={game.name}
          loading="lazy"
          onError={e => {
            if (e.target.src === thumb) {
              e.target.src = fallback;
            } else if (e.target.src === fallback && game.image_url) {
              e.target.src = game.image_url;
            } else {
              e.target.src = 'https://crackrelease.com/wp-content/uploads/2023/11/placeholder-image.jpg';
            }
          }}
        />
      </div>

      {/* Main Info */}
      <div className="store-row-main">
        <div className="store-row-title">{game.name}</div>
        <div className="store-row-tags">
          {(game.tags || []).slice(0, 4).map(t => <span key={t} className="store-tag">{t}</span>)}
        </div>
      </div>

      {/* DRM & Crack Info */}
      <div className="store-row-right">
        {/* DRM Badge */}
        <div
          className="store-drm-badge"
          style={{ background: drmStyle.bg, color: drmStyle.color, border: `1px solid ${drmStyle.border}` }}
        >
          {getDrmIcon(drm, 11)}
          {drm}
        </div>

        {/* Crack chip */}
        <CrackStatusChip
          status={game.crack_status}
          ver={game.crack_ver}
          src={game.crack_src}
          date={game.crack_date}
        />

        {/* Date */}
        {game.crack_date && (
          <div className="store-crack-date">{game.crack_date}</div>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 15;

export default function Store() {
  const { setActiveGame, setActivePage } = useAppStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0); // 0-indexed for offset
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapRef = useRef(null);
  const loaderRef = useRef(null);
  const { db, lookupGame } = useCrackDB();
  const searchIdRef = useRef('');

  // Close suggestions on outside click
  useEffect(() => {
    const handleDocClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  // Fetch suggestions on fast input change
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (window.Bridge?.suggest_store_games) {
          const res = window.Bridge.suggest_store_games(q);
          const parsed = typeof res === 'string' ? JSON.parse(res) : res;
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSuggestions(parsed);
            setShowSuggestions(true);
            return;
          }
        }
      } catch (err) {
        console.debug('Suggestions error:', err);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // Debounce main search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(0);
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Call backend search ────────────────────────────────────────────────────────
  const fetchGames = useCallback((targetPage = 0) => {
    const reqId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    searchIdRef.current = reqId;
    setLoading(true);

    if (targetPage === 0) {
      setGames([]);
    }

    const offset = targetPage * PAGE_SIZE;

    const fire = () => {
      const b = window.Bridge;
      if (!b?.search_games) {
        console.warn('[Store] Bridge not ready for search_games');
        setLoading(false);
        return;
      }
      b.search_games(debouncedQuery, offset, PAGE_SIZE, 'updated', '', reqId);
    };

    if (window.Bridge?.search_games) {
      fire();
    } else {
      import('../lib/bridge').then(({ bridge }) =>
        bridge.ready.then(() => { if (searchIdRef.current === reqId) fire(); })
      );
    }
  }, [debouncedQuery]);

  // Handle QWebChannel response
  useEffect(() => {
    const setupHandler = () => {
      if (!window.Bridge?.search_results?.connect) return null;
      const handler = (jsonStr) => {
        try {
          const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
          if (res.request_id !== searchIdRef.current) return; // Stale result

          const rawGames = res.games || [];

          // Enrich from crackDB using lookupGame
          const enriched = rawGames.map(g => {
            const aid = String(g.app_id || g.appid);
            const crackEntry = lookupGame ? lookupGame(aid) : db?.[aid];
            const drm = crackEntry?.drm || g.drm || (crackEntry?.is_standard_steam ? 'Steam DRM' : 'Unknown');
            
            let cStatus = 'cracked';
            if (crackEntry) {
              if (crackEntry.cracked) {
                cStatus = (drm === 'None' || drm.toLowerCase().includes('removed')) ? 'clean' : 'cracked';
              } else {
                cStatus = 'not_cracked';
              }
            } else if (g.crack_status) {
              cStatus = g.crack_status;
            }

            return {
              app_id: aid,
              name: g.name,
              image_url: g.image_url || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${aid}/capsule_616x353.jpg`,
              drm: drm,
              crack_status: cStatus,
              crack_ver: crackEntry?.crack_ver || crackEntry?.crack_version || g.crack_ver,
              crack_src: crackEntry?.crack_source || g.crack_src,
              crack_date: crackEntry?.crack_date || g.crack_date,
              tags: g.tags || [],
            };
          });

          // Local filtering for crack status
          let filtered = enriched;
          if (filter !== 'all') {
            filtered = enriched.filter(g => g.crack_status === filter);
          }

          // Sorting: exact or prefix matches first
          if (debouncedQuery) {
            const q = debouncedQuery.toLowerCase();
            filtered.sort((a, b) => {
              const aName = (a.name || '').toLowerCase();
              const bName = (b.name || '').toLowerCase();
              const aExact = aName === q;
              const bExact = bName === q;
              if (aExact && !bExact) return -1;
              if (bExact && !aExact) return 1;
              
              const aStarts = aName.startsWith(q);
              const bStarts = bName.startsWith(q);
              if (aStarts && !bStarts) return -1;
              if (bStarts && !aStarts) return 1;
              
              return 0;
            });
          }

          setGames(prev => {
            return (res.offset === 0 || !res.offset) ? filtered : [...prev, ...filtered];
          });
          setTotal(res.total || 0);
          setHasMore((res.total || 0) > (res.offset || 0) + rawGames.length);
          setLoading(false);
        } catch (err) {
          console.error('Failed to parse search results', err);
          setLoading(false);
        }
      };
      window.Bridge.search_results.connect(handler);
      return handler;
    };

    let connectedHandler = null;
    if (window.Bridge) {
      connectedHandler = setupHandler();
    } else {
      import('../lib/bridge').then(({ bridge }) =>
        bridge.ready.then(() => { connectedHandler = setupHandler(); })
      );
    }

    return () => {
      try {
        if (connectedHandler && window.Bridge?.search_results?.disconnect) {
          window.Bridge.search_results.disconnect(connectedHandler);
        }
      } catch (e) {}
    };
  }, [db, filter, lookupGame, debouncedQuery]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loaderRef.current || loading) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !loading) {
        setPage(p => {
          const next = p + 1;
          fetchGames(next);
          return next;
        });
      }
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, fetchGames]);

  // Trigger search on debounced query or filter change
  useEffect(() => {
    fetchGames(0);
  }, [debouncedQuery, filter, fetchGames]);

  const handleSuggestionClick = (sug) => {
    setShowSuggestions(false);
    setActiveGame({
      app_id: sug.app_id,
      name: sug.name,
      cover_url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${sug.app_id}/library_600x900.jpg`,
      image_url: sug.capsule_url || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${sug.app_id}/capsule_616x353.jpg`,
    });
    setActivePage('game-hub');
  };

  return (
    <div className="store-page">
      {/* Toolbar */}
      <div className="store-toolbar">
        <div className="store-search-wrap" ref={searchWrapRef}>
          <Search size={14} className="store-search-icon" />
          <input
            className="store-search"
            placeholder="Szukaj gry lub ID..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setShowSuggestions(false);
                setDebouncedQuery(query);
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
          />
          {query && (
            <button className="store-search-clear" onClick={() => { setQuery(''); setDebouncedQuery(''); setSuggestions([]); }}>
              <X size={13} />
            </button>
          )}

          {/* Steam-like suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div 
                className="store-suggestions"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <div className="store-suggestions-header">Wyniki wyszukiwania</div>
                {suggestions.map(s => {
                  const aid = String(s.app_id);
                  const crackEntry = lookupGame ? lookupGame(aid) : db?.[aid];
                  const drm = crackEntry?.drm || (crackEntry?.is_standard_steam ? 'Steam DRM' : 'Steam');
                  return (
                    <div 
                      key={s.app_id} 
                      className="store-suggestion-row" 
                      onClick={() => handleSuggestionClick(s)}
                    >
                      <img 
                        src={s.capsule_url || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${s.app_id}/capsule_184x69.jpg`}
                        alt={s.name}
                        className="store-suggestion-thumb"
                        onError={e => {
                          e.target.src = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${s.app_id}/header.jpg`;
                        }}
                      />
                      <div className="store-suggestion-info">
                        <div className="store-suggestion-title">{s.name}</div>
                        <div className="store-suggestion-meta">
                          <span className="store-suggestion-appid">AppID: {s.app_id}</span>
                          <span className="store-suggestion-badge">{drm}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="store-filter-pills">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`filter-pill ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="store-count">{total} gier</div>

      {/* List */}
      <div className="store-list">
        {games.map((game, i) => (
          <StoreRow key={game.app_id + i} game={game} index={i} />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && !loading && (
          <div ref={loaderRef} className="store-loader">
            <span>Ładowanie więcej…</span>
          </div>
        )}

        {loading && (
          <div className="store-loader">
            <span>Wyszukiwanie...</span>
          </div>
        )}

        {games.length === 0 && !loading && (
          <div className="store-empty">Brak gier spełniających kryteria wyszukiwania.</div>
        )}
      </div>
    </div>
  );
}

