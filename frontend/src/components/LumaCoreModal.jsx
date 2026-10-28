import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Shield,
  ShieldAlert,
  Folder,
  Trash2,
  X,
  Lock,
  ExternalLink
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import './LumaCoreModal.css';

export default function LumaCoreModal({ isOpen, onClose, onInstalled }) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [versionInfo, setVersionInfo] = useState({
    installed: '',
    latest: '',
    update_available: false,
  });
  const [steamPath, setSteamPath] = useState('');
  const [variant, setVariant] = useState('release');
  const [blockUpdates, setBlockUpdates] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [resultState, setResultState] = useState(null); // { success: bool, message: string }

  // Query LumaCore status and steam path on open
  const checkStatus = async (force = false) => {
    setLoadingStatus(true);
    setResultState(null);
    try {
      // 1. Get steam path
      const sp = await bridge.call('get_setting', 'steam_path');
      if (sp) setSteamPath(sp);

      // 2. Check steam updates state
      const updateState = await bridge.call('steam_updates_get_state');
      setBlockUpdates(updateState === 'blocked');

      // 3. Check LumaCore version
      const res = await bridge.call('lumacore_check_update', force ? 'force' : '');
      if (res) {
        const data = typeof res === 'string' ? JSON.parse(res) : res;
        setVersionInfo({
          installed: data.installed || '',
          latest: data.latest || '',
          update_available: !!data.update_available,
        });
      }
    } catch (err) {
      console.error('[LumaCoreModal] Check error:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus(false);
    }
  }, [isOpen]);

  // Listen to live progress from Python bridge
  useEffect(() => {
    const unsubProgress = bridge.on('lc_progress', (msg) => {
      if (!msg) return;
      setProgressMsg(msg);

      // Heuristic parsing for progress bar percentage
      const match = msg.match(/(\d+)%/);
      if (match) {
        setProgressPct(parseInt(match[1], 10));
      } else if (msg.toLowerCase().includes('closing steam')) {
        setProgressPct(15);
      } else if (msg.toLowerCase().includes('downloading')) {
        setProgressPct(40);
      } else if (msg.toLowerCase().includes('extracting')) {
        setProgressPct(75);
      } else if (msg.toLowerCase().includes('pattern') || msg.toLowerCase().includes('checking')) {
        setProgressPct(90);
      } else if (msg.toLowerCase().includes('installed')) {
        setProgressPct(100);
      }
    });

    const unsubFinished = bridge.on('task_finished', (raw) => {
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (payload.task === 'auto_lc_setup') {
          setInstalling(false);
          setResultState({
            success: !!payload.success,
            message: payload.message || (payload.success ? 'LumaCore installed successfully.' : 'Installation failed.'),
          });
          if (payload.success) {
            setProgressPct(100);
            checkStatus(true);
            if (onInstalled) onInstalled();
          }
        } else if (payload.task === 'auto_lc_deactivate') {
          setInstalling(false);
          setResultState({
            success: !!payload.success,
            message: payload.message || 'LumaCore removed.',
          });
          checkStatus(true);
        }
      } catch (e) {
        console.error('[LumaCoreModal] task_finished error:', e);
      }
    });

    return () => {
      unsubProgress();
      unsubFinished();
    };
  }, [onInstalled]);

  const handleInstall = async () => {
    setInstalling(true);
    setProgressPct(5);
    setProgressMsg('Initiating LumaCore installation...');
    setResultState(null);

    try {
      // If user selected block updates, configure steam.cfg
      if (blockUpdates) {
        await bridge.call('steam_updates_set_state', 'block');
      }

      // Fire install_lumacore
      await bridge.call('install_lumacore', steamPath || '', variant);
    } catch (err) {
      console.error('[LumaCoreModal] Install call error:', err);
      setInstalling(false);
      setResultState({
        success: false,
        message: String(err.message || err),
      });
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to remove LumaCore DLLs from your Steam directory?')) return;
    setInstalling(true);
    setProgressPct(10);
    setProgressMsg('Removing LumaCore DLLs from Steam...');
    setResultState(null);
    try {
      await bridge.call('lumacore_deactivate');
    } catch (err) {
      console.error('[LumaCoreModal] Deactivate error:', err);
      setInstalling(false);
      setResultState({
        success: false,
        message: String(err.message || err),
      });
    }
  };

  const handleSelectSteamFolder = async () => {
    try {
      const selected = await bridge.call('open_file_dialog', 'steam');
      if (selected) {
        setSteamPath(selected);
        await bridge.call('set_setting', 'steam_path', selected);
        checkStatus(true);
      }
    } catch (err) {
      console.error('Folder select error:', err);
    }
  };

  if (!isOpen) return null;

  const isInstalled = !!versionInfo.installed;
  const isUpToDate = isInstalled && versionInfo.installed === versionInfo.latest;

  return (
    <AnimatePresence>
      <div className="lumacore-modal-overlay" onClick={onClose}>
        <motion.div
          className="lumacore-modal-container"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="lumacore-modal-header">
            <div className="header-icon-wrap">
              <ShieldAlert size={24} className="amber-glow-icon" />
            </div>
            <div className="header-text">
              <h3>Auto LC Setup (LumaCore)</h3>
              <p>Steam Hook & Unlocker Environment</p>
            </div>
            <button className="lumacore-close-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>

          {/* Yellow Warning Banner */}
          <div className="lumacore-warning-banner">
            <div className="warning-banner-icon">
              <AlertTriangle size={22} />
            </div>
            <div className="warning-banner-content">
              <strong>LumaCore is required for Steam library unlocks!</strong>
              <p>
                Kraken utilizes LumaCore to hook into <code>steamclient64.dll</code>, allowing Steam to recognize downloaded manifests, Lua scripts, and cloud saves. Without LumaCore, games will not launch or appear in your active Steam library.
              </p>
            </div>
          </div>

          {/* Status & Details Grid */}
          <div className="lumacore-details-grid">
            <div className="detail-row">
              <span className="detail-label">Current Status:</span>
              <div className="detail-badges">
                {loadingStatus ? (
                  <span className="badge badge-loading">
                    <RefreshCw size={12} className="spin" /> Checking...
                  </span>
                ) : isInstalled ? (
                  <span className="badge badge-success">
                    <CheckCircle size={12} /> Installed: {versionInfo.installed}
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <XCircle size={12} /> Not Detected in Steam
                  </span>
                )}

                {versionInfo.latest && (
                  <span className="badge badge-info">
                    Latest: {versionInfo.latest}
                  </span>
                )}

                {versionInfo.update_available && (
                  <span className="badge badge-update">
                    Update Available!
                  </span>
                )}
              </div>
              <button
                className="btn-refresh-status"
                onClick={() => checkStatus(true)}
                disabled={loadingStatus || installing}
                title="Force refresh from GitHub"
              >
                <RefreshCw size={13} className={loadingStatus ? 'spin' : ''} />
                <span>Check for updates</span>
              </button>
            </div>

            <div className="detail-row">
              <span className="detail-label">Steam Path:</span>
              <div className="steam-path-selector">
                <input
                  type="text"
                  value={steamPath || 'Auto-detected'}
                  readOnly
                  className="steam-path-input"
                />
                <button
                  type="button"
                  className="btn-browse-steam"
                  onClick={handleSelectSteamFolder}
                  disabled={installing}
                >
                  <Folder size={14} />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">Build Type:</span>
              <div className="variant-picker">
                <button
                  type="button"
                  className={`variant-btn ${variant === 'release' ? 'active' : ''}`}
                  onClick={() => setVariant('release')}
                  disabled={installing}
                >
                  RELEASE
                </button>
                <button
                  type="button"
                  className={`variant-btn ${variant === 'debug' ? 'active' : ''}`}
                  onClick={() => setVariant('debug')}
                  disabled={installing}
                >
                  DEBUG (Verbose logs)
                </button>
              </div>
            </div>

            <div className="detail-row toggle-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={blockUpdates}
                  onChange={(e) => setBlockUpdates(e.target.checked)}
                  disabled={installing}
                />
                <span className="custom-checkbox"></span>
                <span className="checkbox-text">
                  <Lock size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                  Block Steam client updates (prevents Steam updates from wiping LumaCore DLLs)
                </span>
              </label>
            </div>
          </div>

          {/* Progress / Result Area */}
          {(installing || progressMsg || resultState) && (
            <div className="lumacore-progress-box">
              {installing && (
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}

              <div className="progress-status-line">
                {installing ? (
                  <>
                    <RefreshCw size={14} className="spin status-icon" />
                    <span>{progressMsg || 'Processing...'}</span>
                    <span className="pct-label">{progressPct}%</span>
                  </>
                ) : resultState ? (
                  resultState.success ? (
                    <div className="status-result success">
                      <CheckCircle size={16} />
                      <span>{resultState.message}</span>
                    </div>
                  ) : (
                    <div className="status-result error">
                      <XCircle size={16} />
                      <span>{resultState.message}</span>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="lumacore-modal-actions">
            <div className="left-actions">
              {isInstalled && (
                <button
                  type="button"
                  className="btn-deactivate"
                  onClick={handleDeactivate}
                  disabled={installing}
                >
                  <Trash2 size={15} />
                  <span>Deactivate LumaCore</span>
                </button>
              )}
            </div>

            <div className="right-actions">
              {resultState?.success && (
                <button
                  type="button"
                  className="btn-install-primary"
                  onClick={() => window.Bridge?.restart_steam?.()}
                  disabled={installing}
                >
                  Restart Steam now
                </button>
              )}
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={installing}
              >
                {resultState?.success ? 'Close' : 'Cancel'}
              </button>

              <button
                type="button"
                className="btn-install-primary"
                onClick={handleInstall}
                disabled={installing}
              >
                {installing ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>{isInstalled ? 'Reinstall / Update LumaCore' : 'Install LumaCore'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
