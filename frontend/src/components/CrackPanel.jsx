import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, ShieldCheck, ShieldX, Download,
  ChevronDown, ChevronUp, RefreshCw, ArrowDownToLine,
  CheckCircle, AlertTriangle, Clock, ExternalLink
} from 'lucide-react';
import './CrackPanel.css';

const DRM_COLORS = {
  'Denuvo': 'red',
  'Steam DRM': 'yellow',
  'EAC': 'orange',
  'BattleEye': 'orange',
  'None': 'green',
};

export default function CrackPanel({ crackInfo, game, currentBuild }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState(true);

  if (!crackInfo) return null;

  const drmColor = DRM_COLORS[crackInfo.drm] || 'muted';
  const needsDowngrade = crackInfo.required_build && currentBuild &&
    String(currentBuild) !== String(crackInfo.required_build);

  const handleDownload = async () => {
    if (!crackInfo.crack_url) return;
    setDownloading(true);
    // Simulate download progress (will be replaced with real bridge call)
    for (let i = 1; i <= 100; i++) {
      await new Promise(r => setTimeout(r, 30));
      setProgress(i);
    }
    setDownloading(false);
    setDone(true);
  };

  const isDrmFree = crackInfo.drm === 'None';
  const isSteamDrm = crackInfo.drm === 'Steam DRM';

  return (
    <motion.div
      className={`crack-panel drm-${drmColor}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <button className="crack-panel-header" onClick={() => setExpanded(!expanded)}>
        <div className="crack-drm-tag">
          {isDrmFree || crackInfo.cracked ? (
            <ShieldCheck size={16} />
          ) : (
            <ShieldAlert size={16} />
          )}
          <span>{isDrmFree ? 'DRM-Free' : crackInfo.drm}</span>
          {crackInfo.drm_version && (
            <span className="crack-drm-version">{crackInfo.drm_version}</span>
          )}
        </div>

        {isDrmFree ? (
          <span className="crack-status-badge drmfree">✓ DRM-Free</span>
        ) : isSteamDrm ? (
          <span className="crack-status-badge steamdrm">✓ Steam DRM Supported</span>
        ) : crackInfo.cracked ? (
          <span className="crack-status-badge cracked">⚡ Cracked</span>
        ) : (
          <span className="crack-status-badge uncracked">🔒 Denuvo Locked</span>
        )}

        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="crack-panel-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isDrmFree ? (
              /* ── 100% DRM-Free Game (e.g. Cyberpunk 2077, Baldur's Gate 3) ── */
              <div className="crack-info-state-box free">
                <CheckCircle size={22} className="crack-state-icon free" />
                <div className="crack-state-text">
                  <div className="crack-state-title">Gra całkowicie DRM-Free (Brak zabezpieczeń)</div>
                  <p className="crack-state-desc">
                    Ten tytuł nie posiada zabezpieczeń antypirackich takich jak Denuvo ani blokad Steam DRM.
                    Nie wymaga cracka ani emulatora — pliki gry działają bezpośrednio po instalacji.
                  </p>
                  {crackInfo.notes && (
                    <div className="crack-note-inline">{crackInfo.notes}</div>
                  )}
                </div>
              </div>
            ) : isSteamDrm ? (
              /* ── Standard Steam DRM (not on isitcracked.com) ── */
              <div className="crack-info-state-box steam">
                <CheckCircle size={22} className="crack-state-icon steam" />
                <div className="crack-state-text">
                  <div className="crack-state-title">Standardowe zabezpieczenie Steam DRM</div>
                  <p className="crack-state-desc">
                    Tytuł nie posiada inwazyjnego zabezpieczenia Denuvo. Uruchamia się bezproblemowo
                    z wykorzystaniem wbudowanego emulatora Steam (Goldberg Emulator / SmokeAPI).
                  </p>
                  {crackInfo.notes && (
                    <div className="crack-note-inline">{crackInfo.notes}</div>
                  )}
                </div>
              </div>
            ) : crackInfo.cracked ? (
              /* ── Third-party DRM Cracked (e.g. Resident Evil 4 by EMPRESS) ── */
              <>
                {/* Crack Metadata */}
                <div className="crack-meta">
                  <MetaItem label="Wersja cracka" value={crackInfo.crack_version} />
                  <MetaItem label="Grupa / Źródło" value={crackInfo.crack_source} />
                  <MetaItem label="Data wydania" value={crackInfo.crack_date} />
                  <MetaItem label="Rozmiar archiwum" value={crackInfo.file_size} />
                </div>

                {/* Target files if specified */}
                {crackInfo.target_files && crackInfo.target_files.length > 0 && (
                  <div className="crack-target-files">
                    <span className="crack-target-label">Zawartość archiwum cracka:</span>
                    <div className="crack-files-chips">
                      {crackInfo.target_files.map(f => (
                        <code key={f} className="crack-file-chip">{f}</code>
                      ))}
                    </div>
                  </div>
                )}

                {crackInfo.notes && (
                  <div className="crack-note">
                    <AlertTriangle size={12} />
                    {crackInfo.notes}
                  </div>
                )}

                {/* Build Status */}
                {crackInfo.required_build && (
                  <div className={`crack-build-status ${needsDowngrade ? 'needs-downgrade' : 'ok'}`}>
                    {needsDowngrade ? (
                      <>
                        <AlertTriangle size={13} />
                        <span>Wymagany build Steam <code>{crackInfo.required_build}</code> (twój: <code>{currentBuild || 'nieznany'}</code>)</span>
                        <button className="crack-downgrade-btn">
                          <ArrowDownToLine size={12} /> Cofnij wersję gry
                        </button>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={13} />
                        <span>Build gry <code>{crackInfo.required_build}</code> — W pełni zgodny ✓</span>
                      </>
                    )}
                  </div>
                )}

                {/* Download Crack Action Area */}
                {crackInfo.crack_url && (
                  !done ? (
                    <div className="crack-download-area">
                      <div className="crack-actions-row">
                        <button
                          className="crack-download-btn"
                          onClick={handleDownload}
                          disabled={downloading}
                        >
                          {downloading
                            ? <><RefreshCw size={14} className="spin" /> Pobieranie cracka…</>
                            : <><Download size={14} /> Pobierz i zainstaluj crack {crackInfo.file_size ? `(${crackInfo.file_size})` : ''}</>
                          }
                        </button>

                        <a
                          href={crackInfo.crack_url}
                          target="_blank"
                          rel="noreferrer"
                          className="crack-link-btn"
                          title="Bezpośredni link do pliku"
                        >
                          <ExternalLink size={13} /> Plik .zip
                        </a>

                        {crackInfo.mirror_url && (
                          <a
                            href={crackInfo.mirror_url}
                            target="_blank"
                            rel="noreferrer"
                            className="crack-link-btn mirror"
                            title="Mirror pobierania"
                          >
                            <ExternalLink size={13} /> Mirror
                          </a>
                        )}
                      </div>

                      {downloading && (
                        <div className="crack-progress">
                          <div className="crack-progress-bar" style={{ width: `${progress}%` }} />
                          <span>{progress}%</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="crack-success">
                      <CheckCircle size={15} />
                      Pliki cracka zostały pomyślnie zainstalowane do folderu gry!
                    </div>
                  )
                )}
              </>
            ) : (
              /* ── Third-party DRM Locked (e.g. uncracked Denuvo game) ── */
              <div className="crack-uncracked-msg">
                <ShieldX size={28} />
                <p>Gra zabezpieczona przez <strong>{crackInfo.drm}</strong> {crackInfo.drm_version && `(${crackInfo.drm_version})`}.</p>
                <p className="crack-muted">Obecnie brak działającego cracka w bazie isitcracked.com.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MetaItem({ label, value }) {
  if (!value) return null;
  return (
    <div className="crack-meta-item">
      <span className="crack-meta-label">{label}</span>
      <span className="crack-meta-value">{value}</span>
    </div>
  );
}
