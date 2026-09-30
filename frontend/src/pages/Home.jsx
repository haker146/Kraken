import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ShieldOff, Sparkles, ShieldAlert,
  Shield, BookOpen, Wrench, Download, ChevronRight,
  TrendingUp, Activity, Info
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import './Home.css';

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'cracked',        label: 'Recently Cracked',         icon: Zap,        color: '#a78bfa' },
  { id: 'denuvo_removed', label: 'Denuvo Removed by Studio', icon: ShieldOff,  color: '#4ade80' },
  { id: 'new_releases',   label: 'New Releases',             icon: Sparkles,   color: '#38bdf8' },
  { id: 'not_cracked',    label: 'Not Yet Cracked',          icon: ShieldAlert,color: '#f87171' },
];

const CATEGORY_APPIDS = {
  cracked:        ['1091500','1245620','2050650','1716740','1593500','1174180'],
  denuvo_removed: ['1086940','1593500','230410','291550','582010','632360'],
  new_releases:   ['2358720','2767030','2239430','1888160','1877480','2379780'],
  not_cracked:    ['990080','2358720','2767030','2239430','1888160','1877480'],
};

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const heroImg    = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/page_bg_generated_v6b.jpg`;
const headerImg  = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const capsuleImg = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/capsule_sm_120.jpg`;
const libImg     = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;

// ── Compact Hero ──────────────────────────────────────────────────────────────
function MiniHero({ appIds, catColor, catId }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef(null);
  const { setActiveGame, setActivePage } = useAppStore();
  const { db } = useCrackDB();

  useEffect(() => {
    setActiveIdx(0);
  }, [catId]);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % appIds.length);
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [appIds, catId]);

  const goTo = (i) => {
    setActiveIdx(i);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(n => (n + 1) % appIds.length);
    }, 6000);
  };

  const appId = appIds[activeIdx];

  const handleOpen = () => {
    const crackEntry = db?.[appId];
    setActiveGame({
      app_id: appId,
      name: crackEntry?.name || `App ${appId}`,
      cover_url: libImg(appId),
      hero_url: heroImg(appId),
      drm: crackEntry?.drm,
      cracked: crackEntry?.cracked,
    });
    setActivePage('game-hub');
  };

  return (
    <div className="mini-hero">
      <AnimatePresence mode="sync">
        <motion.div
          key={appId}
          className="mini-hero-bg"
          style={{ backgroundImage: `url(${heroImg(appId)})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>
      <div className="mini-hero-gradient" />

      <div className="mini-hero-content">
        <AnimatePresence mode="wait">
          <motion.img
            key={appId + '_hdr'}
            src={headerImg(appId)}
            alt=""
            className="mini-hero-header"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28 }}
            onError={e => e.target.style.display = 'none'}
          />
        </AnimatePresence>
        <button
          className="mini-hero-cta"
          style={{ '--cat-color': catColor }}
          onClick={handleOpen}
        >
          Open Game Hub <ChevronRight size={14} />
        </button>
      </div>

      <div className="mini-hero-strip">
        {appIds.map((id, i) => (
          <button
            key={id}
            className={`mini-strip-btn ${i === activeIdx ? 'active' : ''}`}
            onClick={() => goTo(i)}
            style={{ '--cc': catColor }}
          >
            <img src={capsuleImg(id)} alt="" onError={e => e.target.style.display = 'none'} />
            {i === activeIdx && (
              <motion.div
                className="mini-strip-bar"
                layoutId="mini-strip-bar"
                style={{ background: catColor }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Feature Info Cards ────────────────────────────────────────────────────────
const INFO_CARDS = [
  {
    icon: Download,
    color: '#22c55e',
    title: 'One-Click Install',
    desc: 'Downloads manifests, writes decryption keys, registers the App ID and creates the ACF — all in one automated pipeline.',
  },
  {
    icon: Shield,
    color: '#38bdf8',
    title: 'LumaCore Integration',
    desc: 'Unlocks games via LumaCore stplug-in Lua injection automatically. No manual file editing or Steam restarts required.',
  },
  {
    icon: BookOpen,
    color: '#a78bfa',
    title: 'Crack Database',
    desc: 'Live crack-status feed synced from community sources. See which version is cracked, by whom, and on what build.',
  },
  {
    icon: Wrench,
    color: '#fb923c',
    title: 'Fix Tools',
    desc: 'Goldberg Emulator, SmokeAPI, CreamAPI, Steamless — all integrated and accessible from any Game Hub page.',
  },
  {
    icon: TrendingUp,
    color: '#f472b6',
    title: 'DLC Manager',
    desc: 'Unlock, browse and manage DLC for every installed title directly from the Library or individual Game Hub.',
  },
  {
    icon: Activity,
    color: '#facc15',
    title: 'Manifest Watcher',
    desc: 'Background daemon preserves downloaded manifests so they survive Steam uninstalls and depot cache clears.',
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeCat, setActiveCat] = useState('cracked');
  const cat = CATEGORIES.find(c => c.id === activeCat);
  const [displayIds, setDisplayIds] = useState(() => pickRandom(CATEGORY_APPIDS['cracked'], 5));

  useEffect(() => {
    setDisplayIds(pickRandom(CATEGORY_APPIDS[activeCat], 5));
  }, [activeCat]);

  return (
    <div className="home-page">
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
                <motion.div
                  className="cat-tab-indicator"
                  layoutId="cat-tab-indicator"
                  style={{ background: c.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="home-body">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCat}
            className="home-hero-wrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <MiniHero appIds={displayIds} catColor={cat.color} catId={activeCat} />
          </motion.div>
        </AnimatePresence>

        <div className="home-info-section">
          <div className="home-info-header">
            <Info size={14} />
            <span>What Kraken can do for you</span>
          </div>
          <div className="home-info-grid">
            {INFO_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  className="home-info-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <div className="home-info-icon" style={{ '--ic': card.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="home-info-text">
                    <div className="home-info-title">{card.title}</div>
                    <div className="home-info-desc">{card.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
