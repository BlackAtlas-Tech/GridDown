#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# serial-ws-bridge.sh — WiFi Sentinel Tier 1 Serial-to-WebSocket Bridge
#
# Reads JSONL from an ESP32-C5 serial port (via USB) and forwards each line
# over a WebSocket for GridDown's WiFiSentinelModule.
#
# Requires:  websocat   (pkg install websocat)
#
# Usage:
#   ./serial-ws-bridge.sh /dev/atlasrf/wifi24 8766   # Unit 1 on port 8766
#   ./serial-ws-bridge.sh /dev/atlasrf/wifi5g 8767   # Unit 2 on port 8767
#
# If udev symlinks aren't set up, use the raw device path:
#   ./serial-ws-bridge.sh /dev/ttyACM0 8766
#
# GridDown connects to ws://localhost:8766 and ws://localhost:8767
# to receive real-time JSONL from both ESP32 units.
#
# Copyright 2025-2026 BlackAtlas LLC
# SPDX-License-Identifier: Proprietary
# =============================================================================

set -u

SERIAL_PORT="${1:?Usage: $0 <serial_port> [ws_port]}"
WS_PORT="${2:-8766}"
BAUD=115200

# Ensure Termux bin is in PATH
TERMUX_PREFIX="/data/data/com.termux/files/usr"
if [ -d "$TERMUX_PREFIX/bin" ]; then
    export PATH="$TERMUX_PREFIX/bin:$PATH"
fi

# Check dependencies
if ! command -v websocat &>/dev/null; then
    echo "ERROR: websocat not found. Install with: pkg install websocat"
    exit 1
fi

# Check serial port
if [ ! -e "$SERIAL_PORT" ]; then
    echo "ERROR: Serial port $SERIAL_PORT not found"
    echo ""
    echo "Available ports:"
    ls -la /dev/ttyACM* /dev/atlasrf/* 2>/dev/null || echo "  (none found)"
    exit 1
fi

# Configure serial port
stty -F "$SERIAL_PORT" "$BAUD" cs8 -cstopb -parenb raw -echo 2>/dev/null || {
    echo "WARNING: Could not configure $SERIAL_PORT — may already be in use"
}

echo "WiFi Sentinel Tier 1 Serial Bridge"
echo "  Serial: $SERIAL_PORT @ ${BAUD} baud"
echo "  WebSocket: ws://localhost:${WS_PORT}"
echo "  Auto-restarts on client disconnect"
echo "  Press Ctrl+C to stop"
echo ""

CONNECTIONS=0

# Main loop: restart websocat when client disconnects
while true; do
    CONNECTIONS=$((CONNECTIONS + 1))
    echo "[$(date '+%H:%M:%S')] Waiting for connection #${CONNECTIONS} on port ${WS_PORT}..."

    # Verify serial port still exists before each connection attempt
    if [ ! -e "$SERIAL_PORT" ]; then
        echo "[$(date '+%H:%M:%S')] Serial port $SERIAL_PORT disappeared — waiting for reconnection..."
        sleep 3
        continue
    fi

    # Read serial → broadcast via WebSocket
    # websocat -s is single-connection; loop handles reconnects
    cat "$SERIAL_PORT" 2>/dev/null | websocat -s "$WS_PORT" --text 2>/dev/null || true

    echo "[$(date '+%H:%M:%S')] Client disconnected. Restarting in 2s..."
    sleep 2
done
