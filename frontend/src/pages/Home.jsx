import React, { useEffect, useRef, useState } from 'react';
import {
  Play, Flame, TrendingUp, Zap, BookOpen, ShieldAlert, Calendar, Sparkles, Download,
} from 'lucide-react';
import { gameNeedsDownload, installViaSteam } from '../lib/libraryActions';
import SteamImage, { SteamLogo, steamImageChain } from '../components/SteamImage';
import { useAppStore } from '../store/useAppStore';
import { useCrackDB } from '../hooks/useCrackDB';
import { FEATURED, RECENTLY_CRACKED } from '../data/homeFeatured';
import './Home.css';

const libImg = (id) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;

function preloadHero(appId) {
  const urls = steamImageChain(appId, { kind: 'hero' });
  if (!urls.length) return;
  const img = new Image();
  let i = 0;
  img.referrerPolicy = 'no-referrer';
  img.onload = () => {};
  img.onerror = () => {
    i += 1;
    if (urls[i]) img.src = urls[i];
  };
  img.src = urls[0];
}

function FeaturedHero({ names }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const setActiveGame = useAppStore((s) => s.setActiveGame);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const setHubBackPage = useAppStore((s) => s.setHubBackPage);
  const { db } = useCrackDB({ prefetch: true });

  const slides = FEATURED;
  const current = slides[idx];
  const appId = current.id;
  const crackEntry = db?.[appId];
  const gameName = names?.[appId] || current.name;

  useEffect(() => {
    slides.forEach((slide) => preloadHero(slide.id));
  }, [slides]);

  useEffect(() => {
    const next = slides[(idx + 1) % slides.length];
    if (next) preloadHero(next.id);
  }, [idx, slides]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, 8000);
    return () => clearInterval(timerRef.current);
  }, [slides.length]);

  const goTo = (next) => {
    setIdx((next + slides.length) % slides.length);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, 8000);
  };

  const open = () => {
    setActiveGame({
      app_id: appId,
      name: gameName,
      cover_url: libImg(appId),
      drm: crackEntry?.drm || 'Unknown',
      cracked: Boolean(crackEntry?.cracked),
    });
    setHubBackPage('home');
    setActivePage('game-hub');
  };

  const openGameCtx = useAppStore((s) => s.openGameCtx);

  return (
    <section
      className="home-hero"
      onClick={open}
      onContextMenu={(e) => openGameCtx(e, { app_id: appId, name: gameName, cover_url: libImg(appId) })}
    >
      <div className="home-hero-frame">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={`home-hero-slide ${i === idx ? 'is-current' : ''}`}
            aria-hidden={i !== idx}
          >
            <SteamImage
              appId={slide.id}
              alt={slide.name}
              kind="hero"
              className="home-hero-img"
            />
          </div>
        ))}
        <div className="home-hero-scrim" />
        <div className="home-hero-copy">
          <SteamLogo
            appId={appId}
            name={gameName}
            className="home-hero-logo"
            titleClassName="home-hero-title"
          />
          <div className="home-hero-pills">
            {crackEntry?.cracked ? (
              <span className="home-pill cracked">Recently cracked</span>
            ) : crackEntry?.drm ? (
              <span className="home-pill locked">{crackEntry.drm}</span>
            ) : (
              <span className="home-pill featured">Featured</span>
            )}
          </div>
          <button
            type="button"
            className="home-hero-cta"
            onClick={(e) => { e.stopPropagation(); open(); }}
          >
            Open Game Hub
          </button>
        </div>
        <button type="button" className="home-hero-nav left" onClick={(e) => { e.stopPropagation(); goTo(idx - 1); }} aria-label="Previous featured">
          ‹
        </button>
        <button type="button" className="home-hero-nav right" onClick={(e) => { e.stopPropagation(); goTo(idx + 1); }} aria-label="Next featured">
          ›
        </button>
        <div className="home-hero-dots" onClick={(e) => e.stopPropagation()}>
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              className={`home-hero-dot ${i === idx ? 'active' : ''}`}
              onClick={() => goTo(i)}
              title={slide.name}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Section({ title, icon: Icon, children, empty, variant = 'wide' }) {
  const hasItems = React.Children.count(children) > 0;
  if (!hasItems && !empty) return null;
  return (
    <section className="home-row">
      <div className="home-row-head">
        <div className="home-row-title">
          {Icon ? <Icon size={15} /> : null}
          <span>{title}</span>
        </div>
      </div>
      {hasItems ? (
        <div className={variant === 'cover' ? 'home-cover-grid' : 'home-wide-grid'}>
          {children}
        </div>
      ) : (
        <div className="home-row-empty">{empty}</div>
      )}
    </section>
  );
}

