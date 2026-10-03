/**
 * language: JavaScript, file: bridge.js, runtime: Browser/QWebEngine
 * Unified Python backend bridge.
 *
 * QWebChannel slots come in two flavours:
 *   sync  → pyqtSlot(result=str)  → callable, returns value directly
 *   async → pyqtSlot() / no result → fires task_finished or a named signal
 *
 * bridge.call() handles sync slots.
 * bridge.on()   handles signals.
 * bridge.invoke() calls an async slot (fire-and-forget, response via signal).
 * bridge.ready  → Promise that resolves when QWebChannel is initialised.
 */

const isDev      = import.meta.env.DEV;
const isElectron = typeof window !== 'undefined' && typeof window.KrakenAPI !== 'undefined';

// Sync slots that return a value directly (pyqtSlot(result=str))
const SYNC_SLOTS = new Set([
  'get_steam_client_status',
  'get_catalog_status',
  'get_kraken_favorites',
  'set_kraken_favorite',
  'suggest_store_games',
  'get_app_summaries',
  'get_all_settings',
  'get_setting',
  'set_setting',
  'get_platform',
  'get_app_version',
  'get_bundled_tool_path',
  'window_is_maximized',
  'get_stored_api_key',
  'get_webui_translations',
  'get_disk_usage',
  'get_storage_paths',
  'get_gse_identity',
]);

class KrakenBridge {
  constructor() {
    this._listeners = {};
    this._bridgeObj  = null;  // populated once QWebChannel resolves
    this._readyCallbacks = [];
    this._isReady = false;

    // Expose a ready promise so components can await Bridge initialisation
    this.ready = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
  }

  /** Called by QWebChannel init below once the channel is open. */
  _onChannelReady(bridgeObj) {
    this._bridgeObj = bridgeObj;
    window.Bridge  = bridgeObj;      // keep global compat
    this._isReady  = true;
    this._resolveReady(bridgeObj);

    // Wire all known signals into our event system
    const signals = [
      'task_finished', 'download_progress', 'search_results',
      'game_branches_ready', 'download_queue_state', 'task_progress',
      'log_message', 'lc_progress', 'depot_history_results',
    ];
    for (const sig of signals) {
      if (bridgeObj[sig]?.connect) {
        bridgeObj[sig].connect((data) => {
          this._dispatch(sig, data);
        });
      }
    }
  }

  _dispatch(event, raw) {
    const listeners = this._listeners[event] || [];
    for (const cb of listeners) {
      try { cb(raw); } catch (e) { console.error('[Bridge] listener error:', e); }
    }
  }

  /** Subscribe to a Python signal. Returns an unsubscribe function. */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    // Also wire Electron events
    if (isElectron && window.KrakenAPI?.on) {
      window.KrakenAPI.on(event, callback);
    }
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Call a Python slot.
   * - Sync slots (in SYNC_SLOTS): returns the value directly.
   * - Async slots: fires the named method, returns a Promise that resolves
   *   from the next task_finished event matching the task name, OR resolves
   *   undefined immediately for fire-and-forget calls.
   */
  async call(method, ...args) {
    // Electron mode
    if (isElectron) {
      const result = await window.KrakenAPI.call(method, ...args);
      if (!result?.ok) throw new Error(result?.error || 'Unknown error');
      return result.data;
    }

    // Dev HTTP mode
    if (isDev) {
      const res = await fetch(`/api/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    }

    // QWebChannel / production mode
    const b = this._bridgeObj || window.Bridge;
    if (!b) {
      console.warn(`[Bridge] Not ready — queuing call to ${method}`);
      await this.ready;
      return this.call(method, ...args);
    }

    const slot = b[method];
    if (typeof slot !== 'function') {
      console.warn(`[Bridge] No slot named '${method}'`);
      return null;
    }

    if (SYNC_SLOTS.has(method)) {
      // Synchronous slot — call with callback convention that QWebChannel uses
      return new Promise((resolve, reject) => {
        try {
          slot.call(b, ...args, (result) => resolve(result));
        } catch (e) {
          reject(e);
        }
      });
    }

    // Async slot — fire and don't wait for a return value
    slot.call(b, ...args);
    return undefined;
  }

  /**
   * Invoke an async slot and wait for the matching task_finished event.
   * taskName: the value of `task` in the task_finished payload.
   * appId: optional — matches only payloads with matching app_id.
   * timeout: ms before rejecting (default 30s).
   */
  invokeAsync(method, args = [], taskName = null, appId = null, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
      const b = this._bridgeObj || window.Bridge;
      if (!b) await this.ready;

      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.off('task_finished', handler);
      };

      const handler = (raw) => {
        try {
          const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const taskMatch  = !taskName || payload.task === taskName;
          const appMatch   = !appId    || String(payload.app_id) === String(appId);
          if (taskMatch && appMatch) {
            cleanup();
            resolve(payload);
          }
        } catch { /* ignore */ }
      };

      if (taskName) this.on('task_finished', handler);

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`[Bridge] Timeout waiting for ${taskName ?? method}`));
      }, timeout);

      await this.call(method, ...args);
    });
  }
}

export const bridge = new KrakenBridge();

// ── QWebChannel initialisation ──────────────────────────────────────────────
// This runs in QWebEngine (production) where `qt` and `QWebChannel` are globals.
// In Vite dev mode neither exists, so the block is skipped.
if (typeof qt !== 'undefined' && typeof QWebChannel !== 'undefined') {
  new QWebChannel(qt.webChannelTransport, (channel) => {
    bridge._onChannelReady(channel.objects.bridge);
  });
}
