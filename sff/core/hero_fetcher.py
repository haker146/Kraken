import json
import logging
import re
import threading
import time
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Exact / prefix / word-start / alias only. Substring matches (score 9)
# produce junk App IDs like 4705510 on the Home hero.
_MAX_HERO_MATCH_SCORE = 5
_MAX_PER_CATEGORY = 16


def fetch_dynamic_hero_lists():
    res = {
        "cracked": [],
        "not_cracked": [],
        "new_releases": [],
        "denuvo_removed": [],
        "names": {},
    }
    names = res["names"]

    from sff.game_list_fallback import get_app_name, iter_named_apps
    games_list = list(iter_named_apps())

    from sff.gui.bridges.store_bridge import _normalize_for_search, _store_search_score
    name_map = {}
    for g in games_list:
        n = g.get('name')
        aid = g.get('app_id') or g.get('appid')
        if n and aid:
            name_map[_normalize_for_search(n)] = str(aid)

    def _remember(aid, name=""):
        aid = str(aid or "").strip()
        if not aid:
            return False
        label = str(name or "").strip() or get_app_name(aid)
        if not label or label.lower().startswith("app "):
            return False
        names[aid] = label
        return True

    def _name_to_appid(name):
        n_norm = _normalize_for_search(name)
        if not n_norm:
            return None
        if n_norm in name_map:
            return name_map[n_norm]
        best = None
        best_score = 999
        prefix = n_norm[:5] if len(n_norm) >= 5 else n_norm
        for g in games_list:
            gn = g.get('name', '')
            if not gn:
                continue
            gn_norm = _normalize_for_search(gn)
            if prefix and prefix not in gn_norm:
                continue
            app_id = g.get('app_id') or g.get('appid')
            if not app_id:
                continue
            score, *_ = _store_search_score(name, gn, app_id)
            if score < best_score and score <= _MAX_HERO_MATCH_SCORE:
                best = str(app_id)
                best_score = score
                if score <= 2:
                    break
        return best

    def _append_named(bucket, aid, name=""):
        aid = str(aid or "").strip()
        if not aid or aid in res[bucket]:
            return
        if not _remember(aid, name):
            return
        if len(res[bucket]) >= _MAX_PER_CATEGORY:
            return
        res[bucket].append(aid)

    # 1. New Releases / Top Sellers from Steam API (includes names)
    try:
        r = httpx.get("https://store.steampowered.com/api/featuredcategories", timeout=10.0)
        if r.status_code == 200:
            j = r.json()
            for bucket_key in ("top_sellers", "new_releases"):
                for item in j.get(bucket_key, {}).get("items", []):
                    if not isinstance(item, dict):
                        continue
                    _append_named("new_releases", item.get("id"), item.get("name") or "")
    except Exception as e:
        logger.warning(f"Failed to fetch Steam categories: {e}")

    # 2. Uncracked Denuvo Games
    try:
        r = httpx.get("https://crackrelease.com/uncracked-denuvo-games/", follow_redirects=True, timeout=10.0)
        soup = BeautifulSoup(r.text, 'html.parser')
        uncracked_names = []
        for table in soup.find_all('table'):
            for tr in table.find_all('tr')[1:]:
                td = tr.find('td')
                if td and td.text:
                    uncracked_names.append(td.text.strip())

        for name in uncracked_names[:20]:
            aid = _name_to_appid(name)
            if aid:
                _append_named("not_cracked", aid, name)
    except Exception as e:
        logger.warning(f"Failed to fetch uncracked from crackrelease: {e}")

    # 3. Denuvo Removed
    try:
        r = httpx.get("https://crackrelease.com/wp-json/wp/v2/posts?search=denuvo%20removed&per_page=10", timeout=10.0)
        if r.status_code == 200:
            for post in r.json():
                title = post.get("title", {}).get("rendered", "")
                clean_title = title.replace("Denuvo Removed", "").replace("Denuvo", "").replace("Crack", "").strip(" -()[]:")
                aid = _name_to_appid(clean_title)
                if aid:
                    _append_named("denuvo_removed", aid, clean_title)
    except Exception as e:
        logger.warning(f"Failed to fetch denuvo removed: {e}")

    # 4. Cracked (Recent Cracks from WP API)
    try:
        r = httpx.get("https://crackrelease.com/wp-json/wp/v2/posts?per_page=20", timeout=10.0)
        if r.status_code == 200:
            for post in r.json():
                title = post.get("title", {}).get("rendered", "")
                clean_title = title.replace("Crack Status", "").replace("Crack", "").replace("Bypass", "").strip(" -()[]:")
                aid = _name_to_appid(clean_title)
                if aid:
                    _append_named("cracked", aid, clean_title)
    except Exception as e:
        logger.warning(f"Failed to fetch recent cracks: {e}")

    return res


