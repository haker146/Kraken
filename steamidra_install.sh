#!/usr/bin/env bash
# Kraken Linux Install Script
# Usage: bash steamidra_install.sh [install|uninstall]
#
# Supports three install types (auto-detected):
#   appimage  — Kraken*.AppImage (or legacy SteaMidra*.AppImage) next to this script
#   binary    — Kraken_GUI / Kraken binary next to this script
#   source    — Main.py + requirements.txt next to this script
#
# Environment variables:
#   SKIPVENV=1   Skip venv creation/rebuild (uses existing .venv)

set -euo pipefail

APP_NAME="Kraken"
INSTALL_DIR="$HOME/.local/share/Kraken"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_THEME_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── notify-send detection ─────────────────────────────────────────────────────
NOTIFY_SEND_AVAILABLE=1
command -v notify-send &>/dev/null && NOTIFY_SEND_AVAILABLE=0

# ── Logging ───────────────────────────────────────────────────────────────────
log_info() {
    echo -e "${GREEN}[Kraken]${NC} $1"
    set +eu
    if [ "$NOTIFY_SEND_AVAILABLE" -eq 0 ]; then
        notify-send -t 5000 "Kraken" "$1" 2>/dev/null
    fi
    set -eu
}

log_warn() {
    echo -e "${YELLOW}[Kraken]${NC} $1"
    set +eu
    if [ "$NOTIFY_SEND_AVAILABLE" -eq 0 ]; then
        notify-send -t 5000 -u normal "Kraken" "$1" 2>/dev/null
    fi
    set -eu
}

log_error() {
    echo -e "${RED}[Kraken]${NC} $1" >&2
    set +eu
    if [ "$NOTIFY_SEND_AVAILABLE" -eq 0 ]; then
        notify-send -t 10000 -u critical "Kraken Error" "$1" 2>/dev/null
    fi
    set -eu
}

_first_existing() {
    local f
    for f in "$@"; do
        [ -f "$f" ] && printf '%s\n' "$f" && return 0
    done
    return 1
}

# ── Install type detection ────────────────────────────────────────────────────
detect_install_type() {
    for f in "$SCRIPT_DIR"/Kraken*.AppImage "$SCRIPT_DIR"/kraken*.AppImage \
             "$SCRIPT_DIR"/SteaMidra*.AppImage "$SCRIPT_DIR"/steamidra*.AppImage; do
        [ -f "$f" ] && echo "appimage" && return 0
    done
    if [ -f "$SCRIPT_DIR/Kraken_GUI" ] || [ -f "$SCRIPT_DIR/Kraken" ] || [ -f "$SCRIPT_DIR/Kraken.bin" ] \
        || [ -f "$SCRIPT_DIR/SteaMidra" ] || [ -f "$SCRIPT_DIR/SteaMidra.bin" ]; then
        echo "binary" && return 0
    fi
    if [ -f "$SCRIPT_DIR/Main.py" ]; then
        echo "source" && return 0
    fi
    echo "unknown"
}

# ── Cleanup old install ───────────────────────────────────────────────────────
cleanup_existing() {
    log_info "Cleaning up existing installation..."
    rm -f "$INSTALL_DIR/Kraken.AppImage" "$INSTALL_DIR/SteaMidra.AppImage" 2>/dev/null || true
    rm -f "$INSTALL_DIR/Kraken_GUI" "$INSTALL_DIR/Kraken" "$INSTALL_DIR/Kraken.bin" 2>/dev/null || true
    rm -f "$INSTALL_DIR/SteaMidra" "$INSTALL_DIR/SteaMidra.bin" 2>/dev/null || true
    rm -f "$INSTALL_DIR/run.sh" 2>/dev/null || true
    rm -rf "$INSTALL_DIR/sff" 2>/dev/null || true
    rm -rf "$INSTALL_DIR/third_party" 2>/dev/null || true
    rm -f  "$INSTALL_DIR/Main.py" 2>/dev/null || true
    rm -f  "$INSTALL_DIR/Main_gui.py" 2>/dev/null || true
    # Previous SteaMidra prefix (same machine, older release)
    local old="$HOME/.local/share/SteaMidra"
    if [ -d "$old" ] && [ "$old" != "$INSTALL_DIR" ]; then
        log_info "Leaving $old in place. Uninstall it separately if you no longer need it."
    fi
}

