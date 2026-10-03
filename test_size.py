import sys
import json
from pathlib import Path
sys.path.insert(0, r"d:\Projekty\Kraken")
from sff.network.steam_client import create_provider_for_current_thread

provider = create_provider_for_current_thread()
app_info = provider.get_single_app_info(990080, quick=True)

depots = app_info.get("depots", {})
print(json.dumps(depots.get("990081", {}), indent=2))
