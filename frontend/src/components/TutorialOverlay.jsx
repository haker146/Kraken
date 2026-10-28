import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { bridge } from '../lib/bridge';
import './TutorialOverlay.css';

const STEPS = [
  {
    title: 'LumaCore hooks Steam',
    body: 'Kraken writes Lua into Steam/config/stplug-in and LumaCore (xinput1_4.dll) makes those games look owned. Install it from Home or Settings before the first unlock.',
    page: 'home',
  },
  {
    title: 'Store search: name or AppID',
    body: 'Type a title, or paste a plain AppID (even hidden components like 476620). If the catalog is empty, Kraken falls back to a one-shot Steam search.',
    page: 'store',
  },
  {
    title: 'Download sources and keys',
    body: 'Hubcap / Ryuu / DepotBox need a key in Settings. A dead key is not a successful download — Kraken fails the job and offers Remove Key, then uses free providers.',
    page: 'settings',
  },
  {
    title: 'Pause and speed limit',
    body: 'The download bar pauses between CDN chunks and keeps the real percent after restart. Cap native speed in Settings (KB/s, 0 = unlimited).',
    page: 'library',
    demo: 'Demo: “Kraken Sample” — injected Lua, files not on disk → Download, not Play.',
  },
  {
    title: 'Library: Play vs Download',
    body: 'Installed games show Play. Lua-only / manifest-only titles show Download and open Steam’s install dialog. Open this tour again from Settings anytime.',
    page: 'library',
  },
];

export default function TutorialOverlay() {
  const setActivePage = useAppStore((s) => s.setActivePage);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const start = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('kraken_start_tutorial', start);
    bridge.ready.then(async () => {
      try {
        const seen = await bridge.call('get_setting', 'tutorial_seen');
        const flag = String(seen || '').toLowerCase();
        if (!flag || flag === 'false' || flag === '0' || flag === 'none') start();
      } catch {
        if (!localStorage.getItem('kraken_tutorial_seen')) start();
      }
    });
    return () => window.removeEventListener('kraken_start_tutorial', start);
  }, []);

  const finish = (persist) => {
    setOpen(false);
    localStorage.setItem('kraken_tutorial_seen', '1');
    if (persist) {
      try { window.Bridge?.set_setting?.('tutorial_seen', 'true'); } catch { /* ignore */ }
    }
  };

  if (!open) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="tut-overlay">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="tut-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <div className="tut-kicker">Step {step + 1} / {STEPS.length}</div>
          <h3>{current.title}</h3>
          <p>{current.body}</p>
          {current.demo && <div className="tut-demo">{current.demo}</div>}
          <div className="tut-dots">
            {STEPS.map((_, i) => <span key={i} className={i === step ? 'is-on' : ''} />)}
          </div>
          <div className="tut-actions">
            <button type="button" className="tut-ghost" onClick={() => finish(true)}>Skip</button>
            <button
              type="button"
              className="tut-next"
              onClick={() => {
                if (current.page) setActivePage(current.page);
                if (last) finish(true);
                else setStep((s) => s + 1);
              }}
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
