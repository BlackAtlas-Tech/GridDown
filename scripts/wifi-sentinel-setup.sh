#!/data/data/com.termux/files/usr/bin/bash
# ══════════════════════════════════════════════════════════════════
# WiFi Sentinel Setup Script
# Run once to configure drone detection: bash scripts/wifi-sentinel-setup.sh
#
# What this does:
#   1. Installs required packages (websocat, termux-api)
#   2. Detects ESP32-C5 USB devices and creates symlinks
#   3. Sets file permissions on bridge scripts
#   4. Verifies Termux WiFi scan capability (Tier 0)
#   5. Tests ESP32 serial communication (Tier 1)
#   6. Installs shell aliases for bridge management
#   7. Optionally adds bridges to Termux:Boot autostart
#
# Safe to run multiple times (idempotent).
#
# BlackAtlas LLC — Navigate When Infrastructure Fails
# ══════════════════════════════════════════════════════════════════

set -e

# ── Colors ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Resolve paths ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRIDDOWN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── ESP32-C5 USB identifiers ────────────────────────────────────
# Espressif USB JTAG/serial (ESP32-C5 default)
ESP_VID="303a"
ESP_PID="1001"
# Alternate: CP210x bridge on some dev boards
CP210X_VID="10c4"
CP210X_PID="ea60"

# ── Ports ────────────────────────────────────────────────────────
WS_PORT_24="8766"
WS_PORT_5G="8767"
WS_PORT_SCAN="8765"

# ── State tracking ───────────────────────────────────────────────
WARNINGS=0
ERRORS=0
ESP32_DEVICES=()
HAS_WEBSOCAT=0
HAS_TERMUX_API=0
TIER0_READY=0
TIER1_READY=0

echo ""
echo -e "${MAGENTA}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}${BOLD}║     WiFi Sentinel Setup                      ║${NC}"
echo -e "${MAGENTA}${BOLD}║     Passive Drone Detection                  ║${NC}"
echo -e "${MAGENTA}${BOLD}║     BlackAtlas LLC                           ║${NC}"
echo -e "${MAGENTA}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  GridDown directory: ${BOLD}$GRIDDOWN_DIR${NC}"
echo ""

# ── Detect environment ───────────────────────────────────────────
IS_TERMUX=0
if [ -d "/data/data/com.termux" ]; then
    IS_TERMUX=1
    # Ensure Termux bin directories are in PATH (critical for command detection)
    TERMUX_PREFIX="/data/data/com.termux/files/usr"
    if [ -d "$TERMUX_PREFIX/bin" ]; then
        export PATH="$TERMUX_PREFIX/bin:$TERMUX_PREFIX/sbin:$PATH"
    fi
    echo -e "  Environment: ${GREEN}Termux on Android${NC}"
    echo -e "  ${DIM}PREFIX: ${TERMUX_PREFIX}${NC}"
else
    echo -e "  Environment: ${CYAN}Linux${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 1: Install Required Packages
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[1/7] Installing Packages${NC}"
echo ""

# Update package repository first (required for fresh installs)
if [ "$IS_TERMUX" = "1" ]; then
    echo -e "  Updating package repository..."
    pkg update -y 2>&1 | tail -1 || true
    echo ""
fi

