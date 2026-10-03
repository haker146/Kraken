/**
 * language: JSX, file: DownloadSourceModal.jsx
 * Source picker for manifest download — Hubcap (default), MIdraeveryday,
 * Ryuu, DepotBox, or Local file.
 * Calls window.Bridge.download_game_with_source(app_id, source, ...)
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FolderOpen, Globe, Key, Zap, HardDrive, ChevronRight, AlertTriangle, History } from 'lucide-react';
import './DownloadSourceModal.css';
import { useCrackDB } from '../hooks/useCrackDB';

const SOURCES = [
  {
    id:       'hubcap',
    label:    'Hubcap Manifest',
    tag:      'Default',
    tagColor: '#22c55e',
    icon:     Globe,
    desc:     'Largest manifest library. Requires Hubcap API key in Settings.',
    needsKey: true,
  },
  {
    id:       'oureveryday',
    label:    'MIdraeveryday',
    tag:      'Fast',
    tagColor: '#38bdf8',
    icon:     Zap,
    desc:     'Quick download, no key needed. May be rate-limited for large titles.',
    needsKey: false,
  },
  {
    id:       'ryuu',
    label:    'Ryuu / DepotBox',
    tag:      'Key required',
    tagColor: '#f59e0b',
    icon:     Key,
    desc:     'Premium manifest source. Requires Ryuu API key in Settings.',
    needsKey: true,
  },
  {
    id:       'local',
    label:    'Local File',
    tag:      'Offline',
    tagColor: '#a78bfa',
    icon:     HardDrive,
    desc:     'Import a .lua, .zip, .rar, or .7z file from your computer.',
    needsKey: false,
  },
];

const OS_OPTIONS = [
  { id: 'windows', label: 'Windows' },
  { id: 'linux',   label: 'Linux' },
  { id: 'mac',     label: 'macOS' },
];

export default function DownloadSourceModal({ appId, gameName, onClose }) {
  const [selected, setSelected]       = useState('oureveryday');
  const [os, setOs]                   = useState('windows');
  const [luaPath, setLuaPath]         = useState('');
  const [manifestFolder, setMfFolder] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError]             = useState('');
  const [hasHubcapKey, setHasHubcapKey] = useState(false);

  const { lookupGame } = useCrackDB();
  const crackInfo = lookupGame(appId);
  
  const [useOlderVersion, setUseOlderVersion] = useState(false);
  const [buildId, setBuildId] = useState('');

  React.useEffect(() => {
    if (crackInfo?.required_build) {
      setUseOlderVersion(true);
      setBuildId(crackInfo.required_build);
    }
  }, [crackInfo?.required_build]);

  React.useEffect(() => {
    if (window.Bridge?.get_secret_setting) {
      try {
        window.Bridge.get_secret_setting('morrenus_key', (key) => {
          if (key && key.trim()) {
            setHasHubcapKey(true);
            setSelected('hubcap');
          } else {
            setHasHubcapKey(false);
            setSelected('oureveryday');
          }
        });
      } catch {
        setSelected('oureveryday');
      }
    }
  }, []);

  const handleBrowseLua = () => {
    if (window.Bridge?.open_lua_file_dialog) {
      window.Bridge.open_lua_file_dialog((path) => {
        if (path) setLuaPath(path);
      });
    }
  };

  const handleBrowseManifest = () => {
    if (window.Bridge?.open_manifest_folder_dialog) {
      window.Bridge.open_manifest_folder_dialog((path) => {
        if (path) setMfFolder(path);
      });
    }
  };

  const handleDownload = () => {
    if (!window.Bridge?.download_game_with_source) {
      setError('Bridge not ready — restart the app.');
      return;
    }
    if (selected === 'local' && !luaPath) {
      setError('Wybierz plik Lua lub archiwum (.zip, .rar, .7z).');
      return;
    }
    if (selected === 'hubcap' && !hasHubcapKey) {
      setError('Hubcap wymaga klucza API. Uzupełnij klucz w Ustawieniach lub wybierz źródło MIdraeveryday.');
      return;
    }
    setError('');
    setDownloading(true);
    window.Bridge.download_game_with_source(
      String(appId),
      selected,
      '0',          // request_update
      luaPath,
      manifestFolder,
      '',           // branch
      '',           // file_type
      useOlderVersion ? String(buildId).trim() : ''
    );
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="dsm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="dsm-panel"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="dsm-header">
            <div className="dsm-title">
              <Download size={15} />
              <span>Download</span>
              <span className="dsm-game-name">{gameName}</span>
            </div>
            <button className="dsm-close" onClick={onClose}><X size={15} /></button>
          </div>

          {crackInfo && crackInfo.cracked && !crackInfo.is_standard_steam && (
            <div className="dsm-crack-banner" style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>Dostępny Crack ({crackInfo.crack_source})</div>
                <div style={{ color: '#fcd34d', fontSize: '12px', opacity: 0.9 }}>
                  {crackInfo.required_build ? `Wymaga starszej wersji (Build ID: ${crackInfo.required_build}). Użyj opcji Pobierz starszą wersję.` : 'Gra ma dostępnego cracka i działa z najnowszą wersją. Możesz pobierać standardowo.'}
                </div>
              </div>
            </div>
          )}

          {/* OS selector */}
          <div className="dsm-os-row">
            <span className="dsm-section-label">Target OS</span>
            <div className="dsm-os-pills">
              {OS_OPTIONS.map(o => (
                <button
                  key={o.id}
                  className={`dsm-os-pill ${os === o.id ? 'active' : ''}`}
                  onClick={() => setOs(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source list */}
          <div className="dsm-section-label" style={{ marginBottom: 8 }}>Manifest Source</div>
          <div className="dsm-sources">
            {SOURCES.map(src => {
              const Icon = src.icon;
              const isActive = selected === src.id;
              return (
                <button
                  key={src.id}
                  className={`dsm-source-row ${isActive ? 'active' : ''}`}
                  onClick={() => setSelected(src.id)}
                >
                  <div className={`dsm-source-icon ${isActive ? 'active' : ''}`}>
                    <Icon size={15} />
                  </div>
                  <div className="dsm-source-body">
                    <div className="dsm-source-name">
                      {src.label}
                      <span className="dsm-source-tag" style={{ background: src.tagColor + '22', color: src.tagColor, border: `1px solid ${src.tagColor}44` }}>
                        {src.id === 'hubcap' ? (hasHubcapKey ? 'Gotowy' : 'Wymaga klucza') : src.tag}
                      </span>
                    </div>
                    <div className="dsm-source-desc">{src.desc}</div>
                  </div>
                  {isActive && <ChevronRight size={13} className="dsm-active-icon" />}
                </button>
              );
            })}
          </div>

          {/* Local file picker (only when local selected) */}
          {selected === 'local' && (
            <motion.div
              className="dsm-local-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <div className="dsm-local-row">
                <span className="dsm-local-label">Lua / Archive</span>
                <div className="dsm-local-input-wrap">
                  <input
                    className="dsm-local-input"
                    value={luaPath}
                    onChange={e => setLuaPath(e.target.value)}
                    placeholder="Path to .lua / .zip / .rar / .7z"
                    readOnly
                  />
                  <button className="dsm-browse-btn" onClick={handleBrowseLua}>
                    <FolderOpen size={13} /> Browse
                  </button>
                </div>
              </div>
              <div className="dsm-local-row">
                <span className="dsm-local-label">Manifest Folder <span className="dsm-optional">(optional)</span></span>
                <div className="dsm-local-input-wrap">
                  <input
                    className="dsm-local-input"
                    value={manifestFolder}
                    onChange={e => setMfFolder(e.target.value)}
                    placeholder="Folder containing .manifest files"
                    readOnly
                  />
                  <button className="dsm-browse-btn" onClick={handleBrowseManifest}>
                    <FolderOpen size={13} /> Browse
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Older Version Section */}
          <div className="dsm-section-label" style={{ marginTop: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={14} />
            Starsza Wersja (Build ID)
          </div>
          <div className="dsm-older-version" style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer', marginBottom: useOlderVersion ? '8px' : '0' }}>
              <input 
                type="checkbox" 
                checked={useOlderVersion} 
                onChange={(e) => setUseOlderVersion(e.target.checked)} 
                style={{ accentColor: '#38bdf8', width: 14, height: 14 }}
              />
              Pobierz starszą wersję
            </label>
            <AnimatePresence>
              {useOlderVersion && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <input
                    className="dsm-local-input"
                    value={buildId}
                    onChange={e => setBuildId(e.target.value)}
                    placeholder="Wpisz Build ID (np. 1234567)"
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    Podaj Build ID z SteamDB, aby pobrać i zainstalować konkretną wersję gry (przydatne jeśli crack nie wspiera najnowszej wersji).
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && <div className="dsm-error">{error}</div>}

          {/* Action */}
          <div className="dsm-footer">
            <button className="dsm-cancel" onClick={onClose}>Cancel</button>
            <button
              className="dsm-confirm"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download size={14} />
              {downloading ? 'Starting…' : 'Download'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
