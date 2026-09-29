import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ShieldOff, Sparkles, ShieldAlert, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import GameCard from '../components/GameCard';
import { useAppStore } from '../store/useAppStore';
import './Home.css';

// ── Data ──────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'cracked',         label: 'Recently Cracked',        icon: Zap,         color: '#a78bfa' },
  { id: 'denuvo_removed',  label: 'Denuvo Removed by Studio',icon: ShieldOff,   color: '#4ade80' },
  { id: 'new_releases',    label: 'New Releases',             icon: Sparkles,    color: '#38bdf8' },
  { id: 'not_cracked',     label: 'Not Yet Cracked',          icon: ShieldAlert, color: '#f87171' },
];

const GAMES_BY_CAT = {
  cracked: [
    { app_id: '1091500', name: 'Cyberpunk 2077',        drm: 'Denuvo v7',  crack_ver: '2.12',   crack_src: 'RUNE',    crack_date: '2024-01-15', status: 'cracked',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/page_bg_generated_v6b.jpg',
      screenshots: [
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_9d018788f947e6a2f8b1b3ccf64bb9af5c4f93b5.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_87da3a8843e36de032abad2be00fe9fe4d3f24bf.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_e8ccd8c22e5bcf0af2c9c78e4186e0e9b33a9af1.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_70d04cba85e76a2e02a8f07d2f79de61df0ddf66.jpg',
      ],
    },
    { app_id: '1245620', name: 'Elden Ring',             drm: 'Denuvo v6',  crack_ver: '1.12.3', crack_src: 'EMPRESS', crack_date: '2023-08-20', status: 'cracked',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/page_bg_generated_v6b.jpg',
      screenshots: [
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_e80a907c2c43337e53316c71e34f9d09ec5f5e4b.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_7c3948b4a28d3cbdac63d9d5028c49ce2b8b0455.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_3d48b0a31e3e18c5cc2f7d3e2b8c6e5d3a7f8b9a.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_f1f7e5afd57b7fc29adf54b5e3de6efca3f52a3b.jpg',
      ],
    },
    { app_id: '2050650', name: 'Resident Evil 4',        drm: 'Denuvo v8',  crack_ver: '1.1.0',  crack_src: 'SKIDROW', crack_date: '2023-05-10', status: 'cracked',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/page_bg_generated_v6b.jpg',
      screenshots: [
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/ss_1.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/ss_2.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/ss_3.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/ss_4.jpg',
      ],
    },
    { app_id: '1716740', name: 'Atomic Heart',           drm: 'Denuvo v7',  crack_ver: '1.0',    crack_src: 'RUNE',    crack_date: '2023-03-02', status: 'cracked',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1716740/page_bg_generated_v6b.jpg',
      screenshots: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1716740/ss_1.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1716740/ss_2.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1716740/ss_3.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1716740/ss_4.jpg'],
    },
  ],
  denuvo_removed: [
    { app_id: '1086940', name: "Baldur's Gate 3",        drm: 'None (Denuvo removed)', crack_ver: null, crack_src: null, crack_date: '2023-09-07', status: 'installed', denuvo_removed_date: '2023-09-07',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/page_bg_generated_v6b.jpg',
      screenshots: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_1.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_2.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_3.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_4.jpg'],
    },
    { app_id: '1593500', name: 'God of War',             drm: 'Steam DRM (Denuvo removed)', crack_ver: null, crack_src: null, crack_date: '2023-07-10', status: 'installed', denuvo_removed_date: '2022-10-12',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/page_bg_generated_v6b.jpg',
      screenshots: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_1.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_2.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_3.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_4.jpg'],
    },
  ],
  new_releases: [
    { app_id: '2358720', name: 'Black Myth: Wukong',     drm: 'Denuvo v9',  crack_ver: null,     crack_src: null,      crack_date: null,         status: 'available',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/page_bg_generated_v6b.jpg',
      screenshots: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_1.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_2.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_3.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_4.jpg'],
    },
    { app_id: '2767030', name: 'S.T.A.L.K.E.R. 2',      drm: 'Denuvo v9',  crack_ver: null,     crack_src: null,      crack_date: null,         status: 'available',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2767030/page_bg_generated_v6b.jpg',
      screenshots: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2767030/ss_1.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2767030/ss_2.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2767030/ss_3.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2767030/ss_4.jpg'],
    },
  ],
  not_cracked: [
    { app_id: '990080',  name: 'Hogwarts Legacy',        drm: 'Denuvo v8',  crack_ver: null,     crack_src: null,      crack_date: null,         status: 'available',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/page_bg_generated_v6b.jpg',
      screenshots: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/ss_1.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/ss_2.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/ss_3.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/ss_4.jpg'],
    },
    { app_id: '2358720', name: 'Black Myth: Wukong',     drm: 'Denuvo v9',  crack_ver: null,     crack_src: null,      crack_date: null,         status: 'available',
      hero: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/page_bg_generated_v6b.jpg',
      screenshots: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_1.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_2.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_3.jpg','https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/ss_4.jpg'],
    },
  ],
};

