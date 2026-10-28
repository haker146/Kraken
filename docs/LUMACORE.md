# LumaCore hosting (Kraken)

Kraken installs LumaCore from **your** GitHub Releases on `haker146/Kraken`, not from a third-party `/releases/latest`.

Tags must start with `luma-` so they never collide with Kraken app versions (`v*`) or the `ship-hold` catalog tag.

**Release Kraken looks for:**

```
https://github.com/haker146/Kraken/releases/tag/luma-V38
```

Asset name: `release.zip` (preferred) containing `xinput1_4.dll` and `LumaCore.dll`.

Target the **`LumaCore`** branch when you create the tag. Do not merge that branch into `main`.

## Publish after a Steam client update

Run this **yourself** (Kraken will not clone the upstream injector into `main`):

```
git clone https://github.com/drappula/LumaCore.git luma-src
cd luma-src
git remote add kraken https://github.com/haker146/Kraken.git
git push kraken HEAD:LumaCore
```

Then on GitHub: Releases → Draft → tag `luma-V39` (or next), target `LumaCore`, attach `release.zip`.

Kraken already prefers `xinput1_4.dll` + `LumaCore.dll`. Older `dwmapi.dll` is optional leftover and is removed on reinstall.