install_pkg() {
    local cmd="$1"
    local pkg="$2"
    local desc="$3"
    local required="$4"  # "required" or "optional"

    # Method 1: Check if command is in PATH
    if command -v "$cmd" > /dev/null 2>&1; then
        local ver=""
        if [ "$IS_TERMUX" = "1" ]; then
            ver=$(dpkg -s "$pkg" 2>/dev/null | grep '^Version:' | cut -d' ' -f2 || echo "")
        fi
        if [ -z "$ver" ]; then
            ver=$(timeout 2 "$cmd" --version 2>&1 | head -1 || echo "")
        fi
        echo -e "  ${GREEN}✓${NC} $pkg — $desc"
        [ -n "$ver" ] && echo -e "    ${DIM}v${ver}${NC}"
        return 0
    fi

    # Method 2: Check if binary exists at Termux prefix directly (PATH may be incomplete)
    if [ "$IS_TERMUX" = "1" ] && [ -n "$TERMUX_PREFIX" ] && [ -f "$TERMUX_PREFIX/bin/$cmd" ]; then
        local ver
        ver=$(dpkg -s "$pkg" 2>/dev/null | grep '^Version:' | cut -d' ' -f2 || echo "installed")
        echo -e "  ${GREEN}✓${NC} $pkg — $desc"
        echo -e "    ${DIM}v${ver} (found at \$PREFIX/bin/$cmd)${NC}"
        return 0
    fi

    # Method 3: Check dpkg package status
    if [ "$IS_TERMUX" = "1" ] && dpkg -s "$pkg" 2>/dev/null | grep -q '^Status:.*installed'; then
        local ver
        ver=$(dpkg -s "$pkg" 2>/dev/null | grep '^Version:' | cut -d' ' -f2 || echo "installed")
        echo -e "  ${GREEN}✓${NC} $pkg — $desc"
        echo -e "    ${DIM}v${ver} (dpkg: installed)${NC}"
        return 0
    fi

    # Method 4: Check pkg list-installed (alternative to dpkg on some Termux builds)
    if [ "$IS_TERMUX" = "1" ] && pkg list-installed 2>/dev/null | grep -q "^${pkg}/"; then
        echo -e "  ${GREEN}✓${NC} $pkg — $desc"
        echo -e "    ${DIM}(detected via pkg list-installed)${NC}"
        return 0
    fi

    if [ "$required" = "required" ]; then
        echo -e "  ${YELLOW}○${NC} $pkg not found — $desc"
        if [ "$IS_TERMUX" = "1" ]; then
            echo -n "    Install now? [Y/n] "
            read -r answer
            if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
                echo -e "    ${DIM}Running: pkg install -y $pkg${NC}"
                if pkg install -y "$pkg" 2>&1 | tail -1; then
                    echo -e "  ${GREEN}✓${NC} $pkg installed"
                    return 0
                else
                    echo -e "  ${RED}✗${NC} Failed to install $pkg"
                    ERRORS=$((ERRORS + 1))
                    return 1
                fi
            else
                echo -e "  ${RED}✗${NC} $pkg required — install manually: ${BOLD}pkg install $pkg${NC}"
                ERRORS=$((ERRORS + 1))
                return 1
            fi
        else
            echo -e "  ${RED}✗${NC} $pkg not found — install manually for your distribution"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        # Optional
        echo -e "  ${YELLOW}○${NC} $pkg not found (optional) — $desc"
        if [ "$IS_TERMUX" = "1" ]; then
            echo -n "    Install now? [y/N] "
            read -r answer
            if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
                echo -e "    ${DIM}Running: pkg install -y $pkg${NC}"
                if pkg install -y "$pkg" 2>&1 | tail -1; then
                    echo -e "  ${GREEN}✓${NC} $pkg installed"
                    return 0
                else
                    echo -e "  ${YELLOW}○${NC} Failed to install $pkg — skipping"
                    WARNINGS=$((WARNINGS + 1))
                    return 1
                fi
            else
                echo "    Skipped."
                return 1
            fi
        else
            echo -e "    ${DIM}Install manually if needed${NC}"
            return 1
        fi
    fi
}

# websocat — required for ALL bridge communication
if install_pkg websocat websocat "WebSocket relay for ESP32 and WiFi scan bridges" required; then
    HAS_WEBSOCAT=1
fi
echo ""