# ── Icon + desktop entry ──────────────────────────────────────────────────────
install_desktop_entry() {
    local exec_path="$1"
    local terminal="${2:-false}"

    mkdir -p "$ICON_THEME_DIR"
    local icon_src=""
    icon_src="$(_first_existing \
        "$SCRIPT_DIR/kraken.png" \
        "$SCRIPT_DIR/Kraken.png" \
        "$INSTALL_DIR/kraken.png" \
        "$INSTALL_DIR/Kraken.png" \
        "$SCRIPT_DIR/SFF.png" \
        "$INSTALL_DIR/SFF.png" \
        "$SCRIPT_DIR/SteaMidra.png" \
        "$INSTALL_DIR/SteaMidra.png" || true)"

    if [ -n "$icon_src" ]; then
        cp -f "$icon_src" "$ICON_THEME_DIR/Kraken.png"
        if [ -z "${XDG_CURRENT_DESKTOP:-}" ] || [[ "${XDG_CURRENT_DESKTOP:-}" != *"KDE"* ]]; then
            command -v gtk-update-icon-cache  &>/dev/null && gtk-update-icon-cache  "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
            command -v gtk4-update-icon-cache &>/dev/null && gtk4-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
        fi
    else
        log_warn "No icon file found — app launcher will have no icon."
    fi

    mkdir -p "$DESKTOP_DIR"
    cat > "$DESKTOP_DIR/kraken.desktop" <<EOF
[Desktop Entry]
Version=1.0
Name=Kraken
Comment=Playnite-style Steam catalog
Exec=$exec_path
Icon=Kraken
Terminal=$terminal
Type=Application
Categories=Utility;
StartupNotify=false
EOF

    command -v update-desktop-database &>/dev/null && \
        update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

    log_info "Desktop entry installed."
}

# ── Launcher wrapper ──────────────────────────────────────────────────────────
create_launcher_script() {
    local target="$1"
    mkdir -p "$BIN_DIR"
    cat > "$BIN_DIR/kraken" <<EOF
#!/usr/bin/env bash
export QTWEBENGINE_DISABLE_SANDBOX=1
exec "$target" "\$@"
EOF
    chmod +x "$BIN_DIR/kraken"
    # Keep the old command name so existing PATH muscle-memory still works.
    ln -sfn "$BIN_DIR/kraken" "$BIN_DIR/steamidra"
    log_info "Launcher created at $BIN_DIR/kraken"
}

# ── .NET 9 runtime (needed for DepotDownloaderMod) ───────────────────────────
install_dotnet9() {
    if command -v dotnet &>/dev/null && dotnet --list-runtimes 2>/dev/null | grep -q "Microsoft.NETCore.App 9\."; then
        log_info ".NET 9 already installed."
        return 0
    fi
    if [ -f "$HOME/.dotnet/dotnet" ] && "$HOME/.dotnet/dotnet" --list-runtimes 2>/dev/null | grep -q "Microsoft.NETCore.App 9\."; then
        log_info ".NET 9 already installed at ~/.dotnet."
        return 0
    fi
    log_info "Installing .NET 9 runtime (needed for game downloads)..."
    local TMP
    TMP="$(mktemp)"
    curl -fsSL --connect-timeout 30 --max-time 120 https://dot.net/v1/dotnet-install.sh -o "$TMP" || { log_error "Failed to download dotnet-install.sh"; rm -f "$TMP"; return 1; }
    chmod +x "$TMP"
    DOTNET_ROOT="$HOME/.dotnet" bash "$TMP" --channel 9.0 --runtime dotnet || { log_error ".NET 9 install failed"; rm -f "$TMP"; return 1; }
    rm -f "$TMP"
    if "$HOME/.dotnet/dotnet" --list-runtimes 2>/dev/null | grep -q "Microsoft.NETCore.App 9\."; then
        log_info ".NET 9 installed successfully."
        for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
            [ -f "$rc" ] || continue
            grep -q 'DOTNET_ROOT' "$rc" 2>/dev/null && continue
            echo 'export DOTNET_ROOT="$HOME/.dotnet"' >> "$rc"
            echo 'export PATH="$PATH:$HOME/.dotnet"'  >> "$rc"
        done
    else
        log_error ".NET 9 installation failed. Install manually:"
        log_error "  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 9.0 --runtime dotnet"
    fi
}

# ── venv helper ───────────────────────────────────────────────────────────────
setup_venv() {
    local dir="$1"
    if [ "${SKIPVENV:-}" = "1" ] && [ -f "$dir/.venv/bin/activate" ]; then
        log_info "Skipping venv setup (SKIPVENV=1 and .venv exists)."
        return 0
    fi
    log_info "Setting up Python virtual environment..."
    python3 -m venv "$dir/.venv"
    if [ -f "$dir/requirements-linux.txt" ]; then
        "$dir/.venv/bin/pip" install --quiet -r "$dir/requirements-linux.txt"
    elif [ -f "$dir/requirements.txt" ]; then
        "$dir/.venv/bin/pip" install --quiet -r "$dir/requirements.txt"
    fi
    "$dir/.venv/bin/pip" install --quiet steam==1.4.4 --no-deps
}

