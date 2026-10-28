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
  ArrowDownToLine, Loader2, Maximize2, X
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import { useCrackStatus } from '../hooks/useCrackStatus';
import { useSteamDetails } from '../hooks/useSteamDetails';
import CrackPanel from '../components/CrackPanel';
import UnlockRecipe from '../components/UnlockRecipe';
import GameDowngradeTab from '../components/GameDowngradeTab';
import DownloadSourceModal from '../components/DownloadSourceModal';
import CrackVersionModal from '../components/CrackVersionModal';
import SteamImage, { SteamLogo } from '../components/SteamImage';
import './GameHub.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const heroImg   = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/page_bg_generated_v6b.jpg`;
const headerImg = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const libImg    = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;

const SteamIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.353 0 0 5.373 0 12c0 4.966 3.018 9.223 7.37 11.015l3.208-4.662c-.176-.058-.337-.142-.486-.252L6.155 19.34a7.02 7.02 0 0 1 1.704-9.356 7.014 7.014 0 0 1 9.421 1.134l3.77-1.48c.026-.145.045-.292.045-.445 0-2.316-1.879-4.195-4.195-4.195-2.315 0-4.195 1.88-4.195 4.195 0 .265.029.52.078.77l-2.42 2.87c-.426-.192-.9-.302-1.398-.302-1.815 0-3.286 1.47-3.286 3.286s1.47 3.286 3.286 3.286 3.286-1.471 3.286-3.286c0-.348-.06-.682-.165-.994l2.493-2.956c.148.017.296.027.445.027 1.183 0 2.247-.492 3.01-1.282l3.775 1.482A11.967 11.967 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm-3.036 17.653c-.93 0-1.685-.755-1.685-1.685s.755-1.685 1.685-1.685 1.685.755 1.685 1.685-.755 1.685-1.685 1.685z"/></svg>;
const EpicIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12.002 0C5.372 0 0 5.372 0 12s5.372 12 12.002 12 12-5.373 12-12S18.632 0 12.002 0zm6.096 17.151h-3.418v-5.264c0-.707-.442-1.077-1.127-1.077-.732 0-1.205.418-1.205 1.137v5.204H8.931V7.917h3.417v1.895c.571-.861 1.636-1.168 2.656-1.168 1.942 0 3.094 1.258 3.094 3.324v5.183z"/></svg>;
const UplayIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 4.195c4.31 0 7.805 3.495 7.805 7.805 0 4.31-3.495 7.805-7.805 7.805-4.31 0-7.805-3.495-7.805-7.805 0-4.31 3.495-7.805 7.805-7.805zm0 1.95a5.855 5.855 0 1 0 0 11.71 5.855 5.855 0 0 0 0-11.71z"/></svg>; // Placeholder simple circle for uplay
const DenuvoIcon = ({size=14}) => <ShieldAlert size={size} />;

function isRemovedDenuvoText(text) {
  const s = String(text || '');
  return /denuvo/i.test(s) && /removed|stripped|dropped|retired/i.test(s);
}

function pickProtection(remote, steam, bundled, extra) {
  const remoteP = String(remote || '').trim();
  const bundledP = String(bundled || '').trim();
  const steamP = String(steam || '').trim();
  const removedHit = [remoteP, bundledP, steamP].find(isRemovedDenuvoText)
    || (extra?.denuvo_removed ? 'Denuvo removed by developer' : '');
  if (removedHit || extra?.denuvo_removed) {
    const rest = [remoteP, bundledP, steamP]
      .flatMap((chunk) => chunk.split(/\s*(?:\+|\/|,|&)\s*/))
      .map((token) => token.trim())
      .filter((token) => token && !/denuvo/i.test(token) && !/removed|stripped|dropped|retired/i.test(token));
    const unique = [...new Set(rest)];
    return unique.length
      ? `Denuvo removed by developer + ${unique.join(' + ')}`
      : 'Denuvo removed by developer';
  }
  if (bundledP && /denuvo/i.test(remoteP) && !/denuvo/i.test(bundledP)) return bundledP;
  if (bundledP && /denuvo/i.test(steamP) && !/denuvo/i.test(bundledP)) {
    return remoteP && !/denuvo/i.test(remoteP) ? remoteP : bundledP;
  }
  return remoteP || steamP || bundledP || '';
}

