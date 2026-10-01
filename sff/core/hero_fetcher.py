import logging
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

def fetch_dynamic_hero_lists():
    res = {
        "cracked": [],
        "not_cracked": [],
        "new_releases": [],
        "denuvo_removed": []
    }
    
    from sff.game_list_fallback import load_cached_list
    games_list = load_cached_list()
    
    def _name_to_appid(name):
        best = None
        best_score = 999
        from sff.gui.bridges.store_bridge import _store_search_score
        for g in games_list:
            app_id = g.get('app_id') or g.get('appid')
            if not app_id:
                continue
            score, _ = _store_search_score(name, g.get('name', ''), app_id)
            if score < best_score and score < 60:
                best = app_id
                best_score = score
        return best

    # 1. New Releases / Top Sellers from Steam API
    try:
        r = httpx.get("https://store.steampowered.com/api/featuredcategories", timeout=10.0)
        if r.status_code == 200:
            j = r.json()
            # Combine top sellers and new releases for the 'new_releases' category
            steam_ids = set()
            for item in j.get("top_sellers", {}).get("items", []):
                steam_ids.add(str(item["id"]))
            for item in j.get("new_releases", {}).get("items", []):
                steam_ids.add(str(item["id"]))
            res["new_releases"] = list(steam_ids)
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
            if aid and aid not in res["not_cracked"]:
                res["not_cracked"].append(aid)
    except Exception as e:
        logger.warning(f"Failed to fetch uncracked from crackrelease: {e}")

    # 3. Denuvo Removed (The page has no table, it's a blog post basically)
    # We will fetch 'denuvo-removed' tags or just use the WP API search
    try:
        r = httpx.get("https://crackrelease.com/wp-json/wp/v2/posts?search=denuvo%20removed&per_page=10", timeout=10.0)
        if r.status_code == 200:
            for post in r.json():
                title = post.get("title", {}).get("rendered", "")
                # usually title is "Game Name (Denuvo Removed)" or similar
                clean_title = title.replace("Denuvo Removed", "").replace("Denuvo", "").replace("Crack", "").strip(" -()[]:")
                aid = _name_to_appid(clean_title)
                if aid and aid not in res["denuvo_removed"]:
                    res["denuvo_removed"].append(aid)
    except Exception as e:
        logger.warning(f"Failed to fetch denuvo removed: {e}")

    # 4. Cracked (Recent Cracks from WP API)
    try:
        r = httpx.get("https://crackrelease.com/wp-json/wp/v2/posts?per_page=20", timeout=10.0)
        if r.status_code == 200:
            for post in r.json():
                title = post.get("title", {}).get("rendered", "")
                # usually title is "Game Name Crack" or similar
                clean_title = title.replace("Crack Status", "").replace("Crack", "").replace("Bypass", "").strip(" -()[]:")
                aid = _name_to_appid(clean_title)
                if aid and aid not in res["cracked"]:
                    res["cracked"].append(aid)
    except Exception as e:
        logger.warning(f"Failed to fetch recent cracks: {e}")

    return res
