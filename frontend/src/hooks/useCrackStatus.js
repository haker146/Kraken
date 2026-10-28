import { useState, useEffect } from 'react';
import { bridge } from '../lib/bridge';

function parseJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

export function useCrackStatus(appId, gameName) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!appId) {
      setInfo(null);
      return undefined;
    }
    let cancelled = false;
    let unsub = () => {};
    let timer;
    setLoading(true);

    const merge = (payload) => {
      if (cancelled || !payload) return;
      setInfo(prev => ({ ...(prev || {}), ...payload, app_id: String(appId) }));
    };

    bridge.ready.then(async () => {
      if (cancelled) return;
      try {
        const catalog = parseJson(await bridge.call('get_crack_info', String(appId), gameName || ''));
        if (catalog) merge(catalog);
      } catch { /* catalog is optional */ }

      unsub = bridge.on('task_finished', (raw) => {
        const payload = parseJson(raw);
        if (!payload || payload.task !== 'crack_status') return;
        if (String(payload.app_id) !== String(appId)) return;
        merge(payload);
        setLoading(false);
      });

      try {
        await bridge.call('get_crack_status', String(appId), gameName || '');
      } catch {
        if (!cancelled) setLoading(false);
      }

      timer = setTimeout(() => {
        if (!cancelled) setLoading(false);
      }, 15000);
    });

    return () => {
      cancelled = true;
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [appId, gameName]);

  return { info, loading };
}
