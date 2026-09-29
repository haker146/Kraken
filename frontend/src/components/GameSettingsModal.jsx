import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, Shield, Save, RefreshCw, Package,
  Trophy, Folder, HardDrive, ToggleLeft, ChevronDown, Download, Trash2
} from 'lucide-react';
import './GameSettingsModal.css';

const TABS = [
  { id: 'crack',    label: 'Crack',         icon: Zap      },
  { id: 'dlc',      label: 'DLC Manager',   icon: Package  },
  { id: 'saves',    label: 'Save Files',    icon: Save     },
  { id: 'version',  label: 'Version',       icon: RefreshCw},
  { id: 'achieve',  label: 'Achievements',  icon: Trophy   },
  { id: 'advanced', label: 'Advanced',      icon: HardDrive},
];

const MOCK_DLC = [
  { id: 1, name: 'Phantom Liberty', size: '18 GB', locked: true  },
  { id: 2, name: 'Cyberpunk Bonus Content', size: '1.2 GB', locked: false },
  { id: 3, name: 'Original Soundtrack', size: '3.1 GB', locked: true },
  { id: 4, name: 'Digital Artbook', size: '450 MB', locked: false },
];

const MOCK_SAVES = [
  { id: 1, name: 'Autosave', date: '2024-01-15 22:34', size: '12 MB' },
  { id: 2, name: 'Manual Save 1', date: '2024-01-14 18:10', size: '11 MB' },
  { id: 3, name: 'Manual Save 2', date: '2024-01-12 09:45', size: '10 MB' },
];

const MOCK_BUILDS = [
  { build: '9999999', date: '2024-01-10', label: 'Latest (Current)' },
  { build: '9986585', date: '2023-12-01', label: 'Crack Compatible ⚡' },
  { build: '9800000', date: '2023-10-15', label: '' },
  { build: '9500000', date: '2023-07-02', label: '' },
];

