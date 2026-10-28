import React, { useState } from 'react';
import { Wrench, Shield, Unlock, Download } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useAppStore } from '../store/useAppStore';
import './Settings.css';

export default function FixGame() {
  const games = useAppStore(s => s.games);
  const [appId, setAppId] = useState(games[0]?.app_id || '');
  const selected = games.find(g => String(g.app_id) === String(appId));

  const run = (action) => {
    if (!appId) return;
    bridge.call('run_game_action', String(appId), action);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2>Fix Game</h2>
          <p>Unpack SteamStub, apply Goldberg / SteamAutoCrack, or install a catalog crack. Prefer the recipe on Game Hub for a per-game checklist.</p>
        </div>
      </div>
      <div className="settings-grid">
        <div className="settings-card">
          <div className="card-icon"><Wrench size={20} /></div>
          <h3>Installed game</h3>
          {games.length === 0 ? (
            <p className="card-desc">Open Library once so the list can load, or type an App ID.</p>
          ) : (
            <div className="settings-field">
              <label>Game</label>
              <select value={appId} onChange={e => setAppId(e.target.value)}>
                {games.map(g => (
                  <option key={g.app_id} value={g.app_id}>{g.name} ({g.app_id})</option>
                ))}
              </select>
            </div>
          )}
          <div className="settings-field">
            <label>App ID</label>
            <input value={appId} onChange={e => setAppId(e.target.value)} placeholder="730" />
          </div>
          <div className="card-button-row">
            <button type="button" className="btn-open-lc-modal" onClick={() => run('steam_auto')}>
              <Shield size={14} /> SteamAutoCrack
            </button>
            <button type="button" className="btn-check-lc" onClick={() => run('steamstub')}>
              <Unlock size={14} /> SteamStub
            </button>
            <button type="button" className="btn-check-lc" onClick={() => bridge.call('apply_game_crack', String(appId), selected?.name || '')}>
              <Download size={14} /> Download catalog crack
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
