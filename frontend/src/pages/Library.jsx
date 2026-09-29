import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import ContextMenu from '../components/ContextMenu';
import GameSettingsModal from '../components/GameSettingsModal';
import './Library.css';

const INSTALLED_GAMES = [
  { app_id: '1091500', name: 'Cyberpunk 2077',         crack_status: 'cracked',   drm: 'Denuvo',    crack_ver: '2.12',   crack_src: 'RUNE',    crack_date: '2024-01-15', playtime: '47h',  last_played: '2 days ago',   size: '70.2 GB' },
  { app_id: '1245620', name: 'Elden Ring',              crack_status: 'cracked',   drm: 'Denuvo',    crack_ver: '1.12.3', crack_src: 'EMPRESS', crack_date: '2023-08-20', playtime: '120h', last_played: 'Today',        size: '52.0 GB' },
  { app_id: '1086940', name: "Baldur's Gate 3",         crack_status: 'clean',     drm: 'None',      crack_ver: null,     crack_src: null,      crack_date: null,         playtime: '200h', last_played: 'Yesterday',    size: '122.1 GB' },
  { app_id: '1593500', name: 'God of War',              crack_status: 'cracked',   drm: 'Steam DRM', crack_ver: '1.0.2',  crack_src: 'CODEX',   crack_date: '2022-01-14', playtime: '32h',  last_played: '1 week ago',   size: '32.1 GB' },
  { app_id: '1716740', name: 'Atomic Heart',            crack_status: 'cracked',   drm: 'Denuvo',    crack_ver: '1.0',    crack_src: 'RUNE',    crack_date: '2023-03-02', playtime: '18h',  last_played: '3 weeks ago',  size: '58.5 GB' },
  { app_id: '1145360', name: 'Hades',                   crack_status: 'clean',     drm: 'None',      crack_ver: null,     crack_src: null,      crack_date: null,         playtime: '88h',  last_played: '2 weeks ago',  size: '1.8 GB'  },
  { app_id: '2050650', name: 'Resident Evil 4',         crack_status: 'cracked',   drm: 'Denuvo',    crack_ver: '1.1.0',  crack_src: 'SKIDROW', crack_date: '2023-05-10', playtime: '24h',  last_played: '1 month ago',  size: '67.4 GB' },
  { app_id: '1174180', name: 'Red Dead Redemption 2',   crack_status: 'cracked',   drm: 'Rockstar',  crack_ver: '1.0',    crack_src: 'EMPRESS', crack_date: '2021-06-01', playtime: '62h',  last_played: '2 months ago', size: '150.0 GB' },
  { app_id: '752590',  name: 'A Plague Tale: Requiem',  crack_status: 'cracked',   drm: 'Denuvo',    crack_ver: '1.3',    crack_src: 'RUNE',    crack_date: '2023-01-05', playtime: '11h',  last_played: '3 months ago', size: '55.7 GB' },
  { app_id: '1912840', name: 'Hi-Fi Rush',              crack_status: 'clean',     drm: 'None',      crack_ver: null,     crack_src: null,      crack_date: null,         playtime: '9h',   last_played: '1 month ago',  size: '25.0 GB' },
];

const STATUS_META = {
  cracked: { label: '⚡ Cracked', cls: 'cracked' },
  clean:   { label: '✓ DRM-Free', cls: 'clean'  },
  locked:  { label: '🔒 Locked',  cls: 'locked' },
};

export default function Library() {
  const [query, setQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);   // { x, y, game }
  const [settingsGame, setSettingsGame] = useState(null); // game to show settings for
  const [favorites, setFavorites] = useState(new Set());
  const [games, setGames] = useState(INSTALLED_GAMES);
  const { setActiveGame, setActivePage } = useAppStore();

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

  const cover = (appId) =>
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;

  return (
    <div className="library-page" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="library-header">
        <div>
          <h2 className="library-title">Your Library</h2>
          <p className="library-subtitle">{filtered.length} games installed</p>
        </div>
        <div className="library-search-wrap">
          <Search size={13} className="lib-search-icon" />
          <input
            className="lib-search"
            placeholder="Filter games…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="library-grid">
        {filtered.map((game, i) => {
          const st = STATUS_META[game.crack_status] || STATUS_META.clean;
          const isFav = favorites.has(game.app_id);

          return (
            <motion.div
              key={game.app_id}
              className={`lib-card ${isFav ? 'favorited' : ''}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              onClick={() => { setActiveGame({ ...game, cover_url: cover(game.app_id) }); setActivePage('game-hub'); }}
              onContextMenu={(e) => handleContextMenu(e, game)}
            >
              {/* Cover */}
              <div className="lib-card-cover">
                <img src={cover(game.app_id)} alt={game.name} loading="lazy"
                  onError={e => { e.target.style.display = 'none'; }} />
                <div className="lib-card-hover">
                  <button className="lib-play-btn" onClick={e => e.stopPropagation()}>▶ Play</button>
                </div>
              </div>

              {/* Favourite star */}
              {isFav && <span className="lib-fav-star">★</span>}

              {/* Status Badge */}
              <span className={`lib-status-badge ${st.cls}`}>{st.label}</span>

              {/* Info */}
              <div className="lib-card-info">
                <p className="lib-card-name">{game.name}</p>
                <div className="lib-card-meta">
                  <span><Clock size={10} /> {game.playtime}</span>
                  <span>{game.size}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Context Menu */}
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

      {/* Settings Modal */}
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
