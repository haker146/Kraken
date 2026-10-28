import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Zap, Shield, ShieldAlert, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import { bridge } from '../lib/bridge';
import SteamImage from '../components/SteamImage';
import './Store.css';

function drmLabel(raw) {
  if (raw == null || raw === false) return 'Unknown';
  if (Array.isArray(raw)) {
    const parts = raw.map(x => String(x || '').trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : 'Unknown';
  }
  if (typeof raw === 'boolean') return 'DRM';
  const s = String(raw).trim();
  return s || 'Unknown';
}

function tagList(raw) {
  if (Array.isArray(raw)) return raw.map(t => (typeof t === 'string' ? t : t?.name || t?.description || '')).filter(Boolean);
  return [];
}

const FILTERS = [
  { id: 'all',         label: 'All Games' },
  { id: 'cracked',     label: '⚡ Cracked' },
  { id: 'not_cracked', label: '🔒 Not Cracked' },
  { id: 'clean',       label: '✓ DRM-Free' },
];

const DRM_COLORS = {
  'Denuvo':               { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.25)' },
  'Denuvo removed by developer': { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  'Denuvo + VMProtect':   { bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.35)' },
  'Steam DRM':            { bg: 'rgba(56,189,248,0.1)',   color: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  'EAC':                  { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'BattleEye':            { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'Rockstar DRM':         { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'Rockstar Social Club DRM': { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'None':                 { bg: 'rgba(74,222,128,0.1)',   color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
};

function getDrmIcon(drm, size = 11) {
  const s = drmLabel(drm).toLowerCase();
  if (!s || s === 'unknown') return <Shield size={size} />;
  if (s.includes('denuvo') && /removed|stripped|dropped|retired/.test(s)) return <ShieldCheck size={size} />;
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
  if (status === 'unknown') return (
    <div className="crack-chip locked">No isitcracked data</div>
  );
  return (
    <div className="crack-chip locked"><ShieldAlert size={11} /> Not Cracked</div>
  );
}

const StoreRow = React.memo(function StoreRow({ game }) {
  const setActiveGame = useAppStore(s => s.setActiveGame);
  const setActivePage = useAppStore(s => s.setActivePage);
  const setHubBackPage = useAppStore(s => s.setHubBackPage);
  const openGameCtx = useAppStore(s => s.openGameCtx);
  const drm = drmLabel(game.drm);
  const drmLower = drm.toLowerCase();
  const drmStyle = DRM_COLORS[drm]
    || (drmLower.includes('denuvo') && /removed|stripped|dropped|retired/.test(drmLower) ? DRM_COLORS['Denuvo removed by developer'] : null)
    || (drmLower.includes('denuvo') ? DRM_COLORS['Denuvo'] : null)
    || (drmLower.includes('steam')  ? DRM_COLORS['Steam DRM'] : null)
    || { bg: 'rgba(113,113,122,0.1)', color: '#71717a', border: 'rgba(113,113,122,0.2)' };

  return (
    <div
      className="store-row"
      onContextMenu={(e) => openGameCtx(e, game)}
      onClick={() => {
        setActiveGame({
          ...game,
          cover_url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.app_id}/library_600x900.jpg`,
        });
        setHubBackPage('store');
        setActivePage('game-hub');
      }}
    >
      {/* Thumbnail */}
      <div className="store-row-thumb">
        <SteamImage
          appId={game.app_id}
          src={game.image_url || game.header_image}
          alt={game.name}
          kind="header"
        />
      </div>

      {/* Main Info */}
      <div className="store-row-main">
        <div className="store-row-title">{game.name}</div>
        <div className="store-row-tags">
          {tagList(game.tags).slice(0, 4).map(t => <span key={t} className="store-tag">{t}</span>)}
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
});

const PAGE_SIZE = 24;

export default function Store() {
  const setActiveGame = useAppStore(s => s.setActiveGame);
  const setActivePage = useAppStore(s => s.setActivePage);
  const setHubBackPage = useAppStore(s => s.setHubBackPage);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0); // 0-indexed for offset
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapRef = useRef(null);
  const loaderRef = useRef(null);
  const { db, lookupGame } = useCrackDB({ prefetch: false });
  const searchIdRef = useRef('');
  const suggestReqIdRef = useRef(0);
  const lookupRef = useRef(lookupGame);
  const filterRef = useRef(filter);
  const queryRef = useRef(debouncedQuery);
  lookupRef.current = lookupGame;
  filterRef.current = filter;
  queryRef.current = debouncedQuery;

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
    const currentReq = ++suggestReqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const { bridge } = await import('../lib/bridge');
        const res = await bridge.call('suggest_store_games', q);
        if (currentReq !== suggestReqIdRef.current) return;
        const parsed = typeof res === 'string' ? JSON.parse(res) : res;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSuggestions(parsed);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
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
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Call backend search ────────────────────────────────────────────────────────
  const fetchGames = useCallback((targetPage = 0) => {
    const reqId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    searchIdRef.current = reqId;
    setLoading(true);
    setError(null);

    const offset = targetPage * PAGE_SIZE;

    const fire = () => {
      if (searchIdRef.current !== reqId) return;
      const b = window.Bridge;
      if (!b?.search_games) {
        console.warn('[Store] Bridge not ready for search_games');
        setLoading(false);
        setError('Store search is unavailable.');
        return;
      }
      b.search_games(debouncedQuery, offset, PAGE_SIZE, 'updated', '', reqId);
    };

    bridge.ready.then(fire);
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (jsonStr) => {
      try {
        const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (res.request_id !== searchIdRef.current) return;

        const rawGames = res.games || [];
        if (res.error && rawGames.length === 0) {
          setError(String(res.error));
          setLoading(false);
          return;
        }

        const lookup = lookupRef.current;
        const activeFilter = filterRef.current;
        const q = (queryRef.current || '').toLowerCase();

        const mapBackendStatus = (g, crackEntry) => {
          const raw = String(g.status_key || g.crack_status || '').toLowerCase();
          const prot = drmLabel(g.protection || crackEntry?.drm).toLowerCase();
          if (raw.includes('uncrack') || raw.includes('hypervisor') || raw.includes('unreleased')) return 'not_cracked';
          if (raw.includes('drm-free') || raw.includes('drm free') || prot === 'none' || /denuvo/.test(prot) && /removed|stripped|dropped/.test(prot)) return 'clean';
          if (raw.includes('crack')) return 'cracked';
          if (crackEntry && crackEntry.cracked === false) return 'not_cracked';
          if (crackEntry && crackEntry.cracked) {
            return (prot === 'none' || prot.includes('removed')) ? 'clean' : 'cracked';
          }
          return 'unknown';
        };

        const enriched = rawGames.map(g => {
          const aid = String(g.app_id || g.appid);
          const crackEntry = lookup ? lookup(aid) : null;
          return {
            app_id: aid,
            name: g.name,
            image_url: g.image_url || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${aid}/capsule_616x353.jpg`,
            drm: drmLabel(g.protection || crackEntry?.drm || g.drm),
            crack_status: mapBackendStatus(g, crackEntry),
            crack_ver: crackEntry?.crack_ver || crackEntry?.crack_version || g.crack_ver,
            crack_src: crackEntry?.crack_source || g.crack_src,
            crack_date: crackEntry?.crack_date || g.crack_date,
            tags: tagList(g.tags),
          };
        });

        let filtered = enriched;
        if (activeFilter !== 'all') {
          filtered = enriched.filter(g => g.crack_status === activeFilter);
        }

        if (q) {
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

        const pageOffset = Number(res.offset ?? 0) || 0;
        setGames(prev => (pageOffset === 0 ? filtered : [...prev, ...filtered]));
        setTotal(res.total || 0);
        setHasMore((res.total || 0) > (res.offset || 0) + rawGames.length);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('Failed to parse search results', err);
        setLoading(false);
        setError('Could not read store results.');
      }
    };

    return bridge.on('search_results', handler);
  }, []);

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
    setHubBackPage('store');
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
                  const drm = drmLabel(crackEntry?.drm || (crackEntry?.is_standard_steam ? 'Steam DRM' : 'Steam'));
                  return (
                    <div 
                      key={s.app_id} 
                      className="store-suggestion-row" 
                      onClick={() => handleSuggestionClick(s)}
                    >
                      <SteamImage
                        appId={s.app_id}
                        src={s.capsule_url}
                        alt={s.name}
                        className="store-suggestion-thumb"
                        kind="header"
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
      <div className="store-count">{loading && games.length === 0 ? 'Loading catalog…' : `${total} gier`}</div>

      {/* List */}
      <div className="store-list">
        {loading && games.length === 0 && (
          <div className="store-loading-overlay">
            <div className="store-loading-spin" />
            <div className="store-loading-title">Loading Store</div>
            <div className="store-loading-sub">Fetching the game list…</div>
          </div>
        )}

        {games.map((game) => (
          <StoreRow key={String(game.app_id)} game={game} />
        ))}

        {hasMore && !loading && (
          <div ref={loaderRef} className="store-loader">
            <span>Ładowanie więcej…</span>
          </div>
        )}

        {loading && games.length > 0 && (
          <div className="store-loader">
            <span>Wyszukiwanie...</span>
          </div>
        )}

        {error && games.length === 0 && !loading && (
          <div className="store-empty">{error}</div>
        )}

        {games.length === 0 && !loading && !error && (
          <div className="store-empty">Brak gier spełniających kryteria wyszukiwania.</div>
        )}
      </div>
    </div>
  );
}

