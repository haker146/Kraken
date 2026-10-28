import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Search, Trash2, Copy, RefreshCw, 
  ArrowDownCircle, AlertCircle, AlertTriangle, Info, Check, Bug
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import './Logs.css';

const LEVEL_COLORS = {
  ERROR:   { bg: 'rgba(248, 113, 113, 0.15)', text: '#f87171', border: 'rgba(248, 113, 113, 0.3)' },
  WARNING: { bg: 'rgba(251, 191, 36, 0.15)',  text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
  INFO:    { bg: 'rgba(56, 189, 248, 0.12)',  text: '#38bdf8', border: 'rgba(56, 189, 248, 0.25)' },
  DEBUG:   { bg: 'rgba(148, 163, 184, 0.10)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' },
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Load existing logs on mount
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await bridge.call('get_recent_logs', 500);
      const parsed = typeof res === 'string' ? JSON.parse(res) : (res || []);
      if (Array.isArray(parsed)) {
        setLogs(parsed);
      }
    } catch (e) {
      console.debug('Failed to fetch recent logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Listen for live real-time logs from Python
    const handleLog = (json) => {
      try {
        const item = typeof json === 'string' ? JSON.parse(json) : json;
        if (item && item.message) {
          setLogs(prev => [...prev.slice(-800), item]);
        }
      } catch (err) {
        // Fallback for raw text log
        if (typeof json === 'string') {
          setLogs(prev => [...prev.slice(-800), {
            time: new Date().toLocaleTimeString(),
            level: 'INFO',
            name: 'system',
            message: json,
          }]);
        }
      }
    };

    const unsub = bridge.on('log_message', handleLog);
    return () => unsub?.();
  }, []);

  // Auto-scroll to bottom on new logs if enabled
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filtered logs
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return logs.filter(log => {
      const level = (log.level || 'INFO').toUpperCase();
      if (filterLevel !== 'ALL' && level !== filterLevel) {
        return false;
      }
      if (!s) return true;
      const msg = (log.message || '').toLowerCase();
      const name = (log.name || '').toLowerCase();
      const time = (log.time || '').toLowerCase();
      return msg.includes(s) || name.includes(s) || time.includes(s);
    });
  }, [logs, filterLevel, search]);

  const counts = useMemo(() => {
    let err = 0;
    let warn = 0;
    for (const l of logs) {
      const lvl = (l.level || '').toUpperCase();
      if (lvl === 'ERROR') err++;
      else if (lvl === 'WARNING') warn++;
    }
    return { err, warn, total: logs.length };
  }, [logs]);

  const handleClear = async () => {
    setLogs([]);
    try {
      await bridge.call('clear_logs');
    } catch {}
  };

  const handleCopy = () => {
    const text = filtered.map(l => `[${l.time || '—'}] [${(l.level || 'INFO').toUpperCase()}] [${l.name || 'sff'}] ${l.message}`).join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="logs-page">
      {/* Header */}
      <div className="logs-header">
        <div className="logs-title-area">
          <div className="logs-title-row">
            <FileText size={20} className="logs-header-icon" />
            <h2 className="logs-title">System & Operation Logs</h2>
            <span className="logs-live-badge">
              <span className="logs-live-dot" /> LIVE STREAM
            </span>
          </div>
          <p className="logs-subtitle">
            Real-time diagnostic stream for downloads, manifests, Lua patches, and Steam services
          </p>
        </div>

        {/* Quick Stats */}
        <div className="logs-stats">
          <span className="logs-stat-pill total">
            {counts.total} entries
          </span>
          {counts.warn > 0 && (
            <span className="logs-stat-pill warn">
              <AlertTriangle size={11} /> {counts.warn} warnings
            </span>
          )}
          {counts.err > 0 && (
            <span className="logs-stat-pill err">
              <AlertCircle size={11} /> {counts.err} errors
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="logs-toolbar">
        {/* Level Filters */}
        <div className="logs-filters">
          {['ALL', 'INFO', 'WARNING', 'ERROR', 'DEBUG'].map(lvl => (
            <button
              key={lvl}
              className={`logs-filter-btn ${filterLevel === lvl ? 'active' : ''}`}
              onClick={() => setFilterLevel(lvl)}
            >
              {lvl === 'ERROR' && <AlertCircle size={12} />}
              {lvl === 'WARNING' && <AlertTriangle size={12} />}
              {lvl === 'INFO' && <Info size={12} />}
              {lvl === 'DEBUG' && <Bug size={12} />}
              {lvl}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="logs-search-wrap">
          <Search size={13} className="logs-search-icon" />
          <input
            className="logs-search-input"
            placeholder="Search logs (e.g. depot, manifest, error)…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="logs-actions">
          <label className="logs-autoscroll-toggle" title="Automatically keep latest logs in view">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            <ArrowDownCircle size={13} />
            <span>Auto-scroll</span>
          </label>

          <button className="logs-action-btn" onClick={fetchLogs} title="Reload logs">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>

          <button className="logs-action-btn" onClick={handleCopy} title="Copy visible logs">
            {copied ? <Check size={13} style={{ color: 'var(--c-green)' }} /> : <Copy size={13} />}
          </button>

          <button className="logs-action-btn danger" onClick={handleClear} title="Clear logs">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Console Viewer */}
      <div className="logs-console-wrap" ref={scrollRef}>
        {filtered.length === 0 ? (
          <div className="logs-empty">
            <FileText size={32} style={{ opacity: 0.3 }} />
            <p>No log records match current filter</p>
          </div>
        ) : (
          <div className="logs-list">
            {filtered.map((log, i) => {
              const lvl = (log.level || 'INFO').toUpperCase();
              const style = LEVEL_COLORS[lvl] || LEVEL_COLORS.INFO;
              return (
                <div key={i} className={`logs-row level-${lvl.toLowerCase()}`}>
                  <span className="logs-col-time">{log.time || '—'}</span>
                  <span
                    className="logs-col-level"
                    style={{ background: style.bg, color: style.text, borderColor: style.border }}
                  >
                    {lvl}
                  </span>
                  <span className="logs-col-name">{log.name || 'sff'}</span>
                  <span className="logs-col-msg">{log.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
