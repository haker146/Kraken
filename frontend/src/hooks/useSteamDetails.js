/**
 * language: JavaScript, file: useSteamDetails.js, runtime: Browser/Vite
 * Fetches game details (description, screenshots, genres, etc.) from Steam Store API.
 * Uses /steam-store proxy in dev (bypasses CORS), direct URL in production (QWebEngine has no CORS).
 */
import { useState, useEffect } from 'react';

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function apiBase() {
  // In dev Vite proxies /steam-store → store.steampowered.com
  // In production QWebEngine fetches directly (no CORS)
  return import.meta.env.DEV ? '/steam-store' : 'https://store.steampowered.com';
}

async function fetchDetails(appId) {
  const url = `${apiBase()}/api/appdetails?appids=${appId}&l=english`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json?.[String(appId)]?.data ?? null;
}

export function useSteamDetails(appId) {
  const key = String(appId);
  const [data,    setData]    = useState(() => CACHE.get(key)?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!appId) return;

    // Hit in-memory cache
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    fetchDetails(appId)
      .then(d => {
        CACHE.set(key, { data: d, ts: Date.now() });
        setData(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [appId]);

  return { data, loading, error };
}
