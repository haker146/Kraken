import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Zap, ToggleLeft, ToggleRight,
  ArrowLeft, ExternalLink, Shield, Play
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import CrackPanel from '../components/CrackPanel';
import './GameHub.css';

export default function GameHub() {
  const { activeGame, setActivePage } = useAppStore();
  const { lookupGame } = useCrackDB();
  const videoRef = useRef(null);

  if (!activeGame) return null;

  const game = activeGame;
  const trailer = game.trailers?.[0];
  const crackInfo = lookupGame(game.app_id);

  return (
    <motion.div
      className="game-hub"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Hero Section */}
      <div className="hub-hero">
        {/* Background Art */}
        <div
          className="hub-hero-bg"
          style={{ backgroundImage: `url(${game.hero_url || game.cover_url})` }}
        />

        {/* Video Trailer */}
        {trailer && (
          <video
            ref={videoRef}
            src={trailer}
            autoPlay
            loop
            muted
            playsInline
            className="hub-hero-video"
          />
        )}

        <div className="hub-hero-gradient" />

        {/* Hero Content */}
        <div className="hub-hero-content">
          <button className="hub-back-btn" onClick={() => setActivePage('store')}>
            <ArrowLeft size={14} /> Back
          </button>

          {game.logo_url && (
            <img src={game.logo_url} alt={game.name} className="hub-game-logo" />
          )}

          {!game.logo_url && (
            <h1 className="hub-game-title">{game.name}</h1>
          )}

          {/* Status Badges */}
          <div className="hub-badges">
            {game.cracked && (
              <span className="hub-badge badge-purple">⚡ Cracked</span>
            )}
            {game.installed && (
              <span className="hub-badge badge-green">✓ Installed</span>
            )}
            {game.drm && (
              <span className="hub-badge badge-muted">
                <Shield size={10} /> {game.drm}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="hub-body">
        {/* Action Panel */}
        <div className="hub-panel hub-actions-panel">
          <button className="hub-btn-primary">
            <Download size={16} /> Download Game
          </button>
          <button className="hub-btn-secondary">
            <Zap size={16} /> Apply Crack
          </button>

          <div className="hub-divider" />

          <HubToggle label="Steam Auto-Update" defaultChecked={!game.update_disabled} />
          <HubToggle label="Install SmokeAPI DLC" />
          <HubToggle label="Apply GSE Emulator" />

          {/* Crack Intelligence Panel */}
          {crackInfo && (
            <>
              <div className="hub-divider" />
              <CrackPanel
                crackInfo={crackInfo}
                game={game}
                currentBuild={game.current_build}
              />
            </>
          )}
        </div>

        {/* Info Panel */}
        <div className="hub-panel hub-info-panel">
          <h3 className="hub-panel-title">About</h3>
          <p className="hub-description">{game.description || 'No description available.'}</p>

          {game.screenshots?.length > 0 && (
            <>
              <h3 className="hub-panel-title" style={{ marginTop: 24 }}>Screenshots</h3>
              <div className="hub-screenshots">
                {game.screenshots.slice(0, 4).map((s, i) => (
                  <img key={i} src={s} alt="" className="hub-screenshot" />
                ))}
              </div>
            </>
          )}
        </div>

        {/* DLC Panel */}
        <div className="hub-panel hub-dlc-panel">
          <h3 className="hub-panel-title">DLC Manager</h3>
          {game.dlc?.length > 0 ? (
            <ul className="hub-dlc-list">
              {game.dlc.map(d => (
                <li key={d.appid} className="hub-dlc-item">
                  <span className="hub-dlc-name">{d.name}</span>
                  <HubToggle compact />
                </li>
              ))}
            </ul>
          ) : (
            <p className="hub-empty-msg">No DLC found for this game.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function HubToggle({ label, defaultChecked = false, compact = false }) {
  const [on, setOn] = React.useState(defaultChecked);
  return (
    <button
      className={`hub-toggle ${on ? 'on' : ''} ${compact ? 'compact' : ''}`}
      onClick={() => setOn(!on)}
    >
      {!compact && <span className="hub-toggle-label">{label}</span>}
      <div className="hub-toggle-track">
        <div className="hub-toggle-thumb" />
      </div>
    </button>
  );
}
