# SteaMidra - Steam game setup and manifest tool (SFF)
import logging
import threading
from urllib.parse import quote
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_cache_by_name = {}
_lock = threading.Lock()

def _normalize_name(value) -> str:
    return " ".join(str(value or "").lower().replace("’", "'").split())

def _scrape_crackrelease(game_name: str) -> dict | None:
    if not game_name:
        return None
    url = f"https://crackrelease.com/?s={quote(game_name)}"
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=10.0)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, 'html.parser')
        results = soup.find_all('article', class_='crui-search-game')
        if not results:
            return None
        
        # Best match
        best_match = None
        target = _normalize_name(game_name)
        for article in results:
            title_el = article.find('h3')
            if title_el:
                title = title_el.text.strip()
                n_title = _normalize_name(title)
                if n_title == target or target in n_title:
                    status_el = article.find('span', class_='crui-search-game__status')
                    status_text = status_el.text.strip() if status_el else "UNKNOWN"
                    best_match = {
                        "name": title,
                        "name_key": n_title,
                        "appid": "",
                        "buildid": "",
                        "crack_status": status_text,
                    }
                    break
        return best_match
    except Exception as e:
        logger.debug(f"crackrelease scrape failed: {e}")
        return None

def prefetch(force: bool = False) -> None:
    pass

def get_entries() -> list[dict]:
    return list(_cache_by_name.values())

def get_buildid_map() -> dict[str, str]:
    return {}

def lookup(app_id=None, game_name=None) -> dict | None:
    target = _normalize_name(game_name)
    if not target:
        return None
    with _lock:
        if target in _cache_by_name:
            return _cache_by_name[target]
            
    res = _scrape_crackrelease(game_name)
    if res:
        with _lock:
            _cache_by_name[target] = res
    return res

def denuvo_still_present(protection: str, crack_status: str = "") -> bool:
    prot = str(protection or "").lower()
    if "denuvo" not in prot:
        return False
    status = str(crack_status or "").lower()
    return "uncracked" in status

def attach_store_fields(game: dict) -> None:
    if not isinstance(game, dict):
        return
    entry = lookup(game_name=game.get("name"))
    if not entry:
        return
    status = entry.get("crack_status", "")
    game["crack_status"] = status
    if status:
        game["status_key"] = status.lower()

def catalog_fields(app_id=None, game_name=None, protection="", crack_status="") -> dict:
    entry = lookup(app_id, game_name)
    if entry:
        return {"crack_status": entry.get("crack_status", "")}
    return {}
