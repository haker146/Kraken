#!/usr/bin/env bash
# Compatibility wrapper — forwards to kraken_install.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/kraken_install.sh" "$@"
