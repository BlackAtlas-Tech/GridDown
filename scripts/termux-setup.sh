#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# GridDown Termux Setup Script
# Run once after cloning: bash scripts/termux-setup.sh
#
# What this does:
#   1. Adds shell aliases to ~/.bashrc (gd, gd-bg, griddown-update, etc.)
#   2. Optionally installs Termux:Boot autostart script
#   3. Safe to run multiple times (idempotent)
#
# BlackAtlas LLC — Navigate When Infrastructure Fails
# ──────────────────────────────────────────────────────────────

set -e

# ── Colors ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Resolve paths ───────────────────────────────────────────────
# This script lives in GridDown/scripts/, so the repo root is one level up
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRIDDOWN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ALIASES_FILE="$SCRIPT_DIR/griddown-aliases.sh"
BASHRC="$HOME/.bashrc"
SOURCE_LINE="source \"$ALIASES_FILE\""
MARKER="# GridDown aliases"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║       GridDown Termux Setup Script           ║${NC}"
echo -e "${CYAN}${BOLD}║       BlackAtlas LLC                         ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "GridDown directory: ${BOLD}$GRIDDOWN_DIR${NC}"
echo ""

# ── Ensure script permissions ───────────────────────────────────
# Git clone or zip extraction may strip execute bits on some systems
chmod +x "$ALIASES_FILE" 2>/dev/null
chmod +x "$SCRIPT_DIR/termux-setup.sh" 2>/dev/null
chmod +x "$SCRIPT_DIR/griddown-server.py" 2>/dev/null

# ── Step 1: Install shell aliases ───────────────────────────────
echo -e "${BOLD}[1/3] Shell Aliases${NC}"

if [ ! -f "$ALIASES_FILE" ]; then
    echo -e "${RED}  ✗ Aliases file not found: $ALIASES_FILE${NC}"
    echo "  Run this script from the GridDown directory."
    exit 1
fi

# Check if already installed
if grep -qF "$MARKER" "$BASHRC" 2>/dev/null; then
    echo -e "${YELLOW}  ⟳ Aliases already installed in ~/.bashrc — updating...${NC}"
    # Remove old block and re-add (handles updates to the aliases file)
    # The block is between the marker line and the source line
    sed -i "/$MARKER/d" "$BASHRC"
    sed -i "\|source.*griddown-aliases\.sh|d" "$BASHRC"
    sed -i '/^export GRIDDOWN_DIR=.*GridDown/d' "$BASHRC"
fi

# Append to .bashrc
{
    echo ""
    echo "$MARKER"
    echo "export GRIDDOWN_DIR=\"$GRIDDOWN_DIR\""
    echo "$SOURCE_LINE"
} >> "$BASHRC"

# Ensure .bash_profile sources .bashrc (Termux login shells read
# .bash_profile instead of .bashrc if it exists)
BASH_PROFILE="$HOME/.bash_profile"
if [ -f "$BASH_PROFILE" ]; then
    if ! grep -qF '.bashrc' "$BASH_PROFILE" 2>/dev/null; then
        echo "" >> "$BASH_PROFILE"
        echo "# Source .bashrc for GridDown aliases in login shells" >> "$BASH_PROFILE"
        echo '[ -f ~/.bashrc ] && source ~/.bashrc' >> "$BASH_PROFILE"
        echo -e "${GREEN}  ✓ Updated ~/.bash_profile to source ~/.bashrc${NC}"
    fi
fi

echo -e "${GREEN}  ✓ Aliases installed in ~/.bashrc${NC}"
echo ""
echo "  Available commands:"
echo -e "    ${BOLD}gd${NC}               Start server (foreground)"
echo -e "    ${BOLD}gd-bg${NC}            Start server (background)"
echo -e "    ${BOLD}gd-stop${NC}          Stop server"
echo -e "    ${BOLD}gd-restart${NC}       Restart server"
echo -e "    ${BOLD}gd-status${NC}        Check if server is running"
echo -e "    ${BOLD}gd-start${NC}         Wake lock + start server + watcher"
echo -e "    ${BOLD}gd-shutdown${NC}      Stop server + watcher + release wake lock"
echo -e "    ${BOLD}griddown-update${NC}  Pull latest from GitHub"
echo -e "    ${BOLD}gd-watch${NC}         Auto-fetch updates every 15 min (background)"
echo -e "    ${BOLD}gd-watch 5${NC}       Auto-fetch every 5 min"
echo -e "    ${BOLD}gd-watch-stop${NC}    Stop auto-fetch watcher"
echo -e "    ${BOLD}gd-watch-status${NC}  Check watcher status + recent log"
echo -e "    ${BOLD}gd-watch-log${NC}     View watcher log"
echo -e "    ${BOLD}gd-version${NC}       Show current version"
echo -e "    ${BOLD}gd-log${NC}           Show recent commits"
echo -e "    ${BOLD}gd-force-update${NC}  Discard local changes and update"
echo -e "    ${BOLD}gd-size${NC}          Show disk usage"
echo -e "    ${BOLD}wl / wlu${NC}         Acquire / release wake lock"
echo ""

