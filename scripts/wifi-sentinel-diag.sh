#!/data/data/com.termux/files/usr/bin/bash
# ══════════════════════════════════════════════════════════════════
# wifi-sentinel-diag.sh — Tier 0 Pipeline Diagnostic
#
# Run from anywhere:
#   bash scripts/wifi-sentinel-diag.sh          (from GridDown root)
#   bash ~/GridDown/scripts/wifi-sentinel-diag.sh (from anywhere)
#   cd scripts && bash wifi-sentinel-diag.sh     (from scripts dir)
#
# Tests every link in the Tier 0 chain:
#   1. Android Location Services enabled
#   2. Termux:API app installed + permissions
#   3. termux-wifi-scaninfo returns real data
#   4. wifi-scan-bridge.sh process running
#   5. WebSocket on port 8765 reachable
#   6. GridDown code has correct termuxWsHost default
#   7. End-to-end pipeline summary
#
# Copyright 2025-2026 BlackAtlas LLC
# ══════════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN + 1)); }

# ── Resolve GridDown directory robustly ─────────────────────────
# Strategy: try multiple methods, verify by checking for sw.js
resolve_griddown_dir() {
    local candidate=""

    # Method 1: GRIDDOWN_DIR environment variable (set by griddown-aliases.sh)
    if [ -n "${GRIDDOWN_DIR:-}" ] && [ -f "$GRIDDOWN_DIR/sw.js" ]; then
        echo "$GRIDDOWN_DIR"
        return 0
    fi

    # Method 2: Relative to this script's location via BASH_SOURCE
    if [ -n "${BASH_SOURCE[0]:-}" ]; then
        candidate="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)"
        if [ -n "$candidate" ] && [ -f "$candidate/sw.js" ]; then
            echo "$candidate"
            return 0
        fi
    fi

    # Method 3: Relative to $0 (works for most invocations)
    if [ -n "${0:-}" ] && [ "$0" != "bash" ] && [ "$0" != "-bash" ] && [ "$0" != "sh" ]; then
        candidate="$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)"
        if [ -n "$candidate" ] && [ -f "$candidate/sw.js" ]; then
            echo "$candidate"
            return 0
        fi
    fi

    # Method 4: Common install locations
    for dir in "$HOME/GridDown" "$HOME/griddown" "$HOME/GridDown-main"; do
        if [ -f "$dir/sw.js" ]; then
            echo "$dir"
            return 0
        fi
    done

    # Method 5: Current working directory or parent
    if [ -f "./sw.js" ]; then
        pwd
        return 0
    fi
    if [ -f "../sw.js" ]; then
        (cd .. && pwd)
        return 0
    fi

    echo ""
    return 1
}

GD_DIR="$(resolve_griddown_dir)"

echo ""
echo -e "${BOLD}WiFi Sentinel Tier 0 — Pipeline Diagnostic${NC}"
echo -e "${DIM}$(date)${NC}"
if [ -n "$GD_DIR" ]; then
    echo -e "${DIM}GridDown: $GD_DIR${NC}"
else
    echo -e "${YELLOW}GridDown directory not found — some tests will be skipped${NC}"
fi
echo ""

# ── Termux-safe process detection ───────────────────────────────
# Android Termux does NOT have GNU ps (no 'ps aux').
# Scan /proc for maximum portability across all Android versions.
find_procs() {
    local pattern="$1"
    local found=""

    # Primary: scan /proc (works on ALL Android/Linux without special tools)
    for pid_dir in /proc/[0-9]*; do
        [ -r "$pid_dir/cmdline" ] || continue
        local cmdline
        cmdline=$(tr '\0' ' ' < "$pid_dir/cmdline" 2>/dev/null) || continue
        if echo "$cmdline" | grep -q "$pattern"; then
            # Skip our own grep/diagnostic process
            local pid="${pid_dir##*/}"
            [ "$pid" = "$$" ] && continue
            echo "$cmdline" | grep -q "wifi-sentinel-diag" && continue
            found="${found}${pid} ${cmdline}\n"
        fi
    done

    if [ -n "$found" ]; then
        echo -e "$found"
        return 0
    fi
    return 1
}

