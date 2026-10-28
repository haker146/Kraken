/**
 * language: JavaScript, file: useCrackDB.js, runtime: Browser/Vite
 * Indexes crackfiles.json the same way SteamIDRA does: name, appid,
 * buildid, source_crack, original_download, fixes[].href.
 * Bundled crack_db.json only fills DRM/scene labels when the catalog
 * has no appid for a title.
 */
import { useState, useEffect } from 'react';
import BUNDLED_CRACK_DB from '../data/crack_db.json';

const KRAKEN_CRACKFILES_URLS = [
  'https://github.com/haker146/Kraken/releases/download/ship-hold/crackfiles.json',
  'https://raw.githubusercontent.com/haker146/Kraken/Ship-hold/crackfiles.json',
];
const CACHE_KEY = 'kraken_crackfiles_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000;

let _memory = null;
let _inflight = null;

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.games)) return data.games;
  if (data && Array.isArray(data.entries)) return data.entries;
  return [];
}

function indexCrackfiles(list, seed = {}) {
  const db = { ...seed };
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const name = String(entry.name || '').trim();
    if (!name) continue;
    const href = (entry.fixes || []).find((item) => item && item.href)?.href || '';
    const requiredBuild = entry.buildid
      || (entry.fixes || []).find((item) => item && item.buildid)?.buildid
      || null;
    const rec = {
      name,
      cracked: Boolean(href),
      required_build: requiredBuild,
      crack_url: href || null,
      source_crack: entry.source_crack || [],
      original_download: entry.original_download || [],
      drm: entry.drm || entry.protection || '',
      denuvo_removed: Boolean(entry.denuvo_removed),
      notes: entry.notes || '',
      fixes: entry.fixes || [],
    };
    const aid = String(entry.appid || entry.app_id || '').trim();
    if (aid) {
      db[aid] = { ...(db[aid] || {}), ...rec };
    }
  }
  return db;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function fetchCrackDB() {
  if (_memory) return _memory;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    let overlay = [];
    for (const url of KRAKEN_CRACKFILES_URLS) {
      try {
        const data = await fetchJson(url);
        overlay = asList(data);
        if (overlay.length) break;
      } catch { /* try next source */ }
    }
    try {
      const localRes = await fetch('./crack_db.json', { cache: 'no-store' });
      if (localRes.ok) {
        const local = await localRes.json();
        if (local && typeof local === 'object' && !Array.isArray(local)) {
          Object.assign(BUNDLED_CRACK_DB, local);
        }
      }
    } catch { /* ignore */ }

    const db = indexCrackfiles(overlay, BUNDLED_CRACK_DB);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: db }));
    } catch { /* ignore */ }
    _memory = db;
    return db;
  })();
  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}

export function useCrackDB({ prefetch = false } = {}) {
  const [db, setDb] = useState(() => {
    if (_memory) return _memory;
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
    if (!prefetch) return undefined;
    fetchCrackDB().then((data) => {
      if (data) setDb(data);
    });
    return undefined;
  }, [prefetch]);

  const lookupGame = (appId) => {
    if (!appId) return null;
    const activeDb = db || BUNDLED_CRACK_DB;
    return activeDb?.[String(appId)] || null;
  };

  return { db, lookupGame };
}
