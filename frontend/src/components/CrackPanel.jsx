import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert, ShieldCheck, ShieldX, Download,
  RefreshCw, ArrowDownToLine, CheckCircle, AlertTriangle, ExternalLink, MessagesSquare,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { DRM_ENTRIES, drmCardsFor, isDenuvoRemoved, isSteamOnlyProtection } from '../data/drmEncyclopedia';
import './CrackPanel.css';

const DRM_COLORS = {
  'Denuvo': 'red',
  'Denuvo removed by developer': 'green',
  'Steam DRM': 'yellow',
  'EAC': 'orange',
  'BattleEye': 'orange',
  'None': 'green',
  'Digital.ai (Arxan) + Rockstar Games Launcher': 'orange',
  'Digital.ai (Arxan)': 'orange',
  'Arxan': 'orange',
};

function mainCsRinThread(crackInfo) {
  const urls = [...(crackInfo?.source_crack || [])].filter(Boolean);
  const rin = urls.find((url) => /cs\.rin\.ru/i.test(url));
  if (!rin) return urls[0] || '';
  try {
    const parsed = new URL(rin);
    const topic = parsed.searchParams.get('t');
    if (topic) return `https://cs.rin.ru/forum/viewtopic.php?t=${topic}`;
  } catch { /* fall through */ }
  return rin.split('#')[0];
}

function statusLabel({ isDrmFree, isSteamDrm, isCracked, denuvoRemoved }) {
  if (denuvoRemoved) return { text: 'Removed by developer', kind: 'removed' };
  if (isDrmFree) return { text: 'DRM-Free', kind: 'drmfree' };
  if (isSteamDrm) return { text: 'Steam DRM', kind: 'steamdrm' };
  if (isCracked) return { text: 'Cracked', kind: 'cracked' };
  return { text: 'Not cracked', kind: 'uncracked' };
}

