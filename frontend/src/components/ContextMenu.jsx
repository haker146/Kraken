import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Settings, Trash2, HardDrive, ChevronRight,
  FolderOpen, RefreshCw, Play, Download,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { bridge } from '../lib/bridge';
import GameSettingsModal from './GameSettingsModal';
import { gameNeedsDownload, installViaSteam } from '../lib/libraryActions';
import './ContextMenu.css';

export default function ContextMenu({
  x, y, game, onClose, onSettings, onRemoveLibrary, onRemoveDisk, onFavorite,
  onPlay, onBrowseFiles, onVerifyFiles, onToggleAutoUpdate, onUpdateManifest
}) {
  const ref = useRef(null);
  const hasManifest = Boolean(game.in_library || game.manifest_only || game.installed);
  const isInstalled = Boolean(game.installed);
  const autoOn = Boolean(game.auto_update);
  const showDanger = hasManifest;

  // Close on outside click / escape
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const keyHandler = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', keyHandler);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const menuW = 268;
  const menuH = 430;
  const style = {
    left: Math.min(Math.max(8, x), window.innerWidth - menuW - 8),
    top: Math.min(Math.max(8, y), window.innerHeight - menuH - 8),
  };

  return (
    <motion.div
      ref={ref}
      className="ctx-menu"
      style={style}
      initial={{ opacity: 0, scale: 0.95, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -6 }}
      transition={{ duration: 0.12 }}
    >
      {/* Game name header */}
      <div className="ctx-header">{game.name}</div>

      <div className="ctx-section">
        {gameNeedsDownload(game) ? (
          <CtxItem
            icon={Download}
            label="Download"
            sublabel="Opens Steam install dialog"
            accent
            onClick={() => { onPlay?.(); onClose(); }}
          />
        ) : (
          <CtxItem icon={Play} label="Play" accent onClick={() => { onPlay?.(); onClose(); }} />
        )}
      </div>

      {hasManifest && game.has_update && (
        <>
          <div className="ctx-divider" />
          <div className="ctx-section">
            <CtxItem
              icon={RefreshCw}
              label="Update Manifest Now"
              sublabel="Download latest manifest"
              accent
              onClick={() => { onUpdateManifest?.(); onClose(); }}
            />
          </div>
        </>
      )}

      <div className="ctx-divider" />

      <div className="ctx-section">
        <CtxItem
          icon={RefreshCw}
          label="Auto-Update"
          status={autoOn ? 'on' : 'off'}
          sublabel={autoOn ? 'Currently enabled — click to disable' : 'Currently disabled — click to enable'}
          onClick={() => { onToggleAutoUpdate?.(); }}
        />
        <CtxItem
          icon={Heart}
          label={game.isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
          onClick={() => { onFavorite?.(); onClose(); }}
        />
        {isInstalled && (
          <>
            <CtxItem icon={FolderOpen} label="Browse Local Files" onClick={() => { onBrowseFiles?.(); onClose(); }} />
            <CtxItem icon={RefreshCw} label="Verify Game Files" onClick={() => { onVerifyFiles?.(); onClose(); }} />
          </>
        )}
      </div>

      <div className="ctx-divider" />

      {/* Manage submenu */}
      <CtxSubmenu icon={Settings} label="Manage">
        <CtxItem label="Create Desktop Shortcut" onClick={onClose} />
        <CtxItem label="Move Install Folder" onClick={onClose} />
        <CtxItem label="Backup Game Files" onClick={onClose} />
        <CtxItem label="Pin Build ID" onClick={onClose} />
      </CtxSubmenu>

      <div className="ctx-divider" />

      <div className="ctx-section">
        <CtxItem
          icon={Settings}
          label="Game Settings"
          onClick={() => { onSettings(); onClose(); }}
        />
      </div>

      {showDanger && (
        <>
          <div className="ctx-divider" />

          <div className="ctx-section">
            {hasManifest && (
              <CtxItem
                icon={Trash2}
                label="Remove from Library"
                sublabel="Removes manifest, keeps files on disk"
                danger
                onClick={() => { onRemoveLibrary?.(); onClose(); }}
              />
            )}
            {isInstalled && (
              <CtxItem
                icon={HardDrive}
                label="Uninstall Game"
                sublabel="Removes from library and disk"
                danger
                onClick={() => { onRemoveDisk?.(); onClose(); }}
              />
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

function CtxItem({ icon: Icon, label, sublabel, danger, accent, status, onClick }) {
  return (
    <button
      className={`ctx-item ${danger ? 'danger' : ''} ${accent ? 'accent' : ''}`}
      onClick={onClick}
    >
      {Icon && <Icon size={14} className="ctx-item-icon" />}
      <div className="ctx-item-text">
        <span className="ctx-item-label">
          <span>{label}</span>
          {status && (
            <span className={`ctx-status ${status}`}>{status === 'on' ? 'ON' : 'OFF'}</span>
          )}
        </span>
        {sublabel && <span className="ctx-item-sub">{sublabel}</span>}
      </div>
    </button>
  );
}

function CtxSubmenu({ icon: Icon, label, children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div
      className="ctx-submenu-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="ctx-item">
        {Icon && <Icon size={14} className="ctx-item-icon" />}
        <span className="ctx-item-text">{label}</span>
        <ChevronRight size={12} className="ctx-chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="ctx-submenu"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.1 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GameContextHost() {
  const gameCtx = useAppStore((s) => s.gameCtx);
  const settingsGame = useAppStore((s) => s.settingsGame);
  const favorites = useAppStore((s) => s.favorites);
  const closeGameCtx = useAppStore((s) => s.closeGameCtx);
  const setSettingsGame = useAppStore((s) => s.setSettingsGame);
  const removeGame = useAppStore((s) => s.removeGame);
  const patchGame = useAppStore((s) => s.patchGame);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  useEffect(() => {
    const blockNative = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (e.target?.closest?.('.home-cover-card, .home-wide-card, .lib-card, .store-row, .gh-cover, .gh-sidebar')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', blockNative, true);
    return () => document.removeEventListener('contextmenu', blockNative, true);
  }, []);

  const game = gameCtx?.game;
  const play = (g) => {
    if (!g) return;
    if (gameNeedsDownload(g)) installViaSteam(g.app_id);
    else if (window.Bridge?.launch_game) window.Bridge.launch_game(String(g.app_id));
  };
  const browse = (g) => { if (g && window.Bridge?.open_game_folder) window.Bridge.open_game_folder(String(g.app_id), g.path || ''); };
  const verify = (g) => { if (g && window.Bridge?.validate_game_files) window.Bridge.validate_game_files(String(g.app_id)); };
  const removeManifest = (g) => {
    if (!g) return;
    removeGame(g.app_id);
    if (window.Bridge?.delete_game) window.Bridge.delete_game(String(g.app_id), g.path || '', 'manifest');
  };
  const uninstall = (g) => {
    if (!g) return;
    if (!window.confirm(`Are you sure you want to uninstall "${g.name}"?\n\nThis will permanently delete all game files from disk and remove the manifest from Steam.`)) return;
    removeGame(g.app_id);
    if (window.Bridge?.delete_game) window.Bridge.delete_game(String(g.app_id), g.path || '', 'full');
  };

  useEffect(() => {
    return bridge.on('task_finished', (json) => {
      try {
        const evt = typeof json === 'string' ? JSON.parse(json) : json;
        if (evt.task !== 'delete_game') return;
        if (!evt.success && evt.app_id) {
          useAppStore.getState().clearPendingRemoved(evt.app_id);
        }
        try { window.Bridge?.load_library?.(); } catch { /* ignore */ }
      } catch { /* ignore */ }
    });
  }, []);

  return (
    <>
      <AnimatePresence>
        {gameCtx && game && (
          <ContextMenu
            x={gameCtx.x}
            y={gameCtx.y}
            game={{ ...game, isFavorite: favorites.includes(String(game.app_id)) }}
            onClose={closeGameCtx}
            onSettings={() => setSettingsGame(game)}
            onPlay={() => play(game)}
            onBrowseFiles={() => browse(game)}
            onVerifyFiles={() => verify(game)}
            onToggleAutoUpdate={() => {
              const next = !Boolean(game.auto_update);
              if (window.Bridge?.set_game_auto_update) window.Bridge.set_game_auto_update(String(game.app_id), next);
              patchGame(game.app_id, { auto_update: next });
            }}
            onUpdateManifest={() => {
              if (window.Bridge?.check_game_update) window.Bridge.check_game_update(String(game.app_id));
            }}
            onFavorite={() => toggleFavorite(game.app_id)}
            onRemoveLibrary={() => removeManifest(game)}
            onRemoveDisk={() => uninstall(game)}
          />
        )}
      </AnimatePresence>
      {settingsGame && (
        <GameSettingsModal
          game={settingsGame}
          onClose={() => setSettingsGame(null)}
          onAutoUpdateChange={(appId, val) => patchGame(appId, { auto_update: val })}
          onRemoveLibrary={() => { removeManifest(settingsGame); setSettingsGame(null); }}
          onUninstall={() => { uninstall(settingsGame); setSettingsGame(null); }}
        />
      )}
    </>
  );
}
