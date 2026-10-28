# Crack catalog — Fixes & Bypasses Source

The catalog lives on the **`Ship-hold`** branch (not `main`). `main` is the Kraken application only.

Kraken downloads the published GitHub Release asset first, then falls back to the raw branch file:

**Release (what Kraken prefers):**
```
https://github.com/haker146/Kraken/releases/download/ship-hold/crackfiles.json
```

**Raw branch (fallback):**
```
https://raw.githubusercontent.com/haker146/Kraken/Ship-hold/crackfiles.json
```

The tag is `ship-hold`, not `latest`. App installers stay on `/releases/latest` (`v*` tags). Pushing to `Ship-hold` republishes the catalog tag in place (`make_latest: false`).

The file is cached in memory for about an hour after startup. Add or edit entries on `Ship-hold` only.

GitHub branch names cannot contain spaces, so this is `Ship-hold` rather than `Ship hold`.

Do not merge `Ship-hold` into `main`. Do not put `crackfiles.json` on `main`.

The Operator Console writes a **local** `crackfiles.json` for testing. Publishing means committing that file on `Ship-hold` and pushing; CI then updates the `ship-hold` release.

---

## How Kraken uses it

1. You click **Fixes & Bypasses** on the Tools page (GUI) or choose it from the menu (CLI).
2. Kraken fetches `crackfiles.json` from the `ship-hold` release, then the `Ship-hold` branch if needed.
3. It matches your game by Steam `appid` when present, otherwise by name. Exact matches appear first; you can also search the full list.
4. Once you pick a fix, Kraken downloads the archive from the `href` link directly to a temp folder.
5. The archive is extracted into your game folder automatically.

In the store, if a game still has **Denuvo** (not removed by the publisher) and the catalog has a `buildid` for it, Kraken shows that Steam build so you know which version to downgrade to.

---

## JSON structure

Each entry in `crackfiles.json` looks like this:

```json
{
  "appid": "1234560",
  "buildid": "20514355",
  "name": "Example Game",
  "source_crack": [],
  "original_download": [],
  "fixes": [
    {
      "href": "",
      "filename": "example_crack.rar",
      "size": "",
      "badges": ["Crack"]
    }
  ]
}
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `appid` | string | Steam App ID. Preferred match key. Optional but recommended. |
| `buildid` | string | Steam build ID the fix was made for. Shown in the store for remaining Denuvo titles. Empty string if not tied to a specific build. |
| `name` | string | Game name as it appears in Steam. Fallback match when `appid` is missing. |
| `source_crack` | array of strings | Optional source-thread URLs for traceability. |
| `original_download` | array of strings | Optional original file URLs. |
| `fixes` | array of objects | One or more downloadable fix entries. See sub-fields below. |

### `fixes` sub-fields

| Field | Type | Description |
|---|---|---|
| `href` | string | Download URL. This is what Kraken downloads. |
| `filename` | string | Expected filename after download. Used as a display hint. |
| `size` | string | File size as a human-readable string. May be empty. |
| `badges` | array of strings | Labels describing the fix type, e.g. `["Crack"]`, `["Online Fix"]`, `["Bypass"]`. Shown in the selection menu. |

---

## Notes

- Fixes extract directly into your game folder. If something breaks, verify game files via Steam to restore originals.
- Build IDs go stale when a game updates. If the fix stops working after a game update, put a new `buildid` on the data branch.
- `Crack_Files` was a full copy of the app and is not the catalog source. `Konungs-skuggsjá` was the earlier data-only branch.
