/**
 * language: JSX, file: CrackVersionModal.jsx, runtime: Vite/Browser
 * Shows crack information and available version before manifest download begins.
 * Appears when a game has non-standard DRM (Denuvo etc.) so the user sees
 * what crack version / source is needed and can grab it from cs.rin.ru.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldAlert, ShieldCheck, Download,
  ExternalLink, Zap, Calendar, User, Tag, AlertTriangle,
  ArrowRight, HardDrive, CheckCircle, Package
} from 'lucide-react';
import './CrackVersionModal.css';

const DRM_COLOR = {
  'Denuvo':    '#f87171',
  'Steam DRM': '#38bdf8',
  'EAC':       '#fb923c',
  'Rockstar':  '#fb923c',
  'None':      '#4ade80',
};

function DrmBadge({ drm }) {
  const color = DRM_COLOR[drm] || '#a78bfa';
  return (
    <span
      className="cvm-drm-badge"
      style={{ color, borderColor: color + '55', background: color + '18' }}
    >
      <ShieldAlert size={11} />
      {drm}
    </span>
  );
}

function MetaRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="cvm-meta-row">
      <span className="cvm-meta-icon">{icon}</span>
      <span className="cvm-meta-label">{label}</span>
      <span className="cvm-meta-value">{value}</span>
    </div>
  );
}

/**
 * @param {object}   props
 * @param {string}   props.gameName
 * @param {string}   props.appId
 * @param {object}   props.crackInfo  — entry from crack_db.json (via lookupGame)
 * @param {function} props.onClose    — close without proceeding
 * @param {function} props.onProceed  — open DownloadSourceModal next
 */
export default function CrackVersionModal({ gameName, appId, crackInfo, onClose, onProceed }) {
  if (!crackInfo) return null;

  const drm          = crackInfo.drm || 'Unknown';
  const isCracked    = !!crackInfo.crack_version || !!crackInfo.crack_source;
  const isSteamOnly  = crackInfo.is_standard_steam;
  const hasCrackUrl  = !!crackInfo.crack_url;
  const hasMirrorUrl = !!crackInfo.mirror_url;

  const headerImg = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
  const csRinUrl = `https://cs.rin.ru/forum/search.php?keywords=${encodeURIComponent(gameName)}&terms=all&fid%5B%5D=10&sf=titleonly&sr=topics&sk=t&sd=d`;

  return (
    <AnimatePresence>
      <motion.div
        className="cvm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="cvm-panel"
          initial={{ opacity: 0, scale: 0.94, y: 22 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button className="cvm-close" onClick={onClose}><X size={15} /></button>

          {/* Header banner with game art */}
          <div className="cvm-header">
            <img
              className="cvm-header-art"
              src={headerImg}
              alt={gameName}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="cvm-header-overlay" />
            <div className="cvm-header-content">
              <div className="cvm-header-eyebrow">
                {isCracked ? (
                  <><Zap size={13} className="cvm-zap" /> Crack dostępny</>
                ) : isSteamOnly ? (
                  <><ShieldCheck size={13} /> Standardowe DRM</>
                ) : (
                  <><ShieldAlert size={13} /> Informacje o DRM</>
                )}
              </div>
              <h2 className="cvm-game-name">{gameName}</h2>
              <div className="cvm-badges-row">
                <DrmBadge drm={drm} />
                {crackInfo.drm_version && (
                  <span className="cvm-drm-ver">{crackInfo.drm_version}</span>
                )}
                {isCracked && !isSteamOnly && (
                  <span className="cvm-cracked-badge">⚡ Cracked</span>
                )}
                {isSteamOnly && (
                  <span className="cvm-steam-badge">
                    <ShieldCheck size={10} /> Supported
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="cvm-body">
            {isSteamOnly ? (
              <div className="cvm-state-box steam">
                <CheckCircle size={22} className="cvm-state-icon steam" />
                <div className="cvm-state-text">
                  <div className="cvm-state-title">Standardowe Steam DRM</div>
                  <p className="cvm-state-desc">
                    Brak Denuvo ani innych inwazyjnych zabezpieczeń. Działa bezproblemowo
                    z wbudowanym emulatorem Steam (Goldberg / SmokeAPI). Manifest można
                    pobrać i zainstalować bezpośrednio.
                  </p>
                </div>
              </div>
            ) : isCracked ? (
              <>
                <div className="cvm-meta-grid">
                  <MetaRow icon={<Tag size={12}/>}       label="Wersja cracka"  value={crackInfo.crack_version} />
                  <MetaRow icon={<User size={12}/>}      label="Źródło / Scena" value={crackInfo.crack_source} />
                  <MetaRow icon={<Calendar size={12}/>}  label="Data cracka"    value={crackInfo.crack_date} />
                  <MetaRow icon={<HardDrive size={12}/>} label="Rozmiar"        value={crackInfo.file_size} />
                  {crackInfo.required_build && (
                    <MetaRow
                      icon={<Package size={12}/>}
                      label="Wymagany build"
                      value={crackInfo.required_build}
                    />
                  )}
                </div>

                {crackInfo.target_files?.length > 0 && (
                  <div className="cvm-files-section">
                    <span className="cvm-files-label">Pliki cracka:</span>
                    <div className="cvm-files-chips">
                      {crackInfo.target_files.map(f => (
                        <code key={f} className="cvm-file-chip">{f}</code>
                      ))}
                    </div>
                  </div>
                )}

                {crackInfo.notes && (
                  <div className="cvm-notes">
                    <AlertTriangle size={12} />
                    <span>{crackInfo.notes}</span>
                  </div>
                )}

                <div className="cvm-links-section">
                  <span className="cvm-links-label">Pobierz crack:</span>
                  <div className="cvm-links-row">
                    {hasCrackUrl && (
                      <a href={crackInfo.crack_url} target="_blank" rel="noreferrer" className="cvm-ext-link">
                        <Download size={12} /> Plik .zip <ExternalLink size={10} />
                      </a>
                    )}
                    {hasMirrorUrl && (
                      <a href={crackInfo.mirror_url} target="_blank" rel="noreferrer" className="cvm-ext-link mirror">
                        <ExternalLink size={12} /> Mirror
                      </a>
                    )}
                    <a href={csRinUrl} target="_blank" rel="noreferrer" className="cvm-ext-link cs-rin">
                      <ExternalLink size={12} /> cs.rin.ru
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="cvm-state-box locked">
                <ShieldAlert size={22} className="cvm-state-icon locked" />
                <div className="cvm-state-text">
                  <div className="cvm-state-title">Brak cracka w bazie</div>
                  <p className="cvm-state-desc">
                    Gra jest zabezpieczona przez <strong>{drm}</strong>
                    {crackInfo.drm_version && ` (${crackInfo.drm_version})`}. Nie znaleziono
                    działającego cracka w lokalnej bazie. Manifest możesz pobrać i sprawdzić
                    dostępność cracka na cs.rin.ru lub CrackWatch.
                  </p>
                  <a href={csRinUrl} target="_blank" rel="noreferrer" className="cvm-ext-link cs-rin"
                    style={{ marginTop: 8, display: 'inline-flex' }}>
                    <ExternalLink size={12} /> Sprawdź cs.rin.ru
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="cvm-footer">
            <button className="cvm-btn-cancel" onClick={onClose}>Anuluj</button>
            <button className="cvm-btn-proceed" onClick={onProceed}>
              <Download size={14} />
              Pobierz manifest
              <ArrowRight size={13} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