function WideCard({ game, onOpen, badge }) {
  const openGameCtx = useAppStore((s) => s.openGameCtx);
  return (
    <button
      type="button"
      className="home-wide-card"
      onClick={() => onOpen(game)}
      onContextMenu={(e) => openGameCtx(e, game)}
    >
      <SteamImage appId={game.app_id} src={game.image_url || game.thumb_url} alt={game.name} kind="wide" className="home-wide-img" />
      <span className="home-wide-shade" />
      {badge && <span className="home-wide-badge">{badge}</span>}
      <span className="home-wide-meta">
        <span className="home-wide-name">{game.name}</span>
        {game.meta && <span className="home-wide-sub">{game.meta}</span>}
      </span>
    </button>
  );
}

function CoverCard({ game, onOpen, playable, onPlay }) {
  const openGameCtx = useAppStore((s) => s.openGameCtx);
  const needsDl = playable && gameNeedsDownload(game);
  return (
    <div
      className="home-cover-card"
      role="button"
      tabIndex={0}
      title={game.name}
      onClick={() => onOpen(game)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(game); }}
      onContextMenu={(e) => openGameCtx(e, game)}
    >
      <SteamImage appId={game.app_id} src={game.cover_url} alt={game.name} kind="cover" />
      {playable && (
        <button
          type="button"
          className={`home-cover-play ${needsDl ? 'is-download' : ''}`}
          title={needsDl ? 'Download' : 'Play'}
          onClick={(e) => { e.stopPropagation(); onPlay?.(game); }}
        >
          {needsDl ? <Download size={14} /> : <Play size={14} fill="currentColor" />}
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const libraryGames = useAppStore((s) => s.games);
  const lumaCore = useAppStore((s) => s.lumaCore);
  const setActiveGame = useAppStore((s) => s.setActiveGame);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const setHubBackPage = useAppStore((s) => s.setHubBackPage);
  const { db } = useCrackDB({ prefetch: true });
  const [heroNames, setHeroNames] = useState({});
  const [homeFeed, setHomeFeed] = useState({
    top_sellers: [], most_played: [], new_releases: [], coming_soon: [], recommended: [],
  });

  const openGame = (g, back = 'home') => {
    const appId = String(g.app_id || g.appid || '');
    setActiveGame({
      ...g,
      app_id: appId,
      name: g.name || heroNames[appId] || `App ${appId}`,
      cover_url: g.cover_url || libImg(appId),
    });
    setHubBackPage(back);
    setActivePage('game-hub');
  };

  const playGame = (g) => {
    if (gameNeedsDownload(g)) {
      installViaSteam(g.app_id);
      return;
    }
    if (window.Bridge?.launch_game) window.Bridge.launch_game(String(g.app_id));
    else openGame(g, 'home');
  };

  useEffect(() => {
    const applyFeed = (data) => {
      if (!data) return;
      setHomeFeed(data);
      setHeroNames((prev) => ({ ...prev, ...(data.names || {}) }));
    };

    try {
      const raw = window.Bridge?.get_home_feed_cached?.();
      if (raw) applyFeed(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch { /* ignore */ }

    const handler = (jsonStr) => {
      try {
        const res = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (res.task === 'home_feed' && res.data) applyFeed(res.data);
      } catch { /* ignore */ }
    };
    const timer = setTimeout(() => {
      if (window.Bridge?.task_finished?.connect) window.Bridge.task_finished.connect(handler);
      window.Bridge?.get_home_feed?.();
    }, 80);
    return () => {
      clearTimeout(timer);
      try { window.Bridge?.task_finished?.disconnect(handler); } catch { /* ignore */ }
    };
  }, []);

  const named = (list) =>
    (list || [])
      .map((g) => {
        const appId = String(g.app_id || g.id || '');
        const name = g.name || heroNames[appId] || '';
        return { ...g, app_id: appId, name };
      })
      .filter((g) => g.app_id && g.name && !/^App\s+\d+$/i.test(g.name));

  const crackedFromDb = Object.entries(db || {})
    .filter(([id, rec]) => /^\d+$/.test(id) && rec?.cracked && rec?.name)
    .slice(0, 12)
    .map(([id, rec]) => ({ app_id: id, name: rec.name }));

  const crackedRail = crackedFromDb.length
    ? crackedFromDb
    : RECENTLY_CRACKED.map((g) => ({ app_id: g.id, name: g.name }));

  return (
    <div className="home-page">
      {(lumaCore?.missing || lumaCore?.update_available || lumaCore?.restart_needed) && (
        <div className={`home-luma-banner ${lumaCore.missing || lumaCore.update_available ? 'is-missing' : 'is-update'}`}>
          <ShieldAlert size={15} />
          <span>
            {lumaCore.missing
              ? 'LumaCore is not installed — Steam will not show unlocked games as owned.'
              : lumaCore.update_available
                ? `LumaCore is outdated (${lumaCore.installed || '?'} → ${lumaCore.latest}). Steam updated the client, not LumaCore — run Auto LC Setup.`
                : 'Steam updated. Kraken refreshed LumaCore hook patterns (not the LumaCore DLL). Restart Steam to reload them.'}
          </span>
          {lumaCore.restart_needed && (
            <button
              type="button"
              className="home-luma-restart"
              onClick={() => window.Bridge?.restart_steam?.()}
            >
              Restart Steam now
            </button>
          )}
          <button
            type="button"
            className="home-luma-setup"
            onClick={() => window.dispatchEvent(new Event('open_lumacore_modal'))}
          >
            Auto LC Setup
          </button>
        </div>
      )}
      <FeaturedHero names={heroNames} />

      <div className="home-stack">
        {(libraryGames || []).length > 0 && (
          <Section title="Jump back in" icon={BookOpen} variant="cover">
            {libraryGames.slice(0, 16).map((g) => (
              <CoverCard
                key={g.app_id}
                game={{ ...g, cover_url: g.cover_url || libImg(g.app_id) }}
                playable
                onOpen={(game) => openGame(game, 'library')}
                onPlay={playGame}
              />
            ))}
          </Section>
        )}

        <Section title="Recommended" icon={Sparkles} empty={(libraryGames || []).length ? 'Play a few games, then Kraken can pull Steam “more like this” titles.' : ''}>
          {named(homeFeed.recommended).map((g) => (
            <WideCard key={g.app_id} game={g} onOpen={openGame} />
          ))}
        </Section>

        <Section title="Bestsellers" icon={TrendingUp} empty="Steam bestsellers did not load.">
          {named(homeFeed.top_sellers).map((g) => (
            <WideCard key={g.app_id} game={g} onOpen={openGame} />
          ))}
        </Section>

        <Section title="Popular new releases" icon={Flame} empty="Steam new releases did not load.">
          {named(homeFeed.new_releases).map((g) => (
            <WideCard key={g.app_id} game={g} onOpen={openGame} />
          ))}
        </Section>

        <Section title="Popular upcoming" icon={Calendar} empty="Steam upcoming titles did not load.">
          {named(homeFeed.coming_soon).map((g) => (
            <WideCard key={g.app_id} game={g} onOpen={openGame} />
          ))}
        </Section>

        <Section title="Recently cracked" icon={Zap}>
          {crackedRail.map((g) => (
            <WideCard key={g.app_id} game={g} onOpen={openGame} badge="Cracked" />
          ))}
        </Section>
      </div>
    </div>
  );
}
