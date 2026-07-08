#!/usr/bin/env bash
#
# install.sh — Prayer Times GNOME Shell extension installer
#
# Installs system dependencies (Node.js, GJS, GTK4, libadwaita, GStreamer
# plugins, GeoClue2), then runs npm install, build, and `make install`.
#
# Usage:
#   ./install.sh
#
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}==>${NC} $1"; }

# ── 1. Choose package manager ────────────────────────────────────────────────

echo -e "${BOLD}Prayer Times — Installer${NC}"
echo
echo "Which package manager does your system use?"
echo "  1) dnf     (Fedora, RHEL, CentOS)"
echo "  2) apt     (Debian, Ubuntu, Mint)"
echo "  3) pacman  (Arch, Manjaro)"
echo "  4) skip    (system dependencies already installed)"
echo
read -rp "Enter choice [1-4]: " PKG_CHOICE

# ── 2. Install system dependencies ───────────────────────────────────────────

install_dnf() {
  info "Installing system dependencies via dnf..."
  sudo dnf install -y \
    nodejs \
    npm \
    gjs \
    glib2-devel \
    gtk4-devel \
    libadwaita-devel \
    gstreamer1-plugins-good \
    gstreamer1-plugins-base \
    geoclue2 \
    make
}

install_apt() {
  info "Installing system dependencies via apt..."
  sudo apt update
  sudo apt install -y \
    nodejs \
    npm \
    gjs \
    libglib2.0-dev \
    libglib2.0-bin \
    libgtk-4-dev \
    libadwaita-1-dev \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-base \
    geoclue-2.0 \
    make
}

install_pacman() {
  info "Installing system dependencies via pacman..."
  sudo pacman -Syu --needed --noconfirm \
    nodejs \
    npm \
    gjs \
    glib2 \
    gtk4 \
    libadwaita \
    gst-plugins-good \
    gst-plugins-base \
    geoclue \
    make
}

case "$PKG_CHOICE" in
1) install_dnf ;;
2) install_apt ;;
3) install_pacman ;;
4) warn "Skipping system dependency install (assuming already present)." ;;
*)
  error "Invalid choice: $PKG_CHOICE"
  exit 1
  ;;
esac

# ── 3. Sanity checks ──────────────────────────────────────────────────────────

check_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "'$1' not found on PATH after install. Please install it manually."
    exit 1
  fi
}

info "Checking required commands..."
check_cmd node
check_cmd npm
check_cmd make
check_cmd gjs

if command -v gst-inspect-1.0 >/dev/null 2>&1; then
  if ! gst-inspect-1.0 playbin >/dev/null 2>&1; then
    warn "GStreamer 'playbin' element not found. Adhan audio playback will fail."
    warn "Re-run this script and select your package manager to install gstreamer1.0-plugins-good/base."
  fi
else
  warn "gst-inspect-1.0 not found — cannot verify GStreamer plugins."
fi

# ── 4. npm install + build ────────────────────────────────────────────────────

info "Running npm install..."
npm install

info "Type-checking..."
npm run typecheck

info "Building extension..."
npm run build

# ── 5. make install ───────────────────────────────────────────────────────────

info "Compiling GSettings schema and installing extension (make install)..."
make install

# ── 6. Done ────────────────────────────────────────────────────────────────────

echo
info "Installation complete."
echo
echo "Next steps:"
echo "  1. Restart GNOME Shell:"
echo "       Wayland → log out and back in"
echo "       X11     → Alt+F2, type 'r', Enter"
echo "  2. Enable the extension:"
echo "       gnome-extensions enable prayer-times@gawad-b.github.io"
echo "  3. Open preferences to set location and check adhan audio:"
echo "       gnome-extensions prefs prayer-times@gawad-b.github.io"
echo
echo "If adhan audio does not play, verify audio files exist under the"
echo "extension's sounds/ directory, named to match the selected muezzin"
echo "('makkah', 'medina', or 'egypt', extension .ogg/.mp3/.flac/.wav)."
