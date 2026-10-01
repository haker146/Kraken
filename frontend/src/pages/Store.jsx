import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, SlidersHorizontal, Zap, Shield, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
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
  'Denuvo':    { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.25)' },
  'Steam DRM': { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  'EAC':       { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'Rockstar':  { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'None':      { bg: 'rgba(74,222,128,0.1)',   color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
};

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
  const drmStyle = DRM_COLORS[game.drm] || DRM_COLORS['None'];

  const thumb = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/capsule_231x87.jpg`;
  const fallback = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/header.jpg`;

  return (
    <motion.div
      className="store-row"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
      onClick={() => { setActiveGame({ ...game, cover_url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/library_600x900.jpg` }); setActivePage('game-hub'); }}
    >
      {/* Thumbnail */}
      <div className="store-row-thumb">
        <img
          src={thumb}
          alt={game.name}
          onError={e => { e.target.src = fallback; }}
        />
      </div>

      {/* Main Info */}
      <div className="store-row-main">
        <div className="store-row-title">{game.name}</div>
        <div className="store-row-tags">
          {game.tags.map(t => <span key={t} className="store-tag">{t}</span>)}
        </div>
      </div>

      {/* DRM & Crack Info */}
      <div className="store-row-right">
        {/* DRM Badge */}
        <div
          className="store-drm-badge"
          style={{ background: drmStyle.bg, color: drmStyle.color, border: `1px solid ${drmStyle.border}` }}
        >
          {game.drm === 'None' ? <ShieldCheck size={11} /> : <Shield size={11} />}
          {game.drm}
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
    </motion.div>
  );
}

const PAGE_SIZE = 15;

export default function Store() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0); // 0-indexed for offset
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loaderRef = useRef(null);
  const { db } = useCrackDB();
  const searchIdRef = useRef('');

  // ── Call backend search ────────────────────────────────────────────────────────
  const fetchGames = useCallback((reset = false) => {
    if (!window.Bridge?.search_games) return;
    const reqId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    searchIdRef.current = reqId;
    
    if (reset) {
      setLoading(true);
      setGames([]);
    }
    
    const offset = reset ? 0 : page * PAGE_SIZE;
    // Map our filter format to what backend expects if necessary, 
    // but the backend takes (query, offset, per_page, sort_by, tag, request_id)
    window.Bridge.search_games(query, offset, PAGE_SIZE, 'updated', '', reqId);
  }, [query, filter, page]);

  // Handle QWebChannel response
  useEffect(() => {
    if (!window.Bridge?.search_results?.connect) return;
    const handler = (jsonStr) => {
      try {
        const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (res.request_id !== searchIdRef.current) return; // Stale result
        
        const rawGames = res.games || [];
        
        // Enrich from crackDB since the backend might not have up-to-date crack status
        const enriched = rawGames.map(g => {
          const aid = String(g.app_id || g.appid);
          const crackEntry = db?.[aid];
          const drm = crackEntry?.drm || g.drm || 'Unknown';
          let cStatus = 'not_cracked';
          if (crackEntry?.cracked) {
             cStatus = (drm === 'None' || drm.toLowerCase().includes('removed')) ? 'clean' : 'cracked';
          }
          return {
            app_id: aid,
            name: g.name,
            image_url: g.image_url || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${aid}/capsule_616x353.jpg`,
            drm: drm,
            crack_status: g.crack_status || cStatus,
            crack_ver: crackEntry?.crack_ver || g.crack_ver,
            crack_src: crackEntry?.crack_source || g.crack_src,
            crack_date: crackEntry?.crack_date || g.crack_date,
            tags: [],
          };
        });

        // Local filtering since backend search_games doesn't fully support crack_status filters yet
        let filtered = enriched;
        if (filter !== 'all') {
          filtered = enriched.filter(g => g.crack_status === filter);
        }

        setGames(prev => {
           // We might need to handle offset logically, but since we re-request and get chunks:
           return res.offset === 0 ? filtered : [...prev, ...filtered];
        });
        setTotal(res.total || 0);
        setHasMore(res.total > (res.offset || 0) + rawGames.length);
        setLoading(false);
      } catch (err) {
        console.error('Failed to parse search results', err);
      }
    };
    
    window.Bridge.search_results.connect(handler);
    return () => {
      try { window.Bridge.search_results.disconnect(handler); } catch (e) {}
    };
  }, [db, filter]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current || loading) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading]);

  // Trigger search on query/filter/page change
  useEffect(() => {
    if (page === 0) {
      fetchGames(true);
    } else {
      fetchGames(false);
    }
  }, [query, filter, page, fetchGames]);

  // Reset page when query/filter changes
  useEffect(() => {
    setPage(0);
  }, [query, filter]);

  return (
    <div className="store-page">
      {/* Toolbar */}
      <div className="store-toolbar">
        <div className="store-search-wrap">
          <Search size={14} className="store-search-icon" />
          <input
            className="store-search"
            placeholder="Search games..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
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
      <div className="store-count">{total} games</div>

      {/* List */}
      <div className="store-list">
        {games.map((game, i) => (
          <StoreRow key={game.app_id + i} game={game} index={i} />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && !loading && (
          <div ref={loaderRef} className="store-loader">
            <span>Loading more…</span>
          </div>
        )}

        {loading && (
          <div className="store-loader">
            <span>Searching...</span>
          </div>
        )}

        {games.length === 0 && !loading && (
          <div className="store-empty">No games matching your search.</div>
        )}
      </div>
    </div>
  );
}
