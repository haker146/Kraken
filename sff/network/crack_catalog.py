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

"""Crack-list catalog hosted on the Kraken data branch (not main)."""

from __future__ import annotations

import logging
import threading
import time
from urllib.parse import quote

import httpx

from sff.core.strings import GITHUB_USERNAME, REPO_NAME

logger = logging.getLogger(__name__)

CRACK_DATA_BRANCH = "Konungs-skuggsjá"
CRACK_DATA_FILENAME = "crackfiles.json"
_TTL = 3600.0
_TIMEOUT = 12.0

_lock = threading.Lock()
_cache_map: dict[str, str] = {}
_cache_by_appid: dict[str, dict] = {}
_cache_full: list[dict] = []
_cache_time = 0.0
_fetching = False


def crack_json_url() -> str:
    branch = quote(CRACK_DATA_BRANCH, safe="")
    return (
        f"https://raw.githubusercontent.com/{GITHUB_USERNAME}/{REPO_NAME}/"
        f"{branch}/{CRACK_DATA_FILENAME}"
    )


def crack_json_fallback_url() -> str:
    branch = quote(CRACK_DATA_BRANCH, safe="")
    return (
        f"https://github.com/{GITHUB_USERNAME}/{REPO_NAME}/raw/refs/heads/"
        f"{branch}/{CRACK_DATA_FILENAME}"
    )


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
        full.append({
            "name": name,
            "name_key": _normalize_name(name),
            "appid": app_id,
            "buildid": bid,
            "source_crack": [str(x) for x in (raw.get("source_crack") or []) if x],
            "original_download": [str(x) for x in (raw.get("original_download") or []) if x],
            "fixes": [
                {
                    "href": str(item.get("href", "") or ""),
                    "filename": str(item.get("filename", "") or ""),
                    "badges": [str(b) for b in (item.get("badges") or [])],
                }
                for item in (raw.get("fixes") or [])
                if isinstance(item, dict) and item.get("href")
            ],
        })
    return full


def _apply_cache(entries: list[dict]) -> None:
    global _cache_map, _cache_by_appid, _cache_full, _cache_time
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


def _download() -> list[dict]:
    headers = {
        "User-Agent": "Kraken-CrackCatalog/1.0",
        "Accept": "application/json",
    }
    last_error = None
    for url in (crack_json_url(), crack_json_fallback_url()):
        try:
            resp = httpx.get(url, follow_redirects=True, timeout=_TIMEOUT, headers=headers)
            if resp.status_code != 200:
                last_error = f"{url} -> HTTP {resp.status_code}"
                continue
            return _parse_entries(resp.json())
        except Exception as exc:
            last_error = f"{url} -> {exc}"
    if last_error:
        logger.debug("crack catalog fetch failed: %s", last_error)
    return []


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
    if aid and aid in _cache_by_appid:
        return _cache_by_appid[aid]
    target = _normalize_name(game_name)
    if not target:
        return None
    for entry in _cache_full:
        if entry.get("name_key") == target:
            return entry
    for entry in _cache_full:
        name = entry.get("name_key") or ""
        if name and target.startswith(name):
            rest = target[len(name):]
            if not rest or not rest[0].isalnum():
                return entry
    return None


def pick_fix(entry) -> dict | None:
    if not entry:
        return None
    fixes = [item for item in entry.get("fixes", []) if item.get("href")]
    if not fixes:
        return None

    def _rank(item):
        badges = [str(b).lower() for b in item.get("badges", [])]
        if "crack only" in badges:
            return 0
        if "crack" in badges:
            return 1
        if "crackfix" in badges:
            return 2
        return 3

    return sorted(fixes, key=_rank)[0]


def extra_drm_still_present(protection: str, crack_status: str = "") -> bool:
    """True when a non-Steam DRM (Denuvo, EAC, …) is still on the title."""
    prot = str(protection or "").strip().lower()
    if not prot or prot in ("steam", "steamworks"):
        return False
    status = str(crack_status or "").strip().lower()
    if "drm-free" in status or "drm free" in status:
        return False
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
