/**
 * language: JSX, file: GameHub.jsx, runtime: Vite/Browser
 * Per-game detail page — hero, crack status, DLC manager, action bar.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Download, Play, Wrench, ShieldAlert,
  ShieldCheck, ShieldOff, Package, Clock, HardDrive,
  ChevronLeft, ChevronRight, RefreshCw, CheckSquare, Square, Info,
  Zap, Calendar, User, Tag, AlertTriangle, CheckCircle,
  ArrowDownToLine, ExternalLink, Loader2, Maximize2, X, Volume2, VolumeX
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import { useSteamDetails } from '../hooks/useSteamDetails';
import CrackPanel from '../components/CrackPanel';
import DownloadSourceModal from '../components/DownloadSourceModal';
import CrackVersionModal from '../components/CrackVersionModal';
import './GameHub.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const heroImg   = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/page_bg_generated_v6b.jpg`;
const headerImg = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const libImg    = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;

const SteamIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.353 0 0 5.373 0 12c0 4.966 3.018 9.223 7.37 11.015l3.208-4.662c-.176-.058-.337-.142-.486-.252L6.155 19.34a7.02 7.02 0 0 1 1.704-9.356 7.014 7.014 0 0 1 9.421 1.134l3.77-1.48c.026-.145.045-.292.045-.445 0-2.316-1.879-4.195-4.195-4.195-2.315 0-4.195 1.88-4.195 4.195 0 .265.029.52.078.77l-2.42 2.87c-.426-.192-.9-.302-1.398-.302-1.815 0-3.286 1.47-3.286 3.286s1.47 3.286 3.286 3.286 3.286-1.471 3.286-3.286c0-.348-.06-.682-.165-.994l2.493-2.956c.148.017.296.027.445.027 1.183 0 2.247-.492 3.01-1.282l3.775 1.482A11.967 11.967 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm-3.036 17.653c-.93 0-1.685-.755-1.685-1.685s.755-1.685 1.685-1.685 1.685.755 1.685 1.685-.755 1.685-1.685 1.685z"/></svg>;
const EpicIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12.002 0C5.372 0 0 5.372 0 12s5.372 12 12.002 12 12-5.373 12-12S18.632 0 12.002 0zm6.096 17.151h-3.418v-5.264c0-.707-.442-1.077-1.127-1.077-.732 0-1.205.418-1.205 1.137v5.204H8.931V7.917h3.417v1.895c.571-.861 1.636-1.168 2.656-1.168 1.942 0 3.094 1.258 3.094 3.324v5.183z"/></svg>;
const UplayIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 4.195c4.31 0 7.805 3.495 7.805 7.805 0 4.31-3.495 7.805-7.805 7.805-4.31 0-7.805-3.495-7.805-7.805 0-4.31 3.495-7.805 7.805-7.805zm0 1.95a5.855 5.855 0 1 0 0 11.71 5.855 5.855 0 0 0 0-11.71z"/></svg>; // Placeholder simple circle for uplay
const DenuvoIcon = ({size=14}) => <ShieldAlert size={size} />;

function getDrmIcons(drmStr) {
  if (!drmStr) return [];
  const s = drmStr.toLowerCase();
  const icons = [];
  if (s.includes('denuvo')) icons.push({ id: 'denuvo', icon: <DenuvoIcon size={12} /> });
  if (s.includes('steam')) icons.push({ id: 'steam', icon: <SteamIcon size={12} /> });
  if (s.includes('uplay') || s.includes('ubisoft')) icons.push({ id: 'uplay', icon: <UplayIcon size={12} /> });
  if (s.includes('epic')) icons.push({ id: 'epic', icon: <EpicIcon size={12} /> });
  if (s.includes('ea') || s.includes('origin')) icons.push({ id: 'ea', icon: <ShieldAlert size={12} /> });
  if (s.includes('rockstar')) icons.push({ id: 'rockstar', icon: <ShieldAlert size={12} /> });
  
  if (icons.length === 0 && drmStr !== 'None') {
    icons.push({ id: 'unknown', icon: <ShieldAlert size={12} /> });
  }
  return icons;
}

// ── Video Player overlay ──────────────────────────────────────────────────────
function TrailerPlayer({ movies, onClose }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(false);

  // Pick the best mp4 URL from Steam movies array
  const url = React.useMemo(() => {
    for (const movie of movies || []) {
      const urls = movie.mp4 || movie.webm || movie.urls || {};
      // Steam API returns { 480: url, max: url }
      const max = urls.max || urls[Object.keys(urls).sort().pop()];
      if (max) return max;
    }
    return null;
  }, [movies]);

  if (!url) return null;

  return (
    <motion.div
      className="gh-trailer-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="gh-trailer-wrap"
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 8 }}
        onClick={e => e.stopPropagation()}
      >
        <button className="gh-trailer-close" onClick={onClose}><X size={18} /></button>
        <button
          className="gh-trailer-mute"
          onClick={() => {
            if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
            setMuted(m => !m);
          }}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <video
          ref={videoRef}
          src={url}
          className="gh-trailer-video"
          autoPlay
          controls
          controlsList="nodownload"
        />
      </motion.div>
    </motion.div>
  );
}

// ── Hero Slideshow Component ──────────────────────────────────────────────────
function HeroSlideshow({ appId, activeGame, crackInfo, screenshots, movies, onBack }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const hasTrailer = movies && movies.length > 0;

  const normalizeUrl = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    return s.path_full || s.path_thumbnail || s.url || '';
  };
  const normalizeThumb = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    return s.path_thumbnail || s.path_full || s.url || '';
  };

  const rawList = (screenshots && screenshots.length > 0)
    ? screenshots.map(normalizeUrl).filter(Boolean)
    : [];

  const list = rawList.length > 0
    ? rawList
    : [
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`,
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`
      ];

  const go = useCallback((dir) => {
    setIdx(i => (i + dir + list.length) % list.length);
  }, [list.length]);

  useEffect(() => {
    if (list.length <= 1 || isPaused) return;
    timerRef.current = setInterval(() => {
      setIdx(i => (i + 1) % list.length);
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [list.length, isPaused]);

  useEffect(() => { setIdx(0); }, [appId]);

  // Keyboard navigation for screenshots and lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightbox) {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'Escape') setLightbox(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, go]);

  const curSrc = list[idx] || list[0];

  return (
    <div
      className="gh-hero"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background slide with cross-fade animation */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={curSrc}
          className="gh-hero-slide-img"
          src={curSrc}
          alt={activeGame.name}
          initial={{ opacity: 0, scale: 1.01 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onError={(e) => {
            const fallback = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
            if (e.target.src !== fallback) {
              e.target.src = fallback;
            }
          }}
        />
      </AnimatePresence>

      <div className="gh-hero-gradient" />

      {/* Back button */}
      <button className="gh-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Watch trailer button */}
      {hasTrailer && (
        <button className="gh-trailer-btn" onClick={() => setShowTrailer(true)}>
          <Play size={14} className="gh-trailer-btn-icon" fill="currentColor" />
          Watch Trailer
        </button>
      )}

      {/* Prev/Next arrows */}
      {list.length > 1 && (
        <>
          <button className="gh-hero-arrow left" onClick={(e) => { e.stopPropagation(); go(-1); }} title="Previous Screenshot">
            <ChevronLeft size={24} />
          </button>
          <button className="gh-hero-arrow right" onClick={(e) => { e.stopPropagation(); go(1); }} title="Next Screenshot">
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Hero content */}
      <div className="gh-hero-content">
        <h1 className="gh-hero-title">{activeGame.name}</h1>
        <div className="gh-hero-meta">
          {(() => {
            const drmIcons = getDrmIcons(crackInfo.drm);
            if (crackInfo.drm === 'None') {
              return (<span className="gh-drm-badge clean"><ShieldOff size={12} /> DRM-Free</span>);
            }
            
            return (
              <span className={`gh-drm-badge with-icon ${crackInfo.cracked ? 'cracked' : 'locked'}`} title={crackInfo.drm}>
                <span className="drm-icons-row" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {drmIcons.map(item => <span key={item.id} title={item.id}>{item.icon}</span>)}
                </span>
                {crackInfo.cracked 
                  ? `Cracked${crackInfo.crack_source ? ` (${crackInfo.crack_source})` : ''} ${crackInfo.crack_days ? `[${crackInfo.crack_days}]` : ''}` 
                  : `${crackInfo.drm || 'Protected'}`}
              </span>
            );
          })()}
          {activeGame.size && activeGame.size !== '—' && (<span className="gh-hero-stat"><HardDrive size={11} /> {activeGame.size}</span>)}
          {activeGame.playtime && activeGame.playtime !== '—' && (<span className="gh-hero-stat"><Clock size={11} /> {activeGame.playtime}</span>)}
        </div>
      </div>

      {/* Thumbnail strip + counter */}
      {list.length > 1 && (
        <div className="gh-hero-controls">
          <div className="gh-hero-strip">
            {list.slice(0, 7).map((ssUrl, i) => (
              <button
                key={i}
                className={`gh-hero-thumb ${i === idx ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              >
                <img src={ssUrl} alt="" loading="lazy" />
              </button>
            ))}
            {list.length > 7 && (
              <span className="gh-hero-more-count">+{list.length - 7}</span>
            )}
          </div>
          <div className="gh-hero-counter-wrap">
            <span className="gh-hero-counter">{idx + 1} / {list.length}</span>
            <button className="gh-hero-fullscreen" onClick={() => setLightbox(true)} title="View Fullscreen">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div className="gh-ss-lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(false)}>
            <button className="gh-ss-lb-close" onClick={() => setLightbox(false)} title="Close (Esc)"><X size={22} /></button>
            <button className="gh-ss-lb-arrow left" onClick={e => { e.stopPropagation(); go(-1); }}><ChevronLeft size={32} /></button>
            <img src={curSrc} alt="" className="gh-ss-lb-img" onClick={e => e.stopPropagation()} />
            <button className="gh-ss-lb-arrow right" onClick={e => { e.stopPropagation(); go(1); }}><ChevronRight size={32} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trailer modal */}
      <AnimatePresence>
        {showTrailer && <TrailerPlayer movies={movies} onClose={() => setShowTrailer(false)} />}
      </AnimatePresence>
    </div>
  );
}

// Fake DLC list for demo — will be replaced with SteamDB fetch
const DEMO_DLCS = [
  { id: '001', name: 'Expansion Pack I — Phantom Liberty', free: false },
  { id: '002', name: 'Expansion Pack II — New Dawn Fades', free: false },
  { id: '003', name: 'Soundtrack — Volume 1', free: true },
  { id: '004', name: 'OST — Night City Radio Mixes', free: true },
  { id: '005', name: 'Digital Artbook', free: false },
];

// ── DLC Manager ───────────────────────────────────────────────────────────────
function DLCManager({ appId }) {
  const [dlcs, setDlcs] = useState(DEMO_DLCS);
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === dlcs.length ? new Set() : new Set(dlcs.map(d => d.id)));

  const handleApply = async () => {
    setApplying(true);
    await new Promise(r => setTimeout(r, 1800));
    setApplying(false);
    setDone(true);
    setTimeout(() => setDone(false), 4000);
  };

  return (
    <div className="gh-dlc-manager">
      <div className="gh-dlc-header">
        <button className="gh-dlc-toggle-all" onClick={toggleAll}>
          {selected.size === dlcs.length
            ? <CheckSquare size={13} />
            : <Square size={13} />
          }
          <span>{selected.size === dlcs.length ? 'Deselect all' : 'Select all'}</span>
        </button>
        <span className="gh-dlc-count">{selected.size}/{dlcs.length} selected</span>
      </div>

      <div className="gh-dlc-list">
        {dlcs.map(dlc => (
          <button
            key={dlc.id}
            className={`gh-dlc-item ${selected.has(dlc.id) ? 'selected' : ''}`}
            onClick={() => toggle(dlc.id)}
          >
            {selected.has(dlc.id)
              ? <CheckSquare size={13} className="dlc-check" />
              : <Square size={13} className="dlc-check" />
            }
            <span className="gh-dlc-name">{dlc.name}</span>
            {dlc.free && <span className="gh-dlc-free-badge">Free</span>}
          </button>
        ))}
      </div>

      <button
        className="gh-dlc-apply"
        disabled={selected.size === 0 || applying}
        onClick={handleApply}
      >
        {applying
          ? <><RefreshCw size={13} className="spin" /> Applying…</>
          : done
            ? <><CheckCircle size={13} /> Applied!</>
            : <><Package size={13} /> Unlock {selected.size} DLC</>
        }
      </button>
    </div>
  );
}

// ── Action Bar ────────────────────────────────────────────────────────────────
function ActionBar({ game, crackInfo, onOpenDownloadModal }) {
  const [launching, setLaunching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);
  const isInstalled = !!game?.path;

  useEffect(() => {
    const setupDlHandler = () => {
      if (!window.Bridge?.download_progress?.connect) return null;
      const handler = (jsonStr) => {
        try {
          const payload = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
          if (payload.app_id === String(game?.app_id)) {
            setDlProgress(payload.progress || 0);
            if (payload.progress >= 100 || payload.status?.toLowerCase().includes('error') || payload.status?.toLowerCase().includes('failed')) {
              setTimeout(() => setDownloading(false), 1500);
            }
          }
        } catch (e) {
          console.error('Failed to parse download progress:', e);
        }
      };
      window.Bridge.download_progress.connect(handler);
      return handler;
    };
    let h = null;
    if (window.Bridge) {
      h = setupDlHandler();
    } else {
      import('../lib/bridge').then(({ bridge }) =>
        bridge.ready.then(() => { h = setupDlHandler(); })
      );
    }
    return () => {
      try { if (h && window.Bridge?.download_progress?.disconnect) window.Bridge.download_progress.disconnect(h); } catch (e) {}
    };
  }, [game?.app_id]);

  const handleLaunch = () => {
    setLaunching(true);
    if (window.Bridge?.launch_game) window.Bridge.launch_game(game.app_id);
    setTimeout(() => setLaunching(false), 2000);
  };

  return (
    <div className="gh-action-bar">
      {isInstalled ? (
        <button className="gh-btn-play" onClick={handleLaunch} disabled={launching}>
          {launching ? <><Loader2 size={16} className="spin" /> Launching…</> : <><Play size={16} /> Play</>}
        </button>
      ) : (
        <div className="gh-dl-wrap">
          <button
            className="gh-btn-download"
            onClick={onOpenDownloadModal}
            disabled={downloading}
          >
            {downloading
              ? <><RefreshCw size={15} className="spin" /> {dlProgress}%</>
              : <><Download size={15} /> Download & Install</>
            }
          </button>
          {downloading && (
            <div className="gh-dl-bar">
              <motion.div
                className="gh-dl-fill"
                initial={{ width: 0 }}
                animate={{ width: `${dlProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          )}
        </div>
      )}
      <button className="gh-btn-secondary"><Wrench size={14} /> Fix Tools</button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function GameHub() {
  const { activeGame, setActivePage } = useAppStore();
  const { lookupGame } = useCrackDB();
  const [tab, setTab] = useState('overview');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showCrackModal, setShowCrackModal] = useState(false);

  const appId = activeGame?.app_id;
  const { data: steamData, loading: steamLoading } = useSteamDetails(appId);

  // If no game selected, go back
  useEffect(() => {
    if (!activeGame) setActivePage('store');
  }, [activeGame]);

  if (!activeGame) return null;

  const crackInfo = lookupGame(appId) ?? {
    drm: activeGame.drm || 'Unknown',
    cracked: activeGame.cracked ?? false,
  };

  const screenshots = steamData?.screenshots ?? [];
  const movies      = steamData?.movies ?? [];
  const shortDesc   = steamData?.short_description || steamData?.short_desc || '';
  const detailedHtml = steamData?.about_html || steamData?.about_the_game || steamData?.detailed_description || steamData?.detailed_html || '';
  const genres      = Array.isArray(steamData?.genres)
    ? steamData.genres.map(g => (typeof g === 'string' ? g : g.description || g.name || ''))
    : (activeGame.tags || []);
  const developers  = steamData?.developers ?? [];
  const releaseDate = (typeof steamData?.release_date === 'object' ? steamData?.release_date?.date : steamData?.release_date) || steamData?.crack_release_date || '';
  const metacritic  = steamData?.metacritic;
  const dlcCount    = steamData?.dlc?.length ?? DEMO_DLCS.length;

  // Scene / crack information merged from backend & crackrelease
  const sceneGroup = steamData?.scene_group || crackInfo?.crack_source;
  const crackDate = steamData?.crack_date || crackInfo?.crack_date;
  const crackDays = steamData?.crack_days || crackInfo?.crack_days;

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'crack',    label: 'Crack' },
    { id: 'dlc',      label: 'DLC Manager' },
  ];

  return (
    <div className="game-hub">
      {/* ── Crack version info modal (step 1 of 2 for non-Steam DRM) ── */}
      {showCrackModal && (
        <CrackVersionModal
          appId={appId}
          gameName={activeGame.name}
          crackInfo={crackInfo}
          onClose={() => setShowCrackModal(false)}
          onProceed={() => {
            setShowCrackModal(false);
            setShowDownloadModal(true);
          }}
        />
      )}

      {/* ── Download source picker modal (step 2) ─────────────────── */}
      {showDownloadModal && (
        <DownloadSourceModal
          appId={appId}
          gameName={activeGame.name}
          onClose={() => setShowDownloadModal(false)}
        />
      )}

      {/* ── Hero Slideshow Banner ─────────────────────────────────────── */}
      <HeroSlideshow
        appId={appId}
        activeGame={activeGame}
        crackInfo={{ ...crackInfo, crack_source: sceneGroup || crackInfo.crack_source, crack_days: crackDays }}
        screenshots={screenshots}
        movies={movies}
        onBack={() => setActivePage('store')}
      />

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="gh-body">
        {/* Sidebar cover */}
        <div className="gh-sidebar">
          <img
            className="gh-cover"
            src={activeGame.cover_url || libImg(appId)}
            alt={activeGame.name}
            onError={e => {
              const fb1 = libImg(appId);
              const fb2 = activeGame.image_url;
              const fb3 = 'https://crackrelease.com/wp-content/uploads/2023/11/placeholder-image.jpg';
              if (e.target.src === activeGame.cover_url) e.target.src = fb1;
              else if (e.target.src === fb1 && fb2) e.target.src = fb2;
              else if (e.target.src !== fb3) e.target.src = fb3;
            }}
          />

          <ActionBar
            game={activeGame}
            crackInfo={crackInfo}
            onOpenDownloadModal={() => {
              // For non-standard DRM (Denuvo etc.) show crack info first
              // For standard Steam DRM / DRM-Free, go straight to manifest picker
              const skipCrackModal = crackInfo.is_standard_steam || crackInfo.drm === 'None';
              if (skipCrackModal) {
                setShowDownloadModal(true);
              } else {
                setShowCrackModal(true);
              }
            }}
          />

          {/* Quick stats */}
          <div className="gh-quick-stats">
            {sceneGroup && (
              <div className="gh-qs-row">
                <User size={11} /> <strong>Scene:</strong> {sceneGroup}
              </div>
            )}
            {crackDays && (
              <div className="gh-qs-row">
                <Clock size={11} /> <strong>Cracked:</strong> {crackDays}
              </div>
            )}
            {crackDate && (
              <div className="gh-qs-row">
                <Calendar size={11} /> <strong>Date:</strong> {crackDate}
              </div>
            )}
            {crackInfo.crack_version && (
              <div className="gh-qs-row">
                <Tag size={11} /> Crack v{crackInfo.crack_version}
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="gh-main">
          {/* Tabs */}
          <div className="gh-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`gh-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {tab === t.id && (
                  <motion.div
                    className="gh-tab-line"
                    layoutId="gh-tab-line"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              className="gh-tab-panel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'overview' && (
                <div className="gh-overview">
                  {/* Game title + meta row */}
                  <div className="gh-overview-header">
                    <h2 className="gh-game-title">{steamData?.name || activeGame.name}</h2>
                    <div className="gh-overview-meta">
                      {genres.slice(0, 4).map(g => (
                        <span key={g} className="gh-genre-tag">{g}</span>
                      ))}
                      {releaseDate && <span className="gh-release-date"><Calendar size={10} /> {releaseDate}</span>}
                      {developers[0] && <span className="gh-dev-tag"><User size={10} /> {developers[0]}</span>}
                      {metacritic && (
                        <span className="gh-metacritic" style={{ '--mc': metacritic.score >= 75 ? '#66cc33' : metacritic.score >= 50 ? '#ffcc00' : '#ff0000' }}>
                          MC {metacritic.score}
                        </span>
                      )}
                    </div>
                  </div>

                  {steamLoading && (
                    <div className="gh-steam-fetching">
                      <Loader2 size={13} className="spin" />
                      <span>Syncing Steam details…</span>
                    </div>
                  )}

                  {/* Short description */}
                  {shortDesc && (
                    <p className="gh-short-desc">{shortDesc}</p>
                  )}

                  {/* Quick info cards */}
                  <div className="gh-info-grid">
                    <InfoCard
                      icon={<ShieldCheck size={15} />}
                      label="DRM Status"
                      value={
                        crackInfo.drm === 'None'
                          ? 'DRM-Free ✓'
                          : crackInfo.drm === 'Steam DRM'
                          ? 'Steam DRM ✓'
                          : crackInfo.cracked
                          ? 'Cracked ⚡'
                          : 'Locked 🔒'
                      }
                      accent={
                        crackInfo.drm === 'None'
                          ? '#4ade80'
                          : crackInfo.drm === 'Steam DRM'
                          ? '#38bdf8'
                          : crackInfo.cracked
                          ? '#a78bfa'
                          : '#f87171'
                      }
                    />
                    <InfoCard
                      icon={<Package size={15} />}
                      label="DLC Available"
                      value={`${dlcCount} ${dlcCount === 1 ? 'item' : 'items'}`}
                      accent="#38bdf8"
                    />
                    {sceneGroup && (
                      <InfoCard
                        icon={<User size={15} />}
                        label="Scene Group"
                        value={sceneGroup}
                        accent="#a78bfa"
                      />
                    )}
                    <InfoCard
                      icon={<Zap size={15} />}
                      label="App ID"
                      value={appId}
                      accent="#facc15"
                    />
                  </div>

                  {/* Detailed description (Steam HTML) */}
                  {detailedHtml ? (
                    <div className="gh-detailed-desc">
                      <div className="gh-desc-label">About This Game</div>
                      <div
                        className="gh-desc-html"
                        dangerouslySetInnerHTML={{ __html: detailedHtml }}
                      />
                    </div>
                  ) : (
                    !steamLoading && (
                      <div className="gh-desc-fallback">
                        <p>{shortDesc || 'No detailed description available for this title.'}</p>
                      </div>
                    )
                  )}

                  {crackInfo.notes && (
                    <div className="gh-note-block">
                      <AlertTriangle size={13} />
                      <span>{crackInfo.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {tab === 'crack' && (
                <div className="gh-crack-tab">
                  <CrackPanel
                    crackInfo={crackInfo}
                    game={activeGame}
                    currentBuild={activeGame.buildid}
                  />

                  {!crackInfo.cracked && (
                    <div className="gh-crack-watch">
                      <Info size={13} />
                      <span>
                        Follow <strong>CrackWatch</strong> for updates on this title.
                      </span>
                      <a
                        href={`https://iscracked.to/?search=${encodeURIComponent(activeGame.name)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="gh-crack-watch-link"
                      >
                        Check iscracked.to <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {tab === 'dlc' && (
                <div className="gh-dlc-tab">
                  <div className="gh-dlc-intro">
                    <Package size={14} />
                    <span>Select DLC to unlock via <strong>SmokeAPI</strong> or <strong>CreamAPI</strong>.</span>
                  </div>
                  <DLCManager appId={appId} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, accent, truncate }) {
  return (
    <div className="gh-info-card" style={{ '--ac': accent }}>
      <div className="gh-info-icon">{icon}</div>
      <div className="gh-info-body">
        <div className="gh-info-label">{label}</div>
        <div className={`gh-info-value ${truncate ? 'truncate' : ''}`}>{value}</div>
      </div>
    </div>
  );
}