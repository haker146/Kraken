import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Download, Lock, Zap, Star } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import './GameCard.css';

const STATUS_CONFIG = {
  installed: { icon: '✓', label: 'Installed', color: 'green' },
  cracked:   { icon: '⚡', label: 'Cracked',  color: 'purple' },
  update:    { icon: '↑', label: 'Update',    color: 'yellow' },
  available: { icon: '↓', label: 'Download',  color: 'accent' },
};

const GameCard = memo(function GameCard({ game }) {
  const { setActiveGame, setActivePage } = useAppStore();

  const status = STATUS_CONFIG[game.status] || STATUS_CONFIG.available;

  const handleClick = () => {
    setActiveGame(game);
    setActivePage('game-hub');
  };

  return (
    <motion.div
      className="game-card"
      onClick={handleClick}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Cover Image */}
      <div className="game-card-cover">
        {game.cover_url ? (
          <img
            src={game.cover_url}
            alt={game.name}
            loading="lazy"
            className="game-card-img"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="game-card-placeholder">
            <span>{game.name?.charAt(0) || '?'}</span>
          </div>
        )}
        <div className="game-card-overlay" />
      </div>

      {/* Status Badge */}
      <span className={`game-card-badge badge-${status.color}`}>
        {status.icon} {status.label}
      </span>

      {/* Info */}
      <div className="game-card-info">
        <p className="game-card-name">{game.name}</p>
        {game.drm && (
          <p className="game-card-drm">
            <Lock size={10} strokeWidth={2} />
            {game.drm}
          </p>
        )}
      </div>
    </motion.div>
  );
});

export default GameCard;
