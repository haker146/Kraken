export const UI_THEMES = [
  {
    id: 'default',
    name: 'Kraken',
    blurb: 'Abyssal glass like Home — cyan and violet, with a kraken wrapping a ship.',
    appId: null,
    fx: ['kraken', 'bubbles', 'caustics'],
    swatch: 'linear-gradient(135deg, #38bdf8 0%, #0b1224 48%, #a78bfa 100%)',
  },
  {
    id: 'hogwarts',
    name: 'Hogwarts Legacy',
    blurb: 'Gold and burgundy glass, castle mist and floating embers.',
    appId: '990080',
    fx: ['embers', 'mist'],
    swatch: 'linear-gradient(135deg, #d4af37 0%, #3b1418 45%, #7b2d3b 100%)',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    blurb: 'Night City yellow and cyan, rain and scanlines over a blurred hero.',
    appId: '1091500',
    fx: ['rain', 'scanlines', 'grain'],
    swatch: 'linear-gradient(135deg, #fcee0a 0%, #0a0a0d 46%, #00f0ff 100%)',
  },
  {
    id: 'rdr2',
    name: 'Red Dead Redemption 2',
    blurb: 'Sunset dust, film grain and a western wash.',
    appId: '1174180',
    fx: ['dust', 'grain', 'godrays'],
    swatch: 'linear-gradient(135deg, #e8b86d 0%, #2a140c 48%, #8b3a1f 100%)',
  },
  {
    id: 'indiana',
    name: 'Indiana Jones and the Great Circle',
    blurb: 'Temple gold and leather, god rays through drifting sand.',
    appId: '2677660',
    fx: ['dust', 'godrays', 'grain'],
    swatch: 'linear-gradient(135deg, #e0c068 0%, #2a1810 46%, #8b3a2a 100%)',
  },
];

export const DEFAULT_UI_THEME = 'default';
const STORAGE_KEY = 'kraken_ui_theme';
const THEME_IDS = new Set(UI_THEMES.map((t) => t.id));

export function getUiTheme(id) {
  return UI_THEMES.find((t) => t.id === id) || UI_THEMES[0];
}

export function normalizeUiTheme(value) {
  return THEME_IDS.has(value) ? value : DEFAULT_UI_THEME;
}

export function readStoredUiTheme() {
  try {
    return normalizeUiTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_UI_THEME;
  }
}

export function applyUiTheme(value) {
  const theme = normalizeUiTheme(value);
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
  return theme;
}

export function themeBackdropUrls(appId) {
  if (!appId) return [];
  return [
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`,
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero_2x.jpg`,
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/page_bg_generated_v6b.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
  ];
}
