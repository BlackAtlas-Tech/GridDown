#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# wifi-scan-bridge.sh — WiFi Sentinel Tier 0 Bridge
#
# Runs Android WiFi scans via termux-wifi-scanresults and serves results
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
# the full termux-wifi-scanresults JSON array.
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
for cmd in termux-wifi-scanresults websocat; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: $cmd not found. Install with:"
        echo "  pkg install termux-api    # for termux-wifi-scanresults"
        echo "  pkg install websocat      # for WebSocket server"
        echo ""
        echo "Note: termux-api also requires the Termux:API companion app"
        echo "      installed from the same source as Termux (GitHub or F-Droid)."
        exit 1
    fi
done

# Write the handler as a temp script (avoids bash-specific 'export -f' issues
# when websocat's sh-c: prefix spawns /bin/sh instead of bash)
HANDLER_SCRIPT=$(mktemp "${TMPDIR:-/tmp}/wifi-scan-handler.XXXXXX")
cat > "$HANDLER_SCRIPT" << 'HANDLER'
#!/data/data/com.termux/files/usr/bin/bash
while IFS= read -r line; do
    if echo "$line" | grep -q '"scan"'; then
        results=$(termux-wifi-scanresults 2>/dev/null || echo '[]')
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
