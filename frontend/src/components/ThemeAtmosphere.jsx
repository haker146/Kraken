import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getUiTheme, themeBackdropUrls } from '../lib/theme';
import './ThemeAtmosphere.css';

function Dots({ className, count }) {
  return Array.from({ length: count }, (_, i) => (
    <span
      key={i}
      className={className}
      style={{
        left: `${(8 + i * 5.3) % 97}%`,
        animationDuration: `${7 + (i % 8) * 1.15}s`,
        animationDelay: `${-(i * 0.7)}s`,
        width: `${3 + (i % 4)}px`,
        height: `${3 + (i % 4)}px`,
      }}
    />
  ));
}

function Backdrop({ appId }) {
  const urls = themeBackdropUrls(appId);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [appId]);
  if (!urls.length) return null;
  return (
    <div className="theme-fx-backdrop">
      <img
        src={urls[idx]}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => (i + 1 < urls.length ? i + 1 : i))}
      />
    </div>
  );
}

function KrakenScene() {
  return (
    <svg className="kraken-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <defs>
        <radialGradient id="k-glow" cx="38%" cy="82%" r="50%">
          <stop offset="0%" stopColor="#5b21b6" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="k-skin" x1="0.15" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="38%" stopColor="#4c1d95" />
          <stop offset="100%" stopColor="#1e0b3a" />
        </linearGradient>
        <linearGradient id="k-skin-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#1a0a32" />
        </linearGradient>
        <linearGradient id="k-sail" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#64748b" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="k-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <radialGradient id="k-eye" cx="42%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </radialGradient>
        <filter id="k-soft" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      <ellipse className="kraken-abyss" cx="720" cy="860" rx="680" ry="210" fill="url(#k-glow)" />
      <path className="kraken-foam" fill="rgba(125,211,252,0.16)" d="M520 640 C 640 610, 880 625, 1180 600 C 1240 630, 1100 655, 900 648 C 740 662, 580 668, 520 640 Z" />

      <g className="kraken-back-arms" fill="none" stroke="url(#k-skin-dark)" strokeLinecap="round" filter="url(#k-soft)">
        <path className="k-arm a1" strokeWidth="46" d="M430 700 C 240 640, 110 730, 40 860" />
        <path className="k-arm a2" strokeWidth="34" d="M480 740 C 300 820, 160 790, 70 700" />
        <path className="k-arm a3" strokeWidth="40" d="M620 730 C 820 860, 1120 880, 1420 760" />
      </g>

      <g className="kraken-ship">
        <g className="kraken-sails">
          <path d="M742 176 L 754 438" stroke="#94a3b8" strokeWidth="8" />
          <path d="M1008 208 L 1018 452" stroke="#94a3b8" strokeWidth="6" />
          <path d="M620 390 L 746 176" stroke="#64748b" strokeWidth="2" opacity="0.7" />
          <path d="M860 410 L 746 176" stroke="#64748b" strokeWidth="2" opacity="0.7" />
          <path d="M920 418 L 1012 208" stroke="#64748b" strokeWidth="2" opacity="0.5" />
          <path d="M1140 400 L 1012 208" stroke="#64748b" strokeWidth="2" opacity="0.5" />
          <path className="kraken-sail s1" fill="url(#k-sail)" d="M756 188 L 756 400 L 888 418 Z" />
          <path className="kraken-sail s2" fill="url(#k-sail)" d="M738 210 L 738 398 L 618 408 Z" opacity="0.88" />
          <path className="kraken-sail s3" fill="url(#k-sail)" d="M1020 222 L 1020 412 L 1148 422 Z" opacity="0.9" />
        </g>
        <path fill="#0f172a" d="M710 438 L 760 412 L 762 458 Z" />
        <path fill="url(#k-hull)" d="M560 438 C 680 492, 1120 508, 1290 428 L 1262 478 C 1100 548, 700 538, 548 482 Z" />
        <path fill="#38bdf8" opacity="0.28" d="M560 438 C 680 458, 1120 468, 1290 428 L 1280 444 C 1120 478, 700 470, 556 452 Z" />
        <circle className="kraken-lantern" cx="1276" cy="426" r="6" fill="#fbbf24" />
      </g>

      <g className="kraken-front-arms" fill="none" stroke="url(#k-skin)" strokeLinecap="round" strokeLinejoin="round">
        <path className="k-arm a4 crush" strokeWidth="42" d="M500 620 C 700 540, 880 500, 1020 430 C 1120 380, 1060 330, 1008 250" />
        <path className="k-arm a5" strokeWidth="36" d="M460 650 C 640 590, 900 600, 1140 530 C 1280 490, 1320 450, 1290 430" />
        <path className="k-arm a6 mast" strokeWidth="28" d="M430 640 C 540 480, 640 300, 746 176 C 780 120, 700 110, 690 168" />
        <path className="k-arm a7" strokeWidth="24" d="M560 690 C 780 650, 1040 610, 1220 520 C 1320 470, 1240 440, 1160 468" />
        <path className="k-arm a8" strokeWidth="22" d="M580 720 C 760 780, 980 720, 1180 620" />
      </g>
      <g className="kraken-suckers" fill="#38bdf8" opacity="0.45">
        <circle cx="780" cy="500" r="5" /><circle cx="860" cy="470" r="6" /><circle cx="940" cy="438" r="5" />
        <circle cx="700" cy="360" r="4" /><circle cx="660" cy="290" r="4" /><circle cx="720" cy="210" r="4" />
        <circle cx="980" cy="560" r="5" /><circle cx="1080" cy="510" r="5" /><circle cx="1188" cy="478" r="4" />
      </g>

      <g className="kraken-body">
        <path fill="url(#k-skin)" d="M250 760 C 220 600, 300 470, 470 450 C 650 430, 740 520, 760 640 C 780 760, 700 840, 520 860 C 340 880, 270 840, 250 760 Z" />
        <path fill="#2e1065" opacity="0.45" d="M310 620 C 360 520, 470 490, 560 520 C 520 580, 430 610, 310 620 Z" />
        <path fill="#1e0b3a" d="M390 500 C 430 470, 490 468, 530 492 C 500 478, 440 478, 390 500 Z" />
        <g className="kraken-eye left">
          <ellipse cx="400" cy="590" rx="34" ry="28" fill="#041018" />
          <ellipse cx="404" cy="588" rx="16" ry="18" fill="url(#k-eye)" />
          <ellipse cx="404" cy="588" rx="5" ry="16" fill="#020617" />
          <circle cx="410" cy="578" r="4" fill="#e0f2fe" />
        </g>
        <g className="kraken-eye right wink">
          <ellipse cx="530" cy="575" rx="36" ry="30" fill="#041018" />
          <ellipse cx="534" cy="573" rx="17" ry="19" fill="url(#k-eye)" />
          <ellipse cx="534" cy="573" rx="5" ry="17" fill="#020617" />
          <circle cx="541" cy="562" r="4.5" fill="#e0f2fe" />
        </g>
        <path className="kraken-brow" fill="#12081f" d="M360 548 C 400 528, 450 534, 478 552 C 452 538, 404 534, 360 548 Z" />
        <path fill="#0f0320" d="M430 655 C 458 678, 508 676, 540 650 C 512 700, 458 704, 430 655 Z" />
        <path className="kraken-grin" fill="none" stroke="#f472b6" strokeWidth="4" strokeLinecap="round" d="M438 668 C 470 692, 512 690, 536 662" />
        <path className="kraken-beak" fill="#1e293b" d="M476 658 L 492 688 L 508 658 Z" />
        <path className="kraken-tongue" fill="#db2777" d="M486 678 C 492 694, 504 694, 508 680 C 500 688, 492 688, 486 678 Z" />
      </g>
    </svg>
  );
}

