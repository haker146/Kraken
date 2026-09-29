/**
 * language: JavaScript, file: bridge.js, runtime: Browser/QWebEngine
 * Provides a unified API to call Python backend.
 * In QWebEngine context: uses existing QWebChannel (window.Bridge)
 * In Vite dev context: calls HTTP API at localhost:7734
 * In Electron context: uses window.KrakenAPI from preload
 */

const isDev = import.meta.env.DEV;
const isElectron = typeof window.KrakenAPI !== 'undefined';

class KrakenBridge {
  constructor() {
    this._listeners = {};
  }

  async call(method, ...args) {
    // Electron mode
    if (isElectron) {
      const result = await window.KrakenAPI.call(method, ...args);
      if (!result.ok) throw new Error(result.error);
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

    // QWebChannel mode (legacy / production PyQt6)
    if (window.Bridge) {
      return new Promise((resolve, reject) => {
        window.Bridge.call(method, ...args, (result) => {
          if (result?.error) reject(new Error(result.error));
          else resolve(result);
        });
      });
    }

    console.warn(`[Bridge] No backend available. Method: ${method}`);
    return null;
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);

    if (isElectron) {
      window.KrakenAPI.on(event, callback);
    }
  }

  emit(event, ...args) {
    (this._listeners[event] || []).forEach(cb => cb(...args));
  }
}

export const bridge = new KrakenBridge();

// Hook QWebChannel events into our bridge (PyQt6 production)
if (typeof qt !== 'undefined' && typeof QWebChannel !== 'undefined') {
  new QWebChannel(qt.webChannelTransport, (channel) => {
    window.Bridge = channel.objects.bridge;
    window.Bridge.task_finished.connect((json) => {
      bridge.emit('task-finished', JSON.parse(json));
    });
  });
}