_HOME_FEED_CACHE = None
_HOME_FEED_AT = 0.0
_HOME_FEED_TTL = 1800.0
_HOME_FEED_LOCK = threading.Lock()

_STEAM_STORE_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
_STEAM_STORE_COOKIES = {
    "wants_mature_content": "1",
    "lastagecheckage": "1-January-1990",
    "birthtime": "631152000",
}
_SKIP_HOME_NAME = re.compile(
    r"(soundtrack|\bos\b|season pass|battle pass|steam (?:frame|machine|deck)|"
    r"playtest|\bdemo\b|server dedicated|dedicated server)",
    re.I,
)
_APP_ID_RE = re.compile(r'data-ds-appid="(\d+)"', re.I)
_TITLE_AFTER_RE = re.compile(r'class="title">([^<]+)', re.I)
_IMG_AFTER_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
_HASHED_ART_RE = re.compile(r"/apps/\d+/[0-9a-f]{12,}/", re.I)
_TINY_CAPSULE_RE = re.compile(r"capsule_sm_120|capsule_231x87|capsule_184x69", re.I)
_ASSET_CDN = "https://shared.akamai.steamstatic.com/store_item_assets/"
_STORE_ITEMS_URL = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/"


def _steam_get(url, **kwargs):
    headers = {"User-Agent": _STEAM_STORE_UA, "Accept-Language": "en-US,en;q=0.9"}
    return httpx.get(
        url,
        timeout=kwargs.get("timeout", 12.0),
        headers=headers,
        cookies=_STEAM_STORE_COOKIES,
        follow_redirects=True,
    )


def _is_home_skip(name, app_id=""):
    label = str(name or "").strip()
    if not label or label.lower().startswith("app "):
        return True
    if _SKIP_HOME_NAME.search(label):
        return True
    aid = str(app_id or "")
    # Steam hardware / platform placeholders that have no game capsule.
    if aid in {"1675200", "2180100", "1628350"}:
        return True
    return False


def _parse_search_results(html):
    items = []
    seen = set()
    if not html:
        return items
    for match in _APP_ID_RE.finditer(html):
        aid = match.group(1)
        if aid in seen:
            continue
        chunk = html[match.start(): match.start() + 1800]
        title_m = _TITLE_AFTER_RE.search(chunk)
        img_m = _IMG_AFTER_RE.search(chunk)
        name = (title_m.group(1) if title_m else "").strip()
        if _is_home_skip(name, aid):
            continue
        seen.add(aid)
        raw_img = (img_m.group(1) if img_m else "").replace("&amp;", "&")
        if raw_img.startswith("//"):
            raw_img = "https:" + raw_img
        # Search HTML only embeds the small capsule. Keep that real URL;
        # _apply_store_art replaces it with the hashed 16:9 capsule when Steam has one.
        image = raw_img or (
            f"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{aid}/capsule_616x353.jpg"
        )
        items.append({"app_id": aid, "name": name, "image_url": image, "thumb_url": raw_img})
        if len(items) >= 16:
            break
    return items


