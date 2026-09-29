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
          {crackInfo.cracked
            ? <ShieldCheck size={15} />
            : <ShieldAlert size={15} />
          }
          <span>{crackInfo.drm}</span>
          {crackInfo.drm_version && (
            <span className="crack-drm-version">{crackInfo.drm_version}</span>
          )}
        </div>
        {crackInfo.cracked
          ? <span className="crack-status-badge cracked">⚡ Cracked</span>
          : <span className="crack-status-badge uncracked">🔒 Not Cracked</span>
        }
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
            {crackInfo.cracked ? (
              <>
                {/* Crack Metadata */}
                <div className="crack-meta">
                  <MetaItem label="Crack Version" value={crackInfo.crack_version} />
                  <MetaItem label="Source" value={crackInfo.crack_source} />
                  <MetaItem label="Released" value={crackInfo.crack_date} />
                </div>

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
                        <span>Your build <code>{currentBuild}</code> needs downgrade to <code>{crackInfo.required_build}</code></span>
                        <button className="crack-downgrade-btn">
                          <ArrowDownToLine size={12} /> Downgrade Now
                        </button>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={13} />
                        <span>Build <code>{crackInfo.required_build}</code> — Compatible ✓</span>
                      </>
                    )}
                  </div>
                )}

                {/* Download Button */}
                {!done ? (
                  <div className="crack-download-area">
                    <button
                      className="crack-download-btn"
                      onClick={handleDownload}
                      disabled={downloading}
                    >
                      {downloading
                        ? <><RefreshCw size={14} className="spin" /> Downloading…</>
                        : <><Download size={14} /> Download Crack v{crackInfo.crack_version}</>
                      }
                    </button>

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
                    Crack installed successfully — launch game offline
                  </div>
                )}
              </>
            ) : (
              <div className="crack-uncracked-msg">
                <ShieldX size={28} />
                <p>This game uses <strong>{crackInfo.drm}</strong> and has not been cracked yet.</p>
                <p className="crack-muted">We'll notify you when a crack becomes available.</p>
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
