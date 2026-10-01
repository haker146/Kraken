import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ShieldOff, Sparkles, ShieldAlert,
  Shield, BookOpen, Wrench, Download, ChevronRight, ChevronLeft,
  TrendingUp, Activity, Info
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import './Home.css';

// ── Steam URL helpers ─────────────────────────────────────────────────────────
// library_hero.jpg exists for most modern games, great as fullscreen background
const heroImg  = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`;
// capsule_616x353 is guaranteed for every game on Steam
const capImg   = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/capsule_616x353.jpg`;
const headerImg = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const libImg    = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;
const logoImg   = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/logo.png`;

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'cracked',        label: 'Recently Cracked',         icon: Zap,        color: '#a78bfa' },
  { id: 'denuvo_removed', label: 'Denuvo Removed by Studio', icon: ShieldOff,  color: '#4ade80' },
  { id: 'new_releases',   label: 'New Releases',             icon: Sparkles,   color: '#38bdf8' },
  { id: 'not_cracked',    label: 'Not Yet Cracked',          icon: ShieldAlert,color: '#f87171' },
];

// ── Large game pool per category ─────────────────────────────────────────────
// Using well-known popular games with confirmed Steam artwork
const CATEGORY_APPIDS = {
  cracked: [
    '1091500', // Cyberpunk 2077
    '1245620', // Elden Ring
    '1593500', // God of War
    '1174180', // Red Dead Redemption 2
    '1716740', // Battlefield 2042
    '2050650', // Resident Evil 4
    '271590',  // GTA V
    '359550',  // Rainbow Six Siege
    '812140',  // Assassin's Creed Origins
    '1145360', // Hades
    '1517290', // Farming Simulator 22
    '1262540', // Disco Elysium
    '292030',  // The Witcher 3
    '1367060', // Cyberpunk DLC / PL-extended
    '774241',  // Assassin's Creed Odyssey
    '1454400', // Weird West
  ],
  denuvo_removed: [
    '1086940', // Baldur's Gate 3
    '230410',  // Warframe
    '291550',  // Battleblock Theater
    '582010',  // Monster Hunter: World
    '632360',  // Risk of Rain 2
    '1174180', // Red Dead Redemption 2
    '1172470', // Apex Legends
    '377160',  // Fallout 4
    '22380',   // Fallout: New Vegas
    '489830',  // The Elder Scrolls V: Skyrim SE
    '1313140', // Forza Horizon 4
    '1551360', // Forza Horizon 5
    '39140',   // Fallout 3
    '208650',  // Batman: Arkham Origins
    '35140',   // Batman: Arkham Asylum
    '312660',  // Saints Row IV
  ],
  new_releases: [
    '2358720', // Hogwarts Legacy
    '2767030', // Baldur's Gate 3 (recent release window)
    '2239430', // Lies of P
    '1888160', // Wo Long: Fallen Dynasty
    '1877480', // Starfield
    '2379780', // Armored Core VI
    '2369390', // Dead Space Remake
    '2528540', // Alone in the Dark
    '1966720', // Lies of P
    '2622090', // Palworld
    '2050650', // RE4 Remake
    '1659420', // Atomic Heart
    '2012500', // Vampire Survivors
    '1811260', // Midnight Ghost Hunt
    '2101250', // The Callisto Protocol
    '1850220', // Citizen Sleeper
  ],
  not_cracked: [
    '990080',  // Hollow Knight: Silksong
    '2358720', // Hogwarts Legacy (old status)
    '2767030', // BG3 early
    '1877480', // Starfield
    '2622090', // Palworld
    '2530490', // Spider-Man 2
    '2183900', // Diablo IV
    '2230740', // GTA VI (placeholder)
    '1151640', // Nickelodeon All-Star Brawl
    '1938090', // Call of Duty: Modern Warfare 2
    '2012840', // Call of Duty: Warzone 2.0
    '2200900', // Need for Speed Unbound
    '1659420', // Atomic Heart
    '2484830', // Exoprimal
    '2379780', // Armored Core VI
    '1840290', // Destiny 2: Lightfall
  ],
};

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ── HeroImage — z automatycznym fallback ─────────────────────────────────────
function HeroImage({ appId, isActive }) {
  const [src, setSrc] = useState(heroImg(appId));
  const [loaded, setLoaded] = useState(false);

  // Reset on appId change
  useEffect(() => {
    setSrc(heroImg(appId));
    setLoaded(false);
  }, [appId]);

  const handleError = () => {
    // Fallback chain: library_hero → capsule_616x353 → header
    if (src === heroImg(appId))    { setSrc(capImg(appId));    return; }
    if (src === capImg(appId))     { setSrc(headerImg(appId)); return; }
  };

  return (
    <img
      key={src}
      src={src}
      alt=""
      className={`mini-hero-bg-img ${loaded ? 'loaded' : ''}`}
      onLoad={() => setLoaded(true)}
      onError={handleError}
      draggable={false}
    />
  );
}

const GAME_NAMES = {
  '1091500': 'Cyberpunk 2077',
  '1245620': 'Elden Ring',
  '1593500': 'God of War',
  '1174180': 'Red Dead Redemption 2',
  '1716740': 'Battlefield 2042',
  '2050650': 'Resident Evil 4',
  '271590':  'Grand Theft Auto V',
  '359550':  "Tom Clancy's Rainbow Six Siege",
  '812140':  "Assassin's Creed Origins",
  '1145360': 'Hades',
  '1517290': 'Farming Simulator 22',
  '1262540': 'Disco Elysium',
  '292030':  'The Witcher 3: Wild Hunt',
  '1367060': 'Cyberpunk 2077: Phantom Liberty',
  '774241':  "Assassin's Creed Odyssey",
  '1454400': 'Weird West',
  '1086940': "Baldur's Gate 3",
  '230410':  'Warframe',
  '291550':  'BattleBlock Theater',
  '582010':  'Monster Hunter: World',
  '632360':  'Risk of Rain 2',
  '1172470': 'Apex Legends',
  '377160':  'Fallout 4',
  '22380':   'Fallout: New Vegas',
  '489830':  'The Elder Scrolls V: Skyrim SE',
  '1313140': 'Forza Horizon 4',
  '1551360': 'Forza Horizon 5',
  '39140':   'Fallout 3',
  '208650':  'Batman: Arkham Origins',
  '35140':   'Batman: Arkham Asylum',
  '312660':  'Saints Row IV',
  '2358720': 'Hogwarts Legacy',
  '2767030': "Baldur's Gate 3",
  '2239430': 'Lies of P',
  '1888160': 'Wo Long: Fallen Dynasty',
  '1877480': 'Starfield',
  '2379780': 'Armored Core VI Fires of Rubicon',
  '2369390': 'Dead Space',
  '2528540': 'Alone in the Dark',
  '1966720': 'Lies of P',
  '2622090': 'Palworld',
  '1659420': 'Atomic Heart',
  '2012500': 'Vampire Survivors',
  '1811260': 'Midnight Ghost Hunt',
  '2101250': 'The Callisto Protocol',
  '1850220': 'Citizen Sleeper',
  '990080':  'Hollow Knight: Silksong',
  '2530490': "Marvel's Spider-Man 2",
  '2183900': 'Diablo IV',
  '2230740': 'Grand Theft Auto VI',
  '1151640': 'Nickelodeon All-Star Brawl',
  '1938090': 'Call of Duty: Modern Warfare II',
  '2012840': 'Call of Duty: Warzone',
  '2200900': 'Need for Speed Unbound',
  '2484830': 'Exoprimal',
  '1840290': 'Destiny 2: Lightfall',
};

// ── Full-screen Slideshow Hero ────────────────────────────────────────────────
function MiniHero({ appIds, catColor, catId, catLabel }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [headerLoaded, setHeaderLoaded] = useState(true);
  const timerRef = useRef(null);
  const { setActiveGame, setActivePage } = useAppStore();
  const { db } = useCrackDB();

  // Reset on category change
  useEffect(() => {
    setActiveIdx(0);
  }, [catId]);

  // Auto-advance every 6s
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % appIds.length);
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [appIds, catId]);

  const goTo = (i) => {
    if (i === activeIdx) return;
    setActiveIdx(i);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(n => (n + 1) % appIds.length);
    }, 6000);
  };

  const appId = appIds[activeIdx];
  const crackEntry = db?.[appId];
  const gameName = crackEntry?.name || GAME_NAMES[appId] || `App ${appId}`;

  const handleOpen = () => {
    setActiveGame({
      app_id:    appId,
      name:      gameName,
      cover_url: libImg(appId),
      drm:       crackEntry?.drm || (catId === 'denuvo_removed' ? 'DRM-Free' : crackEntry?.drm || 'Unknown'),
      cracked:   crackEntry?.cracked ?? (catId === 'cracked' || catId === 'denuvo_removed'),
    });
    setActivePage('game-hub');
  };

  return (
    <div className="mini-hero">
      {/* ─ Crossfade background images ─ */}
      <div className="mini-hero-bg-stack">
        <AnimatePresence initial={false}>
          <motion.div
            key={appId}
            className="mini-hero-bg-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{   opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          >
            <HeroImage appId={appId} isActive={true} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─ Gradient overlays ─ */}
      <div className="mini-hero-gradient" />
      <div className="mini-hero-vignette" />

      {/* ─ Content ─ */}
      <div className="mini-hero-content">
        {/* Category & Status badges */}
        <div className="mini-hero-badges-row">
          <div className="mini-hero-cat-badge" style={{ '--cc': catColor }}>
            {catLabel}
          </div>

          {crackEntry?.cracked ? (
            <span className="mini-hero-drm-pill cracked">
              Cracked {crackEntry.crack_source ? `• ${crackEntry.crack_source}` : '✓'}
            </span>
          ) : catId === 'denuvo_removed' ? (
            <span className="mini-hero-drm-pill drmfree">
              DRM-Free ✓
            </span>
          ) : crackEntry?.drm ? (
            <span className="mini-hero-drm-pill locked">
              {crackEntry.drm}
            </span>
          ) : null}
        </div>

        {/* Game Title & Header Logo */}
        <div className="mini-hero-title-wrap">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={appId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mini-hero-title-box"
            >
              <img 
                src={logoImg(appId)} 
                alt={gameName}
                className="mini-hero-logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <h2 className="mini-hero-text-title" style={{ display: 'none' }}>{gameName}</h2>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CTA */}
        <button
          className="mini-hero-cta"
          style={{ '--cat-color': catColor }}
          onClick={handleOpen}
        >
          Open Game Hub <ChevronRight size={14} />
        </button>
      </div>

      {/* ─ Left / Right arrow navigation ─ */}
      <button className="mini-hero-arrow left" onClick={() => goTo((activeIdx - 1 + appIds.length) % appIds.length)}>
        <ChevronLeft size={20} />
      </button>
      <button className="mini-hero-arrow right" onClick={() => goTo((activeIdx + 1) % appIds.length)}>
        <ChevronRight size={20} />
      </button>

      {/* ─ Dot navigation ─ */}
      <div className="mini-hero-dots">
        {appIds.map((id, i) => (
          <button
            key={id}
            className={`mini-dot ${i === activeIdx ? 'active' : ''}`}
            style={{ '--cc': catColor }}
            onClick={() => goTo(i)}
          >
            {i === activeIdx && (
              <motion.div
                className="mini-dot-fill"
                style={{ background: catColor }}
                layoutId={`dot-fill-${catId}`}
                transition={{ duration: 0.25 }}
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
    desc: 'Unlocks games via LumaCore plug-in Lua injection automatically. No manual file editing or Steam restarts required.',
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
  const { db } = useCrackDB();

  const [dynamicAppIds, setDynamicAppIds] = useState(CATEGORY_APPIDS);
  const [displayIds, setDisplayIds] = useState(() => pickRandom(CATEGORY_APPIDS['cracked'], 8));

  // Fetch live categories from the web via Python backend
  useEffect(() => {
    // 1. Listen for the response
    const handler = (jsonStr) => {
      try {
        const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (res.task === 'hero_categories' && res.data) {
          // Merge with what we have to ensure no empty categories
          setDynamicAppIds(prev => ({
            cracked: res.data.cracked?.length ? res.data.cracked : prev.cracked,
            not_cracked: res.data.not_cracked?.length ? res.data.not_cracked : prev.not_cracked,
            new_releases: res.data.new_releases?.length ? res.data.new_releases : prev.new_releases,
            denuvo_removed: res.data.denuvo_removed?.length ? res.data.denuvo_removed : prev.denuvo_removed,
          }));
        }
      } catch (e) {
        console.error("Failed to parse hero categories", e);
      }
    };
    
    if (window.Bridge?.task_finished?.connect) {
      window.Bridge.task_finished.connect(handler);
    }
    
    // 2. Trigger the fetch
    if (window.Bridge?.get_hero_categories) {
      window.Bridge.get_hero_categories();
    }
    
    return () => {
      try { window.Bridge?.task_finished?.disconnect(handler); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    setDisplayIds(pickRandom(dynamicAppIds[activeCat] || CATEGORY_APPIDS[activeCat], 8));
  }, [activeCat, dynamicAppIds]);

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
        <div className="home-hero-wrap">
          <MiniHero
            appIds={displayIds}
            catColor={cat.color}
            catId={activeCat}
            catLabel={cat.label}
          />
        </div>

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
