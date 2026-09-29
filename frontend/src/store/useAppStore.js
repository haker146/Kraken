import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  // Navigation
  activePage: 'home',
  setActivePage: (page) => set({ activePage: page }),

  // Active game (for Game Hub)
  activeGame: null,
  setActiveGame: (game) => set({ activeGame: game }),

  // Games catalog
  games: [],
  gamesLoading: false,
  setGames: (games) => set({ games }),
  setGamesLoading: (loading) => set({ gamesLoading: loading }),

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

  // Notifications
  notifications: [],
  pushNotification: (n) => set((s) => ({
    notifications: [{ id: Date.now(), ...n }, ...s.notifications].slice(0, 20)
  })),
}));
