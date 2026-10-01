import json
import logging
from PyQt6.QtCore import QTimer

logger = logging.getLogger(__name__)

def _bridge_cloud_backup(bridge, steam_path, steam32_id, app_id, game_name, dest_folder):
    def _do():
        from sff.cloud.cloud_saves import CloudSaves
        mgr = CloudSaves()
        logs = []
        res = mgr.backup_steam_save(
            steam_path,
            steam32_id,
            int(app_id),
            game_name,
            dest_folder,
            log_func=lambda msg: logs.append(msg)
        )
        return {"success": bool(res), "result": res, "logs": logs}
        
    def _on_done(res):
        bridge.task_finished.emit(json.dumps({"task": "cloud_backup", "app_id": app_id, "data": res}))
        
    def _on_err(err):
        bridge.task_finished.emit(json.dumps({"task": "cloud_backup", "app_id": app_id, "data": {"success": False, "error": str(err)}}))

    bridge._run_async(_do, on_done=_on_done, on_error=_on_err)
    return "req_backup_" + str(app_id)


def _bridge_cloud_restore(bridge, dest_folder, steam_path, steam32_id, app_id):
    def _do():
        from sff.cloud.cloud_saves import CloudSaves
        mgr = CloudSaves()
        logs = []
        ok = mgr.restore_steam_save(
            dest_folder,
            steam_path,
            steam32_id,
            int(app_id),
            log_func=lambda msg: logs.append(msg)
        )
        return {"success": bool(ok), "logs": logs}
        
    def _on_done(res):
        bridge.task_finished.emit(json.dumps({"task": "cloud_restore", "app_id": app_id, "data": res}))
        
    def _on_err(err):
        bridge.task_finished.emit(json.dumps({"task": "cloud_restore", "app_id": app_id, "data": {"success": False, "error": str(err)}}))

    bridge._run_async(_do, on_done=_on_done, on_error=_on_err)
    return "req_restore_" + str(app_id)

def _bridge_cloud_get_games(bridge):
    """Returns a list of games installed or backed up."""
    def _do():
        from sff.cloud.cloud_saves import CloudSaves
        mgr = CloudSaves()
        # Not fully implemented in CloudSaves? Let's just return what we can
        return []
        
    # We will just return empty for now, the UI can fetch from library list.
    return "[]"
