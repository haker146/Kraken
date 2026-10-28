import React from 'react';
import { ShieldAlert, Download } from 'lucide-react';
import './Settings.css';

export default function Tools() {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2>Tools</h2>
          <p>LumaCore setup lives here. Game-specific fixes are on Fix Game and Game Hub.</p>
        </div>
      </div>
      <div className="settings-grid">
        <div className="settings-card card-lumacore">
          <div className="card-icon card-icon-amber"><ShieldAlert size={20} /></div>
          <h3>LumaCore</h3>
          <p className="card-desc">Installs the Steam hook so Lua unlocks and DLC show as owned.</p>
          <div className="card-button-row">
            <button
              type="button"
              className="btn-open-lc-modal"
              onClick={() => window.dispatchEvent(new Event('open_lumacore_modal'))}
            >
              <Download size={14} />
              <span>Auto LC Setup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