export default function CrackPanel({ crackInfo, game, currentBuild, onDowngrade }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [savedPath, setSavedPath] = useState('');

  const appId = String(game?.app_id || '');

  useEffect(() => {
    const unsubProg = bridge.on('download_progress', (raw) => {
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (String(payload.app_id) !== appId) return;
        if (payload.progress != null) setProgress(payload.progress);
        if (payload.status) setStatus(payload.status);
      } catch { /* ignore */ }
    });
    const unsubTask = bridge.on('task_finished', (raw) => {
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (payload.task !== 'crack_apply') return;
        if (String(payload.app_id) !== appId) return;
        setDownloading(false);
        if (payload.success) {
          setDone(true);
          setError('');
          setProgress(100);
          setSavedPath(payload.saved_path || payload.message || '');
        } else {
          setError(payload.message || 'Crack download failed.');
        }
      } catch { /* ignore */ }
    });
    return () => {
      unsubProg?.();
      unsubTask?.();
    };
  }, [appId]);

  if (!crackInfo) return null;

  const protection = crackInfo.protection || crackInfo.drm || 'Unknown';
  const denuvoRemoved = isDenuvoRemoved(protection, crackInfo);
  const drmColor = DRM_COLORS[protection]
    || (denuvoRemoved ? 'green'
      : String(protection).toLowerCase().includes('denuvo') ? 'red'
      : /arxan|digital\.ai|rockstar/i.test(protection) ? 'orange' : 'muted');
  const requiredBuild = crackInfo.required_build || crackInfo.crack_buildid || '';
  const latestBuild = crackInfo.latest_buildid || '';
  const needsDowngrade = requiredBuild && currentBuild && String(currentBuild) !== String(requiredBuild);
  const crackBehindLatest = requiredBuild && latestBuild && String(requiredBuild) !== String(latestBuild);
  const catalogHref = Boolean(crackInfo.can_install || crackInfo.fix?.href);
  const hrefForInstalled = crackInfo.can_install_this_build ?? catalogHref;
  const canInstall = catalogHref;
  const isDrmFree = /none|drm-free|drm free/i.test(protection) || crackInfo.status_key === 'drm-free';
  const isSteamDrm = denuvoRemoved || isSteamOnlyProtection(protection) || (/steam/i.test(protection) && !/denuvo|eac|battleye|ubisoft|epic/i.test(protection));
  const isCracked = Boolean(crackInfo.cracked) || String(crackInfo.status_key || '').includes('cracked');
  const drmCards = denuvoRemoved
    ? [DRM_ENTRIES.denuvo_removed, ...drmCardsFor(protection).filter((card) => card.id !== 'denuvo' && card.id !== 'denuvo_removed')]
    : isDrmFree ? [DRM_ENTRIES.drmfree] : drmCardsFor(protection);
  const primaryCard = drmCards.find((card) => card.id !== 'steam') || drmCards[0];
  const extraCards = drmCards.filter((card) => card !== primaryCard);
  const threadUrl = mainCsRinThread(crackInfo);
  const badge = statusLabel({ isDrmFree, isSteamDrm, isCracked, denuvoRemoved });
  const scene = crackInfo.scene_group || crackInfo.crack_source;

  const showDownload = !done && !isSteamDrm && !denuvoRemoved && (
    currentBuild ? Boolean(hrefForInstalled) || (catalogHref && needsDowngrade) : catalogHref
  );

  const handleInstall = () => {
    if (!showDownload) return;
    setDownloading(true);
    setDone(false);
    setError('');
    setProgress(8);
    setSavedPath('');
    setStatus('Looking up crack…');
    bridge.call('apply_game_crack', appId, game?.name || '');
  };

  return (
    <motion.div
      className={`crack-panel drm-${drmColor}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="crack-top">
        <div className="crack-drm-tag">
          {isDrmFree || isCracked || isSteamDrm || denuvoRemoved ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
          <span>{denuvoRemoved ? 'Denuvo removed by developer' : isDrmFree ? 'DRM-Free' : protection}</span>
        </div>
        <div className="crack-top-chips">
          {scene && <span className="crack-chip">{scene}</span>}
          {crackInfo.crack_date && <span className="crack-chip">{crackInfo.crack_date}</span>}
          {crackInfo.days && <span className="crack-chip">{crackInfo.days}</span>}
          <span className={`crack-status-badge ${badge.kind}`}>{badge.text}</span>
        </div>
      </div>

      {primaryCard && (
        <section className={`crack-hero drm-card-${primaryCard.id}`}>
          <div className="crack-hero-copy">
            <span className="drm-card-kicker">{primaryCard.category}</span>
            <h3 className="drm-card-title">{primaryCard.name}</h3>
            <p className="drm-card-blurb">{primaryCard.blurb}</p>
            {extraCards.length > 0 && (
              <div className="crack-extra-drm">
                {extraCards.map((card) => (
                  <span key={card.id} className="crack-chip">+ {card.name}</span>
                ))}
              </div>
            )}
          </div>
          {primaryCard.logo && (
            <div className="crack-hero-logo" aria-hidden="true">
              <img src={primaryCard.logo} alt="" className="drm-card-logo" />
            </div>
          )}
        </section>
      )}

      <div className="crack-actions">
        {threadUrl && (
          <button
            type="button"
            className="crack-link-btn"
            onClick={() => bridge.call('open_url', threadUrl)}
          >
            <MessagesSquare size={14} />
            cs.rin.ru thread
            <ExternalLink size={12} />
          </button>
        )}

        {showDownload && (
          <button
            type="button"
            className="crack-download-btn"
            onClick={handleInstall}
            disabled={downloading}
          >
            {downloading
              ? <><RefreshCw size={14} className="spin" /> {status || 'Downloading…'}</>
              : <><Download size={14} /> Download crack{requiredBuild ? ` · ${requiredBuild}` : ''}</>}
          </button>
        )}
        {done && (
          <div className="crack-success">
            <CheckCircle size={15} />
            <span>Saved in the Kraken <code>cracks</code> folder. Unpack it and copy the files into the game yourself.</span>
            {savedPath && (
              <button
                type="button"
                className="crack-open-folder"
                onClick={() => bridge.call('open_local_path', savedPath)}
              >
                Open folder
              </button>
            )}
          </div>
        )}
      </div>

      {canInstall && !done && (
        <div className="crack-note">
          <AlertTriangle size={12} />
          Download only — Kraken will not inject the crack into the game folder.
        </div>
      )}
      {downloading && (
        <div className="crack-progress">
          <div className="crack-progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}
      {error && <div className="crack-note"><AlertTriangle size={12} /> {error}</div>}

      {(latestBuild || requiredBuild || currentBuild) && (
        <div className="crack-versions">
          <div className="crack-version-cell">
            <span>Steam latest</span>
            <code>{latestBuild || '—'}</code>
          </div>
          <div className="crack-version-cell">
            <span>Crack for</span>
            <code>{requiredBuild || '—'}</code>
          </div>
          <div className="crack-version-cell">
            <span>Installed</span>
            <code>{currentBuild || '—'}</code>
          </div>
        </div>
      )}

      {requiredBuild && (
        <div className={`crack-build-status ${needsDowngrade || crackBehindLatest ? 'needs-downgrade' : 'ok'}`}>
          {needsDowngrade ? (
            <>
              <AlertTriangle size={13} />
              <span>Crack is for Steam build <code>{requiredBuild}</code> (installed: <code>{currentBuild || '?'}</code>)</span>
              <button type="button" className="crack-downgrade-btn" onClick={() => onDowngrade?.(requiredBuild)}>
                <ArrowDownToLine size={12} /> Download that build
              </button>
            </>
          ) : crackBehindLatest ? (
            <>
              <AlertTriangle size={13} />
              <span>Crack targets <code>{requiredBuild}</code>, Steam latest is <code>{latestBuild}</code></span>
              <button type="button" className="crack-downgrade-btn" onClick={() => onDowngrade?.(requiredBuild)}>
                <ArrowDownToLine size={12} /> Get crack build
              </button>
            </>
          ) : (
            <>
              <CheckCircle size={13} />
              <span>Targets build <code>{requiredBuild}</code>{currentBuild ? ' — matches installed' : latestBuild ? ' — matches Steam latest' : ''}</span>
            </>
          )}
        </div>
      )}

      {!canInstall && !done && isCracked && !isSteamDrm && !isDrmFree && !denuvoRemoved && (
        <p className="crack-muted">Cracked, but the catalog has no installable file yet. Use the cs.rin.ru thread if it is listed.</p>
      )}
      {!canInstall && !isCracked && !isDrmFree && !isSteamDrm && !denuvoRemoved && (
        <div className="crack-uncracked-msg">
          <ShieldX size={22} />
          <p>
            Protected by <strong>{protection}</strong>. No extra file is listed — this will not launch.
            {/denuvo/i.test(protection) ? ' Do not download hypervisor packs; Kraken will not install them.' : ''}
          </p>
        </div>
      )}
      {denuvoRemoved && (
        <p className="crack-muted">
          The publisher removed Denuvo in a later official update. Stay on the current Steam build —
          LumaCore / a native Steam install is enough. No extra crack file needed.
        </p>
      )}
      {isSteamDrm && !denuvoRemoved && (
        <p className="crack-muted">Standard Steam DRM — LumaCore / a native Steam install is enough. No extra crack file needed.</p>
      )}
    </motion.div>
  );
}
