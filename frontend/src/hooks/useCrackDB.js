/**
 * language: JavaScript, file: useCrackDB.js, runtime: Browser/Vite
 * Hook that fetches and caches the crack database from GitHub.
 * Falls back to bundled crack_db.json when offline.
 */
import { useState, useEffect } from 'react';
import BUNDLED_CRACK_DB from '../data/crack_db.json';

const DB_URL = 'https://raw.githubusercontent.com/haker146/Kraken/Konungs-skuggsj%C3%A1/crack_db.json';
const CACHE_KEY = 'kraken_crack_db';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function fetchCrackDB() {
  // Try bundled / local /crack_db.json first
  try {
    const localRes = await fetch('./crack_db.json', { cache: 'no-store' });
    if (localRes.ok) {
      const data = await localRes.json();
      const merged = { ...BUNDLED_CRACK_DB, ...data };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: merged }));
      return merged;
    }
  } catch {}

  // Fallback to GitHub raw
  try {
    const res = await fetch(DB_URL, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const merged = { ...BUNDLED_CRACK_DB, ...data };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: merged }));
      return merged;
    }
  } catch {}

  // Try cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      if (data) return { ...BUNDLED_CRACK_DB, ...data };
    }
  } catch {}

  return BUNDLED_CRACK_DB;
}

export function useCrackDB() {
  const [db, setDb] = useState(() => {
    // Load from cache or bundled json immediately
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && data) return { ...BUNDLED_CRACK_DB, ...data };
      }
    } catch {}
    return BUNDLED_CRACK_DB;
  });

  useEffect(() => {
    // Refresh in background if network allows
    fetchCrackDB().then(data => {
      if (data) setDb(data);
    });
  }, []);

  const lookupGame = (appId) => {
    if (!appId) return null;
    const activeDb = db || BUNDLED_CRACK_DB;
    const entry = activeDb?.[String(appId)];
    if (entry) return entry;

    // Games not present in isitcracked.com do not have 3rd-party DRM (no Denuvo)
    // They use standard Steam DRM and run with built-in Steam emulator
    return {
      name: null,
      drm: 'Steam DRM',
      drm_version: null,
      cracked: true,
      crack_version: null,
      crack_source: 'Steam Emulator / Goldberg',
      crack_date: null,
      crack_url: null,
      required_build: null,
      notes: 'Standardowe zabezpieczenie Steam DRM. Brak Denuvo — pełne wsparcie przez wbudowany emulator Steam.',
      is_standard_steam: true,
    };
  };

  return { db, lookupGame };
}
