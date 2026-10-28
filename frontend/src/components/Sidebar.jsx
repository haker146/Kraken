import React from 'react';
import {
  Home, Wrench, Store, BookOpen,
  Settings, FileText, Cloud, Zap, ChevronRight, Terminal
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import krakenLogo from '../assets/kraken.png';
import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'home',       label: 'Home',        icon: Home,     group: 'main' },
  { id: 'store',      label: 'Store',       icon: Store,    group: 'main' },
  { id: 'library',    label: 'Library',     icon: BookOpen, group: 'main' },
  { id: 'fixgame',    label: 'Fix Game',    icon: Zap,      group: 'tools' },
  { id: 'cloudsaves', label: 'Cloud Saves', icon: Cloud,    group: 'tools' },
  { id: 'tools',      label: 'Tools',       icon: Wrench,   group: 'tools' },
  { id: 'settings',   label: 'Settings',    icon: Settings, group: 'bottom' },
  { id: 'logs',       label: 'Logs',        icon: FileText, group: 'bottom' },
];

export default function Sidebar() {
  const activePage = useAppStore(s => s.activePage);
  const setActivePage = useAppStore(s => s.setActivePage);
  const steamStatus = useAppStore(s => s.steamStatus);
  const [avatarError, setAvatarError] = React.useState(false);

  React.useEffect(() => {
    setAvatarError(false);
  }, [steamStatus?.avatar_url, steamStatus?.running]);

  const isSteamRunning = Boolean(steamStatus.running);
  const showSteamAvatar = Boolean(isSteamRunning && steamStatus.avatar_url && !avatarError);
  const avatarSrc = showSteamAvatar ? steamStatus.avatar_url : krakenLogo;

  const groups = {
    main:   NAV_ITEMS.filter(i => i.group === 'main'),
    tools:  NAV_ITEMS.filter(i => i.group === 'tools'),
    bottom: NAV_ITEMS.filter(i => i.group === 'bottom'),
  };

  return (
    <aside className="sidebar">
      {/* Logo / User Profile */}
      <div className="sidebar-logo">
        <div className={`sidebar-logo-icon ${showSteamAvatar ? 'steam-avatar' : 'kraken-logo'}`}>
          <img 
            key={showSteamAvatar ? (steamStatus.avatar_url || 'steam-avatar') : 'kraken-logo'}
            src={avatarSrc} 
            alt="Kraken" 
            onError={() => {
              if (showSteamAvatar) {
                setAvatarError(true);
              }
            }}
            draggable={false}
          />
        </div>
        <div className="sidebar-logo-info">
          <span className="sidebar-logo-text" title={isSteamRunning ? (steamStatus.persona_name || "Kraken") : "Kraken"}>
            {isSteamRunning 
              ? (steamStatus.persona_name || "Kraken") 
              : "Kraken"}
          </span>
          <span className="sidebar-logo-sub">
            {isSteamRunning ? "Steam Connected" : "Steam Offline"}
          </span>
        </div>
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

        <div className="sidebar-op-console">
          <button
            className="op-console-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('open_dev_console'))}
            title="Operator Console (Ctrl+~)"
          >
            <Terminal size={14} className="op-console-icon" />
            <span className="op-console-label">Console</span>
          </button>
        </div>
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
        {active && <span className="nav-indicator" />}
        <Icon size={16} strokeWidth={active ? 2.5 : 1.8} className="nav-icon" />
        <span className="nav-label">{item.label}</span>
        {active && <ChevronRight size={12} className="nav-chevron" />}
      </button>
    </li>
  );
}
