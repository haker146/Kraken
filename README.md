# Kraken crack catalog

This branch holds `crackfiles.json` only. The Kraken app on `main` fetches it from:

https://raw.githubusercontent.com/haker146/Kraken/Konungs-skuggsj%C3%A1/crackfiles.json

Do not merge this branch into `main`. Keep application code on `main`.

Git branch names cannot contain spaces, so this is `Konungs-skuggsjá` rather than `Konungs skuggsjá`.

`crackfiles.json` is a JSON array. Each object may include:

- `appid` — Steam App ID (preferred match key)
- `name` — Steam title (fallback match)
- `buildid` — Steam build the crack works with
- `source_crack`, `original_download` — optional source lists
- `fixes` — objects with `href`, `filename`, and `badges`

Prefer `appid` so store matching is exact. `buildid` is shown in the store when Denuvo is still present.
