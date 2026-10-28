"""One-shot API key probe after startup. Never prompt in a loop."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

PROVIDER_PAGES = {
    "Hubcap": "https://hubcap.pages.dev",
    "Ryuu": "https://generator.ryuu.lol",
    "DepotBox": "https://depotbox.org",
}

_KEY_SETTINGS = {
    "Hubcap": ("HUBCAP_KEY",),
    "Ryuu": ("RYUU_API_KEY", "RYUU_KEY"),
    "DepotBox": ("DEPOTBOX_KEY",),
}


def _present(value) -> str:
    return str(value or "").strip()


def _check_hubcap(key: str) -> bool:
    try:
        from sff.network.store_browser import StoreApiClient
        return bool(StoreApiClient.validate_api_key(key))
    except Exception as exc:
        logger.debug("Hubcap key probe failed: %s", exc)
        return False


def _check_depotbox(key: str) -> bool:
    try:
        resp = httpx.get(
            "https://depotbox.org/api/direct-lua",
            params={"appid": "0"},
            headers={"X-API-Key": key},
            timeout=12,
            follow_redirects=True,
        )
        if resp.status_code == 401:
            return False
        return resp.status_code in (200, 404, 403, 429)
    except Exception as exc:
        logger.debug("DepotBox key probe failed: %s", exc)
        return False


def _check_ryuu(key: str) -> bool:
    if len(key) < 8:
        return False
    try:
        resp = httpx.get(
            "https://generator.ryuu.lol/secure_download",
            params={"appid": "0", "auth_code": key},
            timeout=12,
            follow_redirects=True,
        )
        if resp.status_code in (401, 403):
            return False
        return True
    except Exception as exc:
        logger.debug("Ryuu key probe failed: %s", exc)
        return False


def check_provider_keys() -> dict:
    """Return per-provider {present, ok}. Missing keys are skipped, not prompted."""
    from sff.core.storage.settings import get_setting
    from sff.core.structs import Settings

    hubcap = _present(get_setting(Settings.HUBCAP_KEY))
    ryuu = _present(get_setting(Settings.RYUU_API_KEY)) or _present(
        get_setting(Settings.RYUU_KEY)
    )
    depotbox = _present(get_setting(Settings.DEPOTBOX_KEY))

    result = {
        "hubcap": {"present": bool(hubcap), "ok": None, "label": "Hubcap"},
        "ryuu": {"present": bool(ryuu), "ok": None, "label": "Ryuu"},
        "depotbox": {"present": bool(depotbox), "ok": None, "label": "DepotBox"},
        "invalid": [],
        "fallback": "free providers (GMRC / GitHub)",
    }
    if hubcap:
        result["hubcap"]["ok"] = _check_hubcap(hubcap)
        if not result["hubcap"]["ok"]:
            result["invalid"].append("Hubcap")
    if ryuu:
        result["ryuu"]["ok"] = _check_ryuu(ryuu)
        if not result["ryuu"]["ok"]:
            result["invalid"].append("Ryuu")
    if depotbox:
        result["depotbox"]["ok"] = _check_depotbox(depotbox)
        if not result["depotbox"]["ok"]:
            result["invalid"].append("DepotBox")
    result["pages"] = {name: PROVIDER_PAGES.get(name, "") for name in result["invalid"]}
    return result


def remove_provider_key(label: str) -> bool:
    """Clear a dead provider key so the next download uses free sources."""
    from sff.core.storage.settings import set_setting
    from sff.core.structs import Settings

    names = _KEY_SETTINGS.get(str(label or "").strip())
    if not names:
        return False
    cleared = False
    for attr in names:
        setting = getattr(Settings, attr, None)
        if setting is None:
            continue
        try:
            set_setting(setting, "")
            cleared = True
        except Exception as exc:
            logger.debug("Could not clear %s: %s", attr, exc)
    return cleared


def source_to_provider_label(source) -> str:
    raw = str(source or "").strip().lower()
    if raw in ("hubcap", "morrenus"):
        return "Hubcap"
    if raw in ("ryuu", "ryuu_api"):
        return "Ryuu"
    if raw in ("depotbox",):
        return "DepotBox"
    return ""