def _steam_search_category(steam_filter):
    url = (
        "https://store.steampowered.com/search/results/"
        f"?query=&start=0&count=25&infinite=1&filter={steam_filter}"
        "&category1=998&cc=US&l=english&ignore_preferences=1"
    )
    try:
        r = _steam_get(url)
        if r.status_code != 200:
            logger.warning("Steam search %s returned %s", steam_filter, r.status_code)
            return []
        html = r.text
        try:
            payload = r.json()
            html = payload.get("results_html") or html
        except Exception:
            pass
        return _parse_search_results(html)
    except Exception as exc:
        logger.warning("Steam search %s failed: %s", steam_filter, exc)
        return []


def _featuredcategories_bucket(payload, key):
    items = []
    for raw in (payload.get(key) or {}).get("items") or []:
        if not isinstance(raw, dict):
            continue
        aid = str(raw.get("id") or "").strip()
        name = str(raw.get("name") or "").strip()
        if not aid or _is_home_skip(name, aid):
            continue
        large = (raw.get("large_capsule") or {}).get("image") or ""
        small = (raw.get("small_capsule") or {}).get("image") or raw.get("header_image") or ""
        image = large or small
        items.append({"app_id": aid, "name": name, "image_url": image})
        if len(items) >= 16:
            break
    return items


def _recommended_like(library_app_ids):
    recommended = []
    seen = set(str(x) for x in (library_app_ids or []) if str(x).strip())
    seeds = [aid for aid in seen if aid][:4]
    for seed in seeds:
        if len(recommended) >= 16:
            break
        try:
            r = _steam_get(f"https://store.steampowered.com/recommended/morelike/{seed}/")
            if r.status_code != 200:
                continue
            for item in _parse_search_results(r.text):
                if item["app_id"] in seen:
                    continue
                seen.add(item["app_id"])
                recommended.append(item)
                if len(recommended) >= 16:
                    break
        except Exception as exc:
            logger.debug("morelike %s failed: %s", seed, exc)
    return recommended


def _asset_url(fmt, filename):
    if not fmt or not filename:
        return ""
    path = str(fmt).replace("${FILENAME}", str(filename)).lstrip("/")
    if path.startswith(("http://", "https://")):
        return path
    return _ASSET_CDN + path


def _store_art_map(app_ids):
    """Hashed Steam artwork. Unhashed /capsule_616x353.jpg 404s for newer titles."""
    ids = []
    seen = set()
    for raw in app_ids:
        aid = str(raw or "").strip()
        if not aid.isdigit() or aid in seen:
            continue
        seen.add(aid)
        ids.append(int(aid))
    art = {}
    for start in range(0, len(ids), 40):
        body = {
            "ids": [{"appid": aid} for aid in ids[start:start + 40]],
            "context": {"language": "english", "country_code": "US", "steam_realm": 1},
            "data_request": {"include_assets": True},
        }
        try:
            response = httpx.get(
                _STORE_ITEMS_URL,
                params={"input_json": json.dumps(body, separators=(",", ":"))},
                timeout=15.0,
                headers={"User-Agent": _STEAM_STORE_UA},
                follow_redirects=True,
            )
            if response.status_code != 200:
                logger.warning("Store art lookup returned %s", response.status_code)
                continue
            items = (response.json().get("response") or {}).get("store_items") or []
        except Exception as exc:
            logger.warning("Store art lookup failed: %s", exc)
            continue
        for item in items:
            if not isinstance(item, dict) or item.get("success") != 1:
                continue
            assets = item.get("assets") or {}
            fmt = assets.get("asset_url_format") or ""
            wide = _asset_url(fmt, assets.get("main_capsule") or assets.get("header"))
            cover = _asset_url(fmt, assets.get("library_capsule") or assets.get("library_hero"))
            aid = str(item.get("appid") or item.get("id") or "")
            if aid and (wide or cover):
                art[aid] = {"wide": wide, "cover": cover}
    return art


