# Manifest download source order. UI stores JSON list of {id, enabled}.
from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)

SOURCE_IDS = ("hubcap", "gmrc", "github", "manifesthub", "steam_cdn")

DEFAULT_MANIFEST_SOURCES: list[dict] = [
    {"id": "hubcap", "enabled": True},
    {"id": "gmrc", "enabled": True},
    {"id": "github", "enabled": True},
    {"id": "manifesthub", "enabled": True},
    {"id": "steam_cdn", "enabled": True},
]

_LABELS = {
    "hubcap": "Hubcap",
    "gmrc": "GMRC",
    "github": "GitHub",
    "manifesthub": "ManifestHub",
    "steam_cdn": "Steam CDN",
}


def _as_list(raw) -> list | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        items = raw.get("sources") or raw.get("order")
        return items if isinstance(items, list) else None
    text = str(raw).strip()
    if not text or text.lower() in ("null", "none", "undefined"):
        return None
    try:
        parsed = json.loads(text)
    except Exception:
        return None
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        items = parsed.get("sources") or parsed.get("order")
        return items if isinstance(items, list) else None
    return None


def normalize_manifest_sources(raw) -> list[dict]:
    """Return a complete [{id, enabled}, ...] in user order, unknown ids dropped."""
    seen: set[str] = set()
    out: list[dict] = []
    for item in (_as_list(raw) or []):
        if isinstance(item, str):
            source_id = item.strip().lower()
            enabled = True
        elif isinstance(item, dict):
            source_id = str(item.get("id") or "").strip().lower()
            enabled = bool(item.get("enabled", True))
        else:
            continue
        if source_id not in SOURCE_IDS or source_id in seen:
            continue
        seen.add(source_id)
        out.append({"id": source_id, "enabled": enabled})
    for item in DEFAULT_MANIFEST_SOURCES:
        if item["id"] not in seen:
            out.append({"id": item["id"], "enabled": bool(item["enabled"])})
    return out


def enabled_source_ids(raw=None) -> list[str]:
    """Enabled ids in configured order. If everything is off, use the default chain."""
    if raw is None:
        try:
            from sff.core.storage.settings import get_setting
            from sff.core.structs import Settings
            raw = get_setting(Settings.MANIFEST_SOURCES)
        except Exception:
            raw = None
    plan = normalize_manifest_sources(raw)
    enabled = [item["id"] for item in plan if item.get("enabled")]
    if enabled:
        return enabled
    return [item["id"] for item in DEFAULT_MANIFEST_SOURCES if item.get("enabled")]


def format_source_chain(ids: list[str] | None = None) -> str:
    names = [_LABELS.get(i, i) for i in (ids or enabled_source_ids())]
    return " → ".join(names) if names else "(none)"
