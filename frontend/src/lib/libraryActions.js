export function gameNeedsDownload(game) {
  if (!game) return false;
  if (game.installed) return false;
  return Boolean(game.manifest_only || game.steamidra_managed || game.in_library);
}

export function installViaSteam(appId) {
  const id = String(appId || '').trim();
  if (!id) return;
  if (window.Bridge?.install_game) window.Bridge.install_game(id);
  else if (window.Bridge?.open_url) window.Bridge.open_url(`steam://install/${id}`);
}

export function playOrInstall(game) {
  if (!game) return;
  if (gameNeedsDownload(game)) installViaSteam(game.app_id);
  else if (window.Bridge?.launch_game) window.Bridge.launch_game(String(game.app_id));
}
