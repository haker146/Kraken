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

"""
Fetch game names and app details from Steam store (HTTP). No Steam client login.
Used when local ACF is missing and as fallback for DLC check when Steam API times out.
"""

import re
import logging
import time
from html.parser import HTMLParser

import httpx

logger = logging.getLogger(__name__)

# Store page title: "Game Name on Steam" or "Save 60% on Game Name on Steam"
_STEAM_TITLE_RE = re.compile(
    r"<title>\s*(.+)\s+(?:on|en)\s+Steam\s*</title>",
    re.IGNORECASE | re.DOTALL,
)
_STORE_TIMEOUT = 12.0
_STORE_API_DELAY = 0.4  # seconds between store API calls to avoid rate limit
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _store_get_json(url):
    try:
        resp = httpx.get(
            url,
            timeout=_STORE_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except (httpx.TimeoutException, httpx.RequestError, ValueError) as e:
        logger.debug("Store API request failed: %s", e)
        return None


_REQ_BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
_REQ_P_RE = re.compile(r"</p\s*>", re.IGNORECASE)
_REQ_TAG_RE = re.compile(r"<[^>]+>")

_ALLOWED_HTML_TAGS = frozenset({
    "p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h1", "h2", "h3",
    "h4", "h5", "span", "div", "img", "video", "source", "hr", "blockquote", "a",
})
_VOID_HTML_TAGS = frozenset({"br", "img", "hr", "source"})
_SKIP_HTML_TAGS = frozenset({"script", "style", "iframe", "object", "embed", "link", "meta", "form"})
_URL_ATTRS = frozenset({"src", "poster", "href"})
_BOOL_ATTRS = frozenset({"autoplay", "loop", "muted", "playsinline", "controls"})
_VIDEO_FILE_RE = re.compile(r"\.(?:webm|mp4)(?:$|\?)", re.IGNORECASE)
_ALLOWED_ATTRS = {
    "img": frozenset({"src", "alt", "width", "height", "loading", "class"}),
    "video": frozenset({"src", "poster", "controls", "autoplay", "loop", "muted", "playsinline", "width", "height"}),
    "source": frozenset({"src", "type"}),
    "a": frozenset({"href"}),
    "p": frozenset({"class"}),
    "h1": frozenset({"class"}),
    "h2": frozenset({"class"}),
    "h3": frozenset({"class"}),
    "ul": frozenset({"class"}),
    "ol": frozenset({"class"}),
    "li": frozenset({"class"}),
    "span": frozenset({"class"}),
    "div": frozenset({"class"}),
}


def _safe_media_url(value: str) -> str:
    url = str(value or "").strip()
    if url.startswith("//"):
        url = "https:" + url
    if not url:
        return ""
    lower = url.lower()
    if lower.startswith("javascript:") or lower.startswith("data:"):
        return ""
    if lower.startswith("http://") or lower.startswith("https://"):
        return url
    return ""


class _SteamHtmlSanitizer(HTMLParser):
    """Keep Steam about-this-game markup (images, GIFs, video) and drop scripts."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._out: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        tag = (tag or "").lower()
        if tag in _SKIP_HTML_TAGS:
            self._skip += 1
            return
        if self._skip or tag not in _ALLOWED_HTML_TAGS:
            return
        allowed = _ALLOWED_ATTRS.get(tag, frozenset())
        parts = []
        src_url = ""
        has_autoplay = False
        for name, value in attrs:
            key = (name or "").lower()
            if key not in allowed:
                continue
            if key == "autoplay":
                has_autoplay = True
            if key in _BOOL_ATTRS:
                parts.append(key)
                continue
            val = value or ""
            if key in _URL_ATTRS:
                val = _safe_media_url(val)
                if not val:
                    continue
                if key == "src":
                    src_url = val
            parts.append(f'{key}="{_html_attr(val)}"')
        if tag == "img" and not src_url:
            return
        if tag == "img" and _VIDEO_FILE_RE.search(src_url):
            self._out.append(
                f'<video src="{_html_attr(src_url)}" autoplay loop muted playsinline></video>'
            )
            return
        if tag == "video" and not has_autoplay:
            keys = {p.split("=", 1)[0] for p in parts}
            if "controls" not in keys:
                parts.append("controls")
            if "playsinline" not in keys:
                parts.append("playsinline")
        attr_str = (" " + " ".join(parts)) if parts else ""
        if tag in _VOID_HTML_TAGS:
            self._out.append(f"<{tag}{attr_str}>")
        else:
            self._out.append(f"<{tag}{attr_str}>")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = (tag or "").lower()
        if tag in _SKIP_HTML_TAGS:
            if self._skip:
                self._skip -= 1
            return
        if self._skip or tag not in _ALLOWED_HTML_TAGS or tag in _VOID_HTML_TAGS:
            return
        self._out.append(f"</{tag}>")

    def handle_data(self, data):
        if self._skip or not data:
            return
        self._out.append(_html_text(data))

    def get_html(self) -> str:
        html = "".join(self._out)
        html = re.sub(r"(?:<br>\s*){3,}", "<br><br>", html)
        return html.strip()[:120000]


def _html_attr(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _html_text(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def sanitize_store_html(html) -> str:
    if not html or not isinstance(html, str):
        return ""
    parser = _SteamHtmlSanitizer()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        return _REQ_TAG_RE.sub("", html)[:8000]
    return parser.get_html()


def _movie_urls(movie: dict, app_id: str = "") -> list[str]:
    """Build playable trailer URLs.

    Steam's appdetails payload often ships HLS/DASH only. Chromium (and
    QWebEngine) cannot play those in a <video> tag, but the older MP4
    CDN still hosts files keyed by the movie id — Portal 2's trailers
    are a typical example.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def _add(url):
        url = _safe_media_url(url or "")
        if not url or url in seen:
            return
        lower = url.lower()
        if lower.endswith(".m3u8") or ".mpd" in lower or "hls_" in lower:
            return
        seen.add(url)
        urls.append(url)

    webm = movie.get("webm") if isinstance(movie.get("webm"), dict) else {}
    mp4 = movie.get("mp4") if isinstance(movie.get("mp4"), dict) else {}
    for blob in (mp4, webm):
        for key in ("480", "max", "720", "1080"):
            _add(blob.get(key))
    _add(movie.get("highlight_url"))

    ids = []
    if movie.get("id"):
        ids.append(str(movie.get("id")))
    elif app_id:
        ids.append(str(app_id))
    hosts = (
        "https://cdn.akamai.steamstatic.com/steam/apps/{id}/{file}",
        "https://cdn.cloudflare.steamstatic.com/steam/apps/{id}/{file}",
    )
    files = ("movie480.mp4", "movie_max.mp4")
    for mid in ids:
        for host in hosts:
            for fname in files:
                _add(host.format(id=mid, file=fname))
    return urls


