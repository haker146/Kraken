import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Settings, Trash2, HardDrive, ChevronRight,
  FolderOpen, RefreshCw, Play, Star
} from 'lucide-react';
import './ContextMenu.css';

export default function ContextMenu({ x, y, game, onClose, onSettings, onRemoveLibrary, onRemoveDisk, onFavorite }) {
  const ref = useRef(null);

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

  // Keep menu inside viewport
  const style = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 260),
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
        <CtxItem icon={Play} label="Play" accent onClick={onClose} />
      </div>

      <div className="ctx-divider" />

      <div className="ctx-section">
        <CtxItem icon={Heart} label="Add to Favourites" onClick={() => { onFavorite?.(); onClose(); }} />
        <CtxItem icon={FolderOpen} label="Browse Local Files" onClick={onClose} />
        <CtxItem icon={RefreshCw} label="Verify Game Files" onClick={onClose} />
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

      <div className="ctx-divider" />

      <div className="ctx-section">
        <CtxItem
          icon={Trash2}
          label="Remove from Library"
          danger
          onClick={() => { onRemoveLibrary?.(); onClose(); }}
        />
        <CtxItem
          icon={HardDrive}
          label="Uninstall Game"
          sublabel="Removes from library and disk"
          danger
          onClick={() => { onRemoveDisk?.(); onClose(); }}
        />
      </div>
    </motion.div>
  );
}

function CtxItem({ icon: Icon, label, sublabel, danger, accent, onClick }) {
  return (
    <button
      className={`ctx-item ${danger ? 'danger' : ''} ${accent ? 'accent' : ''}`}
      onClick={onClick}
    >
      {Icon && <Icon size={14} className="ctx-item-icon" />}
      <div className="ctx-item-text">
        <span>{label}</span>
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
