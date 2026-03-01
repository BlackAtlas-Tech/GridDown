#!/data/data/com.termux/files/usr/bin/bash
# ══════════════════════════════════════════════════════════════════
# wifi-sentinel-diag.sh — Tier 0 Pipeline Diagnostic
# Run from Termux: bash scripts/wifi-sentinel-diag.sh
#
# Tests each link in the chain:
#   1. termux-wifi-scaninfo returns data
#   2. Bridge script is running on port 8765
#   3. WebSocket is reachable
#   4. Scan results contain drone signatures
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

echo ""
echo -e "${BOLD}WiFi Sentinel Tier 0 — Pipeline Diagnostic${NC}"
echo -e "${DIM}$(date)${NC}"
echo ""

# ── Test 1: Android Location Services ────────────────────────────
echo -e "${BOLD}[1/6] Android Location Services${NC}"

# Check if location is enabled via settings command
LOCATION_MODE=$(settings get secure location_mode 2>/dev/null || echo "unknown")
if [ "$LOCATION_MODE" = "unknown" ]; then
    warn "Cannot check location mode (settings command unavailable)"
    echo -e "    ${DIM}Manually verify: Android Settings → Location → ON${NC}"
elif [ "$LOCATION_MODE" = "0" ]; then
    fail "Location services are OFF (mode=0)"
    echo -e "    ${RED}${BOLD}FIX: Android Settings → Location → turn ON${NC}"
    echo -e "    ${DIM}Android requires location ON for ANY app to perform WiFi scans${NC}"
else
    pass "Location services enabled (mode=$LOCATION_MODE)"
fi
echo ""

# ── Test 2: Termux:API App ──────────────────────────────────────
echo -e "${BOLD}[2/6] Termux:API Companion App${NC}"

API_INSTALLED=0
if pm list packages 2>/dev/null | grep -q "com.termux.api"; then
    API_INSTALLED=1
    pass "Termux:API app installed (com.termux.api)"

    # Check if it has location permission
    PERM_DUMP=$(dumpsys package com.termux.api 2>/dev/null || echo "")
    if echo "$PERM_DUMP" | grep -q "android.permission.ACCESS_FINE_LOCATION.*granted=true"; then
        pass "Termux:API has fine location permission"
    elif echo "$PERM_DUMP" | grep -q "android.permission.ACCESS_FINE_LOCATION"; then
        fail "Termux:API location permission NOT granted"
        echo -e "    ${RED}${BOLD}FIX: Android Settings → Apps → Termux:API → Permissions → Location → Allow${NC}"
    else
        warn "Cannot verify Termux:API permissions (dumpsys may need root)"
        echo -e "    ${DIM}Manually check: Settings → Apps → Termux:API → Permissions → Location${NC}"
    fi
else
    fail "Termux:API app NOT installed"
    echo -e "    ${RED}${BOLD}FIX: Install from github.com/termux/termux-api/releases${NC}"
    echo -e "    ${DIM}This is a separate APK, not the same as 'pkg install termux-api'${NC}"
fi
echo ""

# ── Test 3: termux-wifi-scaninfo command ────────────────────────
echo -e "${BOLD}[3/6] WiFi Scan Command${NC}"

