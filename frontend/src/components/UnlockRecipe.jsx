import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, Circle, AlertTriangle, XCircle, ShieldAlert, Download,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { isDenuvoRemoved, isSteamOnlyProtection } from '../data/drmEncyclopedia';
import { useAppStore } from '../store/useAppStore';
import './UnlockRecipe.css';

function parseJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function Row({ state, title, detail, action }) {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'warn' ? AlertTriangle : state === 'bad' ? XCircle : Circle;
  return (
    <div className={`unlock-row unlock-${state}`}>
      <Icon size={14} />
      <div className="unlock-row-copy">
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      {action || null}
    </div>
  );
}

export default function UnlockRecipe({
  appId,
  gameName,
  crackInfo,
  currentBuild,
  onDowngrade,
  onOpenCrackTab,
}) {
  const lumaCore = useAppStore((s) => s.lumaCore);
  const [recipe, setRecipe] = useState(null);

  useEffect(() => {
    if (!appId) {
      setRecipe(null);
      return undefined;
    }
    let cancelled = false;
    bridge.ready.then(async () => {
      try {
        const raw = await bridge.call('get_unlock_recipe', String(appId), gameName || '');
        if (!cancelled) setRecipe(parseJson(raw));
      } catch {
        if (!cancelled) setRecipe(null);
      }
    });
    return () => { cancelled = true; };
  }, [appId, gameName]);

  const protection = crackInfo?.protection || crackInfo?.drm || '';
  const denuvoRemoved = isDenuvoRemoved(protection, crackInfo);
  const isDrmFree = /none|drm-free|drm free/i.test(protection) || crackInfo?.status_key === 'drm-free';
  const isSteamDrm = denuvoRemoved || isSteamOnlyProtection(protection) || (/steam/i.test(protection) && !/denuvo|eac|battleye|ubisoft|epic/i.test(protection));
  const isCracked = Boolean(crackInfo?.cracked) || String(crackInfo?.status_key || '').includes('cracked');
  const hasDenuvo = /denuvo/i.test(protection) && !denuvoRemoved;
  const installedBid = String(recipe?.installed_buildid || currentBuild || '').trim();
  const crackBid = String(recipe?.crack_buildid || crackInfo?.required_build || crackInfo?.crack_buildid || '').trim();
  const canInstall = Boolean(recipe?.can_install ?? crackInfo?.can_install);
  const lumaMissing = Boolean(lumaCore?.missing) || (recipe && !recipe.lumacore_installed);
  const lumaUpdate = Boolean(lumaCore?.update_available || recipe?.lumacore_update);

  let verdict = {
    kind: 'ok',
    title: 'Ready path is LumaCore + Lua. No extra crack file.',
  };
  if (lumaMissing) {
    verdict = { kind: 'bad', title: 'Install LumaCore first — games will not show as owned in Steam without it.' };
  } else if (denuvoRemoved) {
    verdict = {
      kind: 'ok',
      title: 'Publisher removed Denuvo. Ready path is LumaCore + Lua on the current Steam build — no extra crack file.',
    };
  } else if (hasDenuvo && !isCracked && !canInstall) {
    verdict = {
      kind: 'bad',
      title: 'Denuvo is still on this title and there is no catalog file. It will not launch. Do not hunt hypervisor packs.',
    };
  } else if (!isDrmFree && !isSteamDrm && isCracked && canInstall && crackBid && installedBid && crackBid !== installedBid) {
    verdict = {
      kind: 'warn',
      title: `Catalog file is for build ${crackBid}. Installed is ${installedBid} — downgrade, then apply the file.`,
    };
  } else if (!isDrmFree && !isSteamDrm && isCracked && canInstall) {
    verdict = { kind: 'ok', title: 'Extra DRM: download the catalog file, then copy it into the game folder.' };
  } else if (!isDrmFree && !isSteamDrm && isCracked && !canInstall) {
    verdict = { kind: 'warn', title: 'Marked cracked, but the catalog has no installable file yet.' };
  } else if (!isDrmFree && !isSteamDrm && !isCracked) {
    verdict = { kind: 'bad', title: `Still protected (${protection || 'unknown'}). No extra file is listed — this will not start.` };
  }

  const openLuma = () => window.dispatchEvent(new Event('open_lumacore_modal'));

  return (
    <section className={`unlock-recipe unlock-verdict-${verdict.kind}`}>
      <div className="unlock-kicker">Unlock recipe</div>
      <p className="unlock-verdict">{verdict.title}</p>
      <div className="unlock-list">
        <Row
          state={lumaMissing ? 'bad' : lumaUpdate ? 'warn' : 'ok'}
          title="LumaCore"
          detail={
            lumaMissing
              ? 'Not installed in the Steam folder'
              : lumaUpdate
                ? `Update available (${recipe?.lumacore_version || lumaCore?.installed || 'installed'} → ${recipe?.lumacore_latest || lumaCore?.latest})`
                : recipe?.lumacore_version || lumaCore?.installed || 'Installed'
          }
          action={
            (lumaMissing || lumaUpdate) ? (
              <button type="button" className="unlock-action" onClick={openLuma}>Setup</button>
            ) : null
          }
        />
        <Row
          state={recipe?.lua ? 'ok' : 'warn'}
          title="Lua / license"
          detail={recipe?.lua ? 'stplug-in file is present' : 'Not written yet — download or add the game first'}
        />
        <Row
          state={recipe?.installed ? 'ok' : 'warn'}
          title="Installed files"
          detail={recipe?.installed ? (installedBid ? `Build ${installedBid}` : 'On disk') : 'Not installed'}
        />
        <Row
          state={
            denuvoRemoved || isDrmFree || isSteamDrm
              ? 'ok'
              : hasDenuvo && !isCracked && !canInstall
                ? 'bad'
                : canInstall
                  ? 'ok'
                  : 'warn'
          }
          title="Extra DRM"
          detail={
            denuvoRemoved
              ? 'Denuvo was removed by the developer — current Steam build needs no crack file'
              : isDrmFree
                ? 'DRM-Free — no crack file'
                : isSteamDrm
                  ? 'Steam DRM only — LumaCore is enough'
                  : hasDenuvo && !isCracked && !canInstall
                    ? 'Denuvo, uncracked — will not launch'
                    : canInstall
                      ? `Catalog file${crackBid ? ` for build ${crackBid}` : ''}`
                      : (protection || 'Unknown protection')
          }
          action={
            canInstall || crackBid ? (
              <button type="button" className="unlock-action" onClick={onOpenCrackTab}>
                <Download size={11} /> Crack tab
              </button>
            ) : null
          }
        />
        <Row
          state={!crackBid || !installedBid ? 'warn' : crackBid === installedBid ? 'ok' : 'warn'}
          title="Build match"
          detail={
            !installedBid
              ? 'Installed build unknown until the game is on disk'
              : !crackBid
                ? 'Catalog did not name a build — not guessing'
                : crackBid === installedBid
                  ? `${installedBid} matches the catalog file`
                  : `Installed ${installedBid} vs crack ${crackBid}`
          }
          action={
            crackBid && installedBid && crackBid !== installedBid ? (
              <button type="button" className="unlock-action" onClick={() => onDowngrade?.(crackBid)}>
                Downgrade
              </button>
            ) : null
          }
        />
        <Row
          state={recipe?.steam_updates === 'blocked' ? 'ok' : 'warn'}
          title="Steam client updates"
          detail={
            recipe?.steam_updates === 'blocked'
              ? 'Blocked in steam.cfg — Steam will not overwrite installs'
              : recipe?.steam_updates === 'unblocked'
                ? 'Allowed — Steam can overwrite a pinned build'
                : 'Unknown — check Settings if a crack is build-locked'
          }
        />
      </div>
      {hasDenuvo && !isCracked && !canInstall && (
        <p className="unlock-hv-note">
          <ShieldAlert size={12} /> Hypervisor tools stay out of Kraken. They need kernel/driver changes and were removed after the old host went malware.
        </p>
      )}
    </section>
  );
}
