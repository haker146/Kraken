import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useAppStore } from '../store/useAppStore';
import './ProviderKeyDialog.css';

const FALLBACK_PAGES = {
  Hubcap: 'https://hubcap.pages.dev',
  Ryuu: 'https://generator.ryuu.lol',
  DepotBox: 'https://depotbox.org',
};

export default function ProviderKeyDialog() {
  const setActivePage = useAppStore(s => s.setActivePage);
  const [invalid, setInvalid] = useState([]);
  const [fallback, setFallback] = useState('free providers');
  const [pages, setPages] = useState({});

  useEffect(() => {
    const unsub = bridge.on('task_finished', (raw) => {
      try {
        const evt = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (evt.task !== 'provider_keys') return;
        const list = evt.invalid || [];
        if (list.length) {
          setInvalid(list);
          setFallback(evt.fallback || 'free providers');
          setPages(evt.pages || {});
        }
      } catch { /* ignore */ }
    });
    return unsub;
  }, []);

  if (!invalid.length) return null;

  const removeKey = (name) => {
    try { window.Bridge?.remove_provider_key?.(name); } catch { /* ignore */ }
    setInvalid((prev) => prev.filter((n) => n !== name));
  };

  return (
    <div className="pk-overlay" onClick={() => setInvalid([])}>
      <div className="pk-card" onClick={e => e.stopPropagation()}>
        <div className="pk-icon"><AlertTriangle size={18} /></div>
        <h3>API key expired</h3>
        <p>
          {invalid.join(', ')} failed. Empty downloads are treated as failures.
          Kraken will keep using {fallback} instead of asking you to paste a key in a loop.
        </p>
        <div className="pk-keys">
          {invalid.map((name) => (
            <div key={name} className="pk-key-row">
              <strong>{name}</strong>
              <a
                href={pages[name] || FALLBACK_PAGES[name] || '#'}
                onClick={(e) => {
                  e.preventDefault();
                  const url = pages[name] || FALLBACK_PAGES[name];
                  if (url && window.Bridge?.open_url) window.Bridge.open_url(url);
                }}
              >
                Provider page
              </a>
              <button type="button" className="pk-remove" onClick={() => removeKey(name)}>
                Remove Key
              </button>
            </div>
          ))}
        </div>
        <div className="pk-actions">
          <button type="button" className="pk-ghost" onClick={() => setInvalid([])}>Dismiss</button>
          <button
            type="button"
            className="pk-go"
            onClick={() => { setInvalid([]); setActivePage('settings'); }}
          >
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}
