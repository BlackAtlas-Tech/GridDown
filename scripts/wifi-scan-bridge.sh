#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# wifi-scan-bridge.sh — WiFi Sentinel Tier 0 Bridge
#
# Runs Android WiFi scans via termux-wifi-scaninfo and serves results
# over a WebSocket on port 8765 for GridDown's WiFiSentinelModule.
#
# Requires:  termux-api (pkg install termux-api) + Termux:API companion app
#            websocat   (pkg install websocat)
#
# Usage:
#   ./wifi-scan-bridge.sh              # Start on default port 8765
#   ./wifi-scan-bridge.sh 9000         # Start on custom port
#
# The bridge listens for {"command":"scan"} messages and responds with
# the full termux-wifi-scaninfo JSON array.
#
# Auto-restarts when a client disconnects — no manual intervention needed.
#
# Copyright 2025-2026 BlackAtlas LLC
# SPDX-License-Identifier: Proprietary
# =============================================================================

set -uo pipefail

PORT="${1:-8765}"
CONNECTIONS=0

# Ensure Termux bin is in PATH
TERMUX_PREFIX="/data/data/com.termux/files/usr"
if [ -d "$TERMUX_PREFIX/bin" ]; then
    export PATH="$TERMUX_PREFIX/bin:$PATH"
fi

# Check dependencies
missing=0

if ! command -v websocat &>/dev/null && [ ! -f "$TERMUX_PREFIX/bin/websocat" ]; then
    echo "ERROR: websocat not found."
    echo "  Fix: pkg install websocat"
    echo ""
    missing=1
fi

if ! command -v termux-wifi-scaninfo &>/dev/null && [ ! -f "$TERMUX_PREFIX/bin/termux-wifi-scaninfo" ]; then
    echo "ERROR: termux-wifi-scaninfo not found."
    echo ""
    echo "  WiFi Sentinel Tier 0 requires TWO separate things both named 'termux-api':"
    echo ""
    echo "  ┌─────────────────────────────────────────────────────────────────┐"
    echo "  │  STEP 1: Install the CLI package (run this inside Termux):     │"
    echo "  │                                                                 │"
    echo "  │    pkg update && pkg install -y termux-api                      │"
    echo "  │                                                                 │"
    echo "  │  This installs the termux-wifi-scaninfo command.             │"
    echo "  │                                                                 │"
    echo "  │  STEP 2: Install the Termux:API Android app (APK):             │"
    echo "  │                                                                 │"
    echo "  │    Download from: github.com/termux/termux-api/releases         │"
    echo "  │    Install the .apk file on your device.                        │"
    echo "  │                                                                 │"
    echo "  │  Both steps are required. The APK alone does NOT install the    │"
    echo "  │  command-line tools. The CLI package alone does NOT work        │"
    echo "  │  without the companion APK.                                     │"
    echo "  └─────────────────────────────────────────────────────────────────┘"
    echo ""

    # Diagnostic: check if pkg thinks it's installed but binary is missing
    if dpkg -s termux-api 2>/dev/null | grep -q 'Status:.*installed'; then
        echo "  NOTE: dpkg reports termux-api is installed, but the command is missing."
        echo "  Try reinstalling:"
        echo "    pkg reinstall termux-api"
        echo ""
        echo "  Installed files from termux-api package:"
        dpkg -L termux-api 2>/dev/null | grep bin/ | head -5
        echo "  ..."
    fi

    # Check if the companion APK is installed
    if command -v pm &>/dev/null; then
        if pm list packages 2>/dev/null | grep -q 'com.termux.api'; then
            echo "  ✓ Termux:API Android app is installed."
        else
            echo "  ✗ Termux:API Android app is NOT installed."
            echo "    Download from: github.com/termux/termux-api/releases"
        fi
    fi
    echo ""
    missing=1
fi

if [ "$missing" -eq 1 ]; then
    exit 1
fi

# Write the handler as a temp script (avoids bash-specific 'export -f' issues
# when websocat's sh-c: prefix spawns /bin/sh instead of bash)
HANDLER_SCRIPT=$(mktemp "${TMPDIR:-/tmp}/wifi-scan-handler.XXXXXX")
cat > "$HANDLER_SCRIPT" << 'HANDLER'
#!/data/data/com.termux/files/usr/bin/bash
while IFS= read -r line; do
    if echo "$line" | grep -q '"scan"'; then
        results=$(termux-wifi-scaninfo 2>/dev/null || echo '[]')
        echo "$results"
    fi
done
HANDLER
chmod +x "$HANDLER_SCRIPT"

# Cleanup handler script on exit
cleanup() {
    rm -f "$HANDLER_SCRIPT"
    echo ""
    echo "WiFi scan bridge stopped."
}
trap cleanup EXIT

echo "WiFi Sentinel Tier 0 Bridge"
echo "  Listening on ws://localhost:${PORT}"
echo "  Send {\"command\":\"scan\"} to trigger a WiFi scan"
echo "  Auto-restarts on client disconnect"
echo "  Press Ctrl+C to stop"
echo ""

# Main loop: restart websocat when client disconnects
while true; do
    CONNECTIONS=$((CONNECTIONS + 1))
    echo "[$(date '+%H:%M:%S')] Waiting for connection #${CONNECTIONS} on port ${PORT}..."

    # Use exec: to run the handler script directly (portable, no export -f needed)
    websocat -s "$PORT" --text "exec:$HANDLER_SCRIPT" 2>/dev/null

    echo "[$(date '+%H:%M:%S')] Client disconnected. Restarting in 1s..."
    sleep 1
done
