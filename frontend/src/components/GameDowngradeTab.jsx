import React, { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { bridge } from '../lib/bridge';

export default function GameDowngradeTab({
  appId,
  gameName,
  currentBuild,
  latestBuild,
  crackBuild,
  prefillBuild,
}) {
  const [buildId, setBuildId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setBuildId(String(prefillBuild || crackBuild || '').trim());
    setBusy(false);
    setProgress(0);
    setStatus('');
    setError('');
    setDone(false);
  }, [appId, prefillBuild, crackBuild]);

  useEffect(() => {
    const unsubProg = bridge.on('download_progress', (raw) => {
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (String(payload.app_id) !== String(appId)) return;
        if (payload.progress != null) setProgress(Number(payload.progress) || 0);
        if (payload.status) setStatus(payload.status);
        if (payload.error) setError(payload.status || 'Downgrade failed.');
      } catch { /* ignore */ }
    });
    const unsubTask = bridge.on('task_finished', (raw) => {
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (payload.task !== 'download_older_auto') return;
        if (String(payload.app_id) !== String(appId)) return;
        setBusy(false);
        if (payload.success) {
          setDone(true);
          setError('');
          setProgress(100);
          setStatus(payload.message || 'Build pinned.');
        } else {
          setError(payload.message || 'Downgrade failed.');
        }
      } catch { /* ignore */ }
    });
    return () => {
      unsubProg?.();
      unsubTask?.();
    };
  }, [appId]);

  const run = () => {
    const bid = String(buildId || '').trim();
    if (!appId || !/^\d+$/.test(bid)) return;
    setBusy(true);
    setDone(false);
    setError('');
    setProgress(8);
    setStatus(`Pinning build ${bid}…`);
    bridge.call('download_older_version_auto', String(appId), bid);
  };

  const chips = [
    crackBuild && { id: 'crack', label: `Crack build ${crackBuild}`, value: String(crackBuild) },
    currentBuild && { id: 'installed', label: `Installed ${currentBuild}`, value: String(currentBuild) },
    latestBuild && { id: 'latest', label: `Latest ${latestBuild}`, value: String(latestBuild) },
  ].filter(Boolean);

  return (
    <div className="gh-downgrade-tab">
      <div className="gh-dg-intro">
        <RotateCcw size={15} />
        <div>
          <strong>Pin an older Steam build</strong>
          <p>This applies to {gameName || 'this game'} only. Enter a Build ID, then Kraken pins the matching depot manifests.</p>
        </div>
      </div>

      <div className="gh-dg-meta">
        <div className="gh-dg-stat">
          <span>Installed</span>
          <code>{currentBuild || '—'}</code>
        </div>
        <div className="gh-dg-stat">
          <span>Latest public</span>
          <code>{latestBuild || '—'}</code>
        </div>
        <div className="gh-dg-stat">
          <span>Catalog / crack</span>
          <code>{crackBuild || '—'}</code>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="gh-dg-chips">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`gh-dg-chip ${String(buildId) === chip.value ? 'active' : ''}`}
              onClick={() => setBuildId(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <label className="gh-dg-field">
        <span>Build ID</span>
        <input
          value={buildId}
          onChange={(e) => setBuildId(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="10461750"
          inputMode="numeric"
        />
      </label>

      <button
        type="button"
        className="gh-dg-run"
        onClick={run}
        disabled={busy || !/^\d+$/.test(String(buildId).trim())}
      >
        {busy
          ? <><RefreshCw size={14} className="spin" /> {status || 'Working…'}</>
          : <><RotateCcw size={14} /> Download this build</>}
      </button>

      {busy && (
        <div className="gh-dg-progress">
          <div className="gh-dg-progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}

      {error && (
        <div className="gh-dg-note error">
          <AlertTriangle size={13} />
          <span>{error}</span>
        </div>
      )}
      {done && !error && (
        <div className="gh-dg-note ok">
          <CheckCircle size={13} />
          <span>{status || 'Older build pinned. Steam will use this TargetBuildID.'}</span>
        </div>
      )}
    </div>
  );
}
