/**
 * language: JavaScript, file: main.js, runtime: Electron 35, target: Windows
 * Main process — manages window lifecycle, Python sidecar, and IPC routing.
 */
const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

const BACKEND_URL = 'http://127.0.0.1:7734';
const BACKEND_STARTUP_TIMEOUT = 15000;

let mainWindow = null;
let tray = null;
let pythonProcess = null;

// ── Window Creation ──────────────────────────────────────────────────────────

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        frame: false,           // Custom titlebar
        transparent: false,
        backgroundColor: '#090b10',
        icon: path.join(__dirname, '../kraken.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        show: false,            // Don't flash on startup
    });

    // Load new Electron UI
    mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Minimise to tray on close
    mainWindow.on('close', (e) => {
        if (tray) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    // Open devtools in dev mode
    if (process.env.KRAKEN_DEV) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

// ── System Tray ──────────────────────────────────────────────────────────────

function createTray() {
    const iconPath = path.join(__dirname, '../kraken.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Kraken', click: () => { if (mainWindow) mainWindow.show(); } },
        { type: 'separator' },
        { label: 'Quit', click: () => { tray = null; app.quit(); } },
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('Kraken');
    tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });
}

// ── Python Sidecar ───────────────────────────────────────────────────────────

function startPythonBackend() {
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, '../sff/api_server.py');

    pythonProcess = spawn(pythonExe, [scriptPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, KRAKEN_ELECTRON: '1' },
    });

    pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach(line => {
            if (mainWindow) mainWindow.webContents.send('log-line', line);
        });
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error('[Python]', data.toString());
    });

    pythonProcess.on('exit', (code) => {
        console.log(`Python backend exited with code ${code}`);
        pythonProcess = null;
    });
}

async function waitForBackend(timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            await axios.get(`${BACKEND_URL}/ping`, { timeout: 500 });
            return true;
        } catch {
            await new Promise(r => setTimeout(r, 300));
        }
    }
    return false;
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('api-call', async (event, endpoint, ...args) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/${endpoint}`, { args }, {
            timeout: 30000,
        });
        return { ok: true, data: response.data };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('get-version', () => app.getVersion());

// Custom window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.hide());
ipcMain.on('window-quit', () => { tray = null; app.quit(); });

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    createTray();
    startPythonBackend();

    // Don't wait forever for backend on first launch
    const backendReady = await waitForBackend(BACKEND_STARTUP_TIMEOUT);
    if (!backendReady) {
        console.warn('Python backend did not respond within timeout — launching UI anyway');
    }

    createWindow();
});

app.on('window-all-closed', () => {
    // On macOS, app stays in tray
    if (process.platform !== 'darwin' && !tray) {
        app.quit();
    }
});

app.on('activate', () => {
    if (!mainWindow) createWindow();
});

app.on('before-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill('SIGTERM');
    }
});
