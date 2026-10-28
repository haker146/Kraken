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

# Public crack-watch sites often copy a Denuvo label from the 2020 crack window.
# RDR2 on PC never shipped Denuvo; it uses Digital.ai (formerly Arxan) + Rockstar.
_PROTECTION_BY_APPID = {
    "1174180": "Digital.ai (Arxan) + Rockstar Games Launcher",
    # 007 First Light — IO Interactive stripped Denuvo in a later Steam build
    # (not "From Russia with Love", which never had Denuvo).
    "3768760": "Denuvo removed by developer",
}
_PROTECTION_BY_SLUG = {
    "red-dead-redemption-2": "Digital.ai (Arxan) + Rockstar Games Launcher",
    "007-first-light": "Denuvo removed by developer",
}

_DENUVO_REMOVED_RE = re.compile(
    r"denuvo.{0,48}(removed|stripped|dropped|retired)|"
    r"(?:removed|stripped|dropped|retired).{0,24}denuvo",
    re.I,
)
_DENUVO_REMOVED_APPIDS = {"3768760"}
_removed_lock = threading.Lock()
_removed_cache: tuple[float, set[str]] = (0.0, set())
_REMOVED_TTL = 12 * 3600

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


def _protection_override(name: str = "", app_id=None, slug: str = "") -> str:
    aid = str(app_id or "").strip()
    if aid and aid in _PROTECTION_BY_APPID:
        return _PROTECTION_BY_APPID[aid]
    key = str(slug or slugify(name) or "").strip().lower()
    return _PROTECTION_BY_SLUG.get(key, "")


def _seed_denuvo_removed() -> set[str]:
    found = set(_DENUVO_REMOVED_APPIDS)
    found.update(k for k, v in _PROTECTION_BY_SLUG.items() if "removed" in v.lower())
    return found


def _scrape_denuvo_removed() -> None:
    global _removed_cache
    found = _seed_denuvo_removed()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
    urls = (
        "https://crackrelease.com/denuvo-removed-games/",
        "https://crackrelease.com/denuvo-removed/",
        "https://crackrelease.com/wp-json/wp/v2/posts?search=denuvo%20removed&per_page=20",
    )
    try:
        with httpx.Client(timeout=8.0, follow_redirects=True, headers=headers) as client:
            for url in urls:
                try:
                    resp = client.get(url)
                    if resp.status_code != 200:
                        continue
                    body = resp.text
                    if "wp-json" in url:
                        try:
                            posts = resp.json()
                        except Exception:
                            posts = []
                        for post in posts or []:
                            title = str((post.get("title") or {}).get("rendered") or "")
                            slug = slugify(
                                title.replace("Denuvo Removed", "")
                                .replace("Denuvo", "")
                                .replace("Crack", "")
                            )
                            if slug:
                                found.add(slug)
                    else:
                        for app_id in re.findall(r"/app(?:s)?/(\d+)", body):
                            found.add(app_id)
                        for href in re.findall(r'href="https?://[^"]*isitcracked\.com/game/([^"/]+)', body):
                            found.add(href.strip("/").lower())
                        for href in re.findall(r'href="https?://crackrelease\.com/([^"/]+)/?"', body):
                            piece = href.strip("/").lower()
                            if piece and piece not in {
                                "denuvo-removed",
                                "denuvo-removed-games",
                                "uncracked-denuvo-games",
                            }:
                                found.add(piece)
                except (httpx.TimeoutException, httpx.RequestError):
                    continue
    except Exception as exc:
        logger.debug("denuvo-removed index failed: %s", exc)
    with _removed_lock:
        _removed_cache = (time.time(), set(found))


def _refresh_denuvo_removed_index() -> set[str]:
    """App IDs + slugs of titles where the publisher later dropped Denuvo."""
    now = time.time()
    with _removed_lock:
        ts, cached = _removed_cache
        if cached and (now - ts) < _REMOVED_TTL:
            return set(cached)
        seed = set(cached) if cached else _seed_denuvo_removed()
        _removed_cache = (now, seed)
    threading.Thread(target=_scrape_denuvo_removed, daemon=True, name="denuvo-removed").start()
    return seed


def denuvo_removed_by_developer(
    name: str = "",
    app_id=None,
    protection: str = "",
    status_key: str = "",
    slug: str = "",
) -> bool:
    aid = str(app_id or "").strip()
    if aid in _DENUVO_REMOVED_APPIDS or aid in _PROTECTION_BY_APPID and "removed" in _PROTECTION_BY_APPID[aid].lower():
        return True
    blob = f"{protection} {status_key} {slug} {name}"
    if _DENUVO_REMOVED_RE.search(blob):
        return True
    key = str(slug or slugify(name) or "").strip().lower()
    if key in _PROTECTION_BY_SLUG and "removed" in _PROTECTION_BY_SLUG[key].lower():
        return True
    try:
        index = _refresh_denuvo_removed_index()
    except Exception:
        index = set(_DENUVO_REMOVED_APPIDS)
    if aid and aid in index:
        return True
    if key and key in index:
        return True
    return False