export default function ThemeAtmosphere() {
  const uiTheme = useAppStore((s) => s.uiTheme);
  const [id, setId] = useState(
    () => document.documentElement.getAttribute('data-theme') || uiTheme || 'default',
  );

  useEffect(() => {
    const sync = () => {
      setId(document.documentElement.getAttribute('data-theme') || uiTheme || 'default');
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [uiTheme]);

  const theme = getUiTheme(id);
  const fx = new Set(theme.fx || []);

  return (
    <div className={`theme-fx theme-fx-${theme.id}`} aria-hidden="true">
      {theme.appId ? <Backdrop appId={theme.appId} /> : null}
      <div className="theme-fx-wash" />
      {fx.has('mist') ? <div className="theme-mist" /> : null}
      {fx.has('caustics') ? <div className="theme-caustics" /> : null}
      {fx.has('godrays') ? <div className="theme-godrays" /> : null}
      {fx.has('kraken') ? <KrakenScene /> : null}
      {fx.has('embers') ? (
        <div className="theme-particles"><Dots className="theme-ember" count={18} /></div>
      ) : null}
      {fx.has('bubbles') ? (
        <div className="theme-particles"><Dots className="theme-bubble" count={16} /></div>
      ) : null}
      {fx.has('dust') ? (
        <div className="theme-particles"><Dots className="theme-dust" count={16} /></div>
      ) : null}
      {fx.has('rain') ? (
        <div className="theme-rain"><Dots className="theme-drop" count={22} /></div>
      ) : null}
      {fx.has('scanlines') ? <div className="theme-scanlines" /> : null}
      {fx.has('grain') ? <div className="theme-grain" /> : null}
    </div>
  );
}