# termux-api — required for Tier 0 WiFi scanning
if [ "$IS_TERMUX" = "1" ]; then
    # Detect Termux installation source
    TERMUX_SOURCE="unknown"
    if [ -n "$TERMUX_APK_RELEASE" ]; then
        TERMUX_SOURCE="$TERMUX_APK_RELEASE"
    elif [ -f "/data/data/com.termux/files/usr/etc/termux/termux.properties" ] 2>/dev/null; then
        # Heuristic: Google Play version uses different paths/properties
        if pm list packages 2>/dev/null | grep -q "com.termux.api"; then
            TERMUX_SOURCE="has_api_app"
        fi
    fi

    echo -e "  Termux source: ${BOLD}${TERMUX_SOURCE}${NC}"

    if [ "$TERMUX_SOURCE" = "GOOGLE_PLAY_STORE" ]; then
        echo ""
        echo -e "  ${RED}${BOLD}⚠  Google Play Termux detected${NC}"
        echo -e "  ${YELLOW}   The Termux:API companion app is NOT available on Google Play.${NC}"
        echo -e "  ${YELLOW}   termux-wifi-scaninfo requires Termux:API, so Tier 0 WiFi${NC}"
        echo -e "  ${YELLOW}   scanning is NOT available with the Google Play version.${NC}"
        echo ""
        echo -e "  ${BOLD}   Tier 1 (ESP32-C5) still works${NC} — it only needs websocat."
        echo ""
        echo -e "  ${DIM}   For Tier 0 support, install Termux + Termux:API from GitHub:${NC}"
        echo -e "  ${DIM}     https://github.com/termux/termux-app/releases${NC}"
        echo -e "  ${DIM}     https://github.com/termux/termux-api/releases${NC}"
        echo -e "  ${DIM}   (Requires uninstalling Google Play Termux first — backup data!)${NC}"
        echo ""
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${CYAN}Tier 0 requires TWO separate installs both named 'termux-api':${NC}"
        echo -e "  ${DIM}  1. CLI package:  pkg install termux-api   (installs the commands)${NC}"
        echo -e "  ${DIM}  2. Android app:  Termux:API APK from GitHub  (provides WiFi access)${NC}"
        echo ""
        if install_pkg termux-wifi-scaninfo termux-api "CLI tools for Android WiFi scan (Step 1 of 2)" optional; then
            HAS_TERMUX_API=1
        fi
        echo ""

        # Check for the companion Android app (required in addition to the CLI package)
        if [ "$HAS_TERMUX_API" = "1" ]; then
            # The CLI tools (pkg install termux-api) are installed, but we also need
            # the Termux:API Android app for the system-level bridge
            API_APP_INSTALLED=0
            if pm list packages 2>/dev/null | grep -q "com.termux.api"; then
                API_APP_INSTALLED=1
            fi

            if [ "$API_APP_INSTALLED" = "1" ]; then
                echo -e "  ${GREEN}✓${NC} Termux:API companion app detected"
            else
                echo -e "  ${YELLOW}⚠${NC}  The ${BOLD}Termux:API${NC} companion app must also be installed."
                echo -e "     ${DIM}The CLI tools (termux-api package) are installed, but the Android${NC}"
                echo -e "     ${DIM}app provides the system-level WiFi access. Both are required.${NC}"
                echo ""
                echo -e "     Install from the same source as Termux:"
                echo -e "     ${DIM}• F-Droid: search 'Termux:API'${NC}"
                echo -e "     ${DIM}• GitHub:  https://github.com/termux/termux-api/releases${NC}"
                echo ""
                echo -e "     ${RED}Do NOT mix sources.${NC} All Termux apps must come from the same source"
                echo -e "     (F-Droid, GitHub, or Google Play) due to signing key differences."
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 2: Set Script Permissions
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[2/7] Script Permissions${NC}"

set_perm() {
    local script="$1"
    local name="$2"
    if [ -f "$script" ]; then
        chmod +x "$script"
        echo -e "  ${GREEN}✓${NC} $name"
    else
        echo -e "  ${RED}✗${NC} $name — file not found: $script"
        ERRORS=$((ERRORS + 1))
    fi
}

set_perm "$SCRIPT_DIR/serial-ws-bridge.sh" "serial-ws-bridge.sh (Tier 1 ESP32 bridge)"
set_perm "$SCRIPT_DIR/wifi-scan-bridge.sh" "wifi-scan-bridge.sh (Tier 0 WiFi scan bridge)"
set_perm "$SCRIPT_DIR/wifi-sentinel-setup.sh" "wifi-sentinel-setup.sh (this script)"
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 3: Detect ESP32-C5 USB Devices
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[3/7] ESP32-C5 Detection${NC}"
echo ""

# Look for serial devices
FOUND_ACM=()
FOUND_USB=()

for dev in /dev/ttyACM* /dev/ttyUSB*; do
    [ -e "$dev" ] || continue
    if [[ "$dev" == *ACM* ]]; then
        FOUND_ACM+=("$dev")
    else
        FOUND_USB+=("$dev")
    fi
done

ALL_SERIAL=("${FOUND_ACM[@]}" "${FOUND_USB[@]}")

