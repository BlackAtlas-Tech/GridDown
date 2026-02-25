/**
 * GridDown WiFi Sentinel Module
 * 
 * Passive drone detection via WiFi fingerprinting.
 * 
 * Two input tiers feed a unified detection pipeline:
 * 
 *   Tier 1 — ESP32-C5 Hardware (WiFi Sentinel Full)
 *     - Web Serial API (Chrome/Edge PWA) or Termux WebSocket bridge
 *     - JSONL v1 protocol from dual ESP32-C5 units (2.4 GHz + 5 GHz)
 *     - All frame types: beacon, probe, assoc, deauth, data
 *     - Sub-3-second detection cycle
 *     - Operator phone detection, active link tracking, deauth flood alerts
 *
 *   Tier 0 — Built-in WiFi (WiFi Sentinel Lite)
 *     - Termux `termux-wifi-scaninfo` via WebSocket bridge
 *     - Returns results from Android's most recent background WiFi scan
 *     - Beacon-only detection (Android WiFi scan API)
 *     - ~30-second scan interval (Android throttle)
 *     - Confidence capped at "med"
 *     - Works on any Android device, no hardware needed
 *
 * Both tiers emit identical events and render identically on the map.
 *
 * @version 1.0.0
 */
const WiFiSentinelModule = (function() {
    'use strict';

    // ==================== Configuration ====================

    const CONFIG = {
        // Track management
        trackMaxAgeSec: 300,            // 5 min — remove track from active view
        trackStaleSec: 60,              // 1 min — mark track stale (dimmed on map)
        correlationWindowMs: 10000,     // 10s — window to link probe→beacon→assoc

        // Tier 0 (built-in WiFi)
        wifiScanIntervalMs: 30000,      // 30s between Android WiFi scans
        wifiScanWsPort: 8765,           // Termux WebSocket port for scan results

        // Tier 1 (ESP32 serial)
        serialBaudRate: 115200,
        serialEsp32VendorId: 0x303A,    // Espressif USB vendor ID
        termuxWsPort: 8766,             // Termux WebSocket port for serial bridge

        // Dedup
        dedupWindowMs: 3000,            // Suppress same BSSID+type within 3s

        // Map rendering
        markerRadiusPx: 8,
        rssiRingMinZoom: 12,
        labelMinZoom: 10,

        // IndexedDB
        dbName: 'griddown_wifi_sentinel',
        dbVersion: 1,
        maxHistoryRecords: 10000,

        // Alerts
        deauthFloodAlertCooldownMs: 60000,  // Don't re-alert same target within 1 min

        // Connection
        wsConnectTimeoutMs: 4000,           // WebSocket connect timeout before error

        // Cross-reference (AtlasRF correlation)
        crossRefWindowMs: 60000,            // Both sources must be active within 60s to correlate
        crossRefStaleSec: 120,              // Remove cross-ref if either source goes stale >2min
    };

    // Termux setup guidance (surfaced on connection failure)
    const TERMUX_SETUP_GUIDE = {
        quickSetup: {
            title: 'WiFi Sentinel Quick Setup',
            steps: [
                'Install Termux from GitHub (github.com/termux/termux-app/releases)',
                'Open Termux: bash scripts/wifi-sentinel-setup.sh',
                'Follow prompts to install packages and detect hardware',
                'Run: ws-start-all (starts all bridges)',
            ],
            hint: 'For Tier 0 WiFi scan, you need TWO things both called "termux-api": (1) pkg install termux-api (CLI tools), and (2) the Termux:API Android app from GitHub. Google Play Termux does not support Tier 0.',
        },
        serial: {
            title: 'Termux Serial Bridge Setup',
            steps: [
                'Install websocat: pkg install websocat',
                'Connect ESP32 units via USB hub',
                'Run: ./scripts/serial-ws-bridge.sh /dev/ttyACM0 8766',
                'Run: ./scripts/serial-ws-bridge.sh /dev/ttyACM1 8767',
            ],
            hint: 'Or run: bash scripts/wifi-sentinel-setup.sh for guided setup.',
        },
        wifiScan: {
            title: 'Termux WiFi Scan Bridge Setup',
            steps: [
                'Install Termux from GitHub (github.com/termux/termux-app/releases)',
                'In Termux run: pkg update && pkg install -y termux-api websocat',
                'Install the Termux:API Android APP from GitHub (github.com/termux/termux-api/releases) — this is a separate APK, not the same as the pkg above',
                'Open the Termux:API app once → grant Location permission',
                'Run: ./scripts/wifi-scan-bridge.sh',
            ],
            hint: 'Two things are both called "termux-api": (1) the CLI package installed via pkg, and (2) the Termux:API Android app (APK). Both are required. The APK is NOT on Google Play.',
        },
    };

    // Manufacturer display config
    const MFG_CONFIG = {
        'DJI':       { color: '#ef4444', label: 'DJI',        icon: '🛸' },
        'Parrot':    { color: '#f59e0b', label: 'Parrot',     icon: '🦜' },
        'Skydio':    { color: '#3b82f6', label: 'Skydio',     icon: '🤖' },
        'Autel':     { color: '#8b5cf6', label: 'Autel',      icon: '📡' },
        'Yuneec':    { color: '#06b6d4', label: 'Yuneec',     icon: '🛸' },
        'Hubsan':    { color: '#84cc16', label: 'Hubsan/EXO', icon: '🛸' },
        'FIMI':      { color: '#14b8a6', label: 'FIMI',       icon: '🛸' },
        'Ryze':      { color: '#f97316', label: 'Ryze/Tello', icon: '🛸' },
        'SkyViper':  { color: '#a855f7', label: 'SkyViper',   icon: '🛸' },
        'HolyStone': { color: '#eab308', label: 'Holy Stone', icon: '🛸' },
        'Potensic':  { color: '#22d3ee', label: 'Potensic',   icon: '🛸' },
        'Ruko':      { color: '#fb923c', label: 'Ruko',       icon: '🛸' },
        'Snaptain':  { color: '#a3e635', label: 'Snaptain',   icon: '🛸' },
        'Walkera':   { color: '#c084fc', label: 'Walkera',    icon: '🛸' },
        'Wingsland': { color: '#2dd4bf', label: 'Wingsland',  icon: '🛸' },
        'SwellPro':  { color: '#38bdf8', label: 'SwellPro',   icon: '🛸' },
        'Eachine':   { color: '#fbbf24', label: 'Eachine',    icon: '🛸' },
        'SJRC':      { color: '#34d399', label: 'SJRC',       icon: '🛸' },
        'BetaFPV':   { color: '#f472b6', label: 'BetaFPV',    icon: '🏎️' },
        'Teal':      { color: '#64748b', label: 'Teal Drones', icon: '🎖️' },
        'iFlight':   { color: '#fb7185', label: 'iFlight',    icon: '🏎️' },
        'FPV':       { color: '#94a3b8', label: 'FPV Generic', icon: '🏎️' },
        'Unknown':   { color: '#6b7280', label: 'Unknown',    icon: '❓' }
    };

    // OUI database — verified against IEEE MA-L registry (oui.csv Feb 2026)
    const OUI_DB = [
        // DJI — SZ DJI Technology Co., Ltd (10 OUIs)
        { prefix: '60:60:1F', mfg: 'DJI' },
        { prefix: '34:D2:62', mfg: 'DJI' },
        { prefix: '48:1C:B9', mfg: 'DJI' },
        { prefix: 'E4:7A:2C', mfg: 'DJI' },
        { prefix: '58:B8:58', mfg: 'DJI' },
        { prefix: '04:A8:5A', mfg: 'DJI' },
        { prefix: '8C:58:23', mfg: 'DJI' },
        { prefix: '0C:9A:E6', mfg: 'DJI' },
        { prefix: '88:29:85', mfg: 'DJI' },
        { prefix: '4C:43:F6', mfg: 'DJI' },
        // DJI — Baiwang Technology Co Ltd (DJI subsidiary)
        { prefix: '9C:5A:8A', mfg: 'DJI' },
        // Parrot SA (5 OUIs)
        { prefix: 'A0:14:3D', mfg: 'Parrot' },
        { prefix: '90:03:B7', mfg: 'Parrot' },
        { prefix: '00:26:7E', mfg: 'Parrot' },
        { prefix: '00:12:1C', mfg: 'Parrot' },
        { prefix: '90:3A:E6', mfg: 'Parrot' },
        // Skydio Inc.
        { prefix: '38:1D:14', mfg: 'Skydio' },
        // Autel — chipset-level: FN-LINK modules used in Autel drones
        { prefix: '54:C9:DF', mfg: 'Autel' },
        // Yuneec — chipset-level: D-Link modules used in Yuneec drones
        { prefix: '58:D5:6E', mfg: 'Yuneec' },
        // Holy Stone Ent. Co., Ltd.
        { prefix: '00:0C:BF', mfg: 'HolyStone' },
        // Teal Drones, Inc. (military/defense, Holladay UT)
        { prefix: 'B0:30:C8', mfg: 'Teal' },
        // iFlight Technology Company Limited (FPV racing)
        { prefix: '9C:4B:6B', mfg: 'iFlight' },
    ];

    // SSID pattern database — comprehensive drone WiFi fingerprints
    // Used for Tier 0 (Android WiFi scan) and Tier 1 (ESP32) matching
    const SSID_DB = [
        // ── DJI ──────────────────────────────────────────────────────
        { prefix: 'DJI_', mfg: 'DJI' }, { prefix: 'DJI-', mfg: 'DJI' },
        { prefix: 'PHANTOM', mfg: 'DJI' }, { prefix: 'Phantom', mfg: 'DJI' },
        { prefix: 'MAVIC', mfg: 'DJI' }, { prefix: 'Mavic', mfg: 'DJI' },
        { prefix: 'Spark-', mfg: 'DJI' }, { prefix: 'SPARK-', mfg: 'DJI' },
        { prefix: 'INSPIRE', mfg: 'DJI' }, { prefix: 'Inspire', mfg: 'DJI' },
        { prefix: 'Matrice', mfg: 'DJI' }, { prefix: 'MATRICE', mfg: 'DJI' },
        { prefix: 'DJI_RCN', mfg: 'DJI' }, { prefix: 'DJI_RC_', mfg: 'DJI' },
        { prefix: 'Avata', mfg: 'DJI' }, { prefix: 'AVATA', mfg: 'DJI' },
        { prefix: 'DJI_FPV', mfg: 'DJI' },
        { prefix: 'AGRAS', mfg: 'DJI' }, { prefix: 'Agras', mfg: 'DJI' },
        { prefix: 'Flycart', mfg: 'DJI' }, { prefix: 'FLYCART', mfg: 'DJI' },
        // ── Parrot ───────────────────────────────────────────────────
        { prefix: 'ANAFI', mfg: 'Parrot' }, { prefix: 'Anafi', mfg: 'Parrot' },
        { prefix: 'DISCO-', mfg: 'Parrot' }, { prefix: 'BebopDrone-', mfg: 'Parrot' },
        { prefix: 'Bebop2-', mfg: 'Parrot' }, { prefix: 'Mambo_', mfg: 'Parrot' },
        { prefix: 'Swing_', mfg: 'Parrot' }, { prefix: 'SkyController', mfg: 'Parrot' },
        { prefix: 'Parrot-', mfg: 'Parrot' }, { prefix: 'BLUEGRASS', mfg: 'Parrot' },
        // ── Skydio (no trailing hyphen — matches Skydio2-, SkydioX2-, etc.) ──
        { prefix: 'Skydio', mfg: 'Skydio' }, { prefix: 'SKYDIO', mfg: 'Skydio' },
        // ── Autel ────────────────────────────────────────────────────
        { prefix: 'AUTEL-', mfg: 'Autel' }, { prefix: 'Autel_', mfg: 'Autel' },
        { prefix: 'Evo_', mfg: 'Autel' }, { prefix: 'EVO_', mfg: 'Autel' },
        { prefix: 'EVO-', mfg: 'Autel' }, { prefix: 'AutelRobotics', mfg: 'Autel' },
        { prefix: 'Dragonfish', mfg: 'Autel' },
        { exact: 'default-ssid', mfg: 'Autel' }, // Autel Remote ID beacon
        // ── Yuneec ───────────────────────────────────────────────────
        { prefix: 'Yuneec-', mfg: 'Yuneec' }, { prefix: 'YUNEEC-', mfg: 'Yuneec' },
        { prefix: 'Typhoon-', mfg: 'Yuneec' }, { prefix: 'H520-', mfg: 'Yuneec' },
        { prefix: 'H480-', mfg: 'Yuneec' }, { prefix: 'H920-', mfg: 'Yuneec' },
        { prefix: 'Mantis', mfg: 'Yuneec' }, { prefix: 'MANTIS', mfg: 'Yuneec' },
        // ── Hubsan / EXO ─────────────────────────────────────────────
        { prefix: 'Hubsan-', mfg: 'Hubsan' }, { prefix: 'HUBSAN', mfg: 'Hubsan' },
        { prefix: 'EXO-', mfg: 'Hubsan' },
        { prefix: 'Zino', mfg: 'Hubsan' }, { prefix: 'ZINO', mfg: 'Hubsan' },
        // ── FIMI (Xiaomi sub-brand) ──────────────────────────────────
        { prefix: 'FIMI-', mfg: 'FIMI' }, { prefix: 'FIMI_', mfg: 'FIMI' },
        // ── Ryze / Tello ─────────────────────────────────────────────
        { prefix: 'TELLO-', mfg: 'Ryze' }, { prefix: 'RMTT-', mfg: 'Ryze' },
        // ── SkyViper ─────────────────────────────────────────────────
        { prefix: 'SKYVIPERGPS_', mfg: 'SkyViper' },
        { prefix: 'SKYVIPER_', mfg: 'SkyViper' }, { prefix: 'SkyViper', mfg: 'SkyViper' },
        // ── Holy Stone ───────────────────────────────────────────────
        { prefix: 'HS-', mfg: 'HolyStone' },
        { prefix: 'HolyStone', mfg: 'HolyStone' }, { prefix: 'HOLYSTONE', mfg: 'HolyStone' },
        // ── Potensic ─────────────────────────────────────────────────
        { prefix: 'Potensic', mfg: 'Potensic' }, { prefix: 'POTENSIC', mfg: 'Potensic' },
        // ── Ruko ─────────────────────────────────────────────────────
        { prefix: 'Ruko', mfg: 'Ruko' }, { prefix: 'RUKO', mfg: 'Ruko' },
        // ── Snaptain ─────────────────────────────────────────────────
        { prefix: 'SNAPTAIN', mfg: 'Snaptain' }, { prefix: 'Snaptain', mfg: 'Snaptain' },
        // ── Walkera ──────────────────────────────────────────────────
        { prefix: 'Walkera', mfg: 'Walkera' }, { prefix: 'WALKERA', mfg: 'Walkera' },
        // ── Wingsland ────────────────────────────────────────────────
        { prefix: 'Wingsland', mfg: 'Wingsland' }, { prefix: 'WINGSLAND', mfg: 'Wingsland' },
        // ── SwellPro ─────────────────────────────────────────────────
        { prefix: 'SwellPro', mfg: 'SwellPro' }, { prefix: 'SWELLPRO', mfg: 'SwellPro' },
        { prefix: 'SplashDrone', mfg: 'SwellPro' },
        // ── Eachine (budget FPV) ─────────────────────────────────────
        { prefix: 'Eachine', mfg: 'Eachine' }, { prefix: 'EACHINE', mfg: 'Eachine' },
        // ── SJRC ─────────────────────────────────────────────────────
        { prefix: 'SJRC', mfg: 'SJRC' }, { prefix: 'SJ-RC', mfg: 'SJRC' },
        // ── BetaFPV (racing/cinewhoop) ───────────────────────────────
        { prefix: 'BetaFPV', mfg: 'BetaFPV' }, { prefix: 'BETAFPV', mfg: 'BetaFPV' },
        // ── Teal Drones (military/defense) ───────────────────────────
        { prefix: 'Teal-', mfg: 'Teal' }, { prefix: 'TEAL-', mfg: 'Teal' },
        // ── iFlight (FPV racing) ─────────────────────────────────────
        { prefix: 'iFlight', mfg: 'iFlight' },
        // ── FPV generic (racing quads) ───────────────────────────────
        { prefix: 'GEPRC', mfg: 'FPV' },
    ];

    // ==================== State ====================

    let state = {
        // Module lifecycle
        initialized: false,
        enabled: true,

        // Connection state
        tier: null,                     // 'esp32' | 'wifi_scan' | null
        esp32Connected: false,
        wifiScanActive: false,
        serialPorts: [],                // Web Serial port objects
        wsConnections: new Map(),       // unit_id -> WebSocket
        wifiScanWs: null,              // Tier 0 WebSocket
        wifiScanTimer: null,

        // Track data — the unified pipeline
        tracks: new Map(),              // bssid -> track object
        operatorLinks: new Map(),       // client_mac -> { bssid, mfg, firstSeen, lastSeen }

        // Dedup (client-side, supplements firmware dedup)
        dedup: new Map(),               // "bssid:type" -> timestamp

        // Alert dedup
        lastDeauthFloodAlerts: new Map(), // target_bssid -> timestamp

        // ESP32 unit health (populated by heartbeat + ws_status)
        esp32Health: new Map(),            // unit_id -> { heap_free, uptime_s, wifi_pkts, ... }

        // Statistics
        stats: {
            esp32: { beacons: 0, probes: 0, assoc: 0, deauth: 0, deauthFloods: 0, data: 0, hidden: 0, total: 0 },
            wifiScan: { scans: 0, matches: 0 },
            tracksCreated: 0,
            tracksExpired: 0,
            connectionTime: null,
        },

        // Settings (persisted)
        settings: {
            tier0Enabled: false,        // Built-in WiFi scanning (requires Termux bridge)
            tier1Enabled: false,        // ESP32 hardware (enable when hardware connected)
            autoReconnect: true,        // Reconnect to ESP32 on startup
            alertOnNewDrone: true,
            alertOnDeauthFlood: true,
            alertSoundEnabled: true,
            connectionMethod: 'auto',   // 'serial' | 'websocket' | 'auto'
            termuxWsHost: (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost',
        },

        // IndexedDB handle
        db: null,

        // Maintenance timer
        maintenanceTimer: null,

        // Connection error tracking (surfaced to panel)
        lastConnectionError: null,     // { type, message, timestamp, guide }

        // Auto-reconnect suppression (set during explicit disconnect)
        autoReconnectSuppressed: false,

        // Reconnect backoff (prevents toast spam on repeated failures)
        tier0ReconnectAttempts: 0,
        tier1ReconnectAttempts: 0,
        maxReconnectAttempts: 5,       // Stop retrying after this many failures
        lastErrorToastTime: 0,         // Throttle error toasts to 1 per 30s

        // Cross-references with AtlasRF (drone/fpv correlation)
        crossRefs: new Map(),          // ws_bssid -> { rfTrackId, rfType, matchType, confidence, ... }
    };

    // ==================== Initialization ====================

    function init() {
        if (state.initialized) return;

        loadSettings().then(() => {
            // Start maintenance loop
            state.maintenanceTimer = setInterval(maintenance, 5000);

            // Auto-connect if settings indicate
            if (state.settings.autoReconnect && state.settings.tier1Enabled) {
                autoConnect();
            }
            if (state.settings.tier0Enabled) {
                startWifiScan();
            }
        });

        // Open IndexedDB for history
        openDatabase();

        state.initialized = true;
        console.log('WiFiSentinelModule initialized');
    }

    function destroy() {
        // Stop all connections
        disconnectAll();

        // Clear timers
        if (state.maintenanceTimer) clearInterval(state.maintenanceTimer);
        if (state.wifiScanTimer) clearInterval(state.wifiScanTimer);

        // Close DB
        if (state.db) state.db.close();

        state.initialized = false;
        console.log('WiFiSentinelModule destroyed');
    }

    // ==================== Settings Persistence ====================

    async function loadSettings() {
        try {
            if (typeof Storage === 'undefined') return;
            const saved = await Storage.Settings.get('wifi_sentinel_settings');
            if (saved) {
                Object.assign(state.settings, saved);
            }
        } catch (e) {
            console.warn('WiFiSentinel: Could not load settings:', e);
        }
    }

    async function saveSettings() {
        try {
            if (typeof Storage === 'undefined') return;
            await Storage.Settings.set('wifi_sentinel_settings', { ...state.settings });
        } catch (e) {
            console.warn('WiFiSentinel: Could not save settings:', e);
        }
    }

    // ==================== IndexedDB ====================

    function openDatabase() {
        try {
            const req = indexedDB.open(CONFIG.dbName, CONFIG.dbVersion);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('detections')) {
                    const store = db.createObjectStore('detections', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('bssid', 'bssid', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('mfg', 'mfg', { unique: false });
                }
            };
            req.onsuccess = (e) => {
                state.db = e.target.result;
            };
            req.onerror = (e) => {
                console.warn('WiFiSentinel: IndexedDB open failed:', e);
            };
        } catch (e) {
            console.warn('WiFiSentinel: IndexedDB not available:', e);
        }
    }

    function persistDetection(detection) {
        if (!state.db) return;
        try {
            const tx = state.db.transaction('detections', 'readwrite');
            tx.objectStore('detections').add({
                bssid: detection.bssid || detection.src || '',
                ssid: detection.ssid || '',
                mfg: detection.mfg || 'Unknown',
                type: detection.t,
                conf: detection.conf || 'low',
                rssi: detection.rssi || 0,
                channel: detection.ch || 0,
                tier: detection._tier || 'unknown',
                timestamp: Date.now(),
            });
        } catch (e) {
            // Non-critical — don't break detection pipeline
        }
    }

    async function getDetectionHistory(options = {}) {
        if (!state.db) return [];
        return new Promise((resolve) => {
            try {
                const tx = state.db.transaction('detections', 'readonly');
                const store = tx.objectStore('detections');
                const results = [];

                let request;
                if (options.bssid) {
                    const idx = store.index('bssid');
                    request = idx.openCursor(IDBKeyRange.only(options.bssid));
                } else if (options.since) {
                    const idx = store.index('timestamp');
                    request = idx.openCursor(IDBKeyRange.lowerBound(options.since));
                } else {
                    request = store.openCursor();
                }

                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && results.length < (options.limit || 500)) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });
    }

    async function pruneHistory() {
        if (!state.db) return;
        try {
            const tx = state.db.transaction('detections', 'readwrite');
            const store = tx.objectStore('detections');
            const countReq = store.count();
            countReq.onsuccess = () => {
                if (countReq.result > CONFIG.maxHistoryRecords) {
                    const excess = countReq.result - CONFIG.maxHistoryRecords;
                    const idx = store.index('timestamp');
                    const cursor = idx.openCursor();
                    let deleted = 0;
                    cursor.onsuccess = (e) => {
                        const c = e.target.result;
                        if (c && deleted < excess) {
                            c.delete();
                            deleted++;
                            c.continue();
                        }
                    };
                }
            };
        } catch (e) { /* non-critical */ }
    }

    // ==================== OUI / SSID Matching (for Tier 0) ====================

    function lookupOui(bssid) {
        if (!bssid) return 'Unknown';
        const prefix = bssid.substring(0, 8).toUpperCase();
        for (const entry of OUI_DB) {
            if (prefix === entry.prefix.toUpperCase()) return entry.mfg;
        }
        return 'Unknown';
    }

    function lookupSsid(ssid) {
        if (!ssid) return 'Unknown';
        for (const entry of SSID_DB) {
            if (entry.exact) {
                if (ssid === entry.exact) return entry.mfg;
            } else if (entry.prefix) {
                if (ssid.startsWith(entry.prefix)) return entry.mfg;
            }
        }
        return 'Unknown';
    }

    function fingerprint(bssid, ssid) {
        const ouiMfg = lookupOui(bssid);
        const ssidMfg = lookupSsid(ssid);

        if (ouiMfg !== 'Unknown' && ssidMfg !== 'Unknown') {
            return { mfg: ouiMfg, conf: 'high' };
        }
        if (ouiMfg !== 'Unknown') {
            return { mfg: ouiMfg, conf: 'med' };
        }
        if (ssidMfg !== 'Unknown') {
            return { mfg: ssidMfg, conf: 'med' };
        }
        return null;  // No match
    }

    // ==================== Deduplication (client-side) ====================

    function isDuplicate(key) {
        const now = Date.now();
        const last = state.dedup.get(key);
        if (last && (now - last) < CONFIG.dedupWindowMs) return true;
        state.dedup.set(key, now);
        return false;
    }

    // ==================== Unified Track Manager ====================

    /**
     * Track object schema:
     * {
     *   bssid: string,            // Primary key (drone AP MAC)
     *   ssid: string,             // Network name
     *   mfg: string,              // Manufacturer
     *   conf: string,             // 'high' | 'med' | 'low'
     *   tier: string,             // 'esp32' | 'wifi_scan'
     *   channel: number,
     *   band: string,             // '2.4' | '5'
     *   firstSeen: number,        // timestamp ms
     *   lastSeen: number,         // timestamp ms
     *   rssi: number,             // Latest RSSI
     *   rssiHistory: number[],    // Rolling RSSI window (last 20)
     *   rssiTrend: string,        // 'approaching' | 'departing' | 'stable' | 'unknown'
     *   detectionTypes: Set,      // Set of detection types seen
     *   operatorMac: string|null, // Linked operator phone MAC (from probe/assoc)
     *   activeLink: boolean,      // Data frames observed (live control link)
     *   deauthCount: number,      // Deauth frames targeting this BSSID
     *   stale: boolean,           // No update within trackStaleSec
     * }
     */

    function createTrack(bssid, ssid, mfg, conf, tier, channel, rssi) {
        return {
            bssid,
            ssid: ssid || '',
            mfg: mfg || 'Unknown',
            conf: conf || 'low',
            tier,
            channel: channel || 0,
            band: channel > 14 ? '5' : '2.4',
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            rssi: rssi || 0,
            rssiHistory: rssi ? [rssi] : [],
            rssiTrend: 'unknown',
            detectionTypes: new Set(),
            operatorMac: null,
            activeLink: false,
            deauthCount: 0,
            stale: false,
        };
    }

    function updateTrack(track, updates) {
        if (updates.rssi !== undefined && updates.rssi !== 0) {
            track.rssi = updates.rssi;
            track.rssiHistory.push(updates.rssi);
            if (track.rssiHistory.length > 20) track.rssiHistory.shift();
            track.rssiTrend = computeRssiTrend(track.rssiHistory);
        }
        if (updates.ssid && !track.ssid) track.ssid = updates.ssid;
        if (updates.channel) track.channel = updates.channel;
        if (updates.conf && confRank(updates.conf) > confRank(track.conf)) {
            track.conf = updates.conf;
        }
        if (updates.mfg && updates.mfg !== 'Unknown' && track.mfg === 'Unknown') {
            track.mfg = updates.mfg;
        }
        if (updates.type) track.detectionTypes.add(updates.type);
        if (updates.operatorMac) track.operatorMac = updates.operatorMac;
        if (updates.activeLink) track.activeLink = true;
        if (updates.deauth) track.deauthCount++;
        track.lastSeen = Date.now();
        track.stale = false;
    }

    function confRank(conf) {
        switch (conf) {
            case 'high': return 3;
            case 'med': return 2;
            case 'low': return 1;
            default: return 0;
        }
    }

    function computeRssiTrend(history) {
        if (history.length < 4) return 'unknown';
        // Compare average of last 4 samples to previous 4
        const recent = history.slice(-4);
        const older = history.slice(-8, -4);
        if (older.length < 4) return 'unknown';

        const avgRecent = recent.reduce((s, v) => s + v, 0) / recent.length;
        const avgOlder = older.reduce((s, v) => s + v, 0) / older.length;
        const diff = avgRecent - avgOlder;

        if (diff > 3) return 'approaching';   // RSSI increasing = closer
        if (diff < -3) return 'departing';     // RSSI decreasing = further
        return 'stable';
    }

    // ==================== Detection Pipeline ====================

    /**
     * Process a single JSONL detection from ESP32 firmware (Tier 1).
     * This is the primary entry point for firmware data.
     */
    function processEsp32Detection(jsonStr) {
        let det;
        try {
            det = JSON.parse(jsonStr);
        } catch (e) {
            return; // Not valid JSON (boot messages, debug output)
        }

        // Validate it's a WiFi Sentinel message (has v:1)
        // Heartbeat messages have heartbeat:true but no v:1 — capture them separately
        if (det.heartbeat === true) {
            handleHeartbeat(det);
            return;
        }
        if (det.v !== 1) return;

        // Tag the tier
        det._tier = 'esp32';

        const type = det.t;
        if (!type) return;

        // Status messages — update stats only
        if (type === 'ws_status') {
            updateEsp32Stats(det);
            return;
        }

        // Dedup check (client-side supplement — cross-unit overlap prevention)
        // Only dedup if this BSSID is NOT already tracked. Existing tracks
        // always accept updates for RSSI trending and confidence upgrades.
        const primaryMac = det.bssid || det.src || det.target;
        const dedupKey = `${primaryMac}:${type}`;
        if (!state.tracks.has(primaryMac?.toUpperCase()) && isDuplicate(dedupKey)) return;

        // Route by detection type
        switch (type) {
            case 'beacon':
            case 'probe_resp':
                handleBeacon(det);
                break;
            case 'probe_req':
                handleProbeRequest(det);
                break;
            case 'assoc':
                handleAssociation(det);
                break;
            case 'deauth':
                handleDeauth(det);
                break;
            case 'deauth_flood':
                handleDeauthFlood(det);
                break;
            case 'data':
                handleDataFrame(det);
                break;
            case 'hidden_ap':
                handleHiddenAp(det);
                break;
        }

        // Persist to history
        persistDetection(det);
    }

    /**
     * Process a WiFi scan result from Android/Termux (Tier 0).
     * Input: array of { bssid, ssid, frequency_mhz, rssi, capabilities }
     */
    function processWifiScanResults(results) {
        if (!Array.isArray(results)) return;

        state.stats.wifiScan.scans++;
        let matchCount = 0;

        for (const ap of results) {
            const fp = fingerprint(ap.bssid, ap.ssid);
            if (!fp) continue;  // Not a drone

            matchCount++;

            const bssid = ap.bssid?.toUpperCase();
            if (!bssid) continue;  // Guard against null/undefined BSSID
            const dedupKey = `${bssid}:wifi_scan`;
            if (!state.tracks.has(bssid) && isDuplicate(dedupKey)) continue;

            const channel = frequencyToChannel(ap.frequency_mhz || ap.frequency);

            let track = state.tracks.get(bssid);
            if (track) {
                updateTrack(track, {
                    rssi: ap.rssi || ap.level,
                    channel,
                    ssid: ap.ssid,
                    conf: fp.conf,
                    mfg: fp.mfg,
                    type: 'beacon',
                });
            } else {
                track = createTrack(bssid, ap.ssid, fp.mfg, fp.conf, 'wifi_scan', channel, ap.rssi || ap.level);
                track.detectionTypes.add('beacon');
                state.tracks.set(bssid, track);
                state.stats.tracksCreated++;
                emitNewDroneAlert(track);
            }

            emitEvent('detection', {
                bssid, ssid: ap.ssid, mfg: fp.mfg, conf: fp.conf,
                rssi: ap.rssi || ap.level, channel, tier: 'wifi_scan', type: 'beacon'
            });

            // Persist to detection history (IndexedDB)
            persistDetection({
                bssid, ssid: ap.ssid, mfg: fp.mfg, conf: fp.conf,
                t: 'beacon', rssi: ap.rssi || ap.level, ch: channel, _tier: 'wifi_scan'
            });
        }

        state.stats.wifiScan.matches += matchCount;

        if (matchCount > 0) {
            emitEvent('tracks:updated', { count: state.tracks.size });
            requestMapRender();
        }
    }

    // ==================== Detection Handlers (Tier 1) ====================

    function handleBeacon(det) {
        const bssid = det.bssid?.toUpperCase();
        if (!bssid) return;

        let track = state.tracks.get(bssid);
        if (track) {
            updateTrack(track, {
                rssi: det.rssi, channel: det.ch, ssid: det.ssid,
                conf: det.conf, mfg: det.mfg, type: 'beacon'
            });
            // Upgrade tier if ESP32 detects what Tier 0 found
            if (track.tier === 'wifi_scan') track.tier = 'esp32';
        } else {
            track = createTrack(bssid, det.ssid, det.mfg, det.conf, 'esp32', det.ch, det.rssi);
            track.detectionTypes.add('beacon');
            state.tracks.set(bssid, track);
            state.stats.tracksCreated++;
            emitNewDroneAlert(track);
        }

        state.stats.esp32.beacons++;
        state.stats.esp32.total++;

        emitEvent('detection', {
            bssid, ssid: det.ssid, mfg: det.mfg, conf: det.conf,
            rssi: det.rssi, channel: det.ch, tier: 'esp32', type: 'beacon'
        });
        emitEvent('tracks:updated', { count: state.tracks.size });
        requestMapRender();
    }

    function handleProbeRequest(det) {
        const srcMac = det.src?.toUpperCase();
        if (!srcMac) return;

        state.stats.esp32.probes++;
        state.stats.esp32.total++;

        // Record operator → drone SSID link
        if (det.ssid && det.mfg !== 'Unknown') {
            state.operatorLinks.set(srcMac, {
                ssid: det.ssid,
                mfg: det.mfg,
                firstSeen: state.operatorLinks.get(srcMac)?.firstSeen || Date.now(),
                lastSeen: Date.now(),
            });

            // Try to correlate with existing drone track by SSID
            for (const [bssid, track] of state.tracks) {
                if (track.ssid === det.ssid && !track.operatorMac) {
                    track.operatorMac = srcMac;
                    track.detectionTypes.add('probe_req');
                    // Upgrade confidence — probe + beacon = strong correlation
                    if (confRank(track.conf) < confRank('high')) {
                        track.conf = 'high';
                    }
                    emitEvent('operator:linked', { bssid, operatorMac: srcMac, ssid: det.ssid });
                    break;
                }
            }
        }

        emitEvent('detection', {
            src: srcMac, ssid: det.ssid, mfg: det.mfg, conf: det.conf,
            rssi: det.rssi, channel: det.ch, tier: 'esp32', type: 'probe_req'
        });
    }

    function handleAssociation(det) {
        const bssid = det.bssid?.toUpperCase();
        const clientMac = det.client?.toUpperCase();
        if (!bssid) return;

        state.stats.esp32.assoc++;
        state.stats.esp32.total++;

        let track = state.tracks.get(bssid);
        if (track) {
            updateTrack(track, {
                type: 'assoc',
                operatorMac: clientMac,
                rssi: det.rssi,
                channel: det.ch,
            });
        }

        emitEvent('detection', {
            bssid, client: clientMac, mfg: det.mfg, tier: 'esp32', type: 'assoc'
        });
        emitEvent('tracks:updated', { count: state.tracks.size });
    }

    function handleDeauth(det) {
        const srcMac = det.src?.toUpperCase();
        const dstMac = det.dst?.toUpperCase();

        state.stats.esp32.deauth++;
        state.stats.esp32.total++;

        // Check if either MAC is a tracked drone
        const targetBssid = state.tracks.has(dstMac) ? dstMac : (state.tracks.has(srcMac) ? srcMac : null);
        if (targetBssid) {
            const track = state.tracks.get(targetBssid);
            updateTrack(track, { deauth: true, type: 'deauth' });
        }

        emitEvent('detection', {
            src: srcMac, dst: dstMac, reason: det.reason, mfg: det.mfg,
            tier: 'esp32', type: 'deauth'
        });
    }

    function handleDeauthFlood(det) {
        state.stats.esp32.deauthFloods++;

        const target = det.target?.toUpperCase();
        const now = Date.now();

        // Alert dedup
        const lastAlert = state.lastDeauthFloodAlerts.get(target);
        if (lastAlert && (now - lastAlert) < CONFIG.deauthFloodAlertCooldownMs) return;
        state.lastDeauthFloodAlerts.set(target, now);

        if (state.settings.alertOnDeauthFlood) {
            triggerAlert({
                severity: 'warning',
                title: 'Deauth Flood Detected',
                message: `${det.count} deauth frames targeting ${target || 'unknown'} in ${det.window_s || 5}s — possible drone jamming attack`,
                sound: true,
                persistent: false,
            });
        }

        emitEvent('deauth_flood', { target, count: det.count, window_s: det.window_s });
    }

    function handleDataFrame(det) {
        state.stats.esp32.data++;
        state.stats.esp32.total++;

        // Correlate data frame with tracked drone
        const srcMac = det.src?.toUpperCase();
        const dstMac = det.dst?.toUpperCase();
        const droneBssid = state.tracks.has(srcMac) ? srcMac : (state.tracks.has(dstMac) ? dstMac : null);

        if (droneBssid) {
            const track = state.tracks.get(droneBssid);
            updateTrack(track, { activeLink: true, type: 'data', rssi: det.rssi, channel: det.ch });

            // The other MAC is likely the operator
            const otherMac = droneBssid === srcMac ? dstMac : srcMac;
            if (otherMac && !track.operatorMac) {
                track.operatorMac = otherMac;
                emitEvent('operator:linked', { bssid: droneBssid, operatorMac: otherMac });
            }
        }
    }

    function handleHiddenAp(det) {
        const bssid = det.bssid?.toUpperCase();
        if (!bssid) return;

        state.stats.esp32.hidden++;
        state.stats.esp32.total++;

        let track = state.tracks.get(bssid);
        if (!track) {
            track = createTrack(bssid, '', det.mfg, det.conf, 'esp32', det.ch, det.rssi);
            track.detectionTypes.add('hidden_ap');
            state.tracks.set(bssid, track);
            state.stats.tracksCreated++;
        } else {
            updateTrack(track, { type: 'hidden_ap', rssi: det.rssi, channel: det.ch });
        }

        emitNewDroneAlert(track);
        emitEvent('detection', {
            bssid, mfg: det.mfg, conf: det.conf, tier: 'esp32', type: 'hidden_ap'
        });
        emitEvent('tracks:updated', { count: state.tracks.size });
        requestMapRender();
    }

    function handleHeartbeat(det) {
        // Heartbeat JSON: { heartbeat:true, unit:"wifi_2g", version:"4.0.0-U1",
        //   uptime_s:10, wifi_pkts:4823, wifi_data_pkts:312, odid_detections:0,
        //   ch_current:6, heap_free:198432, beacons:1247, nan:0, vendor_ie:0 }
        const unitId = det.unit || 'unknown';
        const existing = state.esp32Health.get(unitId) || {};
        state.esp32Health.set(unitId, {
            ...existing,
            unitId,
            firmware: det.version || existing.firmware || '',
            uptime_s: det.uptime_s ?? existing.uptime_s ?? 0,
            heap_free: det.heap_free ?? existing.heap_free ?? 0,
            wifi_pkts: det.wifi_pkts ?? existing.wifi_pkts ?? 0,
            wifi_data_pkts: det.wifi_data_pkts ?? existing.wifi_data_pkts ?? 0,
            odid_detections: det.odid_detections ?? existing.odid_detections ?? 0,
            ch_current: det.ch_current ?? existing.ch_current ?? 0,
            lastHeartbeat: Date.now(),
        });
        emitEvent('esp32:status', { dev: unitId, type: 'heartbeat' });
    }

    function updateEsp32Stats(det) {
        // ws_status message from firmware — update unit health
        const unitId = det.dev || 'unknown';
        const existing = state.esp32Health.get(unitId) || {};
        state.esp32Health.set(unitId, {
            ...existing,
            unitId,
            ws_ver: det.ws_ver || existing.ws_ver || '',
            oui_db: det.oui_db ?? existing.oui_db ?? 0,
            ssid_db: det.ssid_db ?? existing.ssid_db ?? 0,
            ws_beacons: det.beacons ?? existing.ws_beacons ?? 0,
            ws_probes: det.probes ?? existing.ws_probes ?? 0,
            ws_assoc: det.assoc ?? existing.ws_assoc ?? 0,
            ws_deauth: det.deauth ?? existing.ws_deauth ?? 0,
            ws_floods: det.floods ?? existing.ws_floods ?? 0,
            ws_data: det.data ?? existing.ws_data ?? 0,
            ws_hidden: det.hidden ?? existing.ws_hidden ?? 0,
            ws_total: det.total ?? existing.ws_total ?? 0,
            ws_links: det.links ?? existing.ws_links ?? 0,
            lastStatus: Date.now(),
        });
        emitEvent('esp32:status', {
            dev: unitId,
            type: 'ws_status',
            version: det.ws_ver,
            oui_db: det.oui_db,
            ssid_db: det.ssid_db,
            links: det.links,
        });
    }

    // ==================== Connection: Web Serial (Tier 1 - PWA) ====================

    async function connectSerial() {
        if (!navigator.serial) {
            console.warn('WiFiSentinel: Web Serial not available');
            return false;
        }

        try {
            const port = await navigator.serial.requestPort({
                filters: [{ usbVendorId: CONFIG.serialEsp32VendorId }]
            });
            await port.open({ baudRate: CONFIG.serialBaudRate });

            state.serialPorts.push(port);
            state.esp32Connected = true;
            state.tier = 'esp32';
            state.stats.connectionTime = Date.now();
            state.lastConnectionError = null;

            readSerialPort(port);

            emitEvent('connected', { method: 'serial', ports: state.serialPorts.length });
            return true;
        } catch (e) {
            console.error('WiFiSentinel serial connect failed:', e);
            emitEvent('error', { message: 'Serial connection failed', error: e });
            return false;
        }
    }

    async function readSerialPort(port) {
        let lineBuffer = '';
        try {
            const reader = port.readable.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                lineBuffer += decoder.decode(value, { stream: true });

                // Process complete lines
                let newlineIdx;
                while ((newlineIdx = lineBuffer.indexOf('\n')) >= 0) {
                    const line = lineBuffer.substring(0, newlineIdx).trim();
                    lineBuffer = lineBuffer.substring(newlineIdx + 1);
                    if (line.length > 0) {
                        processEsp32Detection(line);
                    }
                }
            }
        } catch (e) {
            console.warn('WiFiSentinel: Serial read error:', e);
            // Remove this port from active list
            const idx = state.serialPorts.indexOf(port);
            if (idx >= 0) state.serialPorts.splice(idx, 1);
            if (state.serialPorts.length === 0) {
                state.esp32Connected = false;
                emitEvent('disconnected', { method: 'serial', reason: e.message });
            }
        }
    }

    // ==================== Connection: WebSocket Bridge (Tier 1 - Termux) ====================

    function connectTermuxWs(unitId, port) {
        const wsPort = port || CONFIG.termuxWsPort;
        const host = state.settings.termuxWsHost;
        const url = `ws://${host}:${wsPort}`;

        try {
            const ws = new WebSocket(url);
            let connected = false;

            // Timeout: if not connected within threshold, emit guidance
            const timeout = setTimeout(() => {
                if (!connected) {
                    ws.close();
                    const err = {
                        type: 'termux_bridge',
                        message: `Could not connect to serial bridge at ${url} — is the bridge running?`,
                        timestamp: Date.now(),
                        guide: TERMUX_SETUP_GUIDE.serial,
                        port: wsPort,
                        unit: unitId,
                    };
                    emitThrottledError(err);
                }
            }, CONFIG.wsConnectTimeoutMs);

            ws.onopen = () => {
                connected = true;
                clearTimeout(timeout);
                state.lastConnectionError = null;
                state.tier1ReconnectAttempts = 0; // Reset backoff on success
                state.wsConnections.set(unitId, ws);
                state.esp32Connected = true;
                state.tier = 'esp32';
                state.stats.connectionTime = Date.now();
                emitEvent('connected', { method: 'websocket', unit: unitId });
            };
            ws.onmessage = (event) => {
                // Each WebSocket message is one JSONL line
                const lines = event.data.split('\n');
                for (const line of lines) {
                    if (line.trim()) processEsp32Detection(line.trim());
                }
            };
            ws.onclose = () => {
                state.wsConnections.delete(unitId);
                if (state.wsConnections.size === 0) {
                    state.esp32Connected = false;
                    emitEvent('disconnected', { method: 'websocket', unit: unitId });
                }
                // Auto-reconnect with exponential backoff
                if (state.settings.autoReconnect && state.settings.tier1Enabled && !state.autoReconnectSuppressed) {
                    state.tier1ReconnectAttempts++;
                    if (state.tier1ReconnectAttempts <= state.maxReconnectAttempts) {
                        const delay = Math.min(3000 * Math.pow(2, state.tier1ReconnectAttempts - 1), 60000);
                        console.log(`WiFiSentinel: Tier 1 reconnect ${unitId} attempt ${state.tier1ReconnectAttempts}/${state.maxReconnectAttempts} in ${delay/1000}s`);
                        setTimeout(() => {
                            if (state.settings.autoReconnect && !state.wsConnections.has(unitId) && !state.autoReconnectSuppressed) {
                                connectTermuxWs(unitId, wsPort);
                            }
                        }, delay);
                    } else {
                        console.warn(`WiFiSentinel: Tier 1 ${unitId} max reconnect attempts reached.`);
                        emitThrottledError({
                            type: 'termux_bridge',
                            message: `Serial bridge ${unitId} unreachable after ${state.maxReconnectAttempts} attempts — toggle Tier 1 off/on to retry`,
                            timestamp: Date.now(),
                            guide: TERMUX_SETUP_GUIDE.serial,
                            port: wsPort,
                            unit: unitId,
                        });
                    }
                }
            };
            ws.onerror = (e) => {
                connected = true; // Prevent timeout from double-firing
                clearTimeout(timeout);
                const err = {
                    type: 'termux_bridge',
                    message: `Serial bridge connection failed at ${url}`,
                    timestamp: Date.now(),
                    guide: TERMUX_SETUP_GUIDE.serial,
                    port: wsPort,
                    unit: unitId,
                };
                emitThrottledError(err);
            };
        } catch (e) {
            const err = {
                type: 'termux_bridge',
                message: `WebSocket not available for Termux bridge (port ${wsPort})`,
                timestamp: Date.now(),
                guide: TERMUX_SETUP_GUIDE.serial,
                port: wsPort,
                unit: unitId,
            };
            emitThrottledError(err);
        }
    }

    // ==================== Connection: WiFi Scan (Tier 0 - Termux) ====================

    function startWifiScan() {
        if (state.wifiScanTimer || state.wifiScanActive) return; // Already running
        if (state.wifiScanWs && state.wifiScanWs.readyState <= WebSocket.OPEN) return; // Connection in progress

        // Connect to Termux WiFi scan WebSocket bridge
        connectWifiScanWs();

        // wifiScanActive is set in connectWifiScanWs.onopen, NOT here.
        // The interval timer is also started on successful connection.
        // This prevents the UI from showing "active" when the bridge is unreachable.
    }

    function stopWifiScan() {
        if (state.wifiScanTimer) {
            clearInterval(state.wifiScanTimer);
            state.wifiScanTimer = null;
        }
        if (state.wifiScanWs) {
            state.wifiScanWs.close();
            state.wifiScanWs = null;
        }
        state.wifiScanActive = false;
        emitEvent('wifi_scan:stopped', {});
    }

    function connectWifiScanWs() {
        const host = state.settings.termuxWsHost;
        const url = `ws://${host}:${CONFIG.wifiScanWsPort}`;

        try {
            const ws = new WebSocket(url);
            // Track the ws reference immediately so startWifiScan's guard can detect
            // a connection-in-progress (before onopen sets wifiScanActive)
            state.wifiScanWs = ws;
            let connected = false;

            const timeout = setTimeout(() => {
                if (!connected) {
                    ws.close();
                    const err = {
                        type: 'termux_wifi_scan',
                        message: `Could not connect to WiFi scan bridge at ${url} — is the bridge running?`,
                        timestamp: Date.now(),
                        guide: TERMUX_SETUP_GUIDE.wifiScan,
                        port: CONFIG.wifiScanWsPort,
                    };
                    state.wifiScanActive = false;
                    emitThrottledError(err);
                }
            }, CONFIG.wsConnectTimeoutMs);

            ws.onopen = () => {
                connected = true;
                clearTimeout(timeout);
                state.lastConnectionError = null;
                state.wifiScanActive = true;
                state.tier = state.esp32Connected ? 'esp32' : 'wifi_scan'; // Set tier (ESP32 takes precedence)
                state.tier0ReconnectAttempts = 0; // Reset backoff on success

                // Start periodic scan requests only after connection succeeds
                if (!state.wifiScanTimer) {
                    state.wifiScanTimer = setInterval(() => {
                        requestWifiScan();
                    }, CONFIG.wifiScanIntervalMs);
                }

                requestWifiScan();
                emitEvent('wifi_scan:started', {});
                emitEvent('connected', { method: 'wifi_scan', tier: 0 });
            };
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (Array.isArray(data)) {
                        processWifiScanResults(data);
                    } else if (data.results) {
                        processWifiScanResults(data.results);
                    }
                } catch (e) {
                    // Not valid JSON
                }
            };
            ws.onclose = () => {
                const wasActive = state.wifiScanActive;
                state.wifiScanWs = null;
                state.wifiScanActive = false;
                // Clear tier if WiFi scan was the active tier (ESP32 takes precedence)
                if (state.tier === 'wifi_scan') state.tier = null;
                // Stop the polling timer if the bridge disconnects
                if (state.wifiScanTimer) {
                    clearInterval(state.wifiScanTimer);
                    state.wifiScanTimer = null;
                }
                if (wasActive) {
                    emitEvent('disconnected', { method: 'wifi_scan', tier: 0 });
                }
                // Auto-reconnect with exponential backoff
                if (state.settings.tier0Enabled && !state.autoReconnectSuppressed) {
                    state.tier0ReconnectAttempts++;
                    if (state.tier0ReconnectAttempts <= state.maxReconnectAttempts) {
                        const delay = Math.min(3000 * Math.pow(2, state.tier0ReconnectAttempts - 1), 60000);
                        console.log(`WiFiSentinel: Tier 0 reconnect attempt ${state.tier0ReconnectAttempts}/${state.maxReconnectAttempts} in ${delay/1000}s`);
                        setTimeout(() => {
                            if (state.settings.tier0Enabled && !state.wifiScanActive && !state.autoReconnectSuppressed) {
                                startWifiScan();
                            }
                        }, delay);
                    } else {
                        console.warn('WiFiSentinel: Tier 0 max reconnect attempts reached. Toggle off/on to retry.');
                        emitThrottledError({
                            type: 'termux_wifi_scan',
                            message: `WiFi scan bridge unreachable after ${state.maxReconnectAttempts} attempts — toggle Tier 0 off/on to retry`,
                            timestamp: Date.now(),
                            guide: TERMUX_SETUP_GUIDE.wifiScan,
                            port: CONFIG.wifiScanWsPort,
                        });
                    }
                }
            };
            ws.onerror = () => {
                connected = true;
                clearTimeout(timeout);
                const err = {
                    type: 'termux_wifi_scan',
                    message: `WiFi scan bridge connection failed at ${url}`,
                    timestamp: Date.now(),
                    guide: TERMUX_SETUP_GUIDE.wifiScan,
                    port: CONFIG.wifiScanWsPort,
                };
                state.wifiScanActive = false;
                // Stop the polling timer — no point polling a dead socket
                if (state.wifiScanTimer) {
                    clearInterval(state.wifiScanTimer);
                    state.wifiScanTimer = null;
                }
                emitThrottledError(err);
            };
        } catch (e) {
            const err = {
                type: 'termux_wifi_scan',
                message: `WebSocket not available for WiFi scan bridge`,
                timestamp: Date.now(),
                guide: TERMUX_SETUP_GUIDE.wifiScan,
                port: CONFIG.wifiScanWsPort,
            };
            state.wifiScanActive = false;
            emitThrottledError(err);
        }
    }

    function requestWifiScan() {
        if (state.wifiScanWs && state.wifiScanWs.readyState === WebSocket.OPEN) {
            state.wifiScanWs.send(JSON.stringify({ command: 'scan' }));
        }
    }

    // ==================== Auto-Connect ====================

    function autoConnect() {
        // Try Web Serial first (PWA on Chrome/Edge)
        if (navigator.serial) {
            navigator.serial.getPorts().then(ports => {
                const espPorts = ports.filter(p => {
                    const info = p.getInfo();
                    return info.usbVendorId === CONFIG.serialEsp32VendorId;
                });
                for (const port of espPorts) {
                    port.open({ baudRate: CONFIG.serialBaudRate }).then(() => {
                        state.serialPorts.push(port);
                        state.esp32Connected = true;
                        state.tier = 'esp32';
                        state.stats.connectionTime = Date.now();
                        readSerialPort(port);
                        emitEvent('connected', { method: 'serial', ports: state.serialPorts.length });
                    }).catch(() => {});
                }
            }).catch(() => {});
        }

        // Also try Termux WebSocket bridges
        connectTermuxWs('wifi_2g', CONFIG.termuxWsPort);
        connectTermuxWs('wifi_5g', CONFIG.termuxWsPort + 1);
    }

    function disconnectAll() {
        // Suppress auto-reconnect during explicit disconnect
        state.autoReconnectSuppressed = true;

        // Close serial ports
        for (const port of state.serialPorts) {
            try { port.close(); } catch (e) {}
        }
        state.serialPorts = [];

        // Close WebSocket connections
        for (const [id, ws] of state.wsConnections) {
            try { ws.close(); } catch (e) {}
        }
        state.wsConnections.clear();

        stopWifiScan();

        state.esp32Connected = false;
        state.tier = null;
        state.esp32Health.clear();
        state.lastConnectionError = null;
        state.tier0ReconnectAttempts = 0;
        state.tier1ReconnectAttempts = 0;
        emitEvent('disconnected', { method: 'all' });

        // Re-enable auto-reconnect after close events have fired
        setTimeout(() => { state.autoReconnectSuppressed = false; }, 1000);
    }

    // ==================== Cross-Reference: AtlasRF Correlation ====================

    /**
     * Manufacturer name normalization for cross-module matching.
     * AtlasRF may use slightly different names than WiFi Sentinel's MFG_CONFIG keys.
     */
    const MFG_ALIASES = {
        'dji': 'DJI', 'da-jiang': 'DJI', 'sz dji': 'DJI', 'dji baiwang': 'DJI',
        'parrot': 'Parrot', 'parrot sa': 'Parrot',
        'skydio': 'Skydio',
        'autel': 'Autel', 'autel robotics': 'Autel',
        'yuneec': 'Yuneec',
        'hubsan': 'Hubsan', 'exo': 'Hubsan',
        'fimi': 'FIMI', 'xiaomi fimi': 'FIMI',
        'ryze': 'Ryze', 'ryze tech': 'Ryze', 'tello': 'Ryze',
        'skyviper': 'SkyViper', 'sky viper': 'SkyViper',
        'holy stone': 'HolyStone', 'holystone': 'HolyStone',
        'potensic': 'Potensic',
        'ruko': 'Ruko',
        'snaptain': 'Snaptain',
        'walkera': 'Walkera',
        'wingsland': 'Wingsland',
        'swellpro': 'SwellPro', 'swell pro': 'SwellPro',
        'eachine': 'Eachine',
        'sjrc': 'SJRC', 'sj-rc': 'SJRC',
        'betafpv': 'BetaFPV', 'beta fpv': 'BetaFPV',
        'teal': 'Teal', 'teal drones': 'Teal',
        'iflight': 'iFlight',
        'geprc': 'FPV',
    };

    function normalizeMfg(name) {
        if (!name) return '';
        const lower = name.toLowerCase().trim();
        return MFG_ALIASES[lower] || name;
    }

    /**
     * Run cross-reference sweep against AtlasRF tracks.
     * Called from maintenance loop every 5 seconds.
     *
     * Matching heuristics:
     *   1. Manufacturer match + both active within window → high confidence
     *   2. Manufacturer match + one stale → medium confidence
     *   3. FPV track exists + any WiFi Sentinel drone active → low confidence (temporal only)
     */
    function correlateWithAtlasRF() {
        if (typeof AtlasRFModule === 'undefined') return;
        if (!AtlasRFModule.isConnected || !AtlasRFModule.isConnected()) return;
        if (state.tracks.size === 0) return;

        const rfTracks = AtlasRFModule.getTracks();
        if (!rfTracks || rfTracks.length === 0) return;

        const now = Date.now();
        const window = CONFIG.crossRefWindowMs;
        const staleThresh = CONFIG.crossRefStaleSec * 1000;
        const prevRefs = new Set(state.crossRefs.keys());

        // Filter AtlasRF to drone-relevant tracks
        const rfDrones = rfTracks.filter(t =>
            (t.type === 'drone' || t.type === 'fpv') &&
            t.lastUpdate && (now - t.lastUpdate) < window
        );

        if (rfDrones.length === 0) {
            // Expire all cross-refs if no RF drones active
            if (state.crossRefs.size > 0) {
                state.crossRefs.clear();
                emitEvent('crossref:cleared', {});
            }
            return;
        }

        // For each WiFi Sentinel track, find best AtlasRF match
        for (const [bssid, wsTrack] of state.tracks) {
            if (wsTrack.stale && (now - wsTrack.lastSeen) > staleThresh) continue;
            const wsMfg = normalizeMfg(wsTrack.mfg);
            if (!wsMfg || wsMfg === 'Unknown') continue;

            let bestMatch = null;
            let bestScore = 0;

            for (const rfTrack of rfDrones) {
                const rfMfg = normalizeMfg(rfTrack.manufacturer);
                let score = 0;
                let matchType = 'temporal';

                // Manufacturer match (strongest signal)
                if (rfMfg && wsMfg === rfMfg) {
                    score += 10;
                    matchType = 'manufacturer';
                }

                // Temporal proximity bonus (both seen recently)
                const wsAge = now - wsTrack.lastSeen;
                const rfAge = now - rfTrack.lastUpdate;
                if (wsAge < 30000 && rfAge < 30000) {
                    score += 3; // Both very fresh
                } else if (wsAge < window && rfAge < window) {
                    score += 1;
                }

                // RSSI trend agreement (both approaching or both departing)
                if (wsTrack.rssiTrend === 'approaching' && rfTrack.rssi_trend === 'approaching') score += 1;
                if (wsTrack.rssiTrend === 'departing' && rfTrack.rssi_trend === 'departing') score += 1;

                // RemoteID drone (has GPS) is more valuable than FPV
                if (rfTrack.type === 'drone') score += 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { rfTrack, matchType, score };
                }
            }

            if (bestMatch && bestScore >= 10) {
                // Manufacturer match required for meaningful correlation
                const rf = bestMatch.rfTrack;
                const existing = state.crossRefs.get(bssid);
                const isNew = !existing || existing.rfTrackId !== rf.id;

                const confidence = bestScore >= 13 ? 'high' : bestScore >= 11 ? 'med' : 'low';

                const refLat = rf.lat ?? rf.latitude;
                const refLon = rf.lon ?? rf.longitude;

                state.crossRefs.set(bssid, {
                    wsBssid: bssid,
                    wsMfg: wsMfg,
                    rfTrackId: rf.id,
                    rfType: rf.type,
                    rfMfg: normalizeMfg(rf.manufacturer),
                    matchType: bestMatch.matchType,
                    confidence,
                    score: bestScore,
                    rfHasPosition: !!(refLat && refLon),
                    rfLat: refLat || null,
                    rfLon: refLon || null,
                    rfCallsign: rf.callsign || rf.name || rf.uas_id || rf.serial || null,
                    firstCorrelated: existing ? existing.firstCorrelated : now,
                    lastCorrelated: now,
                });

                prevRefs.delete(bssid);

                if (isNew) {
                    emitEvent('crossref:new', {
                        bssid, wsMfg, rfTrackId: rf.id, rfType: rf.type, confidence
                    });
                }
            }
        }

        // Remove stale cross-refs (WS track no longer active or RF track gone)
        for (const staleBssid of prevRefs) {
            state.crossRefs.delete(staleBssid);
        }
    }

    // ==================== Maintenance ====================

    function maintenance() {
        const now = Date.now();
        const staleThresh = now - (CONFIG.trackStaleSec * 1000);
        const expireThresh = now - (CONFIG.trackMaxAgeSec * 1000);

        for (const [bssid, track] of state.tracks) {
            if (track.lastSeen < expireThresh) {
                state.tracks.delete(bssid);
                state.stats.tracksExpired++;
                emitEvent('track:expired', { bssid, mfg: track.mfg, ssid: track.ssid });
            } else if (track.lastSeen < staleThresh && !track.stale) {
                track.stale = true;
                track.activeLink = false;
            }
        }

        // Prune operator links older than 10 minutes
        const opExpire = now - 600000;
        for (const [mac, link] of state.operatorLinks) {
            if (link.lastSeen < opExpire) state.operatorLinks.delete(mac);
        }

        // Prune dedup map (entries older than 2x window)
        const dedupExpire = now - (CONFIG.dedupWindowMs * 2);
        for (const [key, ts] of state.dedup) {
            if (ts < dedupExpire) state.dedup.delete(key);
        }

        // Prune deauth flood alert dedup
        for (const [target, ts] of state.lastDeauthFloodAlerts) {
            if (ts < now - CONFIG.deauthFloodAlertCooldownMs * 2) {
                state.lastDeauthFloodAlerts.delete(target);
            }
        }

        // Periodic DB prune
        if (Math.random() < 0.01) pruneHistory();  // ~1% chance per 5s tick = ~once per 8 min

        // Cross-reference with AtlasRF drone/FPV tracks
        correlateWithAtlasRF();

        // Request map render if tracks changed
        if (state.tracks.size > 0) requestMapRender();
    }

    // ==================== Helpers ====================

    function frequencyToChannel(freqMhz) {
        if (!freqMhz) return 0;
        if (freqMhz >= 2412 && freqMhz <= 2484) {
            if (freqMhz === 2484) return 14;
            return Math.round((freqMhz - 2412) / 5) + 1;
        }
        if (freqMhz >= 5170 && freqMhz <= 5825) {
            return Math.round((freqMhz - 5000) / 5);
        }
        return 0;
    }

    // ==================== Events & Alerts ====================

    function emitEvent(eventName, data) {
        if (typeof Events !== 'undefined') {
            Events.emit(`wifi_sentinel:${eventName}`, data);
        }
    }

    /** Emit an error event, but throttle to at most 1 toast per 30s to prevent spam */
    function emitThrottledError(err) {
        state.lastConnectionError = err;
        const now = Date.now();
        if (now - state.lastErrorToastTime >= 30000) {
            state.lastErrorToastTime = now;
            emitEvent('error', err);
        } else {
            // Still log, just don't toast
            console.warn('WiFiSentinel:', err.message);
        }
    }

    function requestMapRender() {
        if (typeof MapModule !== 'undefined' && MapModule.render) {
            MapModule.render();
        }
    }

    function emitNewDroneAlert(track) {
        if (!state.settings.alertOnNewDrone) return;

        const mfgConf = MFG_CONFIG[track.mfg] || MFG_CONFIG['Unknown'];
        triggerAlert({
            severity: track.conf === 'high' ? 'warning' : 'caution',
            title: `${mfgConf.icon} Drone Detected — ${mfgConf.label}`,
            message: `${track.ssid || 'Hidden SSID'} on ch${track.channel} (${track.band} GHz) — ${track.conf} confidence` +
                     (track.tier === 'wifi_scan' ? ' [WiFi Scan]' : ''),
            sound: state.settings.alertSoundEnabled,
            persistent: false,
        });

        emitEvent('drone:new', {
            bssid: track.bssid, ssid: track.ssid, mfg: track.mfg,
            conf: track.conf, channel: track.channel, rssi: track.rssi, tier: track.tier,
        });
    }

    function triggerAlert(options) {
        if (typeof AlertModule !== 'undefined' && AlertModule.trigger) {
            AlertModule.trigger({
                source: 'wifi_sentinel',
                ...options,
            });
        }
    }

    // ==================== Map Rendering ====================

    function renderOnMap(ctx, width, height, latLonToPixel, zoom) {
        // WiFi Sentinel tracks don't have GPS positions.
        // We render them as a HUD overlay (track list) rather than map markers.
        // This method renders a compact drone summary in the top-right corner.

        if (state.tracks.size === 0) return;

        const activeTracks = [...state.tracks.values()].filter(t => !t.stale);
        const staleTracks = [...state.tracks.values()].filter(t => t.stale);
        const total = activeTracks.length + staleTracks.length;
        if (total === 0) return;

        ctx.save();

        // HUD panel background
        const panelX = width - 220;
        const panelY = 10;
        const lineHeight = 18;
        const headerHeight = 26;
        const panelHeight = headerHeight + (Math.min(activeTracks.length, 8) * lineHeight) + 10;
        const panelWidth = 210;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1;
        roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 6);
        ctx.fill();
        ctx.stroke();

        // Header
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`WIFI SENTINEL — ${activeTracks.length} active`, panelX + 8, panelY + 17);
        if (staleTracks.length > 0) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '9px system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${staleTracks.length} stale`, panelX + panelWidth - 8, panelY + 17);
        }

        // Track list
        ctx.textAlign = 'left';
        const sortedTracks = activeTracks.sort((a, b) => b.rssi - a.rssi);
        for (let i = 0; i < Math.min(sortedTracks.length, 8); i++) {
            const track = sortedTracks[i];
            const y = panelY + headerHeight + (i * lineHeight) + 4;
            const mfgConf = MFG_CONFIG[track.mfg] || MFG_CONFIG['Unknown'];

            // Manufacturer color dot
            ctx.beginPath();
            ctx.arc(panelX + 14, y + 4, 4, 0, Math.PI * 2);
            ctx.fillStyle = mfgConf.color;
            ctx.fill();

            // SSID or manufacturer
            ctx.fillStyle = '#e5e7eb';
            ctx.font = '10px system-ui, sans-serif';
            const label = track.ssid || mfgConf.label;
            ctx.fillText(truncateStr(label, 16), panelX + 24, y + 8);

            // RSSI
            ctx.fillStyle = rssiColor(track.rssi);
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${track.rssi}`, panelX + panelWidth - 40, y + 8);

            // Trend arrow
            ctx.fillStyle = '#9ca3af';
            const arrow = track.rssiTrend === 'approaching' ? '▲' :
                          track.rssiTrend === 'departing' ? '▼' :
                          track.rssiTrend === 'stable' ? '—' : '?';
            ctx.fillText(arrow, panelX + panelWidth - 20, y + 8);

            // Active link indicator
            if (track.activeLink) {
                ctx.fillStyle = '#22c55e';
                ctx.fillText('●', panelX + panelWidth - 8, y + 8);
            }

            ctx.textAlign = 'left';
        }

        if (activeTracks.length > 8) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '9px system-ui, sans-serif';
            ctx.fillText(`+${activeTracks.length - 8} more`, panelX + 24, panelY + panelHeight - 4);
        }

        ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function rssiColor(rssi) {
        if (rssi > -40) return '#22c55e';    // Strong — very close
        if (rssi > -55) return '#84cc16';    // Good
        if (rssi > -70) return '#f59e0b';    // Moderate
        if (rssi > -85) return '#f97316';    // Weak
        return '#ef4444';                     // Very weak
    }

    function truncateStr(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;
    }

    // ==================== Public API ====================

    return {
        init,
        destroy,

        // Connection
        connectSerial,
        connectTermuxWs,
        disconnectAll,
        autoConnect,
        startWifiScan,
        stopWifiScan,
        isConnected: () => state.esp32Connected || state.wifiScanActive,
        isEsp32Connected: () => state.esp32Connected,
        isWifiScanActive: () => state.wifiScanActive,
        getConnectionTier: () => state.tier,

        // Data input (for external callers / testing)
        processEsp32Detection,
        processWifiScanResults,

        // Track data
        getTracks: () => [...state.tracks.values()],
        getTrack: (bssid) => state.tracks.get(bssid?.toUpperCase()),
        getTrackCount: () => state.tracks.size,
        getActiveTrackCount: () => [...state.tracks.values()].filter(t => !t.stale).length,
        getOperatorLinks: () => [...state.operatorLinks.entries()].map(([mac, link]) => ({ mac, ...link })),

        // History (async)
        getDetectionHistory,

        // Fingerprinting (exported for Tier 0 and testing)
        lookupOui,
        lookupSsid,
        fingerprint,
        frequencyToChannel,

        // Map rendering
        renderOnMap,

        // Stats
        getStats: () => JSON.parse(JSON.stringify(state.stats)),
        getEsp32Health: () => [...state.esp32Health.values()],

        // Settings
        getSettings: () => ({ ...state.settings }),
        updateSettings: (updates) => {
            Object.assign(state.settings, updates);
            saveSettings();
            if (updates.tier0Enabled === false) stopWifiScan();
            if (updates.tier0Enabled === true && !state.wifiScanActive) {
                state.tier0ReconnectAttempts = 0; // Reset backoff on manual toggle
                startWifiScan();
            }
        },

        // Constants
        MFG_CONFIG,
        CONFIG,
        TERMUX_SETUP_GUIDE,

        // Connection diagnostics
        getLastConnectionError: () => state.lastConnectionError ? { ...state.lastConnectionError } : null,

        // Cross-references with AtlasRF
        getCrossRefs: () => [...state.crossRefs.values()],
        getCrossRef: (bssid) => state.crossRefs.has(bssid) ? { ...state.crossRefs.get(bssid) } : null,
        getCrossRefCount: () => state.crossRefs.size,
    };
})();

// Register globally
window.WiFiSentinelModule = WiFiSentinelModule;
