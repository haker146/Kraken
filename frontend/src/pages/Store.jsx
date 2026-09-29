import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, SlidersHorizontal, Zap, Shield, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import './Store.css';

// ── All games list ────────────────────────────────────────────────────────────
const ALL_GAMES = [
  { app_id: '1091500', name: 'Cyberpunk 2077',          drm: 'Denuvo',    crack_status: 'cracked',     crack_ver: '2.12',    crack_src: 'RUNE',    crack_date: '2024-01-15', tags: ['Open World', 'RPG', 'Sci-fi', 'Action'] },
  { app_id: '1245620', name: 'Elden Ring',               drm: 'Denuvo',    crack_status: 'cracked',     crack_ver: '1.12.3',  crack_src: 'EMPRESS', crack_date: '2023-08-20', tags: ['Souls-like', 'RPG', 'Dark Fantasy'] },
  { app_id: '1086940', name: "Baldur's Gate 3",          drm: 'None',      crack_status: 'clean',       crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['RPG', 'Co-op', 'Turn-based'] },
  { app_id: '1593500', name: 'God of War',               drm: 'Steam DRM', crack_status: 'cracked',     crack_ver: '1.0.2',   crack_src: 'CODEX',   crack_date: '2022-01-14', tags: ['Action', 'Adventure', 'Story Rich'] },
  { app_id: '990080',  name: 'Hogwarts Legacy',          drm: 'Denuvo',    crack_status: 'not_cracked', crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['RPG', 'Open World', 'Magic'] },
  { app_id: '1716740', name: 'Atomic Heart',             drm: 'Denuvo',    crack_status: 'cracked',     crack_ver: '1.0',     crack_src: 'RUNE',    crack_date: '2023-03-02', tags: ['FPS', 'Action', 'Sci-fi'] },
  { app_id: '1145360', name: 'Hades',                    drm: 'None',      crack_status: 'clean',       crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['Roguelike', 'Action', 'Indie'] },
  { app_id: '2050650', name: 'Resident Evil 4',          drm: 'Denuvo',    crack_status: 'cracked',     crack_ver: '1.1.0',   crack_src: 'SKIDROW', crack_date: '2023-05-10', tags: ['Horror', 'Shooter', 'Action'] },
  { app_id: '1174180', name: 'Red Dead Redemption 2',    drm: 'Rockstar',  crack_status: 'cracked',     crack_ver: '1.0',     crack_src: 'EMPRESS', crack_date: '2021-06-01', tags: ['Open World', 'Western', 'Adventure'] },
  { app_id: '752590',  name: 'A Plague Tale: Requiem',   drm: 'Denuvo',    crack_status: 'cracked',     crack_ver: '1.3',     crack_src: 'RUNE',    crack_date: '2023-01-05', tags: ['Action', 'Stealth', 'Story Rich'] },
  { app_id: '1888160', name: 'The Callisto Protocol',    drm: 'Denuvo',    crack_status: 'not_cracked', crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['Horror', 'Survival', 'Sci-fi'] },
  { app_id: '2358720', name: 'Black Myth: Wukong',       drm: 'Denuvo',    crack_status: 'not_cracked', crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['Action', 'RPG', 'Mythology'] },
  { app_id: '2767030', name: 'S.T.A.L.K.E.R. 2',        drm: 'Denuvo',    crack_status: 'not_cracked', crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['FPS', 'Survival', 'Open World'] },
  { app_id: '1382330', name: 'Death Stranding 2',        drm: 'Steam DRM', crack_status: 'cracked',     crack_ver: '1.001',   crack_src: 'CODEX',   crack_date: '2025-06-12', tags: ['Action', 'Stealth', 'Story Rich'] },
  { app_id: '1877480', name: 'Hogwarts Mystery',         drm: 'EAC',       crack_status: 'not_cracked', crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['RPG', 'Magic', 'Adventure'] },
  { app_id: '1912840', name: 'Hi-Fi Rush',               drm: 'None',      crack_status: 'clean',       crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['Action', 'Rhythm', 'Indie'] },
  { app_id: '1604030', name: 'V Rising',                 drm: 'Steam DRM', crack_status: 'cracked',     crack_ver: '1.0',     crack_src: 'PLAZA',   crack_date: '2024-05-08', tags: ['Survival', 'RPG', 'Co-op'] },
  { app_id: '1817190', name: 'Ghostwire: Tokyo',         drm: 'Denuvo',    crack_status: 'cracked',     crack_ver: '1.0',     crack_src: 'RUNE',    crack_date: '2023-04-14', tags: ['Action', 'Adventure', 'Open World'] },
  { app_id: '2239430', name: 'Mortal Kombat 1',          drm: 'Denuvo',    crack_status: 'not_cracked', crack_ver: null,      crack_src: null,      crack_date: null,         tags: ['Fighting', 'Action', 'Multiplayer'] },
  { app_id: '2379780', name: 'Lords of the Fallen',      drm: 'Denuvo',    crack_status: 'cracked',     crack_ver: '1.5.88',  crack_src: 'EMPRESS', crack_date: '2024-03-22', tags: ['Souls-like', 'Dark Fantasy', 'RPG'] },
];

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
  const [page, setPage] = useState(1);
  const loaderRef = useRef(null);

  const filtered = ALL_GAMES.filter(g => {
    const matchQ = g.name.toLowerCase().includes(query.toLowerCase());
    const matchF = filter === 'all' || g.crack_status === filter;
    return matchQ && matchF;
  });

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore]);

  // Reset page on filter/query change
  useEffect(() => { setPage(1); }, [query, filter]);

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
      <div className="store-count">{filtered.length} games</div>

      {/* List */}
      <div className="store-list">
        {visible.map((game, i) => (
          <StoreRow key={game.app_id + i} game={game} index={i} />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={loaderRef} className="store-loader">
            <span>Loading more…</span>
          </div>
        )}

        {visible.length === 0 && (
          <div className="store-empty">No games matching your search.</div>
        )}
      </div>
    </div>
  );
}
