import { useEffect, useState } from 'react';
import { Pause, Play, X, Download } from 'lucide-react';
import { bridge } from '../lib/bridge';
import './DownloadBar.css';

export default function DownloadBar() {
  const [state, setState] = useState({ items: [], paused: false });

  useEffect(() => {
    const apply = (raw) => {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data && Array.isArray(data.items)) setState(data);
      } catch { /* ignore */ }
    };
    const unsub = bridge.on('download_queue_state', apply);
    bridge.ready.then(() => {
      if (window.Bridge?.download_queue_get_state) {
        try {
          const snap = window.Bridge.download_queue_get_state();
          apply(snap);
        } catch { /* ignore */ }
      }
    });
    return unsub;
  }, []);

  const active = (state.items || []).filter(i => i.state === 'queued' || i.state === 'downloading');
  if (!active.length && !state.paused) return null;

  const current = active.find(i => i.state === 'downloading') || active[0];

  return (
    <div className="dl-bar">
      <Download size={14} />
      <div className="dl-bar-copy">
        <strong>{current?.name || 'Downloads'}</strong>
        <span>
          {state.paused ? 'Paused' : current?.state === 'downloading' ? 'Downloading' : 'Queued'}
          {active.length > 1 ? ` · ${active.length} in queue` : ''}
        </span>
      </div>
      <button
        type="button"
        title={state.paused ? 'Resume' : 'Pause'}
        onClick={() => {
          if (state.paused) window.Bridge?.download_queue_resume?.();
          else window.Bridge?.download_queue_pause?.();
        }}
      >
        {state.paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      {current?.id && (
        <button
          type="button"
          title="Remove"
          onClick={() => window.Bridge?.download_queue_remove?.(current.id)}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
