import denuvoLogo from '../assets/drm/Denuvo-Anti-Tamper-drm-icon.png';
import steamLogo from '../assets/drm/Steamworks-Steam-DRM-icon.png';
import ubisoftLogo from '../assets/drm/Ubisoft-Connect-Uplay-DRM-icon.png';
import eaLogo from '../assets/drm/Origin-EA-App-DRM-icon.png';
import rockstarLogo from '../assets/drm/Rockstar-Games-Launcher-DRM-icon.png';
import epicLogo from '../assets/drm/Epic-Online-Services-Epic-Games-Store-DRM-icon.png';
import battlenetLogo from '../assets/drm/Battle.net-DRM-icon.png';
import hypervisorLogo from '../assets/drm/hypervisor.svg';
import genericLogo from '../assets/drm/drm-protection.svg';

export const DRM_ENTRIES = {
  denuvo: {
    id: 'denuvo',
    name: 'Denuvo Anti-Tamper',
    category: 'Anti-Tamper',
    logo: denuvoLogo,
    blurb:
      'A software protection layer wrapped around a game executable to impede reverse engineering and modification. It uses obfuscation, anti-debugging, and integrity checks, usually alongside platform DRM for entitlement checks. The stated goal is to cover the initial sales window; the performance cost varies by title.',
  },
  denuvo_removed: {
    id: 'denuvo_removed',
    name: 'Denuvo removed by developer',
    category: 'Anti-Tamper',
    logo: denuvoLogo,
    blurb:
      'This title shipped with Denuvo Anti-Tamper, then the publisher stripped it in a later official build. The current Steam version does not need a scene crack for Denuvo — LumaCore / a normal Steam install is enough. Older Denuvo-era builds are a different story; stay on the updated branch.',
  },
  hypervisor: {
    id: 'hypervisor',
    name: 'Hypervisor-Level Protection',
    category: 'Anti-Tamper',
    logo: hypervisorLogo,
    blurb:
      'Protection that runs at the virtualization layer, beneath the operating system. Integrity checks happen at ring −1, where a normal in-process patch cannot reach. This is among the most demanding categories to analyze.',
  },
  steam: {
    id: 'steam',
    name: 'Steam (CEG / Steam DRM)',
    category: 'Platform DRM',
    logo: steamLogo,
    blurb:
      'Steam ties launches to an authenticated Steam account and a licensed entitlement. Older CEG builds could bind a per-user executable and run integrity checks. After the first activation, offline play is usually available, with periodic revalidation by the Steam client. No extra crack file is needed in Kraken — LumaCore / a native Steam install is enough.',
  },
  epic: {
    id: 'epic',
    name: 'Epic Online Services',
    category: 'Platform DRM',
    logo: epicLogo,
    blurb:
      'A cross-platform backend for authentication, entitlement checks, matchmaking, and related services. Games from the Epic Games Store may use EOS or the launcher to confirm account ownership at launch. Offline behavior depends on the title configuration.',
  },
  ubisoft: {
    id: 'ubisoft',
    name: 'Ubisoft Connect',
    category: 'Platform DRM',
    logo: ubisoftLogo,
    blurb:
      'An account-based launcher that validates ownership and may require online connectivity at first launch or continuously, depending on the title. It also provides updates, overlays, and cloud saves. Enforcement policies vary by game.',
  },
  ea: {
    id: 'ea',
    name: 'EA App / EA Anti-Cheat',
    category: 'Platform DRM',
    logo: eaLogo,
    blurb:
      'The EA App handles account authentication and entitlement checks for game launches and updates. EA Anti-Cheat is a kernel-mode component used by select titles to enforce process integrity and detect cheating. Offline access requirements are game-dependent.',
  },
  rockstar: {
    id: 'rockstar',
    name: 'Rockstar Social Club',
    category: 'Platform DRM',
    logo: rockstarLogo,
    blurb:
      'Rockstar’s launcher and Social Club services authenticate users and verify licenses before starting supported games. They integrate cloud saves, updates, and online features. Offline play typically requires a prior sign-in and is governed by title-specific policies.',
  },
  battlenet: {
    id: 'battlenet',
    name: 'Battle.net',
    category: 'Platform DRM',
    logo: battlenetLogo,
    blurb:
      'Blizzard / Microsoft launcher DRM. Games authenticate against a Battle.net account and often need the client running. Some titles allow limited offline play after a previous online launch.',
  },
  gog: {
    id: 'gog',
    name: 'GOG Galaxy (DRM-free)',
    category: 'Platform DRM',
    logo: genericLogo,
    blurb:
      'GOG distributes games without mandatory DRM; the Galaxy client is optional. Galaxy offers updates, achievements, and cloud saves without enforcing online checks for launch. Installers and executables are designed to function offline.',
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft Store / UWP',
    category: 'Platform DRM',
    logo: genericLogo,
    blurb:
      'Uses Microsoft Store licensing and encryption to bind apps to a Microsoft account or device. UWP packages are signed and run in a sandbox, with integrity checks performed by the Store infrastructure. Some titles also rely on Xbox services for additional authentication.',
  },
  eac: {
    id: 'eac',
    name: 'Easy Anti-Cheat',
    category: 'Anti-Cheat',
    logo: genericLogo,
    blurb:
      'A third-party anti-cheat used by many multiplayer titles. It inspects the game process and, on some games, the kernel. It is not a store DRM by itself, but it can block modified clients online.',
  },
  battleye: {
    id: 'battleye',
    name: 'BattlEye',
    category: 'Anti-Cheat',
    logo: genericLogo,
    blurb:
      'A kernel-level anti-cheat used by several multiplayer games. Like EAC it focuses on live integrity of the running game rather than store ownership. Offline single-player is often unaffected.',
  },
  vmprotect: {
    id: 'vmprotect',
    name: 'VMProtect',
    category: 'Anti-Tamper',
    logo: genericLogo,
    blurb:
      'A code-virtualization packer that turns parts of the executable into a custom bytecode VM. It is often stacked with Denuvo or platform DRM to slow down static analysis of the binary.',
  },
  arxan: {
    id: 'arxan',
    name: 'Digital.ai (Arxan)',
    category: 'Anti-Tamper',
    logo: genericLogo,
    blurb:
      'Code protection from Digital.ai, formerly Arxan. It obfuscates and integrity-checks the game binary. It is a different product from Denuvo, though crack-watch sites often mix the two up. Red Dead Redemption 2 on PC uses this plus the Rockstar launcher — it never shipped with Denuvo.',
  },
  generic: {
    id: 'generic',
    name: 'Other protection',
    category: 'Protection',
    logo: genericLogo,
    blurb:
      'This title reports an additional protection layer. Details vary by publisher; Kraken shows the raw name reported for the game.',
  },
  drmfree: {
    id: 'drmfree',
    name: 'DRM-Free',
    category: 'Platform DRM',
    logo: genericLogo,
    blurb:
      'No extra anti-tamper or store wrapper is reported for this title. The game can run from a normal install without a separate crack file.',
  },
};

