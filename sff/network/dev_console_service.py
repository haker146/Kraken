# language: Python, file: dev_console_service.py, runtime: Python 3.10+, target: Windows 10/11
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sff.network.crack_catalog import prefetch as refresh_catalog_cache
from sff.network.cs_rin import CS_RIN_BASE, CSRinClient, pick_topic, to_catalog_fix
import sff.network.isitcracked as isitcracked_checker

logger = logging.getLogger("DevConsoleService")

COOKIE_FILE = "cs_rin_cookie.txt"

_STEAM_DRM_RE = re.compile(
    r"steam(?:works)?(?:\s*(?:drm|ceg))?|\bceg\b",
    re.I,
)
_EXTRA_DRM_RE = re.compile(
    r"denuvo|hypervisor|vmprotect|arxan|digital\.ai|easy\s*anti-?cheat|\beac\b|battleye|"
    r"ubisoft|uplay|origin|\bea\b|rockstar|epic|battle\.?net|blizzard|"
    r"microsoft|uwp|arc\b|nprotect|themida",
    re.I,
)
_FREE_DRM_RE = re.compile(r"^(none|n/?a|drm-?free|gog(?:\s*galaxy)?)$", re.I)


def get_crackfiles_path() -> Path:
    p = Path("crackfiles.json")
    if p.is_file():
        return p.resolve()
    from sff.core.utils import root_folder
    return (root_folder(outside_internal=True) / "crackfiles.json").resolve()


def get_cookie_file_path() -> Path:
    p = Path(COOKIE_FILE)
    if p.is_file():
        return p.resolve()
    from sff.core.utils import root_folder
    return (root_folder(outside_internal=True) / COOKIE_FILE).resolve()


def load_cookie() -> str:
    path = get_cookie_file_path()
    if path.is_file():
        try:
            return path.read_text(encoding="utf-8").strip()
        except Exception:
            pass
    return os.environ.get("CSRIN_COOKIE", "")


class CSRinExplorer:
    def __init__(self, cookie: Optional[str] = None):
        self.cookie = cookie or load_cookie()
        self.client = CSRinClient(cookie=self.cookie)

    def test_session(self) -> Dict[str, Any]:
        html = self.client.get(CS_RIN_BASE)
        if not html:
            return {"ok": False, "msg": "Brak odpowiedzi od cs.rin.ru (timeout lub 401). Sprawdź cookie."}
        u_match = re.search(r"csrinru_phpbb3_u=(\d+)", self.cookie)
        user_id = u_match.group(1) if u_match else "Nieznane"
        is_logged = ("Logout" in html or "Wyloguj" in html or user_id in html)
        return {
            "ok": is_logged,
            "user_id": user_id,
            "msg": f"Zalogowano jako user ID: {user_id}" if is_logged else "Cookie wygasło lub niezalogowany.",
        }

    def search_topic(self, game_name: str) -> Optional[Dict[str, str]]:
        topics = self.client.search_topics(game_name)
        return pick_topic(topics, game_name)

    def extract_crack_only(self, topic_url: str) -> Dict[str, Any]:
        return self.client.harvest_topic_url(topic_url)


