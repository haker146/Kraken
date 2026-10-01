import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Wrench, Store, BookOpen, RotateCcw,
  Settings, FileText, Cloud, Zap, ChevronRight
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'home',       label: 'Home',        icon: Home,     group: 'main' },
  { id: 'store',      label: 'Store',       icon: Store,    group: 'main' },
  { id: 'library',    label: 'Library',     icon: BookOpen, group: 'main' },
  { id: 'fixgame',    label: 'Fix Game',    icon: Zap,      group: 'tools' },
  { id: 'downgrade',  label: 'Downgrade',   icon: RotateCcw,group: 'tools' },
  { id: 'cloudsaves', label: 'Cloud Saves', icon: Cloud,    group: 'tools' },
  { id: 'tools',      label: 'Tools',       icon: Wrench,   group: 'tools' },
  { id: 'settings',   label: 'Settings',    icon: Settings, group: 'bottom' },
  { id: 'logs',       label: 'Logs',        icon: FileText, group: 'bottom' },
];

export default function Sidebar() {
  const { activePage, setActivePage, steamStatus } = useAppStore();

  const groups = {
    main:   NAV_ITEMS.filter(i => i.group === 'main'),
    tools:  NAV_ITEMS.filter(i => i.group === 'tools'),
    bottom: NAV_ITEMS.filter(i => i.group === 'bottom'),
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <img 
            src={steamStatus.running && steamStatus.avatar_url ? steamStatus.avatar_url : "/kraken.png"} 
            alt="K" 
            onError={e => { e.target.src = '/kraken.png'; }}
            style={{ borderRadius: (steamStatus.running && steamStatus.avatar_url) ? '50%' : '8px' }}
          />
        </div>
        <span className="sidebar-logo-text" style={{ fontSize: steamStatus.running ? 16 : 12, lineHeight: 1.2 }}>
          {steamStatus.running 
            ? (steamStatus.persona_name || "Kraken") 
            : "Brak uruchomionego steam"}
        </span>
      </div>

      {/* Nav Main */}
      <nav className="sidebar-nav">
        <NavGroup items={groups.main} active={activePage} onSelect={setActivePage} />
        
        <div className="sidebar-separator">
          <span>Tools</span>
        </div>
        
        <NavGroup items={groups.tools} active={activePage} onSelect={setActivePage} />
      </nav>

      {/* Bottom */}
      <div className="sidebar-bottom">
        {/* Steam Status */}
        <button
          className={`steam-pill ${steamStatus.connected ? 'connected' : 'disconnected'}`}
          onClick={() => setActivePage('settings')}
        >
          <span className="steam-dot" />
          <span className="steam-label">{steamStatus.label}</span>
        </button>

        <NavGroup items={groups.bottom} active={activePage} onSelect={setActivePage} />
      </div>
    </aside>
  );
}

function NavGroup({ items, active, onSelect }) {
  return (
    <ul className="nav-list">
      {items.map(item => (
        <NavItem key={item.id} item={item} active={active === item.id} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function NavItem({ item, active, onSelect }) {
  const Icon = item.icon;
  return (
    <li>
      <button
        className={`nav-item ${active ? 'active' : ''}`}
        onClick={() => onSelect(item.id)}
      >
        {active && (
          <motion.div
            className="nav-indicator"
            layoutId="nav-indicator"
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}
        <Icon size={16} strokeWidth={active ? 2.5 : 1.8} className="nav-icon" />
        <span className="nav-label">{item.label}</span>
        {active && <ChevronRight size={12} className="nav-chevron" />}
      </button>
    </li>
  );
}
