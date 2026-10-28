// language: JavaScript (React), file: DevConsole.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Terminal, X, RefreshCw, HelpCircle, Shield, Trash2, Key } from 'lucide-react';
import { bridge } from '../lib/bridge';
import './DevConsole.css';

export default function DevConsole({ isOpen, onClose }) {
  const [history, setHistory] = useState([
    { type: 'info', text: 'KRAKEN OPERATOR SYSTEM v2.6 // SECURE CHANNEL INITIALIZED' },
    { type: 'info', text: "Type 'help' to view operator commands or use the quick buttons above." },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [cookieBoxOpen, setCookieBoxOpen] = useState(false);
  const [cookieInput, setCookieInput] = useState('');

  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [history]);

  if (!isOpen) return null;

  const handleCommand = async (commandStr) => {
    const trimmed = (commandStr || inputVal).trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === 'clear') {
      setHistory([]);
      setInputVal('');
      return;
    }

    setHistory(prev => [...prev, { type: 'command', text: `riot@kraken:~$ ${trimmed}` }]);
    setCmdHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInputVal('');
    setLoading(true);

    try {
      const payload = await bridge.invokeAsync(
        'dev_console_exec',
        [trimmed],
        'dev_console',
        null,
        180000,
      );
      const status = payload?.status || (payload?.success ? 'ok' : 'error');
      const output = payload?.output || payload?.message || '(Brak odpowiedzi)';
      setHistory(prev => [...prev, { type: status, text: output }]);
    } catch (err) {
      setHistory(prev => [...prev, { type: 'error', text: `Błąd komunikacji z backendem: ${err}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx < cmdHistory.length) {
        setHistoryIndex(nextIdx);
        setInputVal(cmdHistory[cmdHistory.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(cmdHistory[cmdHistory.length - 1 - nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSaveCookie = () => {
    if (!cookieInput.trim()) return;
    handleCommand(`cookie ${cookieInput.trim()}`);
    setCookieInput('');
    setCookieBoxOpen(false);
  };

  return (
    <div className="dev-console-backdrop" onClick={onClose}>
      <div className="dev-console-window" onClick={e => e.stopPropagation()}>
        <div className="dev-console-header">
          <div className="dev-console-title">
            <span className="dev-console-dot" />
            <Terminal size={15} />
            <span>KRAKEN // OPERATOR CONSOLE</span>
          </div>
          <div className="dev-console-toolbar">
            <button className="dev-btn" onClick={() => handleCommand('status')} title="Sprawdź stan połączenia i bazy">
              <Shield size={12} style={{ display: 'inline', marginRight: 4 }} /> Status
            </button>
            <button className="dev-btn" onClick={() => setCookieBoxOpen(!cookieBoxOpen)} title="Zaktualizuj ciasteczka cs.rin.ru">
              <Key size={12} style={{ display: 'inline', marginRight: 4 }} /> Set Cookie
            </button>
            <button className="dev-btn" onClick={() => handleCommand('help')} title="Pomoc i lista poleceń">
              <HelpCircle size={12} style={{ display: 'inline', marginRight: 4 }} /> Help
            </button>
            <button className="dev-btn" onClick={() => setHistory([])} title="Wyczyść ekran">
              <Trash2 size={12} style={{ display: 'inline', marginRight: 4 }} /> Clear
            </button>
            <button className="dev-btn-close" onClick={onClose} title="Zamknij (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {cookieBoxOpen && (
          <div className="dev-cookie-dialog">
            <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>Wklej ciasteczka z przeglądarki (Cookie header):</span>
            <textarea
              placeholder="np. csrinru_phpbb3_u=...; csrinru_phpbb3_sid=...; securitytoken=...;"
              value={cookieInput}
              onChange={e => setCookieInput(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="dev-btn" onClick={() => setCookieBoxOpen(false)}>Anuluj</button>
              <button className="dev-btn" style={{ background: '#0284c7', color: '#fff', borderColor: '#38bdf8' }} onClick={handleSaveCookie}>
                Zapisz ciasteczka
              </button>
            </div>
          </div>
        )}

        <div className="dev-console-body" ref={bodyRef}>
          {history.map((line, idx) => (
            <div key={idx} className={`dev-console-line ${line.type}`}>
              {line.text}
            </div>
          ))}
          {loading && (
            <div className="dev-console-line warning" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} className="spin" />
              <span>Wykonywanie polecenia...</span>
            </div>
          )}
        </div>

        <div className="dev-console-input-row">
          <span className="dev-prompt">riot@kraken:~$</span>
          <input
            ref={inputRef}
            className="dev-input"
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="np. update Dead Island 2   lub   check Dragon Quest"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