def _sanitize_requirements(html) -> str:
    if not html or not isinstance(html, str):
        return ""
    text = _REQ_BR_RE.sub("\n", html)
    text = _REQ_P_RE.sub("\n", text)
    text = _REQ_TAG_RE.sub("", text)
    lines = [ln.strip() for ln in text.splitlines()]
    return "\n".join(ln for ln in lines if ln)[:4000]


def _parse_store_app_data(inner: dict) -> dict:
    dlc = inner.get("dlc")
    if not isinstance(dlc, list):
        dlc = []
    dlc_ids = [int(x) for x in dlc if isinstance(x, (int, str)) and str(x).isdigit()]
    release = inner.get("release_date") or {}
    if not isinstance(release, dict):
        release = {}
    screenshots = []
    screenshot_thumbs = []
    for shot in (inner.get("screenshots") or [])[:40]:
        if not isinstance(shot, dict):
            continue
        full = _safe_media_url(shot.get("path_full") or "")
        thumb = _safe_media_url(shot.get("path_thumbnail") or "") or full
        if full:
            screenshots.append(full)
            screenshot_thumbs.append(thumb)
    app_id = str(inner.get("steam_appid") or "")
    movies = []
    trailer = ""
    trailer_poster = ""
    trailer_urls: list[str] = []
    raw_movies = [m for m in (inner.get("movies") or []) if isinstance(m, dict)]
    raw_movies.sort(key=lambda m: (not bool(m.get("highlight")), 0))
    for movie in raw_movies:
        urls = _movie_urls(movie, app_id)
        poster = _safe_media_url(movie.get("thumbnail") or "")
        if not urls and not poster:
            continue
        movies.append({
            "id": movie.get("id"),
            "name": movie.get("name") or "Trailer",
            "url": (urls[0] if urls else ""),
            "urls": urls,
            "poster": poster,
            "highlight": bool(movie.get("highlight")),
        })
        if urls and not trailer:
            trailer = urls[0]
            trailer_urls = urls
            trailer_poster = poster
    req = inner.get("pc_requirements") or {}
    if not isinstance(req, dict):
        req = {}
    genres = []
    for g in inner.get("genres") or []:
        if isinstance(g, dict) and g.get("description"):
            genres.append(str(g["description"]))
        elif isinstance(g, str):
            genres.append(g)
    categories = []
    for c in inner.get("categories") or []:
        if isinstance(c, dict) and c.get("description"):
            categories.append(str(c["description"]))
    developers = inner.get("developers") if isinstance(inner.get("developers"), list) else []
    publishers = inner.get("publishers") if isinstance(inner.get("publishers"), list) else []
    deck = ""
    deck_info = inner.get("steam_deck_compatibility") or {}
    if isinstance(deck_info, dict):
        cat = deck_info.get("category")
        if cat is not None:
            deck = str(cat)
    rec = inner.get("recommendations") if isinstance(inner.get("recommendations"), dict) else {}
    metacritic = inner.get("metacritic") if isinstance(inner.get("metacritic"), dict) else {}
    about_html = sanitize_store_html(inner.get("about_the_game") or "")
    detailed_html = sanitize_store_html(inner.get("detailed_description") or "")
    drm_notice = str(inner.get("drm_notice") or "").strip()
    account_notice = str(inner.get("ext_user_account_notice") or "").strip()
    parsed = {
        "name": inner.get("name") or "",
        "dlc": dlc_ids,
        "short_description": inner.get("short_description") or "",
        "about_html": about_html or detailed_html,
        "detailed_html": detailed_html,
        "release_date": release.get("date") or "",
        "coming_soon": bool(release.get("coming_soon")),
        "developers": [str(x) for x in developers if x],
        "publishers": [str(x) for x in publishers if x],
        "genres": genres,
        "categories": categories,
        "screenshots": screenshots,
        "screenshot_thumbs": screenshot_thumbs,
        "header_image": inner.get("header_image") or "",
        "background": inner.get("background") or inner.get("background_raw") or "",
        "website": inner.get("website") or "",
        "trailer": trailer,
        "trailer_urls": trailer_urls,
        "trailer_poster": trailer_poster,
        "movies": movies,
        "pc_requirements": _sanitize_requirements(req.get("minimum")),
        "pc_requirements_recommended": _sanitize_requirements(req.get("recommended")),
        "deck_category": deck,
        "drm_notice": drm_notice,
        "account_notice": account_notice,
        "review_count": rec.get("total") or 0,
        "metacritic": metacritic.get("score") or "",
        "steam_appid": app_id,
    }
    return parsed