def _apply_store_art(feed):
    ids = []
    buckets = ("top_sellers", "coming_soon", "most_played", "new_releases", "recommended")
    for key in buckets:
        for row in feed.get(key) or []:
            ids.append(row.get("app_id"))
    art = _store_art_map(ids)
    if not art:
        return
    for key in buckets:
        for row in feed.get(key) or []:
            found = art.get(str(row.get("app_id") or ""))
            if not found:
                continue
            if found.get("wide"):
                row["image_url"] = found["wide"]
            if found.get("cover"):
                row["cover_url"] = found["cover"]


def peek_home_feed():
    return _HOME_FEED_CACHE


def fetch_home_feed(force: bool = False, library_app_ids=None):
    """Steam store rails: bestsellers, new, upcoming, recommended."""
    global _HOME_FEED_CACHE, _HOME_FEED_AT
    with _HOME_FEED_LOCK:
        now = time.time()
        if (
            not force
            and _HOME_FEED_CACHE
            and (now - _HOME_FEED_AT) < _HOME_FEED_TTL
            and any(_HOME_FEED_CACHE.get(k) for k in ("top_sellers", "new_releases", "coming_soon"))
        ):
            return _HOME_FEED_CACHE

        feed = {
            "top_sellers": [],
            "coming_soon": [],
            "most_played": [],
            "new_releases": [],
            "recommended": [],
            "names": {},
        }

        def _absorb(bucket, rows):
            for row in rows or []:
                aid = str(row.get("app_id") or "").strip()
                name = str(row.get("name") or "").strip()
                if not aid or any(x.get("app_id") == aid for x in feed[bucket]):
                    continue
                if _is_home_skip(name, aid):
                    continue
                image = str(row.get("image_url") or "")
                # Never rewrite hashed Steam art to the legacy unhashed path —
                # /capsule_616x353.jpg 404s for titles like FC 27 / AION 2.
                item = {
                    "app_id": aid,
                    "name": name,
                    "image_url": image,
                }
                if row.get("thumb_url"):
                    item["thumb_url"] = row["thumb_url"]
                if row.get("peak"):
                    item["peak"] = row["peak"]
                feed[bucket].append(item)
                if name:
                    feed["names"][aid] = name
                if len(feed[bucket]) >= 16:
                    break

        featured = {}
        try:
            r = _steam_get("https://store.steampowered.com/api/featuredcategories/?cc=US&l=english")
            if r.status_code == 200:
                featured = r.json() or {}
        except Exception as exc:
            logger.warning("Home feed featuredcategories failed: %s", exc)

        _absorb("top_sellers", _steam_search_category("globaltopsellers") or _featuredcategories_bucket(featured, "top_sellers"))
        if not feed["top_sellers"]:
            _absorb("top_sellers", _steam_search_category("topsellers"))
        _absorb("new_releases", _steam_search_category("popularnew") or _featuredcategories_bucket(featured, "new_releases"))
        _absorb("coming_soon", _steam_search_category("popularcomingsoon") or _featuredcategories_bucket(featured, "coming_soon"))
        if not feed["coming_soon"]:
            _absorb("coming_soon", _steam_search_category("comingsoon"))

        try:
            r = httpx.get(
                "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/",
                timeout=10.0,
                headers={"User-Agent": _STEAM_STORE_UA},
            )
            if r.status_code == 200:
                from sff.game_list_fallback import get_cached_name
                ranks = (r.json() or {}).get("response", {}).get("ranks", []) or []
                chart_rows = []
                for row in ranks[:20]:
                    if not isinstance(row, dict):
                        continue
                    aid = str(row.get("appid") or "")
                    name = get_cached_name(aid) or ""
                    if _is_home_skip(name, aid):
                        continue
                    chart_rows.append({"app_id": aid, "name": name, "peak": row.get("peak_in_game")})
                _absorb("most_played", chart_rows)
        except Exception as exc:
            logger.warning("Home feed most-played failed: %s", exc)

        if library_app_ids:
            _absorb("recommended", _recommended_like(library_app_ids))

        _apply_store_art(feed)

        if any(feed.get(k) for k in ("top_sellers", "new_releases", "coming_soon", "recommended")):
            _HOME_FEED_CACHE = feed
            _HOME_FEED_AT = time.time()
        return feed
