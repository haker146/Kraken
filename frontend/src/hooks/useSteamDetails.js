/**
 * language: JavaScript, file: useSteamDetails.js, runtime: Browser/QWebEngine
 * Fetches game details (description, screenshots, genres, trailers, etc.)
 * via the Python bridge's get_store_game_details slot.
 *
 * The slot is async — it fires task_finished with task="game_details".
 * A partial payload (task="game_details", partial=true) with just the name
 * and header image arrives first, then the full payload follows.
 */
import { useState, useEffect, useRef } from 'react';
import { bridge } from '../lib/bridge';

const CACHE     = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

export function useSteamDetails(appId) {
  const key = String(appId ?? '');
  const [data,    setData]    = useState(() => CACHE.get(key)?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (!appId) return;

    // Cache hit — serve immediately
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);
    let cancelled = false;
    pendingRef.current = key;

    // Dev/Electron: use HTTP fetch mode
    const isDev      = import.meta.env.DEV;
    const isElectron = typeof window !== 'undefined' && typeof window.KrakenAPI !== 'undefined';

    if (isDev || isElectron) {
      bridge.call('get_store_game_details', String(appId))
        .then(resStr => {
          if (cancelled || pendingRef.current !== key) return;
          const json = typeof resStr === 'string' ? JSON.parse(resStr) : resStr;
          const detail = json?.[String(appId)]?.data ?? json ?? null;
          CACHE.set(key, { data: detail, ts: Date.now() });
          setData(detail);
        })
        .catch(e => { if (!cancelled) setError(String(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }

    // QWebEngine production mode:
    // 1. Call the async slot (fire-and-forget).
    // 2. Listen on task_finished for task="game_details" + matching app_id.
    const handler = (raw) => {
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (payload.task !== 'game_details') return;
        if (String(payload.app_id) !== String(appId)) return;
        if (cancelled || pendingRef.current !== key) return;

        if (payload.partial) {
          // First partial response — only name + header available
          if (!data) {
            setData({
              name: payload.name,
              header_image: payload.header_image,
              screenshots: [],
            });
          }
          return;
        }

        // Full payload inside payload.data
        const detail = payload.data ?? payload;
        CACHE.set(key, { data: detail, ts: Date.now() });
        setData(detail);
        setLoading(false);
        bridge.off('task_finished', handler);
      } catch (e) {
        console.error('[useSteamDetails] parse error:', e);
      }
    };

    bridge.on('task_finished', handler);

    // Fire the async slot after bridge is ready
    bridge.ready.then(() => {
      if (!cancelled) {
        bridge.call('get_store_game_details', String(appId));
      }
    });

    // Timeout fallback
    const timer = setTimeout(() => {
      if (!cancelled) {
        bridge.off('task_finished', handler);
        setLoading(false);
        if (!data) setError('Timeout fetching game details.');
      }
    }, 20000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      bridge.off('task_finished', handler);
    };
  }, [appId]);

  return { data, loading, error };
}
