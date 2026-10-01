import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Key, CheckCircle, Shield, Folder, RefreshCw, XCircle } from 'lucide-react';
import { bridge } from '../lib/bridge';
import './Settings.css';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [secrets, setSecrets] = useState({
    morrenus_key: '',
    depotbox_key: '',
    ryuu_api_key: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await bridge.call('get_settings');
        if (res) {
          setSettings(JSON.parse(res));
        }
        // Load secrets explicitly
        const keys = ['morrenus_key', 'depotbox_key', 'ryuu_api_key'];
        const sec = {};
        for (const k of keys) {
          const val = await bridge.call('get_secret_setting', k);
          sec[k] = val || '';
        }
        setSecrets(sec);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSecretChange = (key, value) => {
    setSecrets(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      // Save normal settings
      for (const [k, v] of Object.entries(settings)) {
        await bridge.call('set_setting', k, String(v));
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
        </motion.div>

      </div>
    </div>
  );
}
