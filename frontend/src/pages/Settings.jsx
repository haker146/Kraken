import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Save,
  Key,
  CheckCircle,
  Shield,
  Folder,
  RefreshCw,
  XCircle,
  Lock,
  Unlock,
  ShieldAlert,
  Download,
  AlertTriangle,
  Palette,
  ChevronUp,
  ChevronDown,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { applyUiTheme, UI_THEMES, normalizeUiTheme, readStoredUiTheme } from '../lib/theme';
import {
  MANIFEST_SOURCE_CATALOG,
  DEFAULT_MANIFEST_SOURCES,
  normalizeManifestSources,
} from '../lib/manifestSources';
import { useAppStore } from '../store/useAppStore';
import './Settings.css';

export default function Settings() {
  const setUiTheme = useAppStore((s) => s.setUiTheme);
  const [settings, setSettings] = useState(() => ({ ui_theme: readStoredUiTheme() }));
  const [secrets, setSecrets] = useState({
    morrenus_key: '',
    depotbox_key: '',
    ryuu_api_key: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Steam updates blocker state
  const [steamUpdatesState, setSteamUpdatesState] = useState('unknown');
  const [updatingSteamBlock, setUpdatingSteamBlock] = useState(false);

  // LumaCore version state
  const [lcInfo, setLcInfo] = useState({
    installed: '',
    latest: '',
    update_available: false,
  });
  const [checkingLc, setCheckingLc] = useState(false);
  const [manifestSources, setManifestSources] = useState(DEFAULT_MANIFEST_SOURCES);

  const fetchSteamUpdatesState = async () => {
    try {
      const state = await bridge.call('steam_updates_get_state');
      if (state) setSteamUpdatesState(state);
    } catch (e) {
      console.error('Failed to get steam updates state:', e);
    }
  };

  const fetchLumaCoreStatus = async (force = false) => {
    setCheckingLc(true);
    try {
      const res = await bridge.call('lumacore_check_update', force ? 'force' : '');
      if (res) {
        const data = typeof res === 'string' ? JSON.parse(res) : res;
        setLcInfo({
          installed: data.installed || '',
          latest: data.latest || '',
          update_available: !!data.update_available,
        });
      }
    } catch (e) {
      console.error('Failed to check LumaCore update:', e);
    } finally {
      setCheckingLc(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const res = await Promise.race([
          bridge.call('get_settings'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('settings timeout')), 4000)),
        ]);
        if (res && !cancelled) {
          const parsed = typeof res === 'string' ? JSON.parse(res) : res;
          setSettings(parsed || {});
          setManifestSources(normalizeManifestSources(parsed?.manifest_sources));
        }
        const keys = ['morrenus_key', 'depotbox_key', 'ryuu_api_key'];
        const sec = {};
        for (const k of keys) {
          try {
            const val = await Promise.race([
              bridge.call('get_secret_setting', k),
              new Promise((resolve) => setTimeout(() => resolve(''), 1500)),
            ]);
            sec[k] = val || '';
          } catch {
            sec[k] = '';
          }
        }
        if (!cancelled) setSecrets(sec);
        await fetchSteamUpdatesState();
        await fetchLumaCoreStatus(false);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSettings();
    const fallback = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4500);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  const handleToggleSteamUpdates = async (block) => {
    const action = block ? 'block' : 'unblock';
    setUpdatingSteamBlock(true);
    try {
      const res = await bridge.call('steam_updates_set_state', action);
      if (res === 'blocked' || res === 'unblocked') {
        setSteamUpdatesState(res);
      } else {
        await fetchSteamUpdatesState();
      }
    } catch (e) {
      console.error('Error toggling steam updates:', e);
    } finally {
      setUpdatingSteamBlock(false);
    }
  };

  const openLumaCoreModal = () => {
    window.dispatchEvent(new Event('open_lumacore_modal'));
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const commitManifestSources = (next) => {
    setManifestSources(next);
    handleChange('manifest_sources', JSON.stringify(next));
  };

  const moveManifestSource = (index, dir) => {
    const dest = index + dir;
    if (dest < 0 || dest >= manifestSources.length) return;
    const next = [...manifestSources];
    [next[index], next[dest]] = [next[dest], next[index]];
    commitManifestSources(next);
  };

  const toggleManifestSource = (index, enabled) => {
    const next = manifestSources.map((item, i) => (
      i === index ? { ...item, enabled } : item
    ));
    commitManifestSources(next);
  };

  const handleThemeChange = (id) => {
    const theme = applyUiTheme(id);
    setUiTheme(theme);
    handleChange('ui_theme', theme);
    bridge.call('set_setting', 'ui_theme', theme).catch(() => {});
  };

  const handleSecretChange = (key, value) => {
    setSecrets(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const payload = {
        ...settings,
        manifest_sources: JSON.stringify(manifestSources),
      };
      for (const [k, v] of Object.entries(payload)) {
        if (v === undefined || v === null) continue;
        const encoded = typeof v === 'object' ? JSON.stringify(v) : String(v);
        await bridge.call('set_setting', k, encoded);
      }
      // Save secrets
      for (const [k, v] of Object.entries(secrets)) {
        await bridge.call('set_secret_setting', k, String(v));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page loading">
        <RefreshCw className="spin" size={24} />
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2>Settings & API Keys</h2>
          <p>Configure Hubcap, preferences and behaviors.</p>
        </div>
        <button 
          className="settings-save-btn" 
          onClick={saveSettings} 
          disabled={saving}
        >
          {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
          {saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-grid">
        <motion.div className="settings-card" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}>
          <div className="card-icon"><Key size={20} /></div>
          <h3>API Keys</h3>
          <p className="card-desc">Required for downloading manifests and branch data.</p>
          
          <div className="settings-field">
            <label>Hubcap API Key</label>
            <input 
              type="password" 
              value={secrets.morrenus_key} 
              onChange={e => handleSecretChange('morrenus_key', e.target.value)} 
              placeholder="sk_..."
            />
          </div>
          
          <div className="settings-field">
            <label>DepotBox API Key</label>
            <input 
              type="password" 
              value={secrets.depotbox_key} 
              onChange={e => handleSecretChange('depotbox_key', e.target.value)} 
              placeholder="db_..."
            />
          </div>
          
          <div className="settings-field">
            <label>Ryuu API Key</label>
            <input 
              type="password" 
              value={secrets.ryuu_api_key} 
              onChange={e => handleSecretChange('ryuu_api_key', e.target.value)} 
            />
          </div>
        </motion.div>

        <motion.div className="settings-card settings-card-wide" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.08}}>
          <div className="card-icon"><Layers size={20} /></div>
          <h3>Źródła manifestów</h3>
          <p className="card-desc">
            Kolejność, w jakiej Kraken szuka plików <code>.manifest</code>. Strzałki zmieniają priorytet, przełącznik wyłącza źródło. Hubcap ma dzienny limit — jeśli chcesz go oszczędzać, przesuń niżej albo wyłącz.
          </p>

          <ol className="manifest-source-list">
            {manifestSources.map((item, index) => {
              const meta = MANIFEST_SOURCE_CATALOG.find((s) => s.id === item.id);
              if (!meta) return null;
              const hubcapNeedsKey = item.id === 'hubcap' && !secrets.morrenus_key;
              return (
                <li
                  key={item.id}
                  className={`manifest-source-row${item.enabled ? '' : ' is-disabled'}`}
                >
                  <div className="manifest-source-rank">{index + 1}</div>
                  <div className="manifest-source-move">
                    <button
                      type="button"
                      aria-label={`Przesuń ${meta.name} wyżej`}
                      disabled={index === 0}
                      onClick={() => moveManifestSource(index, -1)}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Przesuń ${meta.name} niżej`}
                      disabled={index === manifestSources.length - 1}
                      onClick={() => moveManifestSource(index, 1)}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <label className="settings-toggle manifest-source-toggle">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => toggleManifestSource(index, e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                  <div className="manifest-source-copy">
                    <div className="manifest-source-title">
                      <strong>{meta.name}</strong>
                      <span className={`manifest-source-badge tone-${meta.badgeTone}`}>{meta.badge}</span>
                      {meta.needsKey && <span className="manifest-source-key">klucz</span>}
                    </div>
                    <p>{meta.description}</p>
                    {hubcapNeedsKey && (
                      <p className="manifest-source-warn">Brak klucza Hubcap — to źródło będzie pomijane, dopóki nie wkleisz klucza powyżej.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {!manifestSources.some((s) => s.enabled) && (
            <p className="field-note">Wszystkie źródła są wyłączone. Przy pobieraniu Kraken wróci do domyślnej kolejności, żeby update nie stanął w miejscu.</p>
          )}

          <div className="card-button-row">
            <button
              type="button"
              className="btn-check-lc"
              onClick={() => commitManifestSources(DEFAULT_MANIFEST_SOURCES.map((s) => ({ ...s })))}
            >
              <RotateCcw size={14} />
              <span>Domyślna kolejność</span>
            </button>
          </div>
        </motion.div>

        <motion.div className="settings-card" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.1}}>
          <div className="card-icon"><Folder size={20} /></div>
          <h3>Paths & Cache</h3>
          <p className="card-desc">Manage local storage and folders.</p>

          <div className="settings-field">
            <label>Steam Installation Path</label>
            <div className="path-input-group">
              <input 
                type="text" 
                value={settings.steam_path || ''} 
                onChange={e => handleChange('steam_path', e.target.value)}
              />
            </div>
          </div>
          <div className="settings-field">
            <label>DLC Unlocker Cache</label>
            <input 
              type="text" 
              value={settings.dlc_unlocker_cache || ''} 
              onChange={e => handleChange('dlc_unlocker_cache', e.target.value)} 
            />
          </div>
        </motion.div>

        <motion.div className="settings-card settings-theme-card" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.12}}>
          <div className="card-icon"><Palette size={20} /></div>
          <h3>Appearance</h3>
          <p className="card-desc">Pick a UI theme. Each one tints the app and adds a living Home backdrop.</p>
          <div className="theme-picker">
            {UI_THEMES.map((theme) => {
              const active = normalizeUiTheme(settings.ui_theme) === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-option ${active ? 'is-active' : ''}`}
                  onClick={() => handleThemeChange(theme.id)}
                >
                  <span className="theme-swatch" style={{ '--theme-swatch': theme.swatch }} />
                  <span className="theme-copy">
                    <strong>{theme.name}</strong>
                    <span>{theme.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div className="settings-card" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.2}}>
          <div className="card-icon"><Shield size={20} /></div>
          <h3>App Behavior</h3>
          
          <label className="settings-toggle">
            <input 
              type="checkbox" 
              checked={settings.play_music === true || settings.play_music === 'true'} 
              onChange={e => handleChange('play_music', e.target.checked)}
            />
            <span className="slider"></span>
            <span className="label-text">Play Background Music</span>
          </label>
          
          <label className="settings-toggle">
            <input 
              type="checkbox" 
              checked={settings.enable_notifications === true || settings.enable_notifications === 'true'} 
              onChange={e => handleChange('enable_notifications', e.target.checked)}
            />
            <span className="slider"></span>
            <span className="label-text">Desktop Notifications</span>
          </label>

          <label className="settings-toggle">
            <input 
              type="checkbox" 
              checked={settings.use_smokeapi === true || settings.use_smokeapi === 'true'} 
              onChange={e => handleChange('use_smokeapi', e.target.checked)}
            />
            <span className="slider"></span>
            <span className="label-text">Prefer SmokeAPI over CreamAPI</span>
          </label>

          <label className="settings-toggle">
            <input 
              type="checkbox" 
              checked={settings.auto_check_manifest_updates === true || settings.auto_check_manifest_updates === 'true'} 
              onChange={e => handleChange('auto_check_manifest_updates', e.target.checked)}
            />
            <span className="slider"></span>
            <span className="label-text">Auto-check Manifest Updates on Launch</span>
          </label>

          <div className="settings-field">
            <label>Native download speed limit (KB/s)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={settings.download_speed_limit || '0'}
              onChange={e => handleChange('download_speed_limit', e.target.value)}
              placeholder="0 = unlimited"
            />
            <p className="field-note">Applies to the Python CDN downloader. 0 means no cap. Pause still stops between chunks.</p>
          </div>

          <div className="card-button-row">
            <button
              type="button"
              className="btn-check-lc"
              onClick={() => window.dispatchEvent(new Event('kraken_start_tutorial'))}
            >
              Replay setup tutorial
            </button>
          </div>
        </motion.div>

        <motion.div className="settings-card" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.25}}>
          <div className="card-icon"><Lock size={20} /></div>
          <h3>Steam Updates Blocker</h3>
          <p className="card-desc">Prevents Steam from auto-updating and wiping LumaCore DLLs.</p>

          <div className="settings-field">
            <div className="steam-updates-status-wrap">
              <span className="field-subtitle">Current Status:</span>
              {steamUpdatesState === 'blocked' ? (
                <span className="badge badge-success">
                  <CheckCircle size={12} /> Updates Blocked (Safe)
                </span>
              ) : steamUpdatesState === 'unblocked' ? (
                <span className="badge badge-warning">
                  <AlertTriangle size={12} /> Updates Allowed
                </span>
              ) : (
                <span className="badge badge-loading">
                  Not Configured
                </span>
              )}
            </div>
            <p className="field-note">
              Writes <code>BootStrapperInhibitAll=Enable</code> into <code>steam.cfg</code> in your Steam directory.
            </p>
          </div>

          <div className="card-button-row">
            {steamUpdatesState === 'blocked' ? (
              <button
                type="button"
                className="btn-unblock-updates"
                onClick={() => handleToggleSteamUpdates(false)}
                disabled={updatingSteamBlock}
              >
                {updatingSteamBlock ? <RefreshCw size={14} className="spin" /> : <Unlock size={14} />}
                <span>Unblock Steam Updates</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-block-updates"
                onClick={() => handleToggleSteamUpdates(true)}
                disabled={updatingSteamBlock}
              >
                {updatingSteamBlock ? <RefreshCw size={14} className="spin" /> : <Lock size={14} />}
                <span>Block Steam Updates</span>
              </button>
            )}
          </div>
        </motion.div>

        <motion.div className="settings-card card-lumacore" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.3}}>
          <div className="card-icon card-icon-amber"><ShieldAlert size={20} /></div>
          <h3>LumaCore (Auto LC Setup)</h3>
          <p className="card-desc">Hooks Steam to enable manifest games, Lua unlocks, and DLC.</p>

          <div className="settings-field">
            <div className="steam-updates-status-wrap">
              <span className="field-subtitle">Installed Build:</span>
              {lcInfo.installed ? (
                <span className="badge badge-success">
                  <CheckCircle size={12} /> {lcInfo.installed}
                </span>
              ) : (
                <span className="badge badge-warning">
                  <XCircle size={12} /> Missing / Not Detected
                </span>
              )}

              {lcInfo.latest && (
                <span className="badge badge-info">
                  Latest: {lcInfo.latest}
                </span>
              )}
            </div>
            {lcInfo.update_available && (
              <div className="lc-update-notice">
                <AlertTriangle size={13} />
                <span>New LumaCore release is available on GitHub!</span>
              </div>
            )}
          </div>

          <div className="card-button-row">
            <button
              type="button"
              className="btn-open-lc-modal"
              onClick={openLumaCoreModal}
            >
              <Download size={14} />
              <span>Auto LC Setup</span>
            </button>

            <button
              type="button"
              className="btn-check-lc"
              onClick={() => fetchLumaCoreStatus(true)}
              disabled={checkingLc}
            >
              <RefreshCw size={14} className={checkingLc ? 'spin' : ''} />
              <span>Check for updates</span>
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