# ── Termux-safe Android app detection ───────────────────────────
# pm list packages can fail on Android 11+ without QUERY_ALL_PACKAGES.
# Use multiple fallbacks including functional testing.
check_android_app() {
    local pkg="$1"

    # Method 1: pm list packages
    if pm list packages "$pkg" 2>/dev/null | grep -q "$pkg"; then
        return 0
    fi

    # Method 2: pm path (sometimes works when list doesn't)
    if pm path "$pkg" 2>/dev/null | grep -q "package:"; then
        return 0
    fi

    # Method 3: dumpsys package
    if dumpsys package "$pkg" 2>/dev/null | grep -q "versionName"; then
        return 0
    fi

    # Method 4: cmd package (Android 7+)
    if cmd package list packages 2>/dev/null | grep -q "$pkg"; then
        return 0
    fi

    # Method 5: For Termux:API specifically — if the scan command works, the app is there
    if [ "$pkg" = "com.termux.api" ] && command -v termux-wifi-scaninfo &>/dev/null; then
        local test_out
        test_out=$(timeout 8 termux-wifi-scaninfo 2>&1 || echo "")
        if echo "$test_out" | grep -q '^\['; then
            return 0
        fi
    fi

    return 1
}

# State tracking for end-to-end summary
LOCATION_OK=0
API_INSTALLED=0
SCAN_CMD=""
SCAN_WORKS=0
BRIDGE_RUNNING=0
WS_OK=0

# ═════════════════════════════════════════════════════════════════
# TEST 1: Android Location Services
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}[1/7] Android Location Services${NC}"

LOCATION_MODE=$(settings get secure location_mode 2>/dev/null || echo "unknown")
if [ "$LOCATION_MODE" = "unknown" ]; then
    # Fallback: check location_providers_allowed
    LOCATION_PROVIDERS=$(settings get secure location_providers_allowed 2>/dev/null || echo "unknown")
    if [ "$LOCATION_PROVIDERS" = "unknown" ]; then
        warn "Cannot check location mode (settings command unavailable)"
        echo -e "    ${DIM}Manually verify: Android Settings > Location > ON${NC}"
    elif [ -z "$LOCATION_PROVIDERS" ]; then
        fail "Location services appear OFF (no providers enabled)"
        echo -e "    ${RED}${BOLD}FIX: Android Settings > Location > turn ON${NC}"
    else
        pass "Location providers enabled: $LOCATION_PROVIDERS"
        LOCATION_OK=1
    fi
elif [ "$LOCATION_MODE" = "0" ]; then
    fail "Location services are OFF (mode=0)"
    echo -e "    ${RED}${BOLD}FIX: Android Settings > Location > turn ON${NC}"
    echo -e "    ${DIM}Android requires location ON for ANY app to perform WiFi scans${NC}"
else
    pass "Location services enabled (mode=$LOCATION_MODE)"
    LOCATION_OK=1
fi
echo ""

# ═════════════════════════════════════════════════════════════════
# TEST 2: Termux:API App
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}[2/7] Termux:API Companion App${NC}"

if check_android_app "com.termux.api"; then
    API_INSTALLED=1
    pass "Termux:API app detected"

    # Try to check location permission
    PERM_DUMP=$(dumpsys package com.termux.api 2>/dev/null || echo "")
    if [ -n "$PERM_DUMP" ]; then
        if echo "$PERM_DUMP" | grep -q "ACCESS_FINE_LOCATION.*granted=true"; then
            pass "Termux:API has fine location permission"
        elif echo "$PERM_DUMP" | grep -q "ACCESS_FINE_LOCATION"; then
            fail "Termux:API location permission NOT granted"
            echo -e "    ${RED}${BOLD}FIX: Settings > Apps > Termux:API > Permissions > Location > Allow${NC}"
        else
            warn "Cannot verify permissions via dumpsys — will test functionally in step 3"
        fi
    else
        warn "Cannot read package permissions — will test functionally in step 3"
    fi
else
    # Double-check with functional test before declaring failure
    if command -v termux-wifi-scaninfo &>/dev/null; then
        QUICK_TEST=$(timeout 8 termux-wifi-scaninfo 2>&1 || echo "")
        if echo "$QUICK_TEST" | grep -q '^\['; then
            API_INSTALLED=1
            pass "Termux:API app working (scan returns data)"
            echo -e "    ${DIM}Note: pm couldn't detect it but the app is functional${NC}"
        else
            fail "Termux:API app NOT detected and scan failed"
            echo -e "    ${RED}${BOLD}FIX: Install APK from github.com/termux/termux-api/releases${NC}"
            echo -e "    ${DIM}This is a separate APK, not the same as 'pkg install termux-api'${NC}"
        fi
    else
        fail "Termux:API app NOT detected"
        echo -e "    ${RED}${BOLD}FIX: Install APK from github.com/termux/termux-api/releases${NC}"
        echo -e "    ${DIM}Also run: pkg install termux-api (for the CLI tools)${NC}"
    fi
