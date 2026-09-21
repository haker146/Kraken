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

# Best-effort post-save enrichment for HubCap and Ryuu .lua files. Some
# DLCs ship as their own appid with no depots and just piggyback on the
# parent game's manifest, so they need an addappid(<dlc_appid>) line in
# the .lua to actually unlock. OurEveryday already does this inline; the
# helper here lets HubCap and Ryuu match that coverage without copying
# the appinfo walk into their own modules.

import logging
import re
from pathlib import Path
from typing import Optional

from sff.network.steam_client import (
    SteamInfoProvider,
    ParsedDLC,
    create_provider_for_current_thread,
)
from sff.core.structs import DLCTypes

logger = logging.getLogger(__name__)

# Match `addappid(123)` and `addappid(123, 1, "<sha256>")` with optional
# whitespace and an optional trailing `-- comment`. Case-insensitive on
# the function name because the wild .lua files run the gamut. The keyed
# form counts as Already_Present because LumaCore treats it as an
# ownership claim on the same appid.
_ADDAPPID_RE = re.compile(
    r'^\s*addappid\s*\(\s*(\d+)\s*'
    r'(?:,\s*[01]\s*,\s*["\'][0-9a-fA-F]+["\']\s*)?\)\s*'
    r'(?:--.*)?\s*$',
    re.IGNORECASE | re.MULTILINE,
)


def _existing_addappid_ids(text: str) -> set:
    out = set()
    for m in _ADDAPPID_RE.finditer(text):
        try:
            out.add(int(m.group(1)))
        except (TypeError, ValueError):
            pass
    return out


def keep_parent_addappids(text: str, parent_id) -> str:
    """Keep addappid lines for the parent game; drop extra DLC app IDs.

    Depot keys, setManifestid, and other lua remain untouched. DLC is
    added later when the user activates selected IDs in the store UI.
    """
    try:
        parent = int(parent_id)
    except (TypeError, ValueError):
        return text or ""
    lines = []
    for line in str(text or "").splitlines(keepends=True):
        match = re.match(r"^\s*addappid\s*\(\s*(\d+)", line, re.IGNORECASE)
        if match:
            try:
                if int(match.group(1)) != parent:
                    continue
            except (TypeError, ValueError):
                pass
        lines.append(line)
    return "".join(lines)


def _compute_depotless_set(provider: SteamInfoProvider, parent_appid: int) -> set:
    # Returns set() on every failure path. The wrapping helper treats an
    # empty set as "nothing to append" so an appinfo blip leaves the .lua
    # exactly as the provider wrote it.
    try:
        parent_info = provider.get_single_app_info(int(parent_appid))
        if not parent_info or not isinstance(parent_info, dict):
            return set()
        extended = parent_info.get("extended", {}) or {}
        if not isinstance(extended, dict):
            return set()
        listofdlc = extended.get("listofdlc", "") or ""
        if not isinstance(listofdlc, str) or not listofdlc.strip():
            return set()
        try:
            dlc_ids = [int(x.strip()) for x in listofdlc.split(",") if x.strip().isdigit()]
        except (TypeError, ValueError):
            return set()
        if not dlc_ids:
            return set()
        dlc_infos = provider.get_app_info(dlc_ids)
        if not dlc_infos or not isinstance(dlc_infos, dict):
            return set()
        depotless = set()
        for dlc_id in dlc_ids:
            data = dlc_infos.get(dlc_id) or dlc_infos.get(str(dlc_id))
            if not data:
                continue
            try:
                dlc = ParsedDLC(int(dlc_id), data, parent_info, local_ids=[])
                if dlc.type == DLCTypes.NOT_DEPOT:
                    depotless.add(int(dlc_id))
            except Exception as e:
                logger.debug("dlc_appid_enricher: ParsedDLC raised for %s: %s", dlc_id, e)
                continue
        return depotless
    except Exception as e:
        logger.debug("dlc_appid_enricher: provider walk failed for %s: %s", parent_appid, e)
        return set()


def _append_lines(lua_path: Path, missing_ids: list) -> int:
    if not missing_ids:
        return 0
    try:
        # Pre-read so the appended block starts on its own line if the
        # prior file did not end in one. Avoids the `addappid(123)`
        # gluing onto a previous comment.
        size = lua_path.stat().st_size if lua_path.exists() else 0
        needs_leading_newline = False
        if size > 0:
            with lua_path.open("rb") as f:
                f.seek(-1, 2)
                last = f.read(1)
                if last not in (b"\n", b"\r"):
                    needs_leading_newline = True

        with lua_path.open("a", encoding="utf-8") as f:
            if needs_leading_newline:
                f.write("\n")
            for appid in missing_ids:
                f.write(f"addappid({int(appid)})\n")
        return len(missing_ids)
    except (OSError, PermissionError) as e:
        logger.debug("dlc_appid_enricher: append to %s failed: %s", lua_path, e)
        return 0


def append_depotless_dlcs(
    lua_path: Path,
    parent_appid,
    *,
    provider: Optional[SteamInfoProvider] = None,
) -> int:
    """DLC is unlocked from the store checkbox list, not auto-appended."""
    return 0


def remove_appids(lua_path: Path, appids, parent_id) -> int:
    """Drop addappid lines for the given DLC ids. The parent line stays."""
    try:
        path = lua_path if isinstance(lua_path, Path) else Path(lua_path)
        parent = int(parent_id)
    except (TypeError, ValueError, OSError):
        return 0
    drop = set()
    for raw in appids or []:
        try:
            value = int(raw)
        except (TypeError, ValueError):
            continue
        if value > 0 and value != parent:
            drop.add(value)
    if not drop or not path.is_file():
        return 0
    try:
        original = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return 0
    kept = []
    removed = 0
    for line in original.splitlines(keepends=True):
        match = re.match(r"^\s*addappid\s*\(\s*(\d+)", line, re.IGNORECASE)
        if match:
            try:
                if int(match.group(1)) in drop:
                    removed += 1
                    continue
            except (TypeError, ValueError):
                pass
        kept.append(line)
    if not removed:
        return 0
    try:
        path.write_text("".join(kept), encoding="utf-8")
    except OSError:
        return 0
    return removed


def append_appids(lua_path: Path, appids) -> int:
    """Append plain ``addappid(N)`` lines that are not already in the lua."""
    try:
        path = lua_path if isinstance(lua_path, Path) else Path(lua_path)
    except Exception:
        return 0
    ids = []
    seen = set()
    for raw in appids or []:
        try:
            value = int(raw)
        except (TypeError, ValueError):
            continue
        if value > 0 and value not in seen:
            seen.add(value)
            ids.append(value)
    if not ids:
        return 0
    existing = set()
    if path.exists():
        try:
            existing = _existing_addappid_ids(
                path.read_text(encoding="utf-8", errors="replace")
            )
        except Exception:
            existing = set()
    missing = [i for i in ids if i not in existing]
    if not missing:
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        try:
            path.write_text("", encoding="utf-8")
        except OSError:
            return 0
    return _append_lines(path, missing)
