import { create } from 'zustand';
import { normalizeUiTheme } from '../lib/theme';

const steamCover = (appId) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;

export function mapLibraryGames(rawGames, prevGames = []) {
  const prev = Array.isArray(prevGames) ? prevGames : [];
  const mapped = (rawGames || []).map((g) => {
    const app_id = String(g.app_id || g.appid || '');
    const installed = Boolean(g.installed);
    return {
      app_id,
      name: g.name || `App ${g.app_id}`,
      crack_status: g.crack_status || (g.cracked ? 'cracked' : 'clean'),
      drm: g.drm || 'Unknown',
      crack_ver: g.crack_ver || null,
      crack_src: g.crack_src || null,
      crack_date: g.crack_date || null,
      playtime: g.playtime || '—',
      last_played: g.last_played || '—',
      size: g.size || '—',
      path: g.path || '',
      cover_url: g.cover_url || (app_id ? steamCover(app_id) : ''),
      image_url: g.image_url || null,
      has_update: Boolean(g.has_update),
      auto_update: Boolean(g.auto_update),
      buildid: g.buildid || null,
      target_buildid: g.target_buildid || null,
      crack_buildid: g.crack_buildid || null,
      installed,
      manifest_only: g.manifest_only !== undefined ? Boolean(g.manifest_only) : !installed,
      steamidra_managed: Boolean(g.steamidra_managed),
      steamidra_source: g.steamidra_source || '',
      in_library: true,
    };
  });
  return mapped.map((g) => {
    const old = prev.find((p) => String(p.app_id) === g.app_id);
    return old ? { ...old, ...g } : g;
  });
}

export const useAppStore = create((set, get) => ({
  // Navigation
  activePage: 'home',
  setActivePage: (page) => set({ activePage: page }),

  // Active game (for Game Hub)
  activeGame: null,
  setActiveGame: (game) => set({ activeGame: game }),
  hubBackPage: 'store',
  setHubBackPage: (page) => set({ hubBackPage: page }),

  // Games catalog
  games: [],
  gamesLoading: false,
  pendingRemovedIds: [],
  setGames: (games) => set({ games }),
  setGamesLoading: (loading) => set({ gamesLoading: loading }),
  applyLibraryPayload: (rawGames) => {
    const pending = (get().pendingRemovedIds || []).map(String);
    const mapped = mapLibraryGames(rawGames, get().games).filter(
      (g) => !pending.includes(String(g.app_id)),
    );
    const payloadIds = new Set(
      (rawGames || []).map((g) => String(g.app_id || g.appid || '')).filter(Boolean),
    );
    set({
      games: mapped,
      pendingRemovedIds: pending.filter((id) => payloadIds.has(id)),
      gamesLoading: false,
    });
  },
  removeGame: (appId) => {
    const id = String(appId || '');
    if (!id) return;
    const pending = get().pendingRemovedIds || [];
    set({
      games: (get().games || []).filter((g) => String(g.app_id) !== id),
      pendingRemovedIds: pending.includes(id) ? pending : [...pending, id],
    });
  },
  clearPendingRemoved: (appId) => {
    const id = String(appId || '');
    if (!id) return;
    set({ pendingRemovedIds: (get().pendingRemovedIds || []).filter((x) => x !== id) });
  },
  patchGame: (appId, extra) => {
    const id = String(appId || '');
    if (!id || !extra) return;
    const patch = (g) => (g && String(g.app_id) === id ? { ...g, ...extra } : g);
    const ctx = get().gameCtx;
    set({
      games: (get().games || []).map(patch),
      gameCtx: ctx?.game ? { ...ctx, game: patch(ctx.game) } : ctx,
      settingsGame: patch(get().settingsGame),
      activeGame: patch(get().activeGame),
    });
  },

  // Tasks / progress
  tasks: {},
  updateTask: (id, data) => set((s) => ({
    tasks: { ...s.tasks, [id]: { ...(s.tasks[id] || {}), ...data } }
  })),
  removeTask: (id) => set((s) => {
    const t = { ...s.tasks };
    delete t[id];
    return { tasks: t };
  }),

  // Steam status
  steamStatus: { connected: false, path: '', label: 'Steam…' },
  setSteamStatus: (status) => set({ steamStatus: status }),

  lumaCore: {
    installed: '',
    latest: '',
    update_available: false,
    missing: false,
    restart_needed: false,
    steam_updated: false,
  },
  setLumaCore: (data) => set({ lumaCore: { ...get().lumaCore, ...data } }),

  uiTheme: 'default',
  setUiTheme: (theme) => set({ uiTheme: normalizeUiTheme(theme) }),

  gameCtx: null,
  settingsGame: null,
  favorites: [],
  openGameCtx: (e, game) => {
    if (!e || !game) return;
    e.preventDefault();
    e.stopPropagation();
    const appId = String(game.app_id || game.appid || '');
    const lib = (get().games || []).find((g) => String(g.app_id) === appId);
    const inLibrary = Boolean(lib);
    set({
      gameCtx: {
        x: e.clientX,
        y: e.clientY,
        game: {
          ...game,
          ...(lib || {}),
          app_id: appId,
          name: game.name || lib?.name || `App ${appId}`,
          cover_url: game.cover_url || lib?.cover_url || '',
          in_library: inLibrary,
          installed: Boolean(lib?.installed),
          manifest_only: inLibrary && !lib?.installed,
          auto_update: Boolean(lib?.auto_update),
        },
      },
    });
  },
  closeGameCtx: () => set({ gameCtx: null }),
  setSettingsGame: (game) => set({ settingsGame: game }),
  setFavorites: (ids) => set({ favorites: (ids || []).map(String) }),
  toggleFavorite: (appId) => {
    const id = String(appId || '');
    if (!id) return;
    const has = get().favorites.includes(id);
    const next = has ? get().favorites.filter((x) => x !== id) : [id, ...get().favorites];
    set({ favorites: next });
    try { window.Bridge?.set_kraken_favorite?.(id, !has); } catch { /* ignore */ }
  },

  // Notifications
  notifications: [],
  pushNotification: (n) => set((s) => ({
    notifications: [{ id: Date.now() + Math.random(), ...n }, ...s.notifications].slice(0, 20)
  })),
  dismissNotification: (id) => set((s) => ({
    notifications: s.notifications.filter(n => n.id !== id)
  })),
}));