fi
echo ""

# ═════════════════════════════════════════════════════════════════
# TEST 3: WiFi Scan Command
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}[3/7] WiFi Scan Command${NC}"

TERMUX_PREFIX="/data/data/com.termux/files/usr"
if command -v termux-wifi-scaninfo &>/dev/null; then
    SCAN_CMD="termux-wifi-scaninfo"
    pass "termux-wifi-scaninfo found in PATH"
elif [ -f "$TERMUX_PREFIX/bin/termux-wifi-scaninfo" ]; then
    SCAN_CMD="$TERMUX_PREFIX/bin/termux-wifi-scaninfo"
    pass "termux-wifi-scaninfo found at $SCAN_CMD"
else
    fail "termux-wifi-scaninfo NOT found"
    echo -e "    ${RED}${BOLD}FIX: pkg install termux-api${NC}"
fi

if [ -n "$SCAN_CMD" ]; then
    echo -e "  Running scan (may take a few seconds)..."
    SCAN_RAW=$(timeout 15 $SCAN_CMD 2>&1 || echo "TIMEOUT")

    if [ "$SCAN_RAW" = "TIMEOUT" ]; then
        fail "termux-wifi-scaninfo timed out (15s)"
        echo -e "    ${DIM}Termux:API app may be frozen — force-stop it in Android settings${NC}"
    elif echo "$SCAN_RAW" | grep -qi "error\|permission\|denied\|exception"; then
        fail "Scan returned error"
        echo -e "    ${RED}${SCAN_RAW:0:300}${NC}"
    elif [ "$SCAN_RAW" = "[]" ] || [ -z "$SCAN_RAW" ]; then
        warn "Scan returned empty results ([])"
        echo -e "    ${DIM}WiFi disabled, location OFF, or no APs in range${NC}"
        SCAN_WORKS=1
    elif echo "$SCAN_RAW" | grep -q '"bssid"'; then
        AP_COUNT=$(echo "$SCAN_RAW" | grep -c '"bssid"')
        pass "Scan returned $AP_COUNT access points"
        SCAN_WORKS=1

        # Drone signature check
        echo ""
        echo -e "  ${BOLD}Drone Signature Scan:${NC}"
        DRONE_FOUND=0
        for pattern in Skydio DJI TELLO Parrot Autel Yuneec FIMI SkyViper; do
            if echo "$SCAN_RAW" | grep -qi "$pattern"; then
                DRONE_FOUND=1
                echo -e "    ${GREEN}🎯 Found: $pattern${NC}"
                echo "$SCAN_RAW" | grep -i "$pattern" | head -3 | while IFS= read -r line; do
                    SSID=$(echo "$line" | sed -n 's/.*"ssid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
                    BSSID=$(echo "$line" | sed -n 's/.*"bssid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
                    RSSI=$(echo "$line" | sed -n 's/.*"rssi"[[:space:]]*:[[:space:]]*\(-\{0,1\}[0-9]*\).*/\1/p')
                    [ -n "$SSID" ] && echo -e "      ${DIM}SSID: $SSID  BSSID: $BSSID  RSSI: ${RSSI}dBm${NC}"
                done
            fi
        done
        # OUI check for Skydio (38:1D:14)
        if echo "$SCAN_RAW" | grep -qi "38:1d:14"; then
            [ "$DRONE_FOUND" = "0" ] && echo -e "    ${GREEN}🎯 Found: Skydio OUI (38:1D:14)${NC}"
            DRONE_FOUND=1
        fi
        [ "$DRONE_FOUND" = "0" ] && warn "No known drone signatures in scan results"
    else
        warn "Unexpected scan output format"
        echo -e "    ${DIM}${SCAN_RAW:0:200}${NC}"
    fi
fi
echo ""

# ═════════════════════════════════════════════════════════════════
# TEST 4: Bridge Process
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}[4/7] WiFi Scan Bridge Process${NC}"

BRIDGE_PROCS=$(find_procs "wifi-scan-bridge" 2>/dev/null || echo "")
if [ -n "$BRIDGE_PROCS" ]; then
    pass "wifi-scan-bridge.sh is running"
    echo -e "    ${DIM}$(echo -e "$BRIDGE_PROCS" | head -1)${NC}"
    BRIDGE_RUNNING=1
else
    fail "wifi-scan-bridge.sh is NOT running"
    echo -e "    ${RED}${BOLD}FIX: Run gd-start (auto-starts bridge) or manually:${NC}"
    echo -e "    ${BOLD}    ./scripts/wifi-scan-bridge.sh &${NC}"
fi

# Check websocat on port 8765 via /proc/net/tcp (most portable)
PORT_8765_LISTENING=0
# Port 8765 in hex = 0x223D
if [ -r /proc/net/tcp ]; then
    if grep -qi ":223D " /proc/net/tcp 2>/dev/null; then
        PORT_8765_LISTENING=1
    fi
fi
# Also check /proc/net/tcp6
if [ "$PORT_8765_LISTENING" = "0" ] && [ -r /proc/net/tcp6 ]; then
    if grep -qi ":223D " /proc/net/tcp6 2>/dev/null; then
        PORT_8765_LISTENING=1
    fi
fi

if [ "$PORT_8765_LISTENING" = "1" ]; then
    pass "Port 8765 is listening"
elif [ "$BRIDGE_RUNNING" = "1" ]; then
    warn "Bridge process found but port 8765 not yet listening (starting up?)"
else
    fail "Nothing listening on port 8765"
fi
echo ""

# ═════════════════════════════════════════════════════════════════
# TEST 5: WebSocket Connectivity
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}[5/7] WebSocket Connectivity Test${NC}"