const RULES = [
  [/digital\.ai|arxan/i, 'arxan'],
  [/denuvo.{0,48}(removed|stripped|dropped|retired)|(?:removed|stripped|dropped|retired).{0,24}denuvo/i, 'denuvo_removed'],
  [/denuvo/i, 'denuvo'],
  [/hypervisor/i, 'hypervisor'],
  [/vmprotect/i, 'vmprotect'],
  [/easy\s*anti-?cheat|\beac\b/i, 'eac'],
  [/battleye/i, 'battleye'],
  [/ubisoft|uplay|connect/i, 'ubisoft'],
  [/origin|\bea\b|electronic arts/i, 'ea'],
  [/rockstar|social club/i, 'rockstar'],
  [/epic|eos/i, 'epic'],
  [/battle\.?net|blizzard/i, 'battlenet'],
  [/\bgog\b/i, 'gog'],
  [/microsoft|uwp|xbox/i, 'microsoft'],
  [/steam|ceg/i, 'steam'],
];

export function parseDrmTokens(raw) {
  const text = String(raw || '').trim();
  if (!text || /^(none|n\/a|unknown)$/i.test(text)) return [];
  return text
    .split(/\s*(?:\+|\/|,|&|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolveDrmId(token) {
  const value = String(token || '');
  for (const [re, id] of RULES) {
    if (re.test(value)) return id;
  }
  return 'generic';
}

export function drmCardsFor(protection) {
  const tokens = parseDrmTokens(protection);
  const seen = new Set();
  const cards = [];
  for (const token of tokens) {
    const id = resolveDrmId(token);
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = DRM_ENTRIES[id] || DRM_ENTRIES.generic;
    cards.push({
      ...entry,
      reportedAs: token,
      name: id === 'generic' ? token : entry.name,
    });
  }
  return cards;
}

export function isSteamOnlyProtection(protection) {
  const cards = drmCardsFor(protection);
  return cards.length > 0 && cards.every((card) => card.id === 'steam');
}

export function isDenuvoRemoved(protection, extra) {
  if (extra?.denuvo_removed) return true;
  const cards = drmCardsFor(protection);
  if (cards.some((card) => card.id === 'denuvo_removed')) return true;
  const text = String(protection || '');
  return /denuvo/i.test(text) && /removed|stripped|dropped|retired/i.test(text);
}
