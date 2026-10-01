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
  ArrowDownToLine, ExternalLink, Loader2, Maximize2, X
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import { useSteamDetails } from '../hooks/useSteamDetails';
import CrackPanel from '../components/CrackPanel';
import './GameHub.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const heroImg   = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/page_bg_generated_v6b.jpg`;
const headerImg = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const libImg    = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;

const DRM_ICONS = {
  'denuvo': 'https://crackrelease.com/wp-content/uploads/2025/09/Denuvo-Anti-Tamper-drm-icon.png',
  'steam': 'https://crackrelease.com/wp-content/uploads/2025/09/Steamworks-Steam-DRM-icon.png',
  'uplay': 'https://crackrelease.com/wp-content/uploads/2025/09/Ubisoft-Connect-Uplay-DRM-icon.png',
  'ubisoft': 'https://crackrelease.com/wp-content/uploads/2025/09/Ubisoft-Connect-Uplay-DRM-icon.png',
  'ea': 'https://crackrelease.com/wp-content/uploads/2025/09/Origin-EA-App-DRM-icon.png',
  'origin': 'https://crackrelease.com/wp-content/uploads/2025/09/Origin-EA-App-DRM-icon.png',
  'rockstar': 'https://crackrelease.com/wp-content/uploads/2025/09/Rockstar-Games-Launcher-DRM-icon.png',
  'epic': 'https://crackrelease.com/wp-content/uploads/2025/09/Epic-Online-Services-Epic-Games-Store-DRM-icon.png',
  'battle.net': 'https://crackrelease.com/wp-content/uploads/2025/09/Battle.net-DRM-icon.png',
};

function getDrmIcon(drmStr) {
  if (!drmStr) return null;
  const s = drmStr.toLowerCase();
  for (const [key, url] of Object.entries(DRM_ICONS)) {
    if (s.includes(key)) return url;
  }
  return null;
}