if ! command -v websocat &>/dev/null; then
    fail "websocat not installed"
    echo -e "    ${RED}${BOLD}FIX: pkg install websocat${NC}"
elif [ "$PORT_8765_LISTENING" = "0" ]; then
    warn "Skipping WebSocket test — nothing listening on port 8765 (fix test 4 first)"
else
    echo -e "  Sending test scan request to ws://127.0.0.1:8765..."

    WS_RESPONSE=$(echo '{"command":"scan"}' | timeout 15 websocat -1 ws://127.0.0.1:8765 2>&1 || echo "WS_FAIL")

    if [ "$WS_RESPONSE" = "WS_FAIL" ] || [ -z "$WS_RESPONSE" ]; then
        fail "WebSocket connection failed or timed out"
        echo -e "    ${DIM}Port is listening but WebSocket handshake failed${NC}"
    elif echo "$WS_RESPONSE" | grep -q '"bssid"'; then
        WS_AP_COUNT=$(echo "$WS_RESPONSE" | grep -o '"bssid"' | wc -l)
        pass "WebSocket returned scan data ($WS_AP_COUNT APs)"
        WS_OK=1
        if echo "$WS_RESPONSE" | grep -qi "skydio\|38:1d:14"; then
            pass "Skydio visible in WebSocket scan results!"
        else
            warn "Skydio NOT in WebSocket results (not powered on?)"
        fi
    elif [ "$WS_RESPONSE" = "[]" ]; then
        warn "WebSocket returned empty scan ([])"
        echo -e "    ${DIM}Bridge works but no APs returned — check location (tests 1 & 2)${NC}"
        WS_OK=1
    else
        warn "WebSocket returned unexpected data"
        echo -e "    ${DIM}${WS_RESPONSE:0:200}${NC}"
    fi
fi
echo ""

# ═════════════════════════════════════════════════════════════════
# TEST 6: GridDown Configuration
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}[6/7] GridDown Configuration Check${NC}"

if [ -z "$GD_DIR" ]; then
    warn "GridDown directory not found — cannot check configuration"
    echo -e "    ${DIM}Run from GridDown dir or set GRIDDOWN_DIR env var${NC}"