# ── Step 2: Termux:Boot autostart (optional) ───────────────────
echo -e "${BOLD}[2/3] Autostart on Boot${NC}"

BOOT_DIR="$HOME/.termux/boot"
BOOT_SCRIPT="$BOOT_DIR/start-griddown.sh"
INSTALL_BOOT=0

if [ -f "$BOOT_SCRIPT" ]; then
    echo -e "${YELLOW}  ⟳ Boot script already exists: $BOOT_SCRIPT${NC}"
    echo -n "  Overwrite with updated version? [y/N] "
    read -r answer
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
        INSTALL_BOOT=1
    else
        echo "  Skipped."
    fi
else
    echo -n "  Install Termux:Boot autostart script? [Y/n] "
    read -r answer
    if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
        INSTALL_BOOT=1
    else
        echo "  Skipped."
    fi
fi

if [ "$INSTALL_BOOT" = "1" ]; then
    mkdir -p "$BOOT_DIR"
    cat > "$BOOT_SCRIPT" << BOOTEOF
#!/data/data/com.termux/files/usr/bin/bash
# GridDown autostart script — runs on boot via Termux:Boot
# Installed by scripts/termux-setup.sh

# Acquire wake lock to prevent Android from killing Termux
termux-wake-lock

# Start GridDown HTTP server in background
python3 "$GRIDDOWN_DIR/scripts/griddown-server.py" &

# Start update watcher (checks every 15 min, pulls if update found)
# GridDown shows in-app toast — user decides when to apply.
source "$GRIDDOWN_DIR/scripts/griddown-aliases.sh"
gd-watch 15 &

# Log startup
echo "\$(date): GridDown server started on port 8080 (PID \$!)" >> ~/griddown-boot.log
BOOTEOF
    chmod +x "$BOOT_SCRIPT"
    echo -e "${GREEN}  ✓ Boot script installed: $BOOT_SCRIPT${NC}"
    echo -e "${YELLOW}  ⚠ Remember to open the Termux:Boot app once to register it.${NC}"
fi
echo ""

# ── Step 3: Verify environment ─────────────────────────────────
echo -e "${BOLD}[3/3] Environment Check${NC}"

CHECKS_PASSED=0
CHECKS_TOTAL=0

check() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    if command -v "$1" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $1 found: $($1 --version 2>&1 | head -1)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} $1 not found — install with: ${BOLD}pkg install $2${NC}"
    fi
}

check python3 python
check git git

# Check for optional SDR tools
if command -v rtl_test > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} rtl-sdr tools found"
else
    echo -e "  ${YELLOW}○${NC} rtl-sdr not installed (optional, for AtlasRF: pkg install rtl-sdr)"
fi

echo ""

# ── Summary ─────────────────────────────────────────────────────
if [ "$CHECKS_PASSED" -eq "$CHECKS_TOTAL" ]; then
    echo -e "${GREEN}${BOLD}Setup complete!${NC}"
else
    echo -e "${YELLOW}${BOLD}Setup complete with warnings.${NC}"
    echo "  Install missing packages above, then re-run this script."
fi

echo ""
echo "  To activate aliases in this session:"
echo -e "    ${BOLD}source ~/.bashrc${NC}"
echo ""
echo "  Then start GridDown:"
echo -e "    ${BOLD}gd-start${NC}"
echo ""
echo "  Open Chrome to:"
echo -e "    ${BOLD}http://localhost:8080${NC}"
echo ""
