import { useEffect, useMemo, useState } from 'react';

function pushUrl(urls, url) {
  if (!url || typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!trimmed || urls.includes(trimmed)) return;
  urls.push(trimmed);
}

const LOW_RES_STEAM_ART = /capsule_sm_120|capsule_231x87|capsule_184x69|capsule_177x101/i;
const HASHED_ART = /\/apps\/\d+\/[0-9a-f]{12,}\//i;
const HASHED_FILE = /^(https?:\/\/[^/]+\/store_item_assets\/steam\/apps\/\d+\/[0-9a-f]{12,}\/)([^/?]+)(.*)$/i;
const STEAM_HOSTS = [
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps',
  'https://cdn.cloudflare.steamstatic.com/steam/apps',
  'https://cdn.akamai.steamstatic.com/steam/apps',
  'https://steamcdn-a.akamaihd.net/steam/apps',
];

function addAsset(urls, id, file, hostLimit = 2) {
  if (!id) return;
  for (const host of STEAM_HOSTS.slice(0, hostLimit)) {
    pushUrl(urls, `${host}/${id}/${file}`);
  }
}

function hashedSiblings(src, kind) {
  const urls = [];
  const match = String(src || '').match(HASHED_FILE);
  if (!match) {
    if (src) pushUrl(urls, src);
    return urls;
  }
  const [, base, file, query] = match;
  const names = kind === 'cover'
    ? ['library_capsule.jpg', 'library_capsule_2x.jpg', 'hero_capsule.jpg', 'header.jpg', file]
    : kind === 'hero'
      ? ['library_hero.jpg', 'library_hero_2x.jpg', 'capsule_616x353.jpg', 'header.jpg', file]
      : ['capsule_616x353.jpg', 'header.jpg', 'hero_capsule.jpg', file];
  for (const name of names) {
    pushUrl(urls, `${base}${name}${query || ''}`);
    if (query) pushUrl(urls, `${base}${name}`);
  }
  return urls;
}

export function steamImageChain(appId, { src, kind = 'header' } = {}) {
  const id = String(appId || '').trim();
  const urls = [];
  const srcTrim = typeof src === 'string' ? src.trim() : '';
  const hashed = Boolean(srcTrim && HASHED_ART.test(srcTrim));
  const srcIsLow = Boolean(srcTrim && LOW_RES_STEAM_ART.test(srcTrim));

  if (hashed) {
    for (const url of hashedSiblings(srcTrim, kind)) pushUrl(urls, url);
    return urls;
  }

  if (srcTrim && !srcIsLow) pushUrl(urls, srcTrim);
  if (!id) {
    if (srcTrim) pushUrl(urls, srcTrim);
    return urls;
  }
  if (kind === 'cover') {
    addAsset(urls, id, 'library_600x900.jpg');
    addAsset(urls, id, 'library_600x900_2x.jpg', 1);
    addAsset(urls, id, 'hero_capsule.jpg');
    addAsset(urls, id, 'header.jpg');
    addAsset(urls, id, 'capsule_616x353.jpg');
    addAsset(urls, id, 'library_hero.jpg', 1);
    addAsset(urls, id, 'capsule_231x87.jpg');
  } else if (kind === 'hero') {
    addAsset(urls, id, 'library_hero.jpg');
    addAsset(urls, id, 'library_hero_2x.jpg', 1);
    addAsset(urls, id, 'page_bg_generated_v6b.jpg', 1);
    addAsset(urls, id, 'capsule_616x353.jpg');
    addAsset(urls, id, 'header.jpg');
    addAsset(urls, id, 'library_600x900.jpg', 1);
  } else if (kind === 'wide') {
    addAsset(urls, id, 'capsule_616x353.jpg');
    addAsset(urls, id, 'header.jpg');
    addAsset(urls, id, 'hero_capsule.jpg');
    addAsset(urls, id, 'library_hero.jpg', 1);
    addAsset(urls, id, 'library_600x900.jpg', 1);
    addAsset(urls, id, 'capsule_231x87.jpg');
  } else if (kind === 'logo') {
    addAsset(urls, id, 'logo.png');
    addAsset(urls, id, 'logo_2x.png', 1);
    addAsset(urls, id, 'library_logo.png', 1);
  } else {
    addAsset(urls, id, 'capsule_231x87.jpg');
    addAsset(urls, id, 'header.jpg');
    addAsset(urls, id, 'capsule_616x353.jpg');
  }
  if (srcTrim) pushUrl(urls, srcTrim);
  return urls;
}

export default function SteamImage({
  appId,
  alt = '',
  className = '',
  src,
  kind = 'header',
  onReady,
  ...rest
}) {
  const chain = useMemo(
    () => steamImageChain(appId, { src, kind }),
    [appId, src, kind],
  );
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [dead, setDead] = useState(false);
  const letter = (alt || '').trim().charAt(0) || '?';

  useEffect(() => {
    setIdx(0);
    setLoaded(false);
    setDead(false);
  }, [appId, src, kind]);

  return (
    <div className={`steam-img-wrap ${className}`.trim()} {...rest}>
      <div className="steam-img-fallback" aria-hidden="true">
        <span>{letter}</span>
      </div>
      {!dead && chain[idx] ? (
        <img
          key={`${appId}-${kind}-${idx}`}
          className={loaded ? 'is-loaded' : 'is-loading'}
          src={chain[idx]}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth < 32 || img.naturalHeight < 32) {
              setLoaded(false);
              if (idx + 1 < chain.length) setIdx(idx + 1);
              else setDead(true);
              return;
            }
            setLoaded(true);
            onReady?.();
          }}
          onError={() => {
            setLoaded(false);
            if (idx + 1 < chain.length) setIdx(idx + 1);
            else setDead(true);
          }}
        />
      ) : null}
    </div>
  );
}

export function SteamLogo({ appId, name = '', className = '', titleClassName = '' }) {
  const chain = useMemo(
    () => steamImageChain(appId, { kind: 'logo' }),
    [appId],
  );
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    setIdx(0);
    setDead(false);
  }, [appId]);

  if (dead || !chain[idx]) {
    return name ? <h1 className={titleClassName || className}>{name}</h1> : null;
  }

  return (
    <img
      key={`${appId}-${idx}`}
      className={className}
      src={chain[idx]}
      alt={name}
      draggable={false}
      decoding="async"
      onError={() => {
        if (idx + 1 < chain.length) setIdx(idx + 1);
        else setDead(true);
      }}
    />
  );
}