TERMUX_PREFIX="/data/data/com.termux/files/usr"
SCAN_CMD=""
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
    SCAN_RAW=$($SCAN_CMD 2>&1)
    SCAN_EXIT=$?

    if [ $SCAN_EXIT -ne 0 ]; then
        fail "termux-wifi-scaninfo exited with code $SCAN_EXIT"
        echo -e "    ${DIM}Output: ${SCAN_RAW:0:200}${NC}"
    elif echo "$SCAN_RAW" | grep -q "error\|Error\|ERROR\|permission\|denied"; then
        fail "Scan returned error"
        echo -e "    ${RED}Output: ${SCAN_RAW:0:300}${NC}"
        echo ""
        echo -e "    ${YELLOW}Common causes:${NC}"
        echo -e "    1. Termux:API app not installed (separate APK)"
        echo -e "    2. Location permission not granted to Termux:API"
        echo -e "    3. Location services OFF"
        echo -e "    4. Termux and Termux:API from different sources (must match)"
    elif [ "$SCAN_RAW" = "[]" ] || [ -z "$SCAN_RAW" ]; then
        warn "Scan returned empty results ([])"
        echo -e "    ${DIM}Possible causes: WiFi disabled, location OFF, or no APs in range${NC}"
        echo -e "    ${DIM}Your tablet WiFi settings may show networks but the API still needs location${NC}"
    elif echo "$SCAN_RAW" | grep -q '"bssid"'; then
        AP_COUNT=$(echo "$SCAN_RAW" | grep -c '"bssid"')
        pass "Scan returned $AP_COUNT access points"

        # Check for drone signatures
        echo ""
        echo -e "  ${BOLD}Drone Signature Scan:${NC}"
        DRONE_FOUND=0
        for pattern in "Skydio" "SKYDIO" "skydio" "DJI" "TELLO" "Parrot" "Autel" "Yuneec" "FIMI" "SkyViper"; do
            MATCHES=$(echo "$SCAN_RAW" | grep -i "\"$pattern" | head -3)
            if [ -n "$MATCHES" ]; then
                DRONE_FOUND=1
                echo -e "    ${GREEN}🎯 Found: $pattern${NC}"
                echo "$MATCHES" | while IFS= read -r line; do
                    SSID=$(echo "$line" | grep -oP '"ssid"\s*:\s*"\K[^"]+' || echo "?")
                    BSSID=$(echo "$line" | grep -oP '"bssid"\s*:\s*"\K[^"]+' || echo "?")
                    RSSI=$(echo "$line" | grep -oP '"rssi"\s*:\s*\K-?[0-9]+' || echo "?")
                    echo -e "      ${DIM}SSID: $SSID  BSSID: $BSSID  RSSI: $RSSI${NC}"
                done
            fi
        done

        # Also check OUI prefixes for Skydio (38:1D:14)
        if echo "$SCAN_RAW" | grep -qi "38:1d:14\|38:1D:14"; then
            DRONE_FOUND=1
            echo -e "    ${GREEN}🎯 Found: Skydio OUI (38:1D:14)${NC}"
        fi

        if [ $DRONE_FOUND -eq 0 ]; then
            warn "No known drone signatures in scan results"
            echo -e "    ${DIM}Is the Skydio powered on with WiFi active?${NC}"
        fi
    else
        warn "Unexpected scan output format"
        echo -e "    ${DIM}${SCAN_RAW:0:200}${NC}"
    fi
fi
echo ""

# ── Test 4: Bridge Process ──────────────────────────────────────
echo -e "${BOLD}[4/6] WiFi Scan Bridge Process${NC}"

BRIDGE_PID=""
# Check for the bridge script
BRIDGE_PROCS=$(ps aux 2>/dev/null | grep -v grep | grep "wifi-scan-bridge" || ps -ef 2>/dev/null | grep -v grep | grep "wifi-scan-bridge" || echo "")
if [ -n "$BRIDGE_PROCS" ]; then
    pass "wifi-scan-bridge.sh is running"
    echo -e "    ${DIM}$BRIDGE_PROCS${NC}"
else
    fail "wifi-scan-bridge.sh is NOT running"
    echo -e "    ${RED}${BOLD}FIX: Run in a separate Termux session:${NC}"
    echo -e "    ${BOLD}./scripts/wifi-scan-bridge.sh${NC}"
    echo -e "    ${DIM}Or: ws-start-scan (if aliases installed)${NC}"
fi

# Check for websocat on port 8765
WS_PROCS=$(ps aux 2>/dev/null | grep -v grep | grep "websocat.*8765" || ps -ef 2>/dev/null | grep -v grep | grep "websocat.*8765" || echo "")
if [ -n "$WS_PROCS" ]; then
    pass "websocat listening on port 8765"
else
    # Also check with ss/netstat
    PORT_LISTEN=$(ss -tlnp 2>/dev/null | grep ":8765 " || netstat -tlnp 2>/dev/null | grep ":8765 " || echo "")
    if [ -n "$PORT_LISTEN" ]; then
        pass "Something listening on port 8765"
        echo -e "    ${DIM}$PORT_LISTEN${NC}"
    else
        fail "Nothing listening on port 8765"
        echo -e "    ${DIM}The bridge script starts websocat which listens on this port${NC}"
    fi
fi
echo ""

# ── Test 5: WebSocket Connectivity ──────────────────────────────
echo -e "${BOLD}[5/6] WebSocket Connectivity Test${NC}"

