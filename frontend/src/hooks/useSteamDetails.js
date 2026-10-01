/**
 * language: JavaScript, file: useSteamDetails.js, runtime: Browser/Vite
 * Fetches game details (description, screenshots, genres, etc.) from Steam Store API.
 * Uses /steam-store proxy in dev (bypasses CORS), direct URL in production (QWebEngine has no CORS).
 */
import { useState, useEffect } from 'react';

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

import { bridge } from '../lib/bridge';

async function fetchDetails(appId) {
  try {
    // Call the backend bridge directly. It bypasses CORS and Steam's API limits.
    const resStr = await bridge.call('get_store_game_details', String(appId));
    if (!resStr) return null;
    const json = JSON.parse(resStr);
    return json?.[String(appId)]?.data ?? null;
  } catch (err) {
    console.error("Failed to fetch steam details:", err);
    throw err;
  }
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
