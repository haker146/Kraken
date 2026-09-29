/**
 * language: JavaScript, file: useCrackDB.js, runtime: Browser/Vite
 * Hook that fetches and caches the crack database from GitHub.
 * Falls back to bundled crack_db.json when offline.
 */
import { useState, useEffect } from 'react';

const DB_URL = 'https://raw.githubusercontent.com/haker146/Kraken/Konungs-skuggsj%C3%A1/crack_db.json';
const CACHE_KEY = 'kraken_crack_db';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function fetchCrackDB() {
  try {
    const res = await fetch(DB_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch {
    // Try cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      return data;
    }
    return null;
  }
}

export function useCrackDB() {
  const [db, setDb] = useState(() => {
    // Load from cache immediately for instant UI
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
    return null;
  });

  useEffect(() => {
    // Always refresh in background
    fetchCrackDB().then(setDb);
  }, []);

  const lookupGame = (appId) => db?.[String(appId)] ?? null;

  return { db, lookupGame };
}