if command -v websocat &>/dev/null; then
    # Send a scan command and check for response
    echo -e "  Sending test scan request to ws://localhost:8765..."
    WS_RESPONSE=$(echo '{"command":"scan"}' | timeout 10 websocat --one-message ws://127.0.0.1:8765 2>&1 || echo "TIMEOUT_OR_ERROR")

    if [ "$WS_RESPONSE" = "TIMEOUT_OR_ERROR" ] || [ -z "$WS_RESPONSE" ]; then
        fail "WebSocket connection failed or timed out"
        echo -e "    ${DIM}Could not connect to ws://localhost:8765${NC}"
        echo -e "    ${DIM}Is the bridge running? Check test 4 above${NC}"
    elif echo "$WS_RESPONSE" | grep -q '"bssid"'; then
        WS_AP_COUNT=$(echo "$WS_RESPONSE" | grep -o '"bssid"' | wc -l)
        pass "WebSocket returned scan data ($WS_AP_COUNT APs)"

        # Check for Skydio specifically
        if echo "$WS_RESPONSE" | grep -qi "skydio\|38:1d:14\|38:1D:14"; then
            pass "Skydio visible in WebSocket scan results!"
        else
            warn "Skydio NOT in WebSocket results (may not be powered on or in range)"
        fi
    elif echo "$WS_RESPONSE" | grep -q '^\[\]$'; then
        warn "WebSocket returned empty scan ([])"
        echo -e "    ${DIM}Bridge is reachable but scan returned no APs${NC}"
        echo -e "    ${DIM}Check location permission and location services (tests 1 & 2)${NC}"
    else
        warn "WebSocket returned unexpected data"
        echo -e "    ${DIM}${WS_RESPONSE:0:200}${NC}"
    fi
else
    warn "websocat not available — cannot test WebSocket directly"
    echo -e "    ${DIM}Install: pkg install websocat${NC}"
fi
echo ""

# ── Test 6: GridDown Connection ─────────────────────────────────
echo -e "${BOLD}[6/6] GridDown Configuration Check${NC}"

# Find the wifiSentinel.js to check the default host
SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo ".")"
GRIDDOWN_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd || echo ".")"
WS_FILE="$GRIDDOWN_DIR/js/modules/wifiSentinel.js"

if [ -f "$WS_FILE" ]; then
    HOST_DEFAULT=$(grep "termuxWsHost:" "$WS_FILE" | head -1)
    if echo "$HOST_DEFAULT" | grep -q "'localhost'"; then
        pass "wifiSentinel.js defaults to localhost"
    elif echo "$HOST_DEFAULT" | grep -q "window.location.hostname"; then
        fail "wifiSentinel.js defaults to window.location.hostname (BUG)"
        echo -e "    ${RED}${BOLD}This means GridDown tries to connect to the web server, not localhost${NC}"
        echo -e "    ${RED}${BOLD}FIX: Deploy the latest GridDown build with the termuxWsHost fix${NC}"
    else
        warn "Unexpected termuxWsHost default: $HOST_DEFAULT"
    fi
else
    warn "Cannot find wifiSentinel.js at $WS_FILE"
    echo -e "    ${DIM}Make sure you're running this from the GridDown directory${NC}"
fi

# Check if GridDown HTTP server is running
GD_SERVER=$(ps aux 2>/dev/null | grep -v grep | grep "griddown-server\|python.*http\|python.*8080\|python.*8443" || echo "")
if [ -n "$GD_SERVER" ]; then
    pass "GridDown server process detected"
    echo -e "    ${DIM}$GD_SERVER${NC}"
else
    warn "No GridDown HTTP server detected"
    echo -e "    ${DIM}If accessing via griddown.blackatlas.tech, the WebSocket must reach localhost:8765${NC}"
    echo -e "    ${DIM}This only works if GridDown code has termuxWsHost: 'localhost' (not window.location.hostname)${NC}"
fi
echo ""

# ══════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}  ${YELLOW}$WARN warnings${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "  ${RED}${BOLD}Pipeline is broken.${NC} Fix the ${RED}✗${NC} items above."
    echo ""
    echo -e "  ${BOLD}Most common post-factory-reset fixes:${NC}"
    echo -e "  1. ${BOLD}Location services OFF${NC} → Android Settings → Location → ON"
    echo -e "  2. ${BOLD}Termux:API app missing${NC} → Install APK from github.com/termux/termux-api/releases"
    echo -e "  3. ${BOLD}Location permission not granted${NC} → Settings → Apps → Termux:API → Permissions → Location → Allow"
    echo -e "  4. ${BOLD}Bridge not running${NC} → Run: ./scripts/wifi-scan-bridge.sh"
    echo -e "  5. ${BOLD}Old GridDown code${NC} → Deploy latest build with termuxWsHost localhost fix"
elif [ $WARN -gt 0 ]; then
    echo -e "  ${YELLOW}Pipeline partially working.${NC} Check ${YELLOW}⚠${NC} items above."
else
    echo -e "  ${GREEN}${BOLD}Pipeline looks healthy!${NC}"
    echo -e "  If GridDown still doesn't show drones, remember Tier 0 needs"
    echo -e "  ${BOLD}2 consecutive scans${NC} (~60s) with different RSSI to confirm a detection."
fi
echo ""