# ── Install: AppImage ─────────────────────────────────────────────────────────
install_appimage() {
    local src=""
    for f in "$SCRIPT_DIR"/Kraken*.AppImage "$SCRIPT_DIR"/kraken*.AppImage \
             "$SCRIPT_DIR"/SteaMidra*.AppImage "$SCRIPT_DIR"/steamidra*.AppImage; do
        [ -f "$f" ] && src="$f" && break
    done
    [ -z "$src" ] && log_error "No AppImage found in $SCRIPT_DIR" && exit 1

    log_info "Installing AppImage: $(basename "$src")"
    mkdir -p "$INSTALL_DIR"
    local dest="$INSTALL_DIR/Kraken.AppImage"
    [ "$src" != "$dest" ] && cp -f "$src" "$dest"
    chmod +x "$dest"

    if [ ! -f "$SCRIPT_DIR/kraken.png" ] && [ ! -f "$SCRIPT_DIR/Kraken.png" ] && [ ! -f "$SCRIPT_DIR/SFF.png" ]; then
        set +e
        APPIMAGE_EXTRACT_AND_RUN=1 "$dest" --appimage-extract squashfs-root/Kraken.png 2>/dev/null && \
            cp -f squashfs-root/Kraken.png "$SCRIPT_DIR/kraken.png" 2>/dev/null && \
            rm -rf squashfs-root
        set -e
    fi

    create_launcher_script "$dest"
    install_desktop_entry  "$dest" "false"
    log_info "Kraken AppImage installed to $INSTALL_DIR"
}

# ── Install: binary ───────────────────────────────────────────────────────────
install_binary() {
    local src=""
    src="$(_first_existing \
        "$SCRIPT_DIR/Kraken_GUI" \
        "$SCRIPT_DIR/Kraken" \
        "$SCRIPT_DIR/Kraken.bin" \
        "$SCRIPT_DIR/SteaMidra" \
        "$SCRIPT_DIR/SteaMidra.bin" || true)"
    [ -z "$src" ] && log_error "No Kraken binary found in $SCRIPT_DIR" && exit 1

    log_info "Installing binary: $(basename "$src")"
    mkdir -p "$INSTALL_DIR"
    cp -f "$src" "$INSTALL_DIR/Kraken_GUI"
    chmod +x "$INSTALL_DIR/Kraken_GUI"

    create_launcher_script "$INSTALL_DIR/Kraken_GUI"
    install_desktop_entry  "$INSTALL_DIR/Kraken_GUI" "true"
    log_info "Kraken binary installed to $INSTALL_DIR"
}

# ── Install: source ───────────────────────────────────────────────────────────
install_source() {
    if ! command -v python3 &>/dev/null; then
        log_error "python3 not found. Please install Python 3.10+."
        exit 1
    fi

    log_info "Installing from source: $SCRIPT_DIR"
    mkdir -p "$INSTALL_DIR"
    [ "$SCRIPT_DIR" != "$INSTALL_DIR" ] && cp -r "$SCRIPT_DIR/." "$INSTALL_DIR/"

    setup_venv "$INSTALL_DIR"

    cat > "$INSTALL_DIR/run.sh" <<RUNEOF
#!/usr/bin/env bash
cd "$INSTALL_DIR"
exec "$INSTALL_DIR/.venv/bin/python" "$INSTALL_DIR/Main_gui.py" "\$@"
RUNEOF
    chmod +x "$INSTALL_DIR/run.sh"

    create_launcher_script "$INSTALL_DIR/run.sh"
    install_desktop_entry  "$INSTALL_DIR/run.sh" "true"
    log_info "Kraken source install complete."
}

# ── Post-install message ──────────────────────────────────────────────────────
installed_message() {
    log_info "Kraken installed to $INSTALL_DIR"
    log_info "Run: kraken   or launch from your application menu."
    if ! echo "$PATH" | grep -q "$BIN_DIR"; then
        log_warn "Add $BIN_DIR to your PATH to use 'kraken' from any terminal."
        log_warn "  echo 'export PATH=\"\$PATH:$BIN_DIR\"' >> ~/.bashrc && source ~/.bashrc"
    fi
    (
        sleep 3
        set +eu
        if [ "$NOTIFY_SEND_AVAILABLE" -eq 0 ]; then
            notify-send -t 8000 "Kraken installed" \
                "Installed to $INSTALL_DIR — launch from your application menu." 2>/dev/null
        fi
    ) &
    disown
}

# ── Uninstall ─────────────────────────────────────────────────────────────────
do_uninstall() {
    log_info "Uninstalling Kraken..."
    rm -rf "$INSTALL_DIR"
    rm -f  "$BIN_DIR/kraken" "$BIN_DIR/steamidra"
    rm -f  "$DESKTOP_DIR/kraken.desktop" "$DESKTOP_DIR/steamidra.desktop"
    rm -f  "$ICON_THEME_DIR/Kraken.png" "$ICON_THEME_DIR/SteaMidra.png"
    command -v update-desktop-database &>/dev/null && \
        update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    log_info "Kraken uninstalled."
}

# ── Main ──────────────────────────────────────────────────────────────────────
case "${1:-install}" in
    install)
        INSTALL_TYPE="$(detect_install_type)"
        log_info "Detected install type: $INSTALL_TYPE"
        cleanup_existing
        case "$INSTALL_TYPE" in
            appimage) install_appimage ;;
            binary)   install_binary   ;;
            source)   install_source   ;;
            unknown)
                log_error "No Kraken AppImage, binary, or Main.py found in $SCRIPT_DIR"
                log_error "Place steamidra_install.sh alongside Kraken.AppImage (or Main.py for source)."
                exit 1
                ;;
        esac
        install_dotnet9
        installed_message
        ;;
    uninstall) do_uninstall ;;
    *)
        echo "Usage: $0 [install|uninstall]"
        exit 1
        ;;
esac
