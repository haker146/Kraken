/**
 * language: JSX, file: GameHub.jsx, runtime: Vite/Browser
 * Per-game detail page — hero, crack status, DLC manager, action bar.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Download, Play, Wrench, ShieldAlert,
  ShieldCheck, ShieldOff, Package, Clock, HardDrive,
  ChevronRight, RefreshCw, CheckSquare, Square, Info,
  Zap, Calendar, User, Tag, AlertTriangle, CheckCircle,
  ArrowDownToLine, ExternalLink, Loader2
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import CrackPanel from '../components/CrackPanel';
import './GameHub.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const heroImg    = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/page_bg_generated_v6b.jpg`;
const headerImg  = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const libImg     = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;

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

  const handleLaunch = () => {
    setLaunching(true);
    // Bridge call to launch game
    if (window.Bridge?.launch_game) {
      window.Bridge.launch_game(game.app_id);
    }
    setTimeout(() => setLaunching(false), 2000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDlProgress(0);
    for (let i = 1; i <= 100; i++) {
      await new Promise(r => setTimeout(r, 40));
      setDlProgress(i);
    }
    setDownloading(false);
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
  const [heroError, setHeroError] = useState(false);

  // If no game selected, go back
  useEffect(() => {
    if (!activeGame) setActivePage('store');
  }, [activeGame]);

  if (!activeGame) return null;

  const appId = activeGame.app_id;
  const crackInfo = lookupGame(appId) ?? {
    drm: activeGame.drm || 'Unknown',
    cracked: activeGame.cracked ?? false,
  };

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'crack',    label: 'Crack' },
    { id: 'dlc',      label: 'DLC Manager' },
  ];

  return (
    <div className="game-hub">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="gh-hero">
        {!heroError ? (
          <img
            className="gh-hero-bg"
            src={heroImg(appId)}
            alt=""
            onError={() => setHeroError(true)}
          />
        ) : (
          <div className="gh-hero-bg gh-hero-fallback" />
        )}
        <div className="gh-hero-gradient" />

        {/* Back button */}
        <button className="gh-back-btn" onClick={() => setActivePage('store')}>
          <ArrowLeft size={14} /> Back
        </button>

        {/* Hero content */}
        <div className="gh-hero-content">
          <img
            className="gh-hero-header"
            src={headerImg(appId)}
            alt={activeGame.name}
            onError={e => e.target.style.display = 'none'}
          />

          <div className="gh-hero-meta">
            {crackInfo.cracked ? (
              <span className="gh-drm-badge cracked">
                <ShieldCheck size={12} /> {crackInfo.drm} — Cracked
              </span>
            ) : crackInfo.drm === 'None' ? (
              <span className="gh-drm-badge clean">
                <ShieldOff size={12} /> DRM-Free
              </span>
            ) : (
              <span className="gh-drm-badge locked">
                <ShieldAlert size={12} /> {crackInfo.drm || 'Unknown DRM'}
              </span>
            )}

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
      </div>

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
                  <h2 className="gh-game-title">{activeGame.name}</h2>

                  <div className="gh-info-grid">
                    <InfoCard
                      icon={<ShieldCheck size={15} />}
                      label="DRM Status"
                      value={crackInfo.cracked ? 'Cracked ⚡' : (crackInfo.drm === 'None' ? 'DRM-Free ✓' : 'Locked 🔒')}
                      accent={crackInfo.cracked ? '#a78bfa' : crackInfo.drm === 'None' ? '#4ade80' : '#f87171'}
                    />
                    <InfoCard
                      icon={<Package size={15} />}
                      label="DLC Available"
                      value={`${DEMO_DLCS.length} expansions`}
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