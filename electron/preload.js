/**
 * language: JavaScript, file: preload.js, runtime: Electron, target: Windows
 * Exposes a safe IPC bridge to the renderer process.
 * All calls go through contextBridge to avoid nodeIntegration vulnerabilities.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('KrakenAPI', {
    // Call backend Python API
    call: (endpoint, ...args) => ipcRenderer.invoke('api-call', endpoint, ...args),
    
    // Listen for push events from main process (backend events)
    on: (channel, callback) => {
        const validChannels = ['task-finished', 'task-progress', 'log-line', 'steam-status'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },
    
    // Remove listener
    off: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },
    
    // Open external links (Steam, Discord, etc.)
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // File system operations
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    
    // App info
    getVersion: () => ipcRenderer.invoke('get-version'),
    getPlatform: () => process.platform,
});