function Toggle({ checked, onChange }) {
  return (
    <button className={`modal-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <div className="modal-toggle-thumb" />
    </button>
  );
}

// ── Tabs ──────────────────────────────────────────────────
function CrackTab({ game }) {
  const [crackInstalled, setCrackInstalled] = useState(game.crack_status === 'cracked');
  return (
    <div className="modal-tab-content">
      <div className="modal-section">
        <h4 className="modal-section-title">Status</h4>
        <div className="modal-info-grid">
          <InfoRow label="DRM" value={game.drm} />
          <InfoRow label="Crack Version" value={game.crack_ver || '—'} accent />
          <InfoRow label="Source" value={game.crack_src || '—'} />
          <InfoRow label="Cracked On" value={game.crack_date || '—'} />
        </div>
      </div>

      <div className="modal-section">
        <h4 className="modal-section-title">Actions</h4>
        <div className="modal-actions-list">
          <ActionRow
            icon={Zap}
            title={crackInstalled ? 'Crack Installed' : 'Install Crack'}
            desc={crackInstalled ? 'Click to remove crack' : `Download and apply v${game.crack_ver || 'N/A'}`}
            active={crackInstalled}
            color="purple"
            onClick={() => setCrackInstalled(!crackInstalled)}
          />
          <ActionRow
            icon={RefreshCw}
            title="Check for Crack Update"
            desc="Sync with Kraken crack database"
            color="accent"
          />
        </div>
      </div>

      <div className="modal-section">
        <h4 className="modal-section-title">Emulator</h4>
        <div className="modal-toggle-rows">
          <ToggleRow label="Goldberg Steam Emulator (GSE)" desc="Offline play without Steam" />
          <ToggleRow label="SteamStub bypass" desc="Removes Steam stub wrapper" />
        </div>
      </div>
    </div>
  );
}

function DlcTab({ game }) {
  const [unlocked, setUnlocked] = useState({ 1: true, 3: true });
  return (
    <div className="modal-tab-content">
      <div className="modal-section">
        <div className="modal-section-header">
          <h4 className="modal-section-title">DLC ({MOCK_DLC.length})</h4>
          <button className="modal-link-btn">Unlock All</button>
        </div>
        <div className="modal-toggle-rows">
          <ToggleRow label="Use SmokeAPI" desc="Automatically unlocks all DLC" defaultOn />
          <ToggleRow label="Use CreamAPI" desc="Alternative DLC unlocker (Denuvo compat)" />
        </div>
      </div>
      <div className="modal-section">
        <h4 className="modal-section-title">DLC List</h4>
        <div className="modal-dlc-list">
          {MOCK_DLC.map(dlc => (
            <div key={dlc.id} className="modal-dlc-row">
              <div className="modal-dlc-info">
                <span className="modal-dlc-name">{dlc.name}</span>
                <span className="modal-dlc-size">{dlc.size}</span>
              </div>
              <Toggle
                checked={!!unlocked[dlc.id]}
                onChange={v => setUnlocked(u => ({ ...u, [dlc.id]: v }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SavesTab() {
  return (
    <div className="modal-tab-content">
      <div className="modal-section">
        <div className="modal-section-header">
          <h4 className="modal-section-title">Save Files</h4>
          <button className="modal-link-btn"><Folder size={12} /> Open Folder</button>
        </div>
        <div className="modal-saves-list">
          {MOCK_SAVES.map(s => (
            <div key={s.id} className="modal-save-row">
              <div className="modal-save-info">
                <span className="modal-save-name">{s.name}</span>
                <span className="modal-save-meta">{s.date} · {s.size}</span>
              </div>
              <div className="modal-save-actions">
                <button className="modal-icon-btn" title="Backup"><Download size={13} /></button>
                <button className="modal-icon-btn danger" title="Delete"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-section">
        <h4 className="modal-section-title">Cloud Backup</h4>
        <div className="modal-toggle-rows">
          <ToggleRow label="Auto-backup saves" desc="Saves a copy before each launch" />
          <ToggleRow label="Sync to local folder" desc="Mirrors saves to a custom path" />
        </div>
      </div>
    </div>
  );
}

function VersionTab({ game }) {
  const [selectedBuild, setSelectedBuild] = useState(MOCK_BUILDS[0].build);
  return (
    <div className="modal-tab-content">
      <div className="modal-section">
        <h4 className="modal-section-title">Installed Version</h4>
        <div className="modal-info-grid">
          <InfoRow label="Build ID" value={selectedBuild} />
          <InfoRow label="Branch" value="public" />
          <InfoRow label="Install Path" value="D:\Games\Cyberpunk 2077" mono />
        </div>
      </div>
      <div className="modal-section">
        <div className="modal-section-header">
          <h4 className="modal-section-title">Available Builds</h4>
          <span className="modal-hint">Crack-compatible build is recommended</span>
        </div>
        <div className="modal-builds-list">
          {MOCK_BUILDS.map(b => (
            <button
              key={b.build}
              className={`modal-build-row ${selectedBuild === b.build ? 'selected' : ''}`}
              onClick={() => setSelectedBuild(b.build)}
            >
              <div className="modal-build-info">
                <span className="modal-build-id">Build {b.build}</span>
                {b.label && <span className="modal-build-label">{b.label}</span>}
              </div>
              <span className="modal-build-date">{b.date}</span>
            </button>
          ))}
        </div>
        <button
          className="modal-btn-primary"
          disabled={selectedBuild === MOCK_BUILDS[0].build}
        >
          <Download size={14} /> Downgrade to Build {selectedBuild}
        </button>
      </div>
    </div>
  );
}

function AchieveTab() {
  return (
    <div className="modal-tab-content">
      <div className="modal-section">
        <h4 className="modal-section-title">Achievement Unlocker (GSE)</h4>
        <div className="modal-toggle-rows">
          <ToggleRow label="Enable GSE Achievement Unlock" desc="Unlocks all achievements locally" />
          <ToggleRow label="Auto-unlock on launch" desc="Unlocks achievements when game starts" />
        </div>
      </div>
      <div className="modal-section">
        <h4 className="modal-section-title">Achievements</h4>
        <div className="modal-achieve-placeholder">
          <Trophy size={32} opacity={0.2} />
          <p>Achievement list loads from Steam API when connected.</p>
        </div>
      </div>
    </div>
  );
}

function AdvancedTab({ game }) {
  return (
    <div className="modal-tab-content">
      <div className="modal-section">
        <h4 className="modal-section-title">Launch Options</h4>
        <input className="modal-input" placeholder="-dx12 --skip-launcher" />
        <p className="modal-hint">These arguments are passed to the game executable on launch.</p>
      </div>
      <div className="modal-section">
        <h4 className="modal-section-title">Steam Integration</h4>
        <div className="modal-toggle-rows">
          <ToggleRow label="Block Steam auto-updates" desc="Pins current build, prevents updates" defaultOn />
          <ToggleRow label="Steam overlay" desc="Enable/disable Steam overlay" defaultOn />
          <ToggleRow label="Family Share bypass" desc="Requires LumaCore" />
        </div>
      </div>
      <div className="modal-section">
        <h4 className="modal-section-title">Danger Zone</h4>
        <div className="modal-actions-list">
          <ActionRow icon={Trash2} title="Remove from Library" desc="Keeps files on disk" color="red" />
          <ActionRow icon={HardDrive} title="Uninstall Game" desc="Permanently deletes all game files" color="red" />
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────
function InfoRow({ label, value, accent, mono }) {
  return (
    <div className="modal-info-row">
      <span className="modal-info-label">{label}</span>
      <span className={`modal-info-value ${accent ? 'accent' : ''} ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function ToggleRow({ label, desc, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="modal-toggle-row">
      <div>
        <div className="modal-toggle-label">{label}</div>
        {desc && <div className="modal-toggle-desc">{desc}</div>}
      </div>
      <Toggle checked={on} onChange={setOn} />
    </div>
  );
}

function ActionRow({ icon: Icon, title, desc, color = 'accent', active = false, onClick }) {
  return (
    <button className={`modal-action-row color-${color} ${active ? 'active' : ''}`} onClick={onClick}>
      <div className={`modal-action-icon color-${color}`}><Icon size={15} /></div>
      <div className="modal-action-text">
        <span className="modal-action-title">{title}</span>
        <span className="modal-action-desc">{desc}</span>
      </div>
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────
export default function GameSettingsModal({ game, onClose }) {
  const [activeTab, setActiveTab] = useState('crack');

  const TAB_CONTENT = {
    crack:    <CrackTab game={game} />,
    dlc:      <DlcTab game={game} />,
    saves:    <SavesTab />,
    version:  <VersionTab game={game} />,
    achieve:  <AchieveTab />,
    advanced: <AdvancedTab game={game} />,
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal-window"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="modal-header">
          <img
            src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/capsule_sm_120.jpg`}
            className="modal-header-thumb"
            alt=""
            onError={e => e.target.style.display = 'none'}
          />
          <div className="modal-header-text">
            <h2 className="modal-title">{game.name}</h2>
            <p className="modal-subtitle">Game Settings</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`modal-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={13} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div className="modal-tab-bar" layoutId="modal-tab-bar" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="modal-body">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {TAB_CONTENT[activeTab]}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
