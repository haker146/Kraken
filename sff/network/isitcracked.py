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

"""Look up DRM protection and crack status from isitcracked.com.

The public site is a client-rendered SPA for normal browsers. Their
prerender path (crawler user-agents) returns HTML that already includes
status pills and the DRM protection field. Results are cached in memory.
"""

from __future__ import annotations

import logging
import re
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Iterable

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://isitcracked.com/game/"
_TTL = 6 * 3600
_TIMEOUT = 10.0
_MAX_WORKERS = 6

# Prerendered HTML is served to link-preview / search crawlers.
_USER_AGENTS = (
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
)

_STATUS_CLASS_RE = re.compile(
    r"bg-status-(uncracked|cracked|hypervisor|unreleased|early-access)",
    re.IGNORECASE,
)
_STATUS_TEXT_RE = re.compile(
    r"uppercase[^>]*>\s*(Uncracked|Cracked|Hypervisor|Unreleased|Early Access)\s*<",
    re.IGNORECASE,
)
_DRM_RE = re.compile(
    r"DRM Protection</span>.*?<p[^>]*>\s*([^<]+?)\s*</p>",
    re.IGNORECASE | re.DOTALL,
)
_NOT_FOUND_RE = re.compile(r"Game Not Found", re.IGNORECASE)
_DAYS_RE = re.compile(r"(\d+)\s+days?\s+and counting", re.IGNORECASE)

_STATUS_LABELS = {
    "uncracked": "Uncracked",
    "cracked": "Cracked",
    "hypervisor": "Hypervisor",
    "unreleased": "Unreleased",
    "early-access": "Early Access",
}

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict]] = {}
_slug_cache: dict[str, tuple[float, dict]] = {}


def slugify(name: str) -> str:
    text = unicodedata.normalize("NFKD", str(name or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    for mark in ("\u2122", "\u00ae", "\u00a9", "\u2117"):
        text = text.replace(mark, "")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text


def _slug_candidates(name: str, app_id=None) -> list[str]:
    raw = str(name or "").strip()
    out: list[str] = []
    seen: set[str] = set()

    def _add(value: str):
        slug = slugify(value)
        if slug and slug not in seen:
            seen.add(slug)
            out.append(slug)

    _add(raw)
    if ":" in raw:
        _add(raw.split(":", 1)[0])
    stripped = re.sub(
        r"\s*[\(\[][^\)\]]+[\)\]]\s*$",
        "",
        raw,
    ).strip()
    if stripped != raw:
        _add(stripped)
    for suffix in (
        " definitive edition",
        " gold edition",
        " deluxe edition",
        " complete edition",
        " game of the year",
        " goty",
        " enhanced edition",
    ):
        lower = raw.lower()
        if lower.endswith(suffix):
            _add(raw[: -len(suffix)])
    if app_id and str(app_id).isdigit():
        _add(str(app_id))
    return out[:6]


def _parse_html(html: str) -> dict | None:
    if not html:
        return None
    if _NOT_FOUND_RE.search(html) and not _STATUS_CLASS_RE.search(html):
        return None
    status_key = ""
    class_m = _STATUS_CLASS_RE.search(html)
    if class_m:
        status_key = class_m.group(1).lower()
    else:
        text_m = _STATUS_TEXT_RE.search(html)
        if text_m:
            status_key = text_m.group(1).lower().replace(" ", "-")
    if not status_key:
        return None
    protection = ""
    drm_m = _DRM_RE.search(html)
    if drm_m:
        protection = re.sub(r"\s+", " ", drm_m.group(1)).strip()
    days = ""
    days_m = _DAYS_RE.search(html)
    if days_m:
        days = days_m.group(1)
    return {
        "status": _STATUS_LABELS.get(status_key, status_key.replace("-", " ").title()),
        "status_key": status_key,
        "protection": protection,
        "days": days,
    }


def _fetch_slug(slug: str) -> dict | None:
    now = time.time()
    with _lock:
        cached = _slug_cache.get(slug)
        if cached and (now - cached[0]) < _TTL:
            return dict(cached[1]) if cached[1] else None

    headers_base = {
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
    parsed = None
    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
            for ua in _USER_AGENTS:
                try:
                    resp = client.get(_BASE + slug, headers={**headers_base, "User-Agent": ua})
                    if resp.status_code != 200:
                        continue
                    parsed = _parse_html(resp.text)
                    if parsed:
                        parsed["url"] = _BASE + slug
                        parsed["slug"] = slug
                        break
                except (httpx.TimeoutException, httpx.RequestError) as exc:
                    logger.debug("isitcracked fetch failed for %s: %s", slug, exc)
    except Exception as exc:
        logger.debug("isitcracked client error for %s: %s", slug, exc)
        parsed = None

    with _lock:
        _slug_cache[slug] = (time.time(), dict(parsed) if parsed else {})
        if len(_slug_cache) > 4000:
            oldest = sorted(_slug_cache.items(), key=lambda kv: kv[1][0])[:1500]
            for key, _ in oldest:
                _slug_cache.pop(key, None)
    return parsed


def lookup_game(name: str, app_id=None) -> dict:
    """Return {status, protection, url, slug, days} or empty dict."""
    cache_key = str(app_id or "") or slugify(name)
    now = time.time()
    with _lock:
        cached = _cache.get(cache_key)
        if cached and (now - cached[0]) < _TTL:
            return dict(cached[1])

    result: dict = {}
    for slug in _slug_candidates(name, app_id):
        parsed = _fetch_slug(slug)
        if parsed:
            result = parsed
            break

    with _lock:
        _cache[cache_key] = (time.time(), dict(result))
    return result


def lookup_games(games: Iterable[dict]) -> dict[int, dict]:
    """Batch-lookup a store page. Keys are int app_ids."""
    pending: list[tuple[int, str]] = []
    out: dict[int, dict] = {}
    now = time.time()
    for game in games or []:
        try:
            aid = int(game.get("app_id") or 0)
        except (TypeError, ValueError):
            continue
        if aid <= 0:
            continue
        name = str(game.get("name") or "")
        with _lock:
            cached = _cache.get(str(aid))
            if cached and (now - cached[0]) < _TTL:
                if cached[1]:
                    out[aid] = dict(cached[1])
                continue
        pending.append((aid, name))

    if not pending:
        return out

    def _one(pair):
        aid, name = pair
        return aid, lookup_game(name, aid)

    workers = min(_MAX_WORKERS, len(pending))
    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = [pool.submit(_one, item) for item in pending]
            for fut in as_completed(futs):
                try:
                    aid, data = fut.result()
                    if data:
                        out[int(aid)] = data
                except Exception as exc:
                    logger.debug("isitcracked worker failed: %s", exc)
    except Exception as exc:
        logger.debug("isitcracked batch failed: %s", exc)
    return out