// ── Hero Panel (Steam-style) ───────────────────────────────────────────────────
function HeroPanel({ games, catColor }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoveredShot, setHoveredShot] = useState(null);
  const { setActiveGame, setActivePage } = useAppStore();
  const timerRef = useRef(null);

  const game = games[activeIdx];
  const displayHero = hoveredShot || game.hero;

  // Auto-advance
  useEffect(() => {
    setActiveIdx(0);
    setHoveredShot(null);
  }, [games]);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % games.length);
      setHoveredShot(null);
    }, 7000);
    return () => clearInterval(timerRef.current);
  }, [games]);

  const goTo = (i) => {
    setActiveIdx(i);
    setHoveredShot(null);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(n => (n + 1) % games.length);
    }, 7000);
  };

  return (
    <div className="hero-panel">
      {/* ── LEFT: Full-width artwork ── */}
      <div className="hero-artwork-wrap">
        <AnimatePresence mode="sync">
          <motion.img
            key={displayHero}
            src={displayHero}
            alt=""
            className="hero-artwork"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onError={e => { e.target.src = game.hero; }}
          />
        </AnimatePresence>
        {/* Gradient fade toward right panel */}
        <div className="hero-artwork-fade" />

        {/* Game list tabs at bottom of artwork */}
        <div className="hero-game-tabs">
          {games.map((g, i) => (
            <button
              key={g.app_id + i}
              className={`hero-game-tab ${i === activeIdx ? 'active' : ''}`}
              onClick={() => goTo(i)}
              style={{ '--cat-color': catColor }}
            >
              <img
                src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.app_id}/capsule_sm_120.jpg`}
                alt={g.name}
                onError={e => e.target.style.display = 'none'}
              />
              <span>{g.name}</span>
              {i === activeIdx && (
                <motion.div className="hero-tab-bar" layoutId="hero-tab-bar" style={{ background: catColor }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Info Panel ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={game.app_id}
          className="hero-info-panel"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.25 }}
        >
          <h2 className="hero-game-name">{game.name}</h2>

          {/* DRM Status Row */}
          <DRMStatusRow game={game} catColor={catColor} />

          {/* Screenshots 2x2 grid */}
          <div className="hero-screenshots">
            {(game.screenshots || []).slice(0, 4).map((src, i) => (
              <div
                key={i}
                className="hero-shot-wrap"
                onMouseEnter={() => setHoveredShot(src)}
                onMouseLeave={() => setHoveredShot(null)}
              >
                <img
                  src={src}
                  alt=""
                  className="hero-shot"
                  onError={e => e.target.parentElement.style.display = 'none'}
                />
                <div className="hero-shot-overlay">
                  <Play size={14} />
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            className="hero-cta-btn"
            style={{ '--cat-color': catColor, '--cat-glow': catColor + '55' }}
            onClick={() => { setActiveGame(game); setActivePage('game-hub'); }}
          >
            Open Game Hub →
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DRMStatusRow({ game, catColor }) {
  const isCracked = game.status === 'cracked';
  const isDenuvoCleaned = game.denuvo_removed_date;
  const isNotCracked = !isCracked && !isDenuvoCleaned;

  return (
    <div className="drm-status-row">
      {/* DRM Badge */}
      <div className={`drm-badge ${isCracked ? 'cracked' : isDenuvoCleaned ? 'clean' : 'locked'}`}>
        {isCracked ? '⚡ Cracked' : isDenuvoCleaned ? '✓ DRM-Free' : '🔒 Not Cracked'}
      </div>

      <div className="drm-details">
        <div className="drm-row">
          <span className="drm-label">Protection</span>
          <span className="drm-value">{game.drm}</span>
        </div>
        {isCracked && (
          <>
            <div className="drm-row">
              <span className="drm-label">Crack Version</span>
              <span className="drm-value" style={{ color: catColor }}>{game.crack_ver}</span>
            </div>
            <div className="drm-row">
              <span className="drm-label">Source</span>
              <span className="drm-value">{game.crack_src}</span>
            </div>
            <div className="drm-row">
              <span className="drm-label">Cracked On</span>
              <span className="drm-value">{game.crack_date}</span>
            </div>
          </>
        )}
        {isDenuvoCleaned && (
          <div className="drm-row">
            <span className="drm-label">Denuvo Removed</span>
            <span className="drm-value" style={{ color: '#4ade80' }}>{game.denuvo_removed_date}</span>
          </div>
        )}
        {isNotCracked && (
          <div className="drm-row">
            <span className="drm-label">Status</span>
            <span className="drm-value" style={{ color: '#f87171' }}>No crack available</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeCat, setActiveCat] = useState('cracked');
  const cat = CATEGORIES.find(c => c.id === activeCat);
  const games = GAMES_BY_CAT[activeCat] || [];

  return (
    <div className="home-page">
      {/* Category Tabs */}
      <div className="cat-tabs">
        {CATEGORIES.map(c => {
          const Icon = c.icon;
          const isActive = c.id === activeCat;
          return (
            <button
              key={c.id}
              className={`cat-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveCat(c.id)}
              style={{ '--c': c.color }}
            >
              <Icon size={14} />
              {c.label}
              {isActive && (
                <motion.div className="cat-tab-indicator" layoutId="cat-tab-indicator" style={{ background: c.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Hero */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCat}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          <HeroPanel games={games} catColor={cat.color} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
