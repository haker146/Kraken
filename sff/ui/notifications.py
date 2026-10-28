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

"""Windows Toast Notifications for SteaMidra"""

import logging
import threading
import warnings
from enum import Enum
from typing import Optional

from sff.core.storage.settings import get_setting
from sff.core.structs import Settings

logger = logging.getLogger(__name__)

# Try to import notification library (always define ToastNotifier for test patching)
# Suppress pkg_resources deprecation from win10toast (build + runtime)
try:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message=".*pkg_resources is deprecated.*",
            category=UserWarning,
        )
        from win10toast import ToastNotifier
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    ToastNotifier = None  # type: ignore[misc, assignment]
    NOTIFICATIONS_AVAILABLE = False
    logger.warning("win10toast not available. Notifications disabled.")


class NotificationType(Enum):
    SUCCESS = "Success"
    ERROR = "Error"
    INFO = "Information"
    UPDATE = "Update Available"


class NotificationService:

    def __init__(self):
        self.toaster: Optional[ToastNotifier] = None
        self.enabled = True
        self.last_notification_time = 0
        self.notification_cooldown = 2  # seconds between notifications
        if NOTIFICATIONS_AVAILABLE:
            try:
                self.toaster = ToastNotifier()
            except Exception as e:
                logger.error(f"Failed to initialize ToastNotifier: {e}")
                self.enabled = False

    def is_enabled(self):
        if not self.enabled:
            return False
        try:
            from PyQt6.QtWidgets import QApplication
            app = QApplication.instance()
            if app is not None and getattr(app, "_tray", None) is not None:
                return True
        except Exception:
            pass
        return NOTIFICATIONS_AVAILABLE and self.toaster is not None

    def show(
        self,
        title: str,
        message: str,
        notification_type = NotificationType.INFO,
        duration = 5
    ):
        kind_map = {
            NotificationType.SUCCESS: "success",
            NotificationType.ERROR: "error",
            NotificationType.INFO: "info",
            NotificationType.UPDATE: "info",
        }
        if _ui_emitter is not None:
            try:
                _ui_emitter(title, message, kind_map.get(notification_type, "info"))
            except Exception:
                pass

        if not self.is_enabled():
            logger.debug(f"Notifications disabled. Would show: {title} - {message}")
            return _ui_emitter is not None

        # First priority: native Qt tray notification
        try:
            from PyQt6.QtWidgets import QApplication
            app = QApplication.instance()
            tray = getattr(app, "_tray", None) if app is not None else None
            if tray is not None and hasattr(tray, "notify"):
                tray.notify(f"Kraken - {title}", message, duration * 1000)
                logger.info(f"Notification shown via Qt tray: {title}")
                return True
        except Exception as tray_err:
            logger.debug(f"Tray notification attempt failed: {tray_err}")

        if not (NOTIFICATIONS_AVAILABLE and self.toaster is not None):
            return False

        try:
            self.toaster.show_toast(
                title=f"Kraken - {title}",
                msg=message,
                duration=duration,
                icon_path=None,
                threaded=True
            )
            logger.info(f"Notification shown via win10toast: {title}")
            return True
        except Exception as toast_error:
            if "pkg_resources" in str(toast_error) or "DistributionNotFound" in str(toast_error):
                logger.warning(f"Disabling win10toast notifications due to pkg_resources error: {toast_error}")
            else:
                logger.error(f"Failed to show toast notification: {toast_error}")
            return False

    def show_success(self, title, message):
        return self.show(title, message, NotificationType.SUCCESS)

    def show_error(self, title, message):
        return self.show(title, message, NotificationType.ERROR, duration=10)

    def show_info(self, title, message):
        return self.show(title, message, NotificationType.INFO)

    def show_update_available(self, version):
        return self.show(
            "Update Available",
            f"Version {version} is available for download",
            NotificationType.UPDATE,
            duration=10
        )


# Global notification service instance
_notification_service = None
_notif_lock = threading.Lock()
_ui_emitter = None


def set_ui_emitter(callback):
    """Register a function(title, message, kind) used by the React toast host."""
    global _ui_emitter
    _ui_emitter = callback


def get_notification_service():
    global _notification_service
    if _notification_service is None:
        with _notif_lock:
            if _notification_service is None:
                _notification_service = NotificationService()
    return _notification_service
