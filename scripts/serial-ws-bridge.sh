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

set -euo pipefail

SERIAL_PORT="${1:?Usage: $0 <serial_port> [ws_port]}"
WS_PORT="${2:-8766}"
BAUD=115200

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
echo "  Press Ctrl+C to stop"
echo ""

# Start: read serial → broadcast via WebSocket
# websocat in server mode, piping serial input to all connected clients
cat "$SERIAL_PORT" | websocat -s "$WS_PORT" --text