class CrackFilesRepository:
    def __init__(self):
        self.file_path = get_crackfiles_path()
        self.data: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        if self.file_path.is_file():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                self.data = raw if isinstance(raw, list) else raw.get("games", [])
            except Exception:
                self.data = []

    def save(self):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            refresh_catalog_cache(force=True)
            return True
        except Exception as exc:
            logger.error("Failed saving crackfiles: %s", exc)
            return False

    @staticmethod
    def _name_key(value: str) -> str:
        return " ".join(str(value or "").lower().replace("’", "'").split())

    def find(self, query: str) -> Optional[Dict[str, Any]]:
        norm = self._name_key(query)
        hits: List[Dict[str, Any]] = []
        for e in self.data:
            appid = str(e.get("appid", "")).strip()
            name = self._name_key(e.get("name", ""))
            if appid == str(query).strip() or name == norm:
                hits.append(e)
        if not hits:
            for e in self.data:
                name = self._name_key(e.get("name", ""))
                if norm and norm in name:
                    hits.append(e)
        if not hits:
            return None
        hits.sort(key=lambda e: len([f for f in (e.get("fixes") or []) if f.get("href")]), reverse=True)
        return hits[0]

    def _matches(self, name: str, appid: str) -> List[Dict[str, Any]]:
        aid = str(appid or "").strip()
        norm = self._name_key(name)
        found: List[Dict[str, Any]] = []
        for entry in self.data:
            if aid and str(entry.get("appid") or "").strip() == aid and entry not in found:
                found.append(entry)
            if norm and self._name_key(entry.get("name", "")) == norm and entry not in found:
                found.append(entry)
        return found

    def upsert(
        self,
        name: str,
        appid: str,
        buildid: str,
        fixes: List[Dict[str, Any]],
        attachments: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        usable_fixes = [item for item in (fixes or []) if str((item or {}).get("href") or "").strip()]
        matches = self._matches(name, appid)
        is_new = False
        if not matches:
            if not usable_fixes and not attachments:
                return {"is_new": False, "entry": None, "added_fixes": 0, "skipped": True}
            entry = {
                "name": name,
                "appid": str(appid or ""),
                "buildid": buildid or "",
                "source_crack": [],
                "original_download": [],
                "fixes": [],
            }
            self.data.append(entry)
            is_new = True
        else:
            entry = matches[0]
            for extra in matches[1:]:
                for item in extra.get("fixes") or []:
                    href = str((item or {}).get("href") or "").strip()
                    if not href:
                        continue
                    existing = entry.setdefault("fixes", [])
                    if any(ex.get("href") == href for ex in existing):
                        continue
                    existing.append(item)
                if extra.get("appid") and not entry.get("appid"):
                    entry["appid"] = extra.get("appid")
                if extra.get("buildid") and not entry.get("buildid"):
                    entry["buildid"] = extra.get("buildid")
                for key in ("source_crack", "original_download"):
                    merged = list(entry.get(key) or [])
                    for value in extra.get(key) or []:
                        if value and value not in merged:
                            merged.append(value)
                    entry[key] = merged
                if extra in self.data:
                    self.data.remove(extra)

        if buildid:
            try:
                incoming = int(str(buildid))
                current = int(str(entry.get("buildid") or 0) or 0)
                if incoming >= current:
                    entry["buildid"] = str(buildid)
            except ValueError:
                if not entry.get("buildid"):
                    entry["buildid"] = str(buildid)
        if appid:
            entry["appid"] = str(appid)
        if name and not entry.get("name"):
            entry["name"] = name

        sc_set = set(entry.get("source_crack") or [])
        od_set = set(entry.get("original_download") or [])

        for att in attachments:
            href = (att or {}).get("href")
            if href:
                od_set.add(href)
            if att.get("source_post"):
                sc_set.add(att["source_post"])

        existing_fixes = entry.setdefault("fixes", [])
        added_count = 0
        for f in usable_fixes:
            sc_set.add(f.get("source_post", ""))
            href = f.get("href") or ""
            if not href or any(ex.get("href") == href for ex in existing_fixes):
                continue
            existing_fixes.append(to_catalog_fix(name, f))
            added_count += 1

        entry["source_crack"] = [s for s in sc_set if s]
        entry["original_download"] = [d for d in od_set if d]

        self.save()
        return {
            "is_new": is_new,
            "entry": entry,
            "added_fixes": added_count,
        }


def _split_drm_tokens(protection: str) -> List[str]:
    return [
        re.sub(r"\s+", " ", part).strip()
        for part in re.split(r"\s*(?:\+| / |/|,|&|\band\b)\s*", str(protection or ""), flags=re.I)
        if str(part).strip()
    ]


def extra_crack_file_needed(protection: str, status_key: str = "") -> Tuple[bool, str, str]:
    """Return (needed, reason, protection). Steam DRM / DRM-free do not need a crack file."""
    prot = str(protection or "").strip()
    key = str(status_key or "").lower().replace(" ", "-")
    if re.search(
        r"denuvo.{0,48}(removed|stripped|dropped|retired)|"
        r"(?:removed|stripped|dropped|retired).{0,24}denuvo",
        f"{prot} {key}",
        re.I,
    ):
        return False, "denuvo-removed", prot or "Denuvo removed by developer"
    if key in ("drm-free", "drmfree"):
        return False, "drm-free", prot or "DRM-Free"
    tokens = _split_drm_tokens(prot)
    if tokens and all(_FREE_DRM_RE.match(t) for t in tokens):
        return False, "drm-free", prot or "DRM-Free"
    if tokens and all(_STEAM_DRM_RE.search(t) and not _EXTRA_DRM_RE.search(t) for t in tokens):
        return False, "steam-drm", prot or "Steam DRM"
    if prot and _STEAM_DRM_RE.search(prot) and not _EXTRA_DRM_RE.search(prot):
        return False, "steam-drm", prot
    return True, "extra", prot


def _lookup_drm(query: str, appid: str = "") -> Dict[str, Any]:
    return isitcracked_checker.lookup_game(query, appid or None) or {}


def _drm_gate(game_name: str, appid: str, output_lines: List[str]) -> str:
    """Append DRM info. Return skip-not-needed, skip-uncracked, or hunt."""
    drm_info = _lookup_drm(game_name, appid)
    protection = str(drm_info.get("protection") or "").strip() or "Unknown"
    status_key = str(drm_info.get("status_key") or drm_info.get("status") or "").lower()
    is_cracked = bool(drm_info.get("cracked")) or (
        status_key.replace(" ", "-") in ("cracked", "drm-free", "drmfree")
    )
    output_lines.append(
        f"[DRM] {protection} | Status: {drm_info.get('status') or 'Brak danych'}"
    )
    needed, reason, prot = extra_crack_file_needed(protection, status_key)
    if not needed:
        if reason == "steam-drm":
            output_lines.append(
                f"[SKIP] {prot} — dodatkowy plik cracka nie jest potrzebny."
            )
            output_lines.append(
                "[SKIP] Wystarczy LumaCore / instalacja natywna przez Steam."
            )
        else:
            output_lines.append(
                "[SKIP] Gra jest DRM-Free. Dodatkowy plik cracka nie jest potrzebny."
            )
        return "skip-not-needed"
    if not is_cracked:
        output_lines.append(
            f"[INFO] Gra nie jest oznaczona jako cracked ({protection})."
        )
        output_lines.append(
            "[INFO] Przeszukiwanie cs.rin.ru wstrzymane, żeby nie zbierać fałszywych linków."
        )
        return "skip-uncracked"
    return "hunt"


def _asset_label(item: Dict[str, Any]) -> str:
    bits = [item.get("badge") or "Crack"]
    if item.get("buildid"):
        bits.append(f"build {item['buildid']}")
    elif item.get("version"):
        bits.append(f"v{item['version']}")
    return "/".join(bits)


def _format_hunt_result(
    fixes: List[Dict[str, Any]],
    attachments: List[Dict[str, Any]],
    harvest: Optional[Dict[str, Any]] = None,
) -> List[str]:
    extra = ""
    if harvest:
        extra = (
            f" (strony={harvest.get('pages_scanned', 0)}, "
            f"posty={harvest.get('posts_scanned', 0)}, "
            f"wyszukiwanie w wątku={harvest.get('search_hits', 0)})"
        )
    lines = [
        f"  Nowe linki: {len(fixes)} fix(ów), {len(attachments)} załącznik(ów) z forum{extra}"
    ]
    for item in fixes[:3]:
        lines.append(f"   -> [{_asset_label(item)}] {item['href']}")
    for att in attachments[:3]:
        lines.append(f"   -> [Forum Attachment] {att['href']}")
    unlabeled = [item for item in fixes if not item.get("buildid") and not item.get("version")]
    if unlabeled:
        lines.append(
            "[INFO] Część plików nie ma build/wersji w poście — nie zgaduję numeru, "
            "zostaje pusty buildid."
        )
    if attachments and not fixes:
        lines.append(
            "[INFO] W wątku był tylko załącznik z forum — brak publicznych hosterów "
            "(Pixeldrain/MEGA itd.) w postach oznaczonych jako crack-only."
        )
    return lines


def execute_dev_command(raw_cmd: str) -> Dict[str, Any]:
    cmd = (raw_cmd or "").strip()
    if not cmd:
        return {"status": "ok", "output": ""}

    parts = cmd.split(maxsplit=1)
    action = parts[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ""

    repo = CrackFilesRepository()
    explorer = CSRinExplorer()

    if action in ("help", "?"):
        return {
            "status": "ok",
            "output": (
                "=== KRAKEN OPERATOR CONSOLE // COMMANDS ===\n"
                "  status                  Sprawdź stan połączenia i sesję cs.rin.ru\n"
                "  update <gra/appid>      Sprawdź DRM; Steam DRM / DRM-Free = skip, inaczej szukaj patcha\n"
                "  check <nazwa_gry>       To samo co update, plus dopisanie nowej gry do bazy\n"
                "  cookie <ciasteczko>     Zapisz nową sesję cs.rin.ru (phpbb3_* / securitytoken)\n"
                "  list                    Pokaż listę gier w lokalnym crackfiles.json\n"
                "  reload                  Wymuś przeładowanie pamięci podręcznej cracków\n"
                "  clear                   Wyczyść ekran konsoli\n"
            ),
        }

    if action == "status":
        sess = explorer.test_session()
        db_path = get_crackfiles_path()
        return {
            "status": "ok" if sess["ok"] else "warning",
            "output": (
                f"[STATUS] cs.rin.ru Session: {sess['msg']}\n"
                f"[DATABASE] Plik bazy: {db_path} ({len(repo.data)} wpisów)\n"
                f"[ENGINE] Tryb szukania: OP ostrożnie, ostatnie strony + search.php w wątku"
            ),
        }

    if action == "cookie":
        if not arg:
            return {"status": "error", "output": "Błąd: Podaj ciąg ciasteczka. Np.: cookie csrinru_phpbb3_u=...;"}
        cpath = get_cookie_file_path()
        try:
            cpath.write_text(arg, encoding="utf-8")
            test = CSRinExplorer(cookie=arg).test_session()
            return {
                "status": "ok" if test["ok"] else "warning",
                "output": f"Ciasteczko zapisane w {cpath.name}.\nWynik weryfikacji: {test['msg']}",
            }
        except Exception as e:
            return {"status": "error", "output": f"Błąd zapisu pliku cookie: {e}"}

    if action == "update":
        if not arg:
            return {"status": "error", "output": "Użycie: update <nazwa gry lub Steam AppID>"}

        entry = repo.find(arg)
        game_name = entry.get("name") if entry else arg
        appid = entry.get("appid", "") if entry else (arg if arg.isdigit() else "")

        output_lines = [f"[SEARCH] Sprawdzam DRM i katalog dla: '{game_name}'..."]
        gate = _drm_gate(game_name, appid, output_lines)
        if gate == "skip-not-needed":
            return {"status": "info", "output": "\n".join(output_lines)}
        if gate == "skip-uncracked":
            return {"status": "info", "output": "\n".join(output_lines)}

        output_lines.append("[FORUM] Szukam wątku crack-only / patch...")
        topic = explorer.search_topic(game_name)
        if not topic:
            if explorer.client.last_error == "security-check":
                return {
                    "status": "warning",
                    "output": "\n".join(output_lines) + (
                        "\n[WARN] cs.rin.ru zablokowało skrypt na Security check (401). "
                        "Wątek może istnieć, ale nginx nie puścił search.php."
                    ),
                }
            return {"status": "warning", "output": "\n".join(output_lines) + f"\n[WARN] Nie znaleziono wątku na cs.rin.ru dla '{game_name}'."}

        output_lines.append(f"[FORUM] Znaleziono wątek: {topic['title']}")
        output_lines.append("[CRAWL] Ostatnie strony + wyszukiwanie w wątku (bez zrzutu CSF z OP)...")
        res = explorer.extract_crack_only(topic["url"])

        if res.get("error"):
            return {"status": "error", "output": "\n".join(output_lines) + f"\n[ERROR] {res['error']}"}

        build_id = res.get("buildid", "")
        fixes = res.get("fixes", [])
        attachments = res.get("attachments", [])

        if not fixes and not attachments:
            return {
                "status": "warning",
                "output": "\n".join(output_lines) + "\n[RESULT] Brak dedykowanych plików cracka na forum.",
            }

        repo.upsert(
            name=game_name,
            appid=appid,
            buildid=build_id,
            fixes=fixes,
            attachments=attachments,
        )

        output_lines.append("[SUCCESS] Zaktualizowano wpis w crackfiles.json!")
        output_lines.append(f"  Target Build ID: {build_id or 'niepodany w postach'}")
        output_lines.extend(_format_hunt_result(fixes, attachments, res))
        return {"status": "ok", "output": "\n".join(output_lines)}

    if action == "check":
        if not arg:
            return {"status": "error", "output": "Użycie: check <nazwa nowej gry>"}

        output_lines = [f"[CHECK] Sprawdzam DRM dla '{arg}'..."]
        gate = _drm_gate(arg, "", output_lines)
        if gate == "skip-not-needed":
            return {"status": "info", "output": "\n".join(output_lines)}
        if gate == "skip-uncracked":
            return {"status": "info", "output": "\n".join(output_lines)}

        output_lines.append("[FORUM] Szukam wątku crack-only / patch...")
        topic = explorer.search_topic(arg)
        if not topic:
            if explorer.client.last_error == "security-check":
                output_lines.append("[WARN] cs.rin.ru Security check (401) — search.php nie doszło do phpBB.")
            else:
                output_lines.append("[WARN] Brak dedykowanego wątku na cs.rin.ru.")
            return {"status": "warning", "output": "\n".join(output_lines)}

        res = explorer.extract_crack_only(topic["url"])
        build_id = res.get("buildid", "")
        fixes = res.get("fixes", [])
        attachments = res.get("attachments", [])

        repo.upsert(
            name=arg,
            appid="",
            buildid=build_id,
            fixes=fixes,
            attachments=attachments,
        )

        output_lines.append("[SUCCESS] Dodano / zaktualizowano wpis w crackfiles.json!")
        output_lines.append(f"  Gra: {arg}")
        output_lines.append(f"  Build ID: {build_id or 'niepodany w postach'}")
        output_lines.extend(_format_hunt_result(fixes, attachments, res))
        return {"status": "ok", "output": "\n".join(output_lines)}

    if action == "list":
        lines = [f"[CATALOG] Łącznie gier w bazie: {len(repo.data)}"]
        for g in repo.data[:15]:
            f_count = len(g.get("fixes", []))
            bid = g.get("buildid") or "latest"
            lines.append(f" - {g.get('name')} (AppID: {g.get('appid') or '---'}, Build: {bid}, Fixes: {f_count})")
        if len(repo.data) > 15:
            lines.append(f" ... i {len(repo.data) - 15} więcej gier.")
        return {"status": "ok", "output": "\n".join(lines)}

    if action == "reload":
        refresh_catalog_cache(force=True)
        return {"status": "ok", "output": "[CATALOG] Przeładowano pamięć podręczną cracków w Krakenie."}

    return {
        "status": "error",
        "output": f"Nieznane polecenie: '{action}'. Wpisz 'help' aby zobaczyć listę komend.",
    }