def _rewrite_removed_protection(protection: str) -> str:
    prot = str(protection or "").strip()
    if not prot or _DENUVO_REMOVED_RE.search(prot):
        return prot or "Denuvo removed by developer"
    parts = [
        re.sub(r"\s+", " ", part).strip()
        for part in re.split(r"\s*(?:\+| / |/|,|&|\band\b)\s*", prot)
        if part and "denuvo" not in part.lower()
    ]
    if parts:
        return "Denuvo removed by developer + " + " + ".join(parts)
    return "Denuvo removed by developer"


def _apply_protection_override(parsed: dict | None, name: str = "", app_id=None, slug: str = "") -> dict | None:
    result = dict(parsed or {})
    override = _protection_override(name, app_id, slug or result.get("slug") or "")
    if override:
        result["protection"] = override
    if denuvo_removed_by_developer(
        name,
        app_id,
        result.get("protection") or "",
        result.get("status_key") or "",
        slug or result.get("slug") or "",
    ):
        result["denuvo_removed"] = True
        result["protection"] = _rewrite_removed_protection(result.get("protection") or override)
    return result or None


def _fetch_isitcracked(slug: str) -> dict | None:
    headers_base = {
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
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
                        return parsed
                except (httpx.TimeoutException, httpx.RequestError) as exc:
                    logger.debug("isitcracked fetch failed for %s: %s", slug, exc)
    except Exception as exc:
        logger.debug("isitcracked client error for %s: %s", slug, exc)
    return None


def _fetch_crackrelease(slug: str) -> dict | None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        from bs4 import BeautifulSoup
        with httpx.Client(timeout=6.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(f"https://crackrelease.com/{slug}/")
            if resp.status_code != 200:
                return None
            soup = BeautifulSoup(resp.text, "html.parser")
            pill = soup.select_one(".gam-status-pill")
            counter = soup.select_one(".gam-status-counter")
            status_text = pill.get_text(strip=True).title() if pill else ""
            if not status_text:
                return None
            meta = {}
            for item in soup.select(".cw-meta-item"):
                txt = item.get_text(":", strip=True).split(":", 1)
                if len(txt) == 2:
                    meta[txt[0].strip().upper()] = txt[1].strip()
            return {
                "status": status_text,
                "status_key": status_text.lower(),
                "days": counter.get_text(strip=True) if counter else "",
                "protection": meta.get("DRM PROTECTION", ""),
                "scene_group": meta.get("SCENE GROUP", ""),
                "crack_date": meta.get("CRACK DATE", ""),
                "release_date": meta.get("RELEASE DATE", ""),
                "url": str(resp.url),
                "slug": slug,
            }
    except Exception as exc:
        logger.debug("crackrelease fetch failed for %s: %s", slug, exc)
        return None


def _fetch_slug(slug: str) -> dict | None:
    now = time.time()
    with _lock:
        cached = _slug_cache.get(slug)
        if cached and (now - cached[0]) < _TTL:
            return dict(cached[1]) if cached[1] else None

    # crackrelease has scene dates; its DRM field is often wrong (RDR2 listed as Denuvo).
    parsed = _fetch_crackrelease(slug)
    ic = None
    remote_prot = str((parsed or {}).get("protection") or "")
    if not parsed or "denuvo" in remote_prot.lower():
        ic = _fetch_isitcracked(slug)
        if not parsed:
            parsed = ic
        elif ic:
            ic_prot = str(ic.get("protection") or "")
            if ic_prot and "denuvo" not in ic_prot.lower():
                parsed["protection"] = ic_prot
            for key in ("status", "status_key", "days", "url"):
                if ic.get(key) and not parsed.get(key):
                    parsed[key] = ic[key]

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
            data = dict(cached[1]) if cached[1] else {}
            return _apply_protection_override(data, name, app_id) or data

    result: dict = {}
    for slug in _slug_candidates(name, app_id):
        parsed = _fetch_slug(slug)
        if parsed:
            result = _apply_protection_override(parsed, name, app_id, slug) or parsed
            break
    else:
        override = _protection_override(name, app_id)
        if override:
            result = {"protection": override, "status": "", "status_key": ""}

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
                data = dict(cached[1]) if cached[1] else {}
                fixed = _apply_protection_override(data, name, aid) or data
                if fixed:
                    out[aid] = fixed
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
