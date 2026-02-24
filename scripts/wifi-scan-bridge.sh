#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# wifi-scan-bridge.sh — WiFi Sentinel Tier 0 Bridge
#
# Runs Android WiFi scans via termux-wifi-scanresults and serves results
# over a WebSocket on port 8765 for GridDown's WiFiSentinelModule.
#
# Requires:  termux-api (pkg install termux-api)
#            websocat   (pkg install websocat)
#
# Usage:
#   ./wifi-scan-bridge.sh              # Start on default port 8765
#   ./wifi-scan-bridge.sh 9000         # Start on custom port
#
# The bridge listens for {"command":"scan"} messages and responds with
# the full termux-wifi-scanresults JSON array.
#
# Copyright 2025-2026 BlackAtlas LLC
# SPDX-License-Identifier: Proprietary
# =============================================================================

set -euo pipefail

PORT="${1:-8765}"

# Check dependencies
for cmd in termux-wifi-scanresults websocat; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: $cmd not found. Install with:"
        echo "  pkg install termux-api    # for termux-wifi-scanresults"
        echo "  pkg install websocat      # for WebSocket server"
        exit 1
    fi
done

echo "WiFi Sentinel Tier 0 Bridge"
echo "  Listening on ws://localhost:${PORT}"
echo "  Send {\"command\":\"scan\"} to trigger a WiFi scan"
echo "  Press Ctrl+C to stop"
echo ""

# Handler script for each WebSocket connection
handle_client() {
    while IFS= read -r line; do
        # Check if client is requesting a scan
        if echo "$line" | grep -q '"scan"'; then
            # Run WiFi scan and send results
            results=$(termux-wifi-scanresults 2>/dev/null || echo '[]')
            echo "$results"
        fi
    done
}

export -f handle_client

# Start WebSocket server
# --binary-only prevents line-buffering issues
websocat -s "$PORT" --text sh-c:'handle_client'