function getDrmIcons(drmStr) {
  if (!drmStr) return [];
  const s = drmStr.toLowerCase();
  const icons = [];
  if (s.includes('arxan') || s.includes('digital.ai')) icons.push({ id: 'arxan', icon: <ShieldAlert size={12} /> });
  if (/denuvo/i.test(s) && /removed|stripped|dropped|retired/i.test(s)) {
    icons.push({ id: 'denuvo_removed', icon: <ShieldCheck size={12} /> });
  } else if (s.includes('denuvo')) {
    icons.push({ id: 'denuvo', icon: <DenuvoIcon size={12} /> });
  }
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
function toHttps(url) {
  if (typeof url !== 'string' || !url) return '';
  return url.replace(/^http:\/\//i, 'https://');
}

function trailerQualityScore(url) {
  const u = String(url || '').toLowerCase();
  const fmt = u.includes('.mp4') ? 0 : u.includes('.webm') ? 1 : 2;
  let q = 2;
  if (u.includes('movie_max') || u.includes('1080') || u.includes('/max')) q = 0;
  else if (u.includes('720')) q = 1;
  else if (u.includes('movie480') || u.includes('480')) q = 3;
  return fmt * 10 + q;
}

function movieUrlList(movie) {
  const seen = new Set();
  const urls = [];
  const add = (raw) => {
    const url = toHttps(raw);
    if (!url || seen.has(url)) return;
    const lower = url.toLowerCase();
    if (lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('hls_')) return;
    seen.add(url);
    urls.push(url);
  };
  if (!movie) return urls;
  if (Array.isArray(movie.urls)) movie.urls.forEach(add);
  add(movie.url);
  if (typeof movie.mp4 === 'string') add(movie.mp4);
  else if (movie.mp4 && typeof movie.mp4 === 'object') {
    add(movie.mp4.max); add(movie.mp4['1080']); add(movie.mp4['720']); add(movie.mp4['480']);
    Object.values(movie.mp4).forEach(add);
  }
  if (typeof movie.webm === 'string') add(movie.webm);
  else if (movie.webm && typeof movie.webm === 'object') {
    add(movie.webm.max); add(movie.webm['1080']); add(movie.webm['720']); add(movie.webm['480']);
    Object.values(movie.webm).forEach(add);
  }
  urls.sort((a, b) => trailerQualityScore(a) - trailerQualityScore(b));
  return urls;
}

function collectTrailerUrls(movies) {
  const seen = new Set();
  const urls = [];
  for (const movie of movies || []) {
    for (const url of movieUrlList(movie)) {
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

function openNativeTrailer(movies, gameName, appId) {
  const urls = collectTrailerUrls(movies);
  const title = movies?.[0]?.name || gameName || 'Trailer';
  if (urls.length) {
    bridge.call('play_game_trailer', urls.join('|'), title);
    return;
  }
  if (appId) {
    bridge.call('open_url', `https://store.steampowered.com/app/${appId}/`);
  }
}

// ── Hero Slideshow Component ──────────────────────────────────────────────────
function placeholderGameName(name, appId) {
  const n = String(name || '').trim();
  if (!n) return true;
  if (/^App\s+\d+$/i.test(n)) return true;
  return Boolean(appId) && n === String(appId);
}

function HeroSlideshow({ appId, activeGame, displayName, crackInfo, screenshots, movies, onBack }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const trailerUrls = collectTrailerUrls(movies);
  const hasTrailer = trailerUrls.length > 0 || (Array.isArray(movies) && movies.length > 0);

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
          alt={displayName || activeGame.name}
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
        <button
          className="gh-trailer-btn"
          onClick={() => openNativeTrailer(movies, displayName || activeGame?.name, appId)}
        >
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
        <div className="gh-hero-brand">
          <SteamLogo
            appId={appId}
            name={displayName || activeGame.name}
            className="gh-hero-logo-img"
            titleClassName="gh-hero-title"
          />
        </div>
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
            {list.slice(0, 4).map((ssUrl, i) => (
              <button
                key={i}
                className={`gh-hero-thumb ${i === idx ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              >
                <img src={ssUrl} alt="" loading="lazy" />
              </button>
            ))}
            {list.length > 4 && (
              <span className="gh-hero-more-count">+{list.length - 4}</span>
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

    </div>
  );
}

// ── DLC Manager ───────────────────────────────────────────────────────────────
function DLCManager({ appId, steamDlcs }) {
  const [dlcs, setDlcs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const rows = Array.isArray(steamDlcs)
      ? steamDlcs.map(d => ({
          id: String(d.id || d.appid || d),
          name: d.name || `DLC ${d.id || d}`,
          free: Boolean(d.free),
        }))
      : [];
    setDlcs(rows);
  }, [steamDlcs]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === dlcs.length ? new Set() : new Set(dlcs.map(d => d.id)));

  const handleApply = async () => {
    if (selected.size === 0) return;
    setApplying(true);
    setDone(false);
    setStatus('Unlocking selected DLC via Lua…');
    const ids = [...selected];
    let ok = 0;
    for (const id of ids) {
      try {
        if (window.Bridge?.download_dlc_oureveryday) {
          window.Bridge.download_dlc_oureveryday(String(id), String(appId));
        } else {
          await bridge.call('download_dlc_oureveryday', String(id), String(appId));
        }
        ok += 1;
        setStatus(`Queued ${ok}/${ids.length}`);
      } catch (e) {
        setStatus(String(e));
      }
    }
    setApplying(false);
    setDone(true);
    setStatus(ok ? `Queued ${ok} DLC download(s). Watch Logs for progress.` : 'Nothing queued.');
    setTimeout(() => setDone(false), 5000);
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
        {dlcs.length === 0 && (
          <p className="gh-dlc-name" style={{ opacity: 0.6, padding: '8px 0' }}>No DLC listed for this title.</p>
        )}
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
          ? <><RefreshCw size={13} className="spin" /> {status || 'Applying…'}</>
          : done
            ? <><CheckCircle size={13} /> {status || 'Queued'}</>
            : <><Package size={13} /> Unlock {selected.size} DLC</>
        }
      </button>
    </div>
  );
}

// ── Action Bar ────────────────────────────────────────────────────────────────
function ActionBar({ game, crackInfo, onOpenDownloadModal, onFixTools, downloading, setDownloading, dlProgress, setDlProgress }) {
  const libGame = useAppStore((s) =>
    (s.games || []).find((g) => String(g.app_id) === String(game?.app_id)) || null
  );
  const inLibrary = Boolean(libGame);
  const [launching, setLaunching] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(Boolean(game?.auto_update || libGame?.auto_update));
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [restartAfterUpdate, setRestartAfterUpdate] = useState(false);
  const isInstalled = Boolean(libGame?.installed) || !!game?.path;

  useEffect(() => {
    if (libGame?.auto_update !== undefined) {
      setAutoUpdate(Boolean(libGame.auto_update));
    } else if (game?.auto_update !== undefined) {
      setAutoUpdate(Boolean(game.auto_update));
    } else if (game?.app_id && window.Bridge?.get_game_auto_update) {
      try {
        const val = window.Bridge.get_game_auto_update(String(game.app_id));
        setAutoUpdate(Boolean(val));
      } catch (e) {}
    }
  }, [game?.app_id, game?.auto_update, libGame?.auto_update]);

  useEffect(() => {
    const handleTask = (jsonStr) => {
      try {
        const payload = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if ((payload.task === 'update_check' || payload.task === 'lure_fix') && String(payload.app_id) === String(game?.app_id)) {
          setCheckingUpdate(false);
          if (payload.success) {
            setUpdateMsg(payload.message || 'Manifest zaktualizowany pomyślnie!');
            setRestartAfterUpdate(Boolean(payload.restart_needed) || /zrestartuj steam/i.test(payload.message || ''));
            if (window.Bridge?.refresh_library) window.Bridge.refresh_library();
          } else {
            setUpdateMsg(payload.message || payload.error || 'Błąd aktualizacji manifestu');
            setRestartAfterUpdate(false);
          }
          setTimeout(() => setUpdateMsg(''), 20000);
        }
      } catch (e) {}
    };

    if (window.Bridge?.task_finished?.connect) {
      window.Bridge.task_finished.connect(handleTask);
    }
    return () => {
      try {
        if (window.Bridge?.task_finished?.disconnect) {
          window.Bridge.task_finished.disconnect(handleTask);
        }
      } catch (e) {}
    };
  }, [game?.app_id]);

  const handleToggleAutoUpdate = (e) => {
    e?.stopPropagation();
    const nextVal = !autoUpdate;
    setAutoUpdate(nextVal);
    if (window.Bridge?.set_game_auto_update) {
      window.Bridge.set_game_auto_update(String(game.app_id), nextVal);
    }
    useAppStore.getState().patchGame(game.app_id, { auto_update: nextVal });
  };

  const handleManualUpdate = (e) => {
    e?.stopPropagation();
    setCheckingUpdate(true);
    setUpdateMsg('Pobieranie nowego manifestu z Hubcap...');
    if (window.Bridge?.check_game_update) {
      window.Bridge.check_game_update(String(game.app_id));
    }
    setTimeout(() => setCheckingUpdate(false), 90000);
  };

  useEffect(() => {
    const setupDlHandler = () => {
      if (!window.Bridge?.download_progress?.connect) return null;
      const handler = (jsonStr) => {
        try {
          const payload = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
          if (payload.app_id === String(game?.app_id)) {
            setDlProgress(payload.progress || 0);
            if (payload.error || payload.progress >= 100 || payload.status?.toLowerCase().includes('error') || payload.status?.toLowerCase().includes('failed')) {
              setTimeout(() => setDownloading(false), 2000);
            } else {
              setDownloading(true);
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
  }, [game?.app_id, setDlProgress, setDownloading]);

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
      <button className="gh-btn-secondary" onClick={onFixTools}><Wrench size={14} /> Fix Tools</button>

      {inLibrary && (
      <div className="gh-autoupdate-card">
        <div className="gh-autoupdate-header" onClick={handleToggleAutoUpdate}>
          <div className="gh-autoupdate-info">
            <span className="gh-autoupdate-label">Auto-update Manifest</span>
            <span className={`gh-autoupdate-status ${autoUpdate ? 'is-on' : 'is-off'}`}>
              {autoUpdate ? 'ON' : 'OFF'}
            </span>
          </div>
          <button
            type="button"
            className={`gh-toggle-btn ${autoUpdate ? 'active' : ''}`}
            onClick={handleToggleAutoUpdate}
            title={autoUpdate ? 'Turn auto-update OFF' : 'Turn auto-update ON'}
          >
            <div className="gh-toggle-slider" />
          </button>
        </div>

        {game?.has_update && (
          <button
            className="gh-btn-update-now"
            onClick={handleManualUpdate}
            disabled={checkingUpdate}
          >
            <RefreshCw size={12} className={checkingUpdate ? 'spin' : ''} />
            {checkingUpdate ? 'Pobieranie manifestu...' : 'Dostępny nowy manifest — Pobierz'}
          </button>
        )}

        {updateMsg && (
          <div
            className="gh-update-feedback"
            style={{
              fontSize: '11px',
              marginTop: '6px',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: updateMsg.toLowerCase().includes('błąd') || updateMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Info size={12} /> {updateMsg}
          </div>
        )}
        {restartAfterUpdate && (
          <button
            type="button"
            className="gh-btn-update-now"
            onClick={() => window.Bridge?.restart_steam?.()}
            style={{ marginTop: 6 }}
          >
            Restart Steam now
          </button>
        )}
      </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function GameHub() {
  const { activeGame, setActiveGame, setActivePage, hubBackPage } = useAppStore();
  const { lookupGame } = useCrackDB();
  const [tab, setTab] = useState('overview');
  const [downgradePrefill, setDowngradePrefill] = useState('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showCrackModal, setShowCrackModal] = useState(false);
  const [showFixTools, setShowFixTools] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);
  const hubOrigin = hubBackPage || 'store';

  const appId = activeGame?.app_id;
  const { data: steamData, loading: steamLoading } = useSteamDetails(appId);
  const { info: catalogStatus, loading: crackLoading } = useCrackStatus(appId, activeGame?.name);
  const detailsPending = Boolean(appId) && steamLoading && !steamData;

  // If no game selected, go back
  useEffect(() => {
    if (!activeGame) setActivePage('store');
  }, [activeGame]);

  useEffect(() => {
    setTab('overview');
    setDowngradePrefill('');
  }, [appId]);

  useEffect(() => {
    const real = String(steamData?.name || '').trim();
    if (!real || !activeGame) return;
    if (!placeholderGameName(activeGame.name, appId)) return;
    if (activeGame.name === real) return;
    setActiveGame({ ...activeGame, name: real });
  }, [steamData?.name, appId, activeGame, setActiveGame]);

  if (!activeGame) return null;

  const displayName = String(steamData?.name || '').trim()
    || (placeholderGameName(activeGame.name, appId) ? '' : activeGame.name)
    || activeGame.name;

  const bundled = lookupGame(appId);
  const protection = pickProtection(
    catalogStatus?.protection,
    steamData?.protection,
    bundled?.drm || activeGame.drm,
    { denuvo_removed: catalogStatus?.denuvo_removed || steamData?.denuvo_removed || bundled?.denuvo_removed },
  );
  const crackInfo = {
    drm: protection || 'Unknown',
    protection,
    denuvo_removed: Boolean(catalogStatus?.denuvo_removed || steamData?.denuvo_removed || bundled?.denuvo_removed) || isRemovedDenuvoText(protection),
    cracked: catalogStatus?.cracked ?? bundled?.cracked ?? (String(steamData?.crack_status || '').toLowerCase().includes('crack')),
    status: catalogStatus?.status || steamData?.crack_status || '',
    status_key: catalogStatus?.status_key || '',
    url: catalogStatus?.url || steamData?.crack_url || `https://isitcracked.com/`,
    days: catalogStatus?.days || steamData?.crack_days || '',
    scene_group: catalogStatus?.scene_group || steamData?.scene_group || bundled?.crack_source,
    crack_source: catalogStatus?.scene_group || bundled?.crack_source,
    crack_date: catalogStatus?.crack_date || steamData?.crack_date || bundled?.crack_date,
    crack_buildid: catalogStatus?.crack_buildid || steamData?.crack_buildid || bundled?.required_build,
    required_build: catalogStatus?.fix?.buildid || catalogStatus?.crack_buildid || bundled?.required_build,
    latest_buildid: catalogStatus?.latest_buildid || steamData?.latest_buildid,
    match_latest: catalogStatus?.match_latest,
    match_installed: catalogStatus?.match_installed,
    can_install: catalogStatus?.can_install,
    can_install_this_build: catalogStatus?.can_install_this_build,
    installed: catalogStatus?.installed ?? Boolean(activeGame?.path),
    fix: catalogStatus?.fix,
    crack_url: catalogStatus?.fix?.href || bundled?.crack_url,
    source_crack: catalogStatus?.source_crack || bundled?.source_crack || [],
    original_download: catalogStatus?.original_download || bundled?.original_download || [],
    notes: bundled?.notes,
  };

  const screenshots = steamData?.screenshots ?? [];
  const movies      = (() => {
    const raw = Array.isArray(steamData?.movies) ? steamData.movies : [];
    if (raw.length) return raw;
    const extra = [];
    if (Array.isArray(steamData?.trailer_urls)) extra.push(...steamData.trailer_urls);
    if (steamData?.trailer) extra.push(steamData.trailer);
    if (!extra.length) return [];
    return [{ name: 'Trailer', url: extra[0], urls: extra, poster: steamData?.trailer_poster || '' }];
  })();
  const shortDesc   = steamData?.short_description || steamData?.short_desc || '';
  const detailedHtml = steamData?.about_html || steamData?.about_the_game || steamData?.detailed_description || steamData?.detailed_html || '';
  const genres      = Array.isArray(steamData?.genres)
    ? steamData.genres.map(g => (typeof g === 'string' ? g : g.description || g.name || ''))
    : (activeGame.tags || []);
  const developers  = steamData?.developers ?? [];
  const releaseDate = (typeof steamData?.release_date === 'object' ? steamData?.release_date?.date : steamData?.release_date) || steamData?.crack_release_date || '';
  const metacritic  = steamData?.metacritic;
  const dlcCount    = steamData?.dlc?.length ?? 0;

  // Scene / crack information merged from backend & crackrelease
  const sceneGroup = steamData?.scene_group || crackInfo?.crack_source;
  const crackDate = steamData?.crack_date || crackInfo?.crack_date;
  const crackDays = steamData?.crack_days || crackInfo?.crack_days;

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'crack',     label: 'Crack' },
    { id: 'downgrade', label: 'Downgrade' },
    { id: 'dlc',       label: 'DLC Manager' },
  ];

  return (
    <div className="game-hub">
      {detailsPending && (
        <div className="gh-details-loading">
          <div className="gh-details-loading-spin" />
          <div className="gh-details-loading-title">{displayName}</div>
          <div className="gh-details-loading-sub">
            {crackLoading ? 'Checking crack status…' : 'Fetching Steam details…'}
          </div>
        </div>
      )}

      {/* ── Crack version info modal (step 1 of 2 for non-Steam DRM) ── */}
      {showCrackModal && (
        <CrackVersionModal
          appId={appId}
          gameName={displayName}
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
          gameName={displayName}
          onClose={() => setShowDownloadModal(false)}
          onStartDownload={() => {
            setDownloading(true);
            setDlProgress(5);
          }}
        />
      )}

      {/* ── Hero Slideshow Banner ─────────────────────────────────────── */}
      <HeroSlideshow
        appId={appId}
        activeGame={activeGame}
        displayName={displayName}
        crackInfo={{ ...crackInfo, crack_source: sceneGroup || crackInfo.crack_source, crack_days: crackDays }}
        screenshots={screenshots}
        movies={movies}
        onBack={() => setActivePage(hubOrigin === 'library' ? 'library' : 'store')}
      />

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="gh-body">
        {/* Sidebar cover */}
        <div className="gh-sidebar">
          <SteamImage
            className="gh-cover"
            appId={appId}
            src={activeGame.cover_url || activeGame.image_url}
            alt={displayName}
            kind="cover"
            onContextMenu={(e) => useAppStore.getState().openGameCtx(e, {
              ...activeGame,
              app_id: appId,
              name: displayName,
            })}
          />

          <ActionBar
            game={activeGame}
            crackInfo={crackInfo}
            downloading={downloading}
            setDownloading={setDownloading}
            dlProgress={dlProgress}
            setDlProgress={setDlProgress}
            onFixTools={() => setShowFixTools(true)}
            onOpenDownloadModal={() => {
              const prot = String(crackInfo.protection || crackInfo.drm || '');
              const skipCrackModal = Boolean(crackInfo.denuvo_removed)
                || isRemovedDenuvoText(prot)
                || !prot
                || (/steam|^none$/i.test(prot) && !/denuvo/i.test(prot));
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
                    <SteamLogo
                      appId={appId}
                      name={displayName}
                      className="gh-overview-logo-img"
                      titleClassName="gh-game-title"
                    />
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

                  <UnlockRecipe
                    appId={appId}
                    gameName={displayName}
                    crackInfo={crackInfo}
                    currentBuild={activeGame.buildid || steamData?.installed_buildid}
                    onDowngrade={(build) => {
                      setDowngradePrefill(String(build || ''));
                      setTab('downgrade');
                    }}
                    onOpenCrackTab={() => setTab('crack')}
                  />

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
                    currentBuild={activeGame.buildid || steamData?.installed_buildid || catalogStatus?.installed_buildid}
                    onDowngrade={(build) => {
                      setDowngradePrefill(String(build || ''));
                      setTab('downgrade');
                    }}
                  />
                </div>
              )}

              {tab === 'downgrade' && (
                <GameDowngradeTab
                  appId={appId}
                  gameName={steamData?.name || activeGame.name}
                  currentBuild={activeGame.buildid || steamData?.installed_buildid}
                  latestBuild={crackInfo.latest_buildid || steamData?.latest_buildid}
                  crackBuild={crackInfo.required_build || crackInfo.crack_buildid}
                  prefillBuild={downgradePrefill}
                />
              )}

              {tab === 'dlc' && (
                <div className="gh-dlc-tab">
                  <div className="gh-dlc-intro">
                    <Package size={14} />
                    <span>Select DLC to register in the game Lua and download depots.</span>
                  </div>
                  <DLCManager appId={appId} steamDlcs={steamData?.dlc} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {showFixTools && (
        <div className="dsm-overlay" onClick={() => setShowFixTools(false)}>
          <div className="dsm-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="dsm-header">
              <div className="dsm-title"><Wrench size={15} /> Fix Tools</div>
              <button className="dsm-close" onClick={() => setShowFixTools(false)}><X size={15} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t-muted)', marginBottom: 12 }}>
              Runs the existing backend pipeline on this installed game.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="gh-btn-download" onClick={() => { bridge.call('run_game_action', String(appId), 'steam_auto'); setShowFixTools(false); }}>
                SteamAutoCrack / Goldberg
              </button>
              <button className="gh-btn-secondary" onClick={() => { bridge.call('run_game_action', String(appId), 'steamstub'); setShowFixTools(false); }}>
                Unpack SteamStub
              </button>
              {crackInfo.can_install && (
                <button className="gh-btn-secondary" onClick={() => { bridge.call('apply_game_crack', String(appId), displayName || ''); setShowFixTools(false); }}>
                  Download catalog crack
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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