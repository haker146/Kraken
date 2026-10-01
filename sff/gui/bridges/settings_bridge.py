import json
import logging
from sff.core.storage.settings import get_setting, set_setting
from sff.core.structs import Settings

logger = logging.getLogger(__name__)

def _bridge_get_settings(bridge):
    """Returns a JSON string of all non-secret settings."""
    out = {}
    for s in Settings:
        if not s.value.is_secret:
            out[s.value.storage_key] = get_setting(s)
    return json.dumps(out)

def _bridge_set_setting(bridge, key, value):
    """Sets a setting given its storage_key and string value."""
    for s in Settings:
        if s.value.storage_key == key:
            # Handle booleans
            if s.value.value_type == bool:
                val = str(value).lower() in ("true", "1", "yes")
            else:
                val = value
            set_setting(s, val)
            return True
    return False

def _bridge_get_secret_setting(bridge, key):
    """Returns a secret setting (e.g. API keys) by storage_key."""
    for s in Settings:
        if s.value.storage_key == key and s.value.is_secret:
            val = get_setting(s)
            return str(val) if val else ""
    return ""

def _bridge_set_secret_setting(bridge, key, value):
    """Sets a secret setting."""
    for s in Settings:
        if s.value.storage_key == key and s.value.is_secret:
            set_setting(s, value)
            return True
    return False