else
    WS_FILE="$GD_DIR/js/modules/wifiSentinel.js"
    if [ -f "$WS_FILE" ]; then
        HOST_DEFAULT=$(grep "termuxWsHost:" "$WS_FILE" | head -1)
        if echo "$HOST_DEFAULT" | grep -q "'localhost'"; then
            pass "wifiSentinel.js defaults to localhost"
        elif echo "$HOST_DEFAULT" | grep -q "window.location.hostname"; then
            fail "wifiSentinel.js defaults to window.location.hostname (BUG)"
            echo -e "    ${RED}${BOLD}FIX: Deploy latest GridDown build${NC}"
        else
            warn "Unexpected termuxWsHost default: $HOST_DEFAULT"
        fi
    else
        warn "Cannot find wifiSentinel.js at $WS_FILE"
        echo -e "    ${DIM}GridDown dir: $GD_DIR${NC}"
    fi

    # Check sw.js cache version
    if [ -f "$GD_DIR/sw.js" ]; then
        SW_VER=$(grep "CACHE_NAME" "$GD_DIR/sw.js" 2>/dev/null | head -1 | sed -n 's/.*\(v[0-9.]*\).*/\1/p')
        [ -n "$SW_VER" ] && pass "GridDown $SW_VER detected"
    fi

    # Check gd-start includes bridge launch
    ALIASES_FILE="$GD_DIR/scripts/griddown-aliases.sh"
    if [ -f "$ALIASES_FILE" ]; then
        if grep -q "wifi-scan-bridge" "$ALIASES_FILE"; then
            pass "gd-start includes WiFi Sentinel bridge auto-launch"
        else
            fail "gd-start does NOT launch WiFi Sentinel bridge"
            echo -e "    ${RED}${BOLD}FIX: Deploy GridDown v6.63.0+${NC}"
        fi
    fi
fi

# Check if GridDown HTTP server is running
GD_PROCS=$(find_procs "griddown-server" 2>/dev/null || echo "")
if [ -n "$GD_PROCS" ]; then
    pass "GridDown server running"
else
    warn "GridDown HTTP server not detected"
    echo -e "    ${DIM}Run: gd-start${NC}"
fi
echo ""

# ═════════════════════════════════════════════════════════════════
# TEST 7: End-to-End Pipeline Summary
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}[7/7] End-to-End Pipeline${NC}"
echo ""

fmt_status() {
    if [ "$1" = "1" ]; then echo -e "${GREEN}$2${NC}"
    else echo -e "${RED}$3${NC}"; fi
}

echo -e "  Android Location:       $(fmt_status "$LOCATION_OK" "ON" "OFF / unknown")"
echo -e "  Termux:API App:         $(fmt_status "$API_INSTALLED" "Installed" "Missing")"
echo -e "  WiFi Scan Command:      $([ -n "$SCAN_CMD" ] && fmt_status 1 "Available" "" || fmt_status 0 "" "Missing")"
echo -e "  Scan Returns Data:      $(fmt_status "$SCAN_WORKS" "Yes" "No")"
echo -e "  Bridge Running:         $(fmt_status "$BRIDGE_RUNNING" "Running" "Stopped")"
echo -e "  Port 8765 Listening:    $(fmt_status "$PORT_8765_LISTENING" "Yes" "No")"
echo -e "  WebSocket Working:      $(fmt_status "$WS_OK" "Yes" "No / untested")"
echo ""

# ═════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}  ${YELLOW}$WARN warnings${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "  ${RED}${BOLD}Pipeline is broken.${NC} Fix the ${RED}✗${NC} items above."
    echo ""
    echo -e "  ${BOLD}Most likely fix:${NC}"
    if [ "$BRIDGE_RUNNING" = "0" ]; then
        echo -e "  → Run ${BOLD}gd-start${NC} to start server + bridge"
    elif [ "$LOCATION_OK" = "0" ]; then
        echo -e "  → Android Settings > Location > ON"
    elif [ "$API_INSTALLED" = "0" ]; then
        echo -e "  → Install Termux:API APK from github.com/termux/termux-api/releases"
    fi
elif [ $WARN -gt 0 ]; then
    echo -e "  ${YELLOW}Pipeline partially working.${NC} Check ${YELLOW}⚠${NC} items."
else
    echo -e "  ${GREEN}${BOLD}All clear! Pipeline is healthy.${NC}"
    echo -e "  Toggle ${BOLD}Termux WiFi Scan${NC} ON in GridDown WiFi Sentinel panel."
    echo -e "  Allow ~60s (2 scans) for detections to confirm."
fi
echo ""