if [ ${#ALL_SERIAL[@]} -eq 0 ]; then
    echo -e "  ${YELLOW}○${NC} No USB serial devices found (/dev/ttyACM* or /dev/ttyUSB*)"
    echo -e "    ${DIM}Connect ESP32-C5 units via USB-C OTG hub and re-run this script.${NC}"
    echo -e "    ${DIM}If devices are connected, you may need to grant USB permission in Android.${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "  Found ${BOLD}${#ALL_SERIAL[@]}${NC} serial device(s):"
    echo ""
    for dev in "${ALL_SERIAL[@]}"; do
        # Try to get USB info
        local_info=""
        if [ -d "/sys/class/tty/$(basename "$dev")/device" ]; then
            vid_path="/sys/class/tty/$(basename "$dev")/device/../idVendor"
            pid_path="/sys/class/tty/$(basename "$dev")/device/../idProduct"
            if [ -f "$vid_path" ] && [ -f "$pid_path" ]; then
                vid=$(cat "$vid_path" 2>/dev/null || echo "????")
                pid=$(cat "$pid_path" 2>/dev/null || echo "????")
                local_info=" [USB ${vid}:${pid}]"
                if [ "$vid" = "$ESP_VID" ] || [ "$vid" = "$CP210X_VID" ]; then
                    ESP32_DEVICES+=("$dev")
                    local_info="${local_info} ${GREEN}← ESP32${NC}"
                fi
            fi
        fi
        echo -e "    ${BOLD}$dev${NC}${local_info}"
    done

    # If we couldn't identify by VID/PID (common on Android/Termux), assume ACM devices are ESP32
    if [ ${#ESP32_DEVICES[@]} -eq 0 ] && [ ${#FOUND_ACM[@]} -gt 0 ]; then
        echo ""
        echo -e "  ${YELLOW}○${NC} Could not read USB vendor IDs (normal on Android)"
        echo -e "    Assuming /dev/ttyACM* devices are ESP32-C5 units."
        ESP32_DEVICES=("${FOUND_ACM[@]}")
    fi

    echo ""
    if [ ${#ESP32_DEVICES[@]} -ge 2 ]; then
        echo -e "  ${GREEN}✓${NC} ${BOLD}${#ESP32_DEVICES[@]} ESP32-C5 units detected${NC} — Tier 1 full detection available"
    elif [ ${#ESP32_DEVICES[@]} -eq 1 ]; then
        echo -e "  ${YELLOW}○${NC} ${BOLD}1 ESP32-C5 unit detected${NC} — single-band only"
        echo -e "    ${DIM}Connect a second ESP32-C5 for dual-band (2.4 + 5 GHz) coverage.${NC}"
    fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 4: Create Device Symlinks
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[4/7] Device Symlinks${NC}"
echo ""

SYMLINK_DIR="/dev/atlasrf"
LINK_24="$SYMLINK_DIR/wifi24"
LINK_5G="$SYMLINK_DIR/wifi5g"

if [ ${#ESP32_DEVICES[@]} -eq 0 ]; then
    echo -e "  ${DIM}Skipped — no ESP32 devices detected${NC}"
elif [ ${#ESP32_DEVICES[@]} -ge 2 ]; then
    echo "  This will create stable symlinks so bridge scripts always find"
    echo "  the correct ESP32 unit regardless of USB enumeration order:"
    echo ""
    echo -e "    ${BOLD}$LINK_24${NC} → ${ESP32_DEVICES[0]} (2.4 GHz, Unit 1)"
    echo -e "    ${BOLD}$LINK_5G${NC} → ${ESP32_DEVICES[1]} (5 GHz, Unit 2)"
    echo ""

    # Check if symlinks already exist and point to the right devices
    NEED_SYMLINKS=1
    if [ -L "$LINK_24" ] && [ -L "$LINK_5G" ]; then
        existing_24=$(readlink -f "$LINK_24" 2>/dev/null || echo "")
        existing_5g=$(readlink -f "$LINK_5G" 2>/dev/null || echo "")
        if [ "$existing_24" = "${ESP32_DEVICES[0]}" ] && [ "$existing_5g" = "${ESP32_DEVICES[1]}" ]; then
            echo -e "  ${GREEN}✓${NC} Symlinks already correct"
            NEED_SYMLINKS=0
        else
            echo -e "  ${YELLOW}⟳${NC} Symlinks exist but point to different devices — updating"
        fi
    fi

    if [ "$NEED_SYMLINKS" = "1" ]; then
        # Try to create symlinks (may need root on some systems)
        if mkdir -p "$SYMLINK_DIR" 2>/dev/null && \
           ln -sf "${ESP32_DEVICES[0]}" "$LINK_24" 2>/dev/null && \
           ln -sf "${ESP32_DEVICES[1]}" "$LINK_5G" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Symlinks created"
        else
            echo -e "  ${YELLOW}○${NC} Permission denied — trying with sudo..."
            if command -v sudo &>/dev/null; then
                sudo mkdir -p "$SYMLINK_DIR" && \
                sudo ln -sf "${ESP32_DEVICES[0]}" "$LINK_24" && \
                sudo ln -sf "${ESP32_DEVICES[1]}" "$LINK_5G" && \
                echo -e "  ${GREEN}✓${NC} Symlinks created (via sudo)" || {
                    echo -e "  ${YELLOW}○${NC} Could not create symlinks — use raw device paths instead"
                    WARNINGS=$((WARNINGS + 1))
                }
            else
                echo -e "  ${YELLOW}○${NC} No sudo available — bridge scripts will use raw /dev/ttyACM* paths"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    fi
elif [ ${#ESP32_DEVICES[@]} -eq 1 ]; then
    echo "  Only 1 ESP32 detected — creating single symlink:"
    echo -e "    ${BOLD}$LINK_24${NC} → ${ESP32_DEVICES[0]}"
    echo ""
    if mkdir -p "$SYMLINK_DIR" 2>/dev/null && \
       ln -sf "${ESP32_DEVICES[0]}" "$LINK_24" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Symlink created"
    else
        if command -v sudo &>/dev/null; then
            sudo mkdir -p "$SYMLINK_DIR" && \
            sudo ln -sf "${ESP32_DEVICES[0]}" "$LINK_24" && \
            echo -e "  ${GREEN}✓${NC} Symlink created (via sudo)" || {
                echo -e "  ${YELLOW}○${NC} Could not create symlink"
                WARNINGS=$((WARNINGS + 1))
            }
        else
            echo -e "  ${YELLOW}○${NC} Could not create symlink"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 5: Verify Tier 0 (Termux WiFi Scan)
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[5/7] Tier 0 — Termux WiFi Scan Test${NC}"
echo ""

if [ "$IS_TERMUX" != "1" ]; then
    echo -e "  ${DIM}Skipped — Tier 0 requires Termux on Android${NC}"
elif [ "$HAS_TERMUX_API" != "1" ]; then
    echo -e "  ${YELLOW}○${NC} Skipped — termux-api not installed"
    echo -e "    ${DIM}Install with: pkg install termux-api${NC}"
    echo -e "    ${DIM}Also install the Termux:API companion app from the same source as Termux.${NC}"
elif [ "$HAS_WEBSOCAT" != "1" ]; then
    echo -e "  ${YELLOW}○${NC} Skipped — websocat not installed (required for bridge)"
else
    echo -e "  Testing WiFi scan via termux-wifi-scaninfo..."
    echo ""

    # Run a test scan (use full path as fallback)
    WIFI_SCAN_CMD="termux-wifi-scaninfo"
    if ! command -v "$WIFI_SCAN_CMD" &>/dev/null && [ -f "$TERMUX_PREFIX/bin/$WIFI_SCAN_CMD" ]; then
        WIFI_SCAN_CMD="$TERMUX_PREFIX/bin/$WIFI_SCAN_CMD"
    fi
    SCAN_OUTPUT=$($WIFI_SCAN_CMD 2>&1 || echo "ERROR")

    if echo "$SCAN_OUTPUT" | grep -q "ERROR\|error\|permission\|denied"; then
        echo -e "  ${RED}✗${NC} WiFi scan failed"
        echo -e "    ${DIM}$SCAN_OUTPUT${NC}"
        echo ""
        echo -e "  ${YELLOW}Troubleshooting:${NC}"
        echo "    1. Grant location permission to the Termux:API app"
        echo "    2. Enable location services on the device"
        echo "    3. Ensure the Termux:API app is installed from the same source as Termux"
        WARNINGS=$((WARNINGS + 1))
    elif echo "$SCAN_OUTPUT" | grep -q '^\['; then
        # Count networks found
        NET_COUNT=$(echo "$SCAN_OUTPUT" | grep -c '"bssid"' || echo "0")
        echo -e "  ${GREEN}✓${NC} WiFi scan working — ${BOLD}$NET_COUNT networks${NC} detected"

        # Check for known drone SSIDs in scan results
        DRONE_HITS=""
        for pattern in "Skydio" "DJI" "TELLO" "Parrot" "Autel" "Yuneec" "FIMI" "SkyViper"; do
            if echo "$SCAN_OUTPUT" | grep -qi "$pattern"; then
                DRONE_HITS="${DRONE_HITS} $pattern"
            fi
        done

        if [ -n "$DRONE_HITS" ]; then
            echo -e "  ${GREEN}${BOLD}🎯 Possible drone SSIDs in range:${NC}${DRONE_HITS}"
        fi

        TIER0_READY=1
        echo ""
        echo -e "  ${GREEN}✓${NC} Tier 0 ready — WiFi scan bridge will relay these results to GridDown"
    else
        echo -e "  ${YELLOW}○${NC} WiFi scan returned empty results"
        echo -e "    ${DIM}This is normal if WiFi is disabled or no networks are in range.${NC}"
        TIER0_READY=1  # The command works, just no results right now
    fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 6: Verify Tier 1 (ESP32-C5 Serial Test)
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[6/7] Tier 1 — ESP32-C5 Serial Test${NC}"
echo ""

if [ ${#ESP32_DEVICES[@]} -eq 0 ]; then
    echo -e "  ${DIM}Skipped — no ESP32 devices detected${NC}"
elif [ "$HAS_WEBSOCAT" != "1" ]; then
    echo -e "  ${YELLOW}○${NC} Skipped — websocat not installed (required for bridge)"
else
    echo -e "  Testing serial communication with ESP32-C5..."
    echo ""

    for i in "${!ESP32_DEVICES[@]}"; do
        dev="${ESP32_DEVICES[$i]}"
        unit_num=$((i + 1))

        echo -n "  Unit $unit_num ($dev): "

        # Try to configure and read one line with timeout
        if stty -F "$dev" 115200 cs8 -cstopb -parenb raw -echo 2>/dev/null; then
            # Read with 3-second timeout
            LINE=$(timeout 3 head -c 512 "$dev" 2>/dev/null | head -1 || echo "")

            if [ -n "$LINE" ]; then
                # Check if it's valid JSONL
                if echo "$LINE" | grep -q '^{'; then
                    echo -e "${GREEN}✓${NC} Receiving JSONL data"
                    echo -e "    ${DIM}${LINE:0:80}...${NC}"
                else
                    echo -e "${YELLOW}○${NC} Receiving data (not JSONL — firmware may need update)"
                    echo -e "    ${DIM}${LINE:0:80}${NC}"
                fi
            else
                echo -e "${YELLOW}○${NC} No data received in 3s (ESP32 may be idle or firmware not flashed)"
            fi
        else
            echo -e "${RED}✗${NC} Could not open serial port"
            echo -e "    ${DIM}Port may be in use or permission denied. Try: chmod 666 $dev${NC}"
        fi
    done

    if [ ${#ESP32_DEVICES[@]} -ge 1 ]; then
        TIER1_READY=1
    fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 7: Shell Aliases & Boot Script
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}[7/7] Shell Aliases & Autostart${NC}"
echo ""

BASHRC="$HOME/.bashrc"
MARKER="# WiFi Sentinel aliases"

# ── Build alias block ────────────────────────────────────────────
ALIAS_BLOCK="$MARKER
# Bridge start commands
alias ws-start-24='${SCRIPT_DIR}/serial-ws-bridge.sh ${LINK_24} ${WS_PORT_24}'
alias ws-start-5g='${SCRIPT_DIR}/serial-ws-bridge.sh ${LINK_5G} ${WS_PORT_5G}'
alias ws-start-scan='${SCRIPT_DIR}/wifi-scan-bridge.sh ${WS_PORT_SCAN}'

# Start all bridges in background
ws-start-all() {
    echo 'Starting WiFi Sentinel bridges...'
    if [ -e '${LINK_24}' ] || [ -e '${ESP32_DEVICES[0]:-/dev/null}' ]; then
        ${SCRIPT_DIR}/serial-ws-bridge.sh '${LINK_24:-${ESP32_DEVICES[0]:-/dev/atlasrf/wifi24}}' ${WS_PORT_24} &
        echo \"  Tier 1 — 2.4 GHz bridge on port ${WS_PORT_24} (PID \$!)\"
    fi
    if [ -e '${LINK_5G}' ] || [ -e '${ESP32_DEVICES[1]:-/dev/null}' ]; then
        ${SCRIPT_DIR}/serial-ws-bridge.sh '${LINK_5G:-${ESP32_DEVICES[1]:-/dev/atlasrf/wifi5g}}' ${WS_PORT_5G} &
        echo \"  Tier 1 — 5 GHz bridge on port ${WS_PORT_5G} (PID \$!)\"
    fi
    if command -v termux-wifi-scaninfo &>/dev/null; then
        ${SCRIPT_DIR}/wifi-scan-bridge.sh ${WS_PORT_SCAN} &
        echo \"  Tier 0 — WiFi scan bridge on port ${WS_PORT_SCAN} (PID \$!)\"
    fi
    echo 'Done. Open GridDown WiFi Sentinel panel to connect.'
}

# Stop all bridges
ws-stop-all() {
    echo 'Stopping WiFi Sentinel bridges...'
    pkill -f 'serial-ws-bridge\\.sh' 2>/dev/null && echo '  Stopped serial bridges' || echo '  No serial bridges running'
    pkill -f 'wifi-scan-bridge\\.sh' 2>/dev/null && echo '  Stopped WiFi scan bridge' || echo '  No WiFi scan bridge running'
    pkill -f 'websocat.*876[567]' 2>/dev/null && echo '  Stopped websocat processes' || true
}

# Show bridge status
ws-status() {
    echo 'WiFi Sentinel Bridge Status:'
    echo ''
    for port in ${WS_PORT_24} ${WS_PORT_5G} ${WS_PORT_SCAN}; do
        pid=\$(lsof -ti :\"$port\" 2>/dev/null || ss -tlnp 2>/dev/null | grep \":\${port} \" | grep -oP 'pid=\\K[0-9]+' || echo '')
        case \$port in
            ${WS_PORT_24}) label='Tier 1 — 2.4 GHz' ;;
            ${WS_PORT_5G}) label='Tier 1 — 5 GHz  ' ;;
            ${WS_PORT_SCAN}) label='Tier 0 — WiFi Scan' ;;
        esac
        if [ -n \"\$pid\" ]; then
            echo -e \"  ● \$label  port \$port  ${GREEN}running${NC} (PID \$pid)\"
        else
            echo -e \"  ○ \$label  port \$port  ${DIM}stopped${NC}\"
        fi
    done
    echo ''
    # Show ESP32 devices
    echo '  USB Devices:'
    ls -la /dev/atlasrf/* 2>/dev/null || ls -la /dev/ttyACM* 2>/dev/null || echo '    (none detected)'
}
# End WiFi Sentinel aliases"

# Check if aliases already installed
if grep -qF "$MARKER" "$BASHRC" 2>/dev/null; then
    echo -e "  ${YELLOW}⟳${NC} WiFi Sentinel aliases already in ~/.bashrc — updating..."
    # Remove old block between markers
    sed -i "/$MARKER/,/# End WiFi Sentinel aliases/d" "$BASHRC"
fi

echo "$ALIAS_BLOCK" >> "$BASHRC"
echo -e "  ${GREEN}✓${NC} Shell aliases installed"
echo ""
echo "  Available commands:"
echo -e "    ${BOLD}ws-start-all${NC}     Start all WiFi Sentinel bridges (background)"
echo -e "    ${BOLD}ws-stop-all${NC}      Stop all bridges"
echo -e "    ${BOLD}ws-status${NC}        Show bridge status and ports"
echo -e "    ${BOLD}ws-start-24${NC}      Start 2.4 GHz ESP32 bridge only"
echo -e "    ${BOLD}ws-start-5g${NC}      Start 5 GHz ESP32 bridge only"
echo -e "    ${BOLD}ws-start-scan${NC}    Start Termux WiFi scan bridge only"
echo ""

# ── Autostart integration ────────────────────────────────────────
if [ "$IS_TERMUX" = "1" ]; then
    BOOT_DIR="$HOME/.termux/boot"
    BOOT_SCRIPT="$BOOT_DIR/start-griddown.sh"

    if [ -f "$BOOT_SCRIPT" ]; then
        # Check if WiFi Sentinel bridges are already in the boot script
        if grep -q "serial-ws-bridge" "$BOOT_SCRIPT"; then
            echo -e "  ${GREEN}✓${NC} WiFi Sentinel bridges already in boot script"
        else
            echo -e "  ${YELLOW}○${NC} Boot script exists but doesn't include WiFi Sentinel bridges"
            echo -n "  Add WiFi Sentinel bridges to boot script? [Y/n] "
            read -r answer
            if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
                # Insert before the log line (or at end if no log line)
                BRIDGE_BLOCK="
# WiFi Sentinel bridges (added by wifi-sentinel-setup.sh)
if [ -e /dev/atlasrf/wifi24 ] && command -v websocat &>/dev/null; then
    \"$GRIDDOWN_DIR/scripts/serial-ws-bridge.sh\" /dev/atlasrf/wifi24 ${WS_PORT_24} &
fi
if [ -e /dev/atlasrf/wifi5g ] && command -v websocat &>/dev/null; then
    \"$GRIDDOWN_DIR/scripts/serial-ws-bridge.sh\" /dev/atlasrf/wifi5g ${WS_PORT_5G} &
fi
if command -v termux-wifi-scaninfo &>/dev/null && command -v websocat &>/dev/null; then
    \"$GRIDDOWN_DIR/scripts/wifi-scan-bridge.sh\" ${WS_PORT_SCAN} &
fi"

                if grep -q "^echo.*griddown-boot.log" "$BOOT_SCRIPT"; then
                    # Insert before the log line
                    sed -i "/^echo.*griddown-boot.log/i\\${BRIDGE_BLOCK}" "$BOOT_SCRIPT"
                else
                    # Append to end
                    echo "$BRIDGE_BLOCK" >> "$BOOT_SCRIPT"
                fi
                echo -e "  ${GREEN}✓${NC} WiFi Sentinel bridges added to boot script"
            else
                echo "    Skipped."
            fi
        fi
    else
        echo -e "  ${YELLOW}○${NC} No boot script found — run ${BOLD}bash scripts/termux-setup.sh${NC} first"
        echo -e "    ${DIM}The main Termux setup creates the boot script with WiFi Sentinel support.${NC}"
    fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo ""

# Tier status
if [ "$TIER1_READY" = "1" ]; then
    echo -e "  ${GREEN}●${NC} Tier 1 (ESP32-C5) — ${GREEN}${BOLD}Ready${NC}"
    echo -e "    ${DIM}${#ESP32_DEVICES[@]} unit(s): full 802.11 frame capture, all 7 detection types${NC}"
else
    echo -e "  ${DIM}○${NC} Tier 1 (ESP32-C5) — ${DIM}Not available${NC}"
    echo -e "    ${DIM}Connect ESP32-C5 via USB-C OTG and re-run this script${NC}"
fi

if [ "$TIER0_READY" = "1" ]; then
    echo -e "  ${GREEN}●${NC} Tier 0 (Termux WiFi) — ${GREEN}${BOLD}Ready${NC}"
    echo -e "    ${DIM}Beacon-only detection, ~30s scan interval, no hardware needed${NC}"
elif [ "$IS_TERMUX" = "1" ]; then
    echo -e "  ${YELLOW}○${NC} Tier 0 (Termux WiFi) — ${YELLOW}Needs setup${NC}"
    echo -e "    ${DIM}Install: pkg install termux-api websocat${NC}"
else
    echo -e "  ${DIM}○${NC} Tier 0 (Termux WiFi) — ${DIM}Requires Termux on Android${NC}"
fi

echo ""

# Manufacturer coverage
echo -e "  Detection Signatures: ${BOLD}9 manufacturers${NC}"
echo -e "    ${DIM}DJI • Parrot • Skydio • Autel • Yuneec • Hubsan • FIMI • Ryze/Tello • SkyViper${NC}"
echo ""

# Error/warning summary
if [ "$ERRORS" -gt 0 ]; then
    echo -e "  ${RED}${BOLD}$ERRORS error(s)${NC} — see above for details"
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "  ${YELLOW}${BOLD}Setup complete with $WARNINGS warning(s)${NC}"
else
    echo -e "  ${GREEN}${BOLD}Setup complete!${NC}"
fi

echo ""

# Next steps
echo -e "${BOLD}  Next Steps${NC}"
echo ""
echo "  1. Activate aliases in this session:"
echo -e "     ${BOLD}source ~/.bashrc${NC}"
echo ""
echo "  2. Start bridges:"
echo -e "     ${BOLD}ws-start-all${NC}"
echo ""
echo "  3. Open GridDown and go to WiFi Sentinel panel:"
if [ "$TIER0_READY" = "1" ]; then
echo -e "     Enable ${BOLD}Termux WiFi Scan${NC} toggle → should show '${GREEN}Active${NC}'"
fi
if [ "$TIER1_READY" = "1" ]; then
echo -e "     Tap ${BOLD}Termux Bridge${NC} → should connect to ESP32(s)"
fi
echo ""
echo -e "  4. Verify detection:"
echo -e "     ${BOLD}ws-status${NC}     (check bridge processes)"
echo ""
