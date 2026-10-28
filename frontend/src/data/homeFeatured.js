export const FEATURED = [
  { id: '1593500', name: 'God of War' },
  { id: '1245620', name: 'ELDEN RING' },
  { id: '1091500', name: 'Cyberpunk 2077' },
  { id: '1174180', name: 'Red Dead Redemption 2' },
  { id: '1086940', name: "Baldur's Gate 3" },
  { id: '271590', name: 'Grand Theft Auto V' },
  { id: '292030', name: 'The Witcher 3: Wild Hunt' },
  { id: '2050650', name: 'Resident Evil 4' },
  { id: '990080', name: 'Hogwarts Legacy' },
  { id: '814380', name: 'Sekiro: Shadows Die Twice' },
];

export const RECENTLY_CRACKED = [
  { id: '1593500', name: 'God of War' },
  { id: '1091500', name: 'Cyberpunk 2077' },
  { id: '1245620', name: 'ELDEN RING' },
  { id: '1174180', name: 'Red Dead Redemption 2' },
  { id: '2050650', name: 'Resident Evil 4' },
  { id: '271590', name: 'Grand Theft Auto V' },
  { id: '292030', name: 'The Witcher 3: Wild Hunt' },
  { id: '1145360', name: 'Hades' },
];

export function preloadSteamArt(appId, kind = 'hero') {
  const id = String(appId || '').trim();
  if (!id) return Promise.resolve();
  const urls = kind === 'cover'
    ? [
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
      ]
    : [
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_hero.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
      ];
  return new Promise((resolve) => {
    let i = 0;
    const img = new Image();
    const next = () => {
      if (i >= urls.length) {
        resolve();
        return;
      }
      img.src = urls[i];
      i += 1;
    };
    img.onload = () => resolve();
    img.onerror = next;
    setTimeout(resolve, 2800);
    next();
  });
}