// ── Hero Slideshow Component ──────────────────────────────────────────────────
function HeroSlideshow({ appId, activeGame, crackInfo, screenshots, onBack }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const list = screenshots && screenshots.length > 0
    ? screenshots.map(s => s.path_full)
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
    }, 5500);
    return () => clearInterval(timerRef.current);
  }, [list.length, isPaused]);

  useEffect(() => {
    setIdx(0);
  }, [appId]);

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
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          onError={(e) => {
            if (e.target.src !== `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`) {
              e.target.src = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
            }
          }}
        />
      </AnimatePresence>

      <div className="gh-hero-gradient" />

      {/* Back button */}
      <button className="gh-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Hero Prev/Next navigation arrows */}
      {list.length > 1 && (
        <>
          <button
            className="gh-hero-arrow left"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            title="Poprzedni zrzut ekranu"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className="gh-hero-arrow right"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            title="Następny zrzut ekranu"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Hero content (Title and meta badges only - no game header icon) */}
      <div className="gh-hero-content">
        <h1 className="gh-hero-title">{activeGame.name}</h1>

        <div className="gh-hero-meta">
          {(() => {
            const drmIcon = getDrmIcon(crackInfo.drm);
            if (drmIcon) {
              return (
                <span className={`gh-drm-badge with-icon ${crackInfo.cracked ? 'cracked' : 'locked'}`} title={crackInfo.drm}>
                  <img src={drmIcon} alt={crackInfo.drm} className="gh-drm-icon-img" />
                  {crackInfo.cracked ? 'Cracked' : 'Protected'}
                </span>
              );
            }
            if (crackInfo.drm === 'None') {
              return (
                <span className="gh-drm-badge clean">
                  <ShieldOff size={12} /> DRM-Free
                </span>
              );
            }
            if (crackInfo.drm === 'Steam DRM') {
              return (
                <span className="gh-drm-badge steam">
                  <ShieldCheck size={12} /> Steam DRM
                </span>
              );
            }
            if (crackInfo.cracked) {
              return (
                <span className="gh-drm-badge cracked">
                  <ShieldCheck size={12} /> {crackInfo.drm} — Cracked
                </span>
              );
            }
            return (
              <span className="gh-drm-badge locked">
                <ShieldAlert size={12} /> {crackInfo.drm || 'Unknown DRM'}
              </span>
            );
          })()}

          {activeGame.size && activeGame.size !== '—' && (
            <span className="gh-hero-stat">
              <HardDrive size={11} /> {activeGame.size}
            </span>
          )}
          {activeGame.playtime && activeGame.playtime !== '—' && (
            <span className="gh-hero-stat">
              <Clock size={11} /> {activeGame.playtime}
            </span>
          )}
        </div>
      </div>

      {/* Hero bottom-right controls (thumbnails + counter + fullscreen) */}
      {list.length > 1 && (
        <div className="gh-hero-controls">
          {screenshots && screenshots.length > 0 && (
            <div className="gh-hero-strip">
              {screenshots.slice(0, 6).map((ss, i) => (
                <button
                  key={i}
                  className={`gh-hero-thumb ${i === idx ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIdx(i);
                  }}
                  title={`Zrzut ${i + 1}`}
                >
                  <img src={ss.path_thumbnail} alt="" loading="lazy" />
                </button>
              ))}
              {screenshots.length > 6 && (
                <span className="gh-hero-more-count">+{screenshots.length - 6}</span>
              )}
            </div>
          )}

          <div className="gh-hero-counter-wrap">
            <span className="gh-hero-counter">{idx + 1} / {list.length}</span>
            <button
              className="gh-hero-fullscreen"
              onClick={() => setLightbox(true)}
              title="Pełny ekran"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox full-res modal */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="gh-ss-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(false)}
          >
            <button className="gh-ss-lb-close" onClick={() => setLightbox(false)}>
              <X size={20} />
            </button>
            <button
              className="gh-ss-lb-arrow left"
              onClick={e => { e.stopPropagation(); go(-1); }}
            >
              <ChevronLeft size={28} />
            </button>
            <img
              src={curSrc}
              alt=""
              className="gh-ss-lb-img"
              onClick={e => e.stopPropagation()}
            />
            <button
              className="gh-ss-lb-arrow right"
              onClick={e => { e.stopPropagation(); go(1); }}
            >
              <ChevronRight size={28} />
            </button>
          </motion.div>
        )}
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
function ActionBar({ game, crackInfo }) {
  const [launching, setLaunching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);
  const isInstalled = !!game?.path;

  useEffect(() => {
    if (!window.Bridge?.download_progress?.connect) return;
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
        console.error("Failed to parse download progress:", e);
      }
    };
    window.Bridge.download_progress.connect(handler);
    return () => {
      try { window.Bridge.download_progress.disconnect(handler); } catch (e) {}
    };
  }, [game?.app_id]);

  const handleLaunch = () => {
    setLaunching(true);
    // Bridge call to launch game
    if (window.Bridge?.launch_game) {
      window.Bridge.launch_game(game.app_id);
    }
    setTimeout(() => setLaunching(false), 2000);
  };

  const handleDownload = () => {
    if (!window.Bridge?.download_game_fastest) return;
    setDownloading(true);
    setDlProgress(0);
    window.Bridge.download_game_fastest(String(game.app_id));
  };

  return (
    <div className="gh-action-bar">
      {isInstalled ? (
        <button
          className="gh-btn-play"
          onClick={handleLaunch}
          disabled={launching}
        >
          {launching
            ? <><Loader2 size={16} className="spin" /> Launching…</>
            : <><Play size={16} /> Play</>
          }
        </button>
      ) : (
        <div className="gh-dl-wrap">
          <button
            className="gh-btn-download"
            onClick={handleDownload}
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

      <button className="gh-btn-secondary">
        <Wrench size={14} /> Fix Tools
      </button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function GameHub() {
  const { activeGame, setActivePage } = useAppStore();
  const { lookupGame } = useCrackDB();
  const [tab, setTab] = useState('overview');

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
  const shortDesc   = steamData?.short_description ?? '';
  const detailedHtml = steamData?.detailed_description ?? '';
  const genres      = steamData?.genres?.map(g => g.description) ?? [];
  const developers  = steamData?.developers ?? [];
  const releaseDate = steamData?.release_date?.date ?? '';
  const metacritic  = steamData?.metacritic;
  const dlcCount    = steamData?.dlc?.length ?? DEMO_DLCS.length;

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'crack',    label: 'Crack' },
    { id: 'dlc',      label: 'DLC Manager' },
  ];

  return (
    <div className="game-hub">
      {/* ── Hero Slideshow Banner ─────────────────────────────────────── */}
      <HeroSlideshow
        appId={appId}
        activeGame={activeGame}
        crackInfo={crackInfo}
        screenshots={screenshots}
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
            onError={e => { e.target.src = libImg(appId); }}
          />

          <ActionBar game={activeGame} crackInfo={crackInfo} />

          {/* Quick stats */}
          <div className="gh-quick-stats">
            {crackInfo.crack_version && (
              <div className="gh-qs-row">
                <Tag size={11} /> Crack v{crackInfo.crack_version}
              </div>
            )}
            {crackInfo.crack_source && (
              <div className="gh-qs-row">
                <User size={11} /> {crackInfo.crack_source}
              </div>
            )}
            {crackInfo.crack_date && (
              <div className="gh-qs-row">
                <Calendar size={11} /> {crackInfo.crack_date}
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
                      {genres.slice(0, 3).map(g => (
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

                  {/* Detailed description (Steam HTML) */}
                  {detailedHtml && (
                    <div className="gh-detailed-desc">
                      <div className="gh-desc-label">About This Game</div>
                      <div
                        className="gh-desc-html"
                        dangerouslySetInnerHTML={{ __html: detailedHtml }}
                      />
                    </div>
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
                    {activeGame.path && (
                      <InfoCard
                        icon={<HardDrive size={15} />}
                        label="Install Path"
                        value={activeGame.path}
                        accent="#fb923c"
                        truncate
                      />
                    )}
                    <InfoCard
                      icon={<Zap size={15} />}
                      label="App ID"
                      value={appId}
                      accent="#facc15"
                    />
                  </div>

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