_STORE_MP4_RE = re.compile(
    r"https://[^\"'\s<>]+movie(?:480|_max)\.(?:mp4|webm)",
    re.IGNORECASE,
)
_STORE_SHOT_RE = re.compile(
    r"https://[^\"'\s<>]+/apps/\d+/(?:[a-f0-9]{40}/)?ss_[a-f0-9]+\.(?:1920x1080|600x338)\.jpg[^\"'\s<>]*",
    re.IGNORECASE,
)
_STORE_MOVIE_ID_RE = re.compile(
    r"highlight_movie_(\d+)|store_item_assets/steam/apps/(\d+)/movie\.",
    re.IGNORECASE,
)


def _merge_store_page_media(details: dict, app_id: str) -> None:
    """Supplement API media with the public Steam store page (MP4s + shots)."""
    url = f"https://store.steampowered.com/app/{app_id}/?l=english"
    try:
        resp = httpx.get(
            url,
            timeout=_STORE_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
            cookies={
                "birthtime": "640584000",
                "mature_content": "1",
                "lastagecheckage": "1-January-1990",
                "wants_mature_content": "1",
            },
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return
        html = resp.text or ""
    except (httpx.TimeoutException, httpx.RequestError) as e:
        logger.debug("Store page media scrape failed for %s: %s", app_id, e)
        return

    shots = details.setdefault("screenshots", [])
    thumbs = details.setdefault("screenshot_thumbs", [])
    seen_shots = set(shots)
    for match in _STORE_SHOT_RE.findall(html):
        full = _safe_media_url(match.replace(".600x338.jpg", ".1920x1080.jpg"))
        thumb = _safe_media_url(match.replace(".1920x1080.jpg", ".600x338.jpg"))
        if full and full not in seen_shots:
            seen_shots.add(full)
            shots.append(full)
            thumbs.append(thumb or full)

    extra_mp4 = []
    seen_mp4 = set(details.get("trailer_urls") or [])
    for match in _STORE_MP4_RE.findall(html):
        mp4 = _safe_media_url(match)
        if mp4 and mp4 not in seen_mp4:
            seen_mp4.add(mp4)
            extra_mp4.append(mp4)
    for groups in _STORE_MOVIE_ID_RE.findall(html):
        mid = groups[0] or groups[1]
        if not mid or mid == str(app_id):
            continue
        for fname in ("movie480.mp4", "movie_max.mp4"):
            cand = f"https://cdn.akamai.steamstatic.com/steam/apps/{mid}/{fname}"
            if cand not in seen_mp4:
                seen_mp4.add(cand)
                extra_mp4.append(cand)
    if extra_mp4:
        trailer_urls = list(details.get("trailer_urls") or [])
        for mp4 in extra_mp4:
            if mp4 not in trailer_urls:
                trailer_urls.append(mp4)
        details["trailer_urls"] = trailer_urls
        if not details.get("trailer"):
            details["trailer"] = trailer_urls[0]
        movies = details.setdefault("movies", [])
        known = {str(m.get("id") or "") for m in movies}
        for mp4 in extra_mp4:
            mid = ""
            m = re.search(r"/apps/(\d+)/movie", mp4)
            if m:
                mid = m.group(1)
            if mid and mid in known:
                for movie in movies:
                    if str(movie.get("id")) == mid and mp4 not in (movie.get("urls") or []):
                        movie.setdefault("urls", []).append(mp4)
                        if not movie.get("url"):
                            movie["url"] = mp4
                continue
            movies.append({
                "id": mid or "",
                "name": "Trailer",
                "url": mp4,
                "urls": [mp4],
                "poster": details.get("trailer_poster") or "",
                "highlight": False,
            })
            if mid:
                known.add(mid)


def get_app_details_from_store(app_id, include_page_media=False):
    """
    Fetch app details from Steam Store API (no login).
    Returns dict with name, dlc ids, and catalog metadata, or None on failure.
    """
    url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&l=english"
    data = _store_get_json(url)
    if not data or not isinstance(data, dict):
        return None
    app_data = data.get(str(app_id))
    if not app_data or not app_data.get("success") or "data" not in app_data:
        return None
    inner = app_data["data"]
    if not isinstance(inner, dict):
        return None
    parsed = _parse_store_app_data(inner)
    if include_page_media and parsed:
        try:
            _merge_store_page_media(parsed, str(app_id))
        except Exception as e:
            logger.debug("Store page media merge failed for %s: %s", app_id, e)
    return parsed


def get_dlc_list_from_store(base_id):
    """
    Get base app name and DLC app id list from Store API (no Steam client).
    Returns (base_name, dlc_ids) or None on failure.
    """
    details = get_app_details_from_store(base_id)
    if not details:
        return None
    return (details["name"] or f"App {base_id}", details["dlc"])


def get_dlc_names_from_store(dlc_ids):
    """
    Fetch DLC names from Store API (one request per id, with short delay).
    Returns dict mapping app_id -> name; missing names are "DLC <id>".
    """
    result = {}
    for i, app_id in enumerate(dlc_ids):
        if i > 0:
            time.sleep(_STORE_API_DELAY)
        details = get_app_details_from_store(app_id)
        if details and details.get("name"):
            result[app_id] = details["name"]
        else:
            result[app_id] = f"DLC {app_id}"
    return result


def _review_payload(url):
    data = _store_get_json(url)
    if not data or not isinstance(data, dict) or data.get("success") != 1:
        return {}
    summary = data.get("query_summary") or {}
    if not isinstance(summary, dict):
        return {}
    total = int(summary.get("total_reviews") or 0)
    positive = int(summary.get("total_positive") or 0)
    percent = int(round((positive * 100.0 / total), 0)) if total else 0
    return {
        "review_label": str(summary.get("review_score_desc") or ""),
        "review_count": total,
        "review_percent": percent,
    }


def get_review_summary(app_id):
    """Fetch Steam overall + recent review labels. Returns dict or empty."""
    base = (
        f"https://store.steampowered.com/appreviews/{app_id}"
        "?json=1&language=all&purchase_type=all&num_per_page=0"
    )
    overall = _review_payload(base)
    recent = _review_payload(base + "&filter=recent&day_range=30")
    if not overall and not recent:
        return {}
    out = dict(overall)
    if recent.get("review_label"):
        out["review_recent_label"] = recent.get("review_label") or ""
        out["review_recent_count"] = recent.get("review_count") or 0
        out["review_recent_percent"] = recent.get("review_percent") or 0
    return out


def get_app_name_from_store(app_id):

    """
    Fetch app name from Steam store page (no Steam client login).
    Returns None on failure or if title cannot be parsed.
    """
    url = f"https://store.steampowered.com/app/{app_id}/"
    try:
        resp = httpx.get(
            url,
            timeout=_STORE_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return None
        html = resp.text
    except (httpx.TimeoutException, httpx.RequestError) as e:
        logger.debug("Store fetch failed for %s: %s", app_id, e)
        return None

    m = _STEAM_TITLE_RE.search(html)
    if not m:
        return None
    name = m.group(1).strip()
    # Trim " en " suffix if present (e.g. Spanish page)
    if " en " in name:
        name = name.split(" en ")[-1].strip()
    # Optional: strip "Save N% on " prefix for cleaner display
    if name.lower().startswith("save ") and " on " in name:
        parts = name.split(" on ", 1)
        if len(parts) == 2 and parts[0].strip().endswith("%"):
            name = parts[1].strip()
    return name if name else None
