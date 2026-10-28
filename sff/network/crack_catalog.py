# SteaMidra - Steam game setup and manifest tool (SFF)
# Copyright (c) 2025-2026 Midrag (https://github.com/Midrags)
#
# This file is part of SteaMidra.
#
# SteaMidra is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# SteaMidra is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with SteaMidra.  If not, see <https://www.gnu.org/licenses/>.

"""Crack-list catalog hosted on the Kraken Ship-hold branch / catalog release."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
import threading
import time
from urllib.parse import quote

import httpx

from sff.core.strings import GITHUB_USERNAME, REPO_NAME

logger = logging.getLogger(__name__)

# Data-only branch. Do not merge into main. GitHub branch names cannot contain spaces.
CRACK_DATA_BRANCH = "Ship-hold"
# Dedicated catalog tag — never v*, never /releases/latest (that URL is the app).
CRACK_RELEASE_TAG = "ship-hold"
CRACK_DATA_FILENAME = "crackfiles.json"
_TTL = 3600.0
_TIMEOUT = 12.0

_lock = threading.Lock()
_cache_map: dict[str, str] = {}
_cache_by_appid: dict[str, dict] = {}
_cache_full: list[dict] = []
_cache_time = 0.0
_fetching = False


def crack_json_urls() -> tuple[str, ...]:
    branch = quote(CRACK_DATA_BRANCH, safe="")
    return (
        f"https://github.com/{GITHUB_USERNAME}/{REPO_NAME}/releases/download/"
        f"{CRACK_RELEASE_TAG}/{CRACK_DATA_FILENAME}",
        f"https://raw.githubusercontent.com/{GITHUB_USERNAME}/{REPO_NAME}/"
        f"{branch}/{CRACK_DATA_FILENAME}",
        f"https://github.com/{GITHUB_USERNAME}/{REPO_NAME}/raw/refs/heads/"
        f"{branch}/{CRACK_DATA_FILENAME}",
    )


def crack_json_url() -> str:
    return crack_json_urls()[0]


def crack_json_fallback_url() -> str:
    return crack_json_urls()[1]


def _normalize_name(value) -> str:
    return " ".join(str(value or "").lower().replace("’", "'").split())


def _parse_entries(data) -> list[dict]:
    if isinstance(data, dict):
        data = data.get("games") or data.get("entries") or []
    if not isinstance(data, list):
        return []
    full = []
    for raw in data:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name", "") or "").strip()
        if not name:
            continue
        app_id = str(raw.get("appid") or raw.get("app_id") or "").strip()
        if app_id and not app_id.isdigit():
            app_id = ""
        bid = str(raw.get("buildid") or raw.get("build_id") or "").strip()
        fixes = []
        for item in raw.get("fixes") or []:
            if not isinstance(item, dict) or not item.get("href"):
                continue
            fix = {
                "href": str(item.get("href", "") or ""),
                "filename": str(item.get("filename", "") or ""),
                "size": str(item.get("size", "") or ""),
                "badges": [str(b) for b in (item.get("badges") or [])],
            }
            item_build = str(item.get("buildid") or "").strip()
            item_ver = str(item.get("version") or "").strip()
            if item_build:
                fix["buildid"] = item_build
            if item_ver:
                fix["version"] = item_ver
            fixes.append(fix)
        drm = str(raw.get("drm") or raw.get("protection") or "").strip()
        notes = str(raw.get("notes") or "").strip()
        denuvo_removed = bool(raw.get("denuvo_removed")) or bool(
            re.search(
                r"denuvo.{0,48}(removed|stripped|dropped)|(?:removed|stripped|dropped).{0,24}denuvo",
                f"{drm} {notes}",
                re.I,
            )
        )
        full.append({
            "name": name,
            "name_key": _normalize_name(name),
            "appid": app_id,
            "buildid": bid,
            "source_crack": [str(x) for x in (raw.get("source_crack") or []) if x],
            "original_download": [str(x) for x in (raw.get("original_download") or []) if x],
            "drm": drm,
            "notes": notes,
            "denuvo_removed": denuvo_removed,
            "fixes": fixes,
        })
    return full


def _combine_entries(entries: list[dict]) -> dict:
    """Merge duplicate catalog rows for the same game (appid or name)."""
    kept = [e for e in entries if isinstance(e, dict)]
    if not kept:
        return {}
    out = dict(kept[0])
    hrefs: dict[str, dict] = {}
    sources: list[str] = []
    originals: list[str] = []
    best_bid = 0
    for entry in kept:
        aid = str(entry.get("appid") or "").strip()
        if entry.get("denuvo_removed"):
            out["denuvo_removed"] = True
        if str(entry.get("drm") or "").strip() and not str(out.get("drm") or "").strip():
            out["drm"] = entry.get("drm")
        if aid and not str(out.get("appid") or "").strip():
            out["appid"] = aid
        name = str(entry.get("name") or "").strip()
        if name and (not out.get("name") or len(name) < len(str(out.get("name") or ""))):
            out["name"] = name
            out["name_key"] = entry.get("name_key") or _normalize_name(name)
        bid_raw = str(entry.get("buildid") or "").strip()
        try:
            bid_n = int(bid_raw) if bid_raw else 0
        except ValueError:
            bid_n = 0
        if bid_n >= best_bid and bid_raw:
            best_bid = bid_n
            out["buildid"] = bid_raw
        elif bid_raw and not str(out.get("buildid") or "").strip():
            out["buildid"] = bid_raw
        for item in entry.get("fixes") or []:
            href = str((item or {}).get("href") or "").strip()
            if href:
                hrefs[href] = item
        sources.extend(str(x) for x in (entry.get("source_crack") or []) if x)
        originals.extend(str(x) for x in (entry.get("original_download") or []) if x)
    out["fixes"] = list(hrefs.values())
    out["source_crack"] = list(dict.fromkeys(sources))
    out["original_download"] = list(dict.fromkeys(originals))
    if not out.get("name_key"):
        out["name_key"] = _normalize_name(out.get("name"))
    return out


def _dedupe_entries(entries: list[dict]) -> list[dict]:
    groups: list[dict] = []
    index: dict[str, int] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        keys = []
        aid = str(entry.get("appid") or "").strip()
        nk = entry.get("name_key") or _normalize_name(entry.get("name"))
        if aid:
            keys.append(f"id:{aid}")
        if nk:
            keys.append(f"name:{nk}")
        if not keys:
            continue
        existing = next((index[k] for k in keys if k in index), None)
        if existing is None:
            idx = len(groups)
            groups.append(dict(entry))
            for key in keys:
                index[key] = idx
            continue
        groups[existing] = _combine_entries([groups[existing], entry])
        for key in keys:
            index[key] = existing
    return groups


def _apply_cache(entries: list[dict]) -> None:
    global _cache_map, _cache_by_appid, _cache_full, _cache_time
    entries = _dedupe_entries(entries)
    by_name = {}
    by_app = {}
    for entry in entries:
        key = entry.get("name_key") or _normalize_name(entry.get("name"))
        bid = str(entry.get("buildid") or "").strip()
        if key and bid:
            by_name[key] = bid
            by_name[str(entry.get("name") or "").strip().lower()] = bid
        app_id = str(entry.get("appid") or "").strip()
        if app_id:
            by_app[app_id] = entry
    _cache_map = by_name
    _cache_by_appid = by_app
    _cache_full = entries
    _cache_time = time.time()


def _entry_key(entry: dict) -> str:
    app_id = str(entry.get("appid") or "").strip()
    if app_id:
        return f"id:{app_id}"
    return f"name:{entry.get('name_key') or _normalize_name(entry.get('name'))}"


def _merge_entries(overlay: list[dict], base: list[dict]) -> list[dict]:
    """Kraken overlay wins on the same appid/name; CrakFiles fills the gaps."""
    by_key: dict[str, dict] = {}
    order: list[str] = []
    for entry in list(base) + list(overlay):
        key = _entry_key(entry)
        if not key or key.endswith(":"):
            continue
        existing = by_key.get(key)
        if existing is None:
            by_key[key] = entry
            order.append(key)
            continue
        existing_hrefs = bool(existing.get("fixes"))
        new_hrefs = bool(entry.get("fixes"))
        if new_hrefs and not existing_hrefs:
            by_key[key] = entry
            continue
        if new_hrefs or not existing_hrefs:
            merged = dict(existing)
            merged.update({k: v for k, v in entry.items() if v})
            if entry.get("fixes"):
                merged["fixes"] = entry["fixes"]
            by_key[key] = merged
    return [by_key[k] for k in order]


def _fetch_url(url: str) -> list[dict]:
    headers = {
        "User-Agent": "Kraken-CrackCatalog/1.0",
        "Accept": "application/json",
    }
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=_TIMEOUT, headers=headers)
        if resp.status_code != 200:
            logger.debug("crack catalog %s -> HTTP %s", url, resp.status_code)
            return []
        return _parse_entries(resp.json())
    except Exception as exc:
        logger.debug("crack catalog %s -> %s", url, exc)
        return []


def _download() -> list[dict]:
    remote_entries = []
    for url in crack_json_urls():
        remote_entries = _fetch_url(url)
        if remote_entries:
            break

    local_paths = [
        Path("crackfiles.json"),
        Path(__file__).resolve().parents[2] / "crackfiles.json",
    ]
    local_entries = []
    for lp in local_paths:
        if lp.is_file():
            try:
                with open(lp, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                local_entries = _parse_entries(raw)
                if local_entries:
                    break
            except Exception:
                pass

    if local_entries and remote_entries:
        return _merge_entries(local_entries, remote_entries)
    return local_entries or remote_entries or []



def prefetch(force: bool = False) -> None:
    global _fetching
    with _lock:
        if not force and _cache_full and (time.time() - _cache_time) < _TTL:
            return
        if _fetching:
            return
        _fetching = True
    try:
        entries = _download()
        with _lock:
            if entries or force or not _cache_full:
                _apply_cache(entries)
    finally:
        with _lock:
            _fetching = False


def get_entries() -> list[dict]:
    return list(_cache_full)


def get_buildid_map() -> dict[str, str]:
    """Return cached name -> buildid map. Never blocks on the network."""
    return dict(_cache_map)


def lookup(app_id=None, game_name=None) -> dict | None:
    """Return a catalog entry from cache only (startup prefetch fills it)."""
    aid = str(app_id or "").strip()
    target = _normalize_name(game_name)
    candidates: list[dict] = []
    if aid:
        for entry in _cache_full:
            if str(entry.get("appid") or "").strip() == aid:
                candidates.append(entry)
        cached = _cache_by_appid.get(aid)
        if cached is not None and cached not in candidates:
            candidates.append(cached)
    if target:
        for entry in _cache_full:
            if entry.get("name_key") == target and entry not in candidates:
                candidates.append(entry)
        if not candidates:
            for entry in _cache_full:
                name = entry.get("name_key") or ""
                if name and target.startswith(name):
                    rest = target[len(name):]
                    if not rest or not rest[0].isalnum():
                        candidates.append(entry)
                        break
    if not candidates:
        return None
    return _combine_entries(candidates) if len(candidates) > 1 else candidates[0]


def _fix_buildid(item, entry_buildid: str = "") -> str:
    bid = str((item or {}).get("buildid") or "").strip()
    if bid:
        return bid
    for badge in (item or {}).get("badges") or []:
        match = re.search(r"build\s+(\d{5,9})", str(badge), re.I)
        if match:
            return match.group(1)
    return str(entry_buildid or "").strip()


def pick_fix(entry, installed_buildid=None, require_match: bool = False) -> dict | None:
    """Prefer a fix whose buildid matches the installed Steam build."""
    if not entry:
        return None
    fixes = [item for item in entry.get("fixes", []) if item.get("href")]
    if not fixes:
        return None
    want = str(installed_buildid or "").strip()
    entry_bid = str(entry.get("buildid") or "").strip()

    def _rank(item):
        badges = [str(b).lower() for b in item.get("badges", [])]
        if "crack only" in badges:
            badge_rank = 0
        elif "crack" in badges:
            badge_rank = 1
        elif "crackfix" in badges:
            badge_rank = 2
        else:
            badge_rank = 3
        item_bid = _fix_buildid(item, entry_bid)
        if want and item_bid == want:
            match_rank = 0
        elif want and item_bid:
            match_rank = 2
        else:
            match_rank = 1
        return (match_rank, badge_rank)

    picked = sorted(fixes, key=_rank)[0]
    if require_match and want:
        if _fix_buildid(picked, entry_bid) != want:
            return None
    return picked


def has_href_for_build(entry, buildid=None) -> bool:
    """True when the catalog lists a downloadable file for this Steam build."""
    if not entry:
        return False
    want = str(buildid or "").strip()
    entry_bid = str(entry.get("buildid") or "").strip()
    for item in entry.get("fixes") or []:
        if not (item or {}).get("href"):
            continue
        if not want or _fix_buildid(item, entry_bid) == want:
            return True
    return False


def extra_drm_still_present(protection: str, crack_status: str = "") -> bool:
    """True when a non-Steam DRM (Denuvo, EAC, …) is still on the title."""
    prot = str(protection or "").strip().lower()
    if not prot or prot in ("steam", "steamworks"):
        return False
    status = str(crack_status or "").strip().lower()
    blob = f"{prot} {status}"
    if "drm-free" in blob or "drm free" in blob:
        return False
    if re.search(
        r"denuvo.{0,48}(removed|stripped|dropped|retired)|"
        r"(?:removed|stripped|dropped|retired).{0,24}denuvo",
        blob,
    ):
        rest = re.sub(
            r"denuvo.{0,48}(removed|stripped|dropped|retired)|"
            r"(?:removed|stripped|dropped|retired).{0,24}denuvo",
            " ",
            blob,
        )
        return bool(re.search(
            r"eac|battleye|ubisoft|uplay|arxan|vmprotect|epic|hypervisor|nprotect",
            rest,
        ))
    if "removed" in status or "stripped" in status:
        return False
    return True


def denuvo_still_present(protection: str, crack_status: str = "") -> bool:
    return "denuvo" in str(protection or "").lower() and extra_drm_still_present(
        protection, crack_status
    )


def attach_store_fields(game: dict) -> None:
    """Annotate a store/details row with crack build info from the catalog."""
    if not isinstance(game, dict):
        return
    entry = lookup(game.get("app_id") or game.get("appid"), game.get("name"))
    if not entry:
        return
    bid = str(entry.get("buildid") or "").strip()
    if bid:
        game["crack_buildid"] = bid
    prot = str(game.get("protection") or "")
    status = str(game.get("crack_status") or game.get("status_key") or "")
    if bid and denuvo_still_present(prot, status):
        game["crack_downgrade_build"] = bid


def catalog_fields(app_id=None, game_name=None, protection="", crack_status="") -> dict:
    entry = lookup(app_id, game_name)
    bid = str((entry or {}).get("buildid") or "").strip()
    show = bool(bid and denuvo_still_present(protection, crack_status))
    return {
        "crack_buildid": bid,
        "crack_downgrade_build": bid if show else "",
    }
