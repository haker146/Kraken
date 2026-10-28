export const MANIFEST_SOURCE_CATALOG = [
  {
    id: 'hubcap',
    name: 'Hubcap',
    badge: 'Najszybsze nowe',
    badgeTone: 'fast',
    needsKey: true,
    description:
      'API hubcapmanifest.com (klucz, ok. 1500 zapytań/dzień). Generuje konkretny GID na żądanie — tu zwykle najszybciej pojawia się świeży update ze Steam, często tego samego dnia.',
  },
  {
    id: 'gmrc',
    name: 'GMRC',
    badge: 'Darmowe',
    badgeTone: 'free',
    needsKey: false,
    description:
      'Publiczne lustra kodów: opensteamtool, steam.run, wudrm, potem plik z CDN Valve. Bez klucza. Nowe GID-y często dostają 403/502, zanim lustro je złapie.',
  },
  {
    id: 'github',
    name: 'GitHub',
    badge: 'Wolne na nowości',
    badgeTone: 'slow',
    needsKey: false,
    description:
      'Gotowe pliki .manifest z repozytoriów społeczności. Bez limitu, ale ktoś musi je wrzucić — na premierowy patch zwykle najwolniejsze.',
  },
  {
    id: 'manifesthub',
    name: 'ManifestHub',
    badge: 'Cache 24h',
    badgeTone: 'mid',
    needsKey: true,
    description:
      'API ManifestHub (klucz ważny ok. 24h). Cache wcześniej ściągniętych manifestów. Średnio szybkie — nie wygeneruje GID-a, którego nikt jeszcze nie pytał.',
  },
  {
    id: 'steam_cdn',
    name: 'Steam CDN',
    badge: 'Ostatnia deska',
    badgeTone: 'last',
    needsKey: false,
    description:
      'Ostatnia próba: ten sam GMRC + steampipe.akamaized.net. Pliki na CDN Valve są od razu, ale bez kodu request (własność albo lustro) i tak będzie Access Denied.',
  },
];

export const DEFAULT_MANIFEST_SOURCES = MANIFEST_SOURCE_CATALOG.map((s) => ({
  id: s.id,
  enabled: true,
}));

export function normalizeManifestSources(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text || text === 'null' || text === 'undefined') {
      list = null;
    } else {
      try {
        list = JSON.parse(text);
      } catch {
        list = null;
      }
    }
  }
  if (list && !Array.isArray(list) && typeof list === 'object') {
    list = list.sources || list.order || null;
  }
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const id = typeof item === 'string' ? item : item?.id;
    if (!id || !MANIFEST_SOURCE_CATALOG.some((s) => s.id === id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({
      id,
      enabled: typeof item === 'string' ? true : item?.enabled !== false,
    });
  }
  for (const def of DEFAULT_MANIFEST_SOURCES) {
    if (!seen.has(def.id)) out.push({ ...def });
  }
  return out;
}
