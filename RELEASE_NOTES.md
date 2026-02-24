# GridDown v6.57.81 Release Notes

## 🎯 What's New

This release adds **WiFi Sentinel**, a passive drone detection system that identifies commercial drones through WiFi fingerprinting. Combined with AtlasRF's existing RF/Remote ID detection, GridDown now offers multi-sensor drone awareness without requiring drone cooperation.

### New Module: WiFi Sentinel

WiFi Sentinel passively monitors 802.11 wireless traffic to detect and identify commercial drones by their unique WiFi signatures — OUI prefixes and SSID naming patterns.

**Dual-Tier Architecture:**
- **Tier 1 (ESP32-C5 hardware)** — Two ESP32-C5 units provide simultaneous 2.4 GHz + 5 GHz monitoring, capturing beacons, probes, associations, deauth attacks, data frames, and hidden APs. Connects via Termux WebSocket bridge or Web Serial API.
- **Tier 0 (built-in WiFi)** — Beacon-only scanning via Termux WiFi scan API. Automatic fallback when hardware unavailable.

**9 Manufacturer Fingerprints:** DJI, Parrot, Skydio, Autel, Yuneec, Hubsan, FIMI, Ryze/Tello, SkyViper. Each with OUI prefix + SSID pattern matching and three-tier confidence scoring.

**Key Features:**
- RSSI trend analysis (approaching/stable/departing) with sparkline history
- Operator phone detection linking controller devices to associated drones
- Deauth flood alerting for jamming detection
- Detection history with IndexedDB persistence and CSV export
- ESP32 health monitoring (heap, uptime, firmware, channel) with color-coded warnings
- Termux bridge setup guidance with step-by-step install instructions on connection failure
- Auto-reconnect preference persisted across app restarts

### AtlasRF Cross-Referencing

WiFi Sentinel correlates its detections with AtlasRF's drone/FPV tracks for multi-sensor confirmation. When both systems detect the same manufacturer within a 60-second window, a cross-reference is created with weighted confidence scoring based on manufacturer match, temporal proximity, RSSI trend agreement, and RemoteID GPS availability. Cross-referenced tracks show a "🔗 RF" badge in the panel and include GPS position data from Remote ID when available.

### ESP32-C5 Firmware

Firmware v4.0.0 for 2 units ships with the release:
- Unit 1: 2.4 GHz band, channels 1/6/11, 500ms dwell, 1.5s full cycle
- Unit 2: 5 GHz non-DFS (UNII-1+3), 9 channels, 300ms dwell, 2.7s cycle
- JSONL v1 protocol over serial (115200 baud) or WebSocket
- On-device OUI/SSID matching, deduplication, heartbeat reporting

---

### Previous Release: v6.57.42

- **Meshtastic protocol fixes** — Reversed longitude in location shares, channel management that was local-only, protocol messages exceeding LoRa payload limit with automatic message compaction.

### Previous Module: QR Code Generator

- **QR Code Generator** (`qr-generator.js`, 609 lines) — Self-contained ISO 18004 QR encoder for offline team invite sharing.

---

## 📦 Installation

### Download & Run
1. Download and extract the zip
2. Serve with any static server:
   ```bash
   python griddown-server.py
   # or
   npx serve .
   ```
3. Open http://localhost:8080

### Install as PWA
After opening in Chrome or Edge, click the install button or use your browser's "Install App" option. Full offline capability after first load.

### ESP32-C5 Setup (for WiFi Sentinel Tier 1)
1. Flash firmware: `./tools/flash_multi_esp32.sh`
2. Set up udev rules: `sudo ./tools/setup_udev.sh`
3. Install Termux dependencies: `pkg install websocat`
4. Run bridge scripts: `./scripts/serial-ws-bridge.sh`

---

## 🔧 Feature Overview

- **61 modules** providing comprehensive offline tactical planning
- **15+ map sources** including USGS, OpenTopoMap, satellite imagery
- **Offline map download** by drawing regions
- **RadiaCode radiation detector** with spectrum analysis, dose tracking, and heatmap overlay
- **Meshtastic mesh networking** with team coordination, position sharing, and encrypted messaging
- **AtlasRF integration** for multi-protocol RF detection (ADS-B, AIS, Remote ID, FPV, APRS)
- **WiFi Sentinel** passive drone detection with 9 manufacturer fingerprints and ESP32-C5 hardware
- **SARSAT beacon detection** for 406 MHz PLB/ELT/EPIRB signals
- **CoT Bridge (TAK)** for interoperability with ATAK/WinTAK
- **Celestial navigation** with star identification, camera sextant, and ephemeris
- **Inertial navigation** with pedestrian dead reckoning for GPS-denied scenarios
- **GPX/KML import/export** with CSV and GeoJSON support
- **Turn-by-turn navigation** with voice guidance
- **Terrain analysis** with viewshed, line-of-sight, solar exposure, and flood risk
- **Radio frequency database** with comm planning and rally points
- **Encrypted plan sharing** with AES-256-GCM team packages
- **Weather integration** and barometric pressure tracking

See the [README](README.md) for complete documentation.

---

## 📊 Stats

- 61 JavaScript modules
- ~105,000 lines of code
- Fully offline-capable PWA
- Zero external dependencies at runtime
- Web Bluetooth, Web Serial, and WebSocket hardware integration

---

## 🔄 Upgrading

If you have a previous version:
1. Replace all files with this release
2. Hard refresh browser (Ctrl+Shift+R)
3. The service worker will automatically update the cache to v6.57.81

---

**Full Changelog**: [CHANGELOG.md](CHANGELOG.md)
