/**
 * GridDown Water Quality Module - Fluidion ALERT One Integration
 * Handheld Microbiology Analyzer for E. coli, Total Coliforms & Enterococci
 * 
 * Supports:
 * 1. USB Serial data download from ALERT One device (Web Serial API)
 * 2. CSV/text file import from Fluidion companion app exports
 * 3. Manual sample entry for field conditions
 * 4. Smart interpretation against WHO, EPA, EU regulatory standards
 * 5. Emergency/disaster-context water safety assessment
 * 6. Geotagged samples on map with color-coded risk visualization
 * 7. Trend analysis across multiple samples
 * 8. IndexedDB offline storage
 * 
 * Device: Fluidion ALERT One (V1.4/V1.5)
 *   - USB-C serial output via Settings > Download Data
 *   - Measures E. coli (CFU/100mL), Total Coliforms, Enterococci
 *   - Calibrations: freshwater, seawater variants
 *   - Fluorescence (E. coli) and Absorbance (Coliform) curves
 * 
 * References:
 *   - https://fluidion.com/products/analyzers/alert-one
 *   - WHO Guidelines for Drinking-water Quality (4th ed.)
 *   - EPA Recreational Water Quality Criteria (2012)
 *   - EU Bathing Water Directive 2006/7/EC
 * 
 * @version 1.0.0
 * @license GPL-3.0
 */
const WaterQualityModule = (function() {
    'use strict';

    // ==================== REGULATORY STANDARDS ====================
    // All thresholds in CFU (Colony Forming Units) per 100mL

    const STANDARDS = {
        // WHO Guidelines for Drinking-water Quality
        who_drinking: {
            name: 'WHO Drinking Water',
            shortName: 'WHO',
            parameter: 'ecoli',
            thresholds: [
                { max: 0,    level: 'safe',     label: 'Conformity', color: '#22c55e', description: 'Meets WHO drinking water standard' },
                { max: 1,    level: 'low',      label: 'Low Risk', color: '#84cc16', description: 'Very low contamination detected' },
                { max: 10,   level: 'moderate',  label: 'Intermediate', color: '#f59e0b', description: 'Contamination present, treatment required' },
                { max: 100,  level: 'high',     label: 'High Risk', color: '#f97316', description: 'Significant contamination, do not consume' },
                { max: 1000, level: 'very_high', label: 'Very High Risk', color: '#ef4444', description: 'Severe contamination, avoid all contact' },
                { max: Infinity, level: 'unsafe', label: 'Unsafe', color: '#991b1b', description: 'Gross contamination, potential sewage' }
            ]
        },

        // US EPA Recreational Water Quality Criteria (2012) - Freshwater E. coli
        epa_recreational_fresh: {
            name: 'EPA Recreational (Freshwater)',
            shortName: 'EPA Fresh',
            parameter: 'ecoli',
            thresholds: [
                { max: 126,  level: 'safe',      label: 'Safe', color: '#22c55e', description: 'Below geometric mean criterion (126 CFU/100mL)' },
                { max: 235,  level: 'caution',   label: 'Caution', color: '#f59e0b', description: 'Above GM, below Beach Action Value (235)' },
                { max: 320,  level: 'advisory',  label: 'Advisory', color: '#f97316', description: 'Above BAV, below STV (320)' },
                { max: Infinity, level: 'closure', label: 'Closure', color: '#ef4444', description: 'Exceeds Statistical Threshold Value' }
            ]
        },

        // US EPA Recreational - Marine Enterococci
        epa_recreational_marine: {
            name: 'EPA Recreational (Marine)',
            shortName: 'EPA Marine',
            parameter: 'enterococci',
            thresholds: [
                { max: 35,   level: 'safe',     label: 'Safe', color: '#22c55e', description: 'Below geometric mean criterion (35 CFU/100mL)' },
                { max: 70,   level: 'caution',  label: 'Caution', color: '#f59e0b', description: 'Above GM, below Beach Action Value (70)' },
                { max: 130,  level: 'advisory', label: 'Advisory', color: '#f97316', description: 'Above BAV, approaching STV (130)' },
                { max: Infinity, level: 'closure', label: 'Closure', color: '#ef4444', description: 'Exceeds Statistical Threshold Value' }
            ]
        },

        // EU Bathing Water Directive 2006/7/EC - Inland (Freshwater)
        eu_bathing_fresh: {
            name: 'EU Bathing (Freshwater)',
            shortName: 'EU Fresh',
            parameter: 'ecoli',
            thresholds: [
                { max: 500,  level: 'excellent', label: 'Excellent', color: '#22c55e', description: 'EU Excellent quality' },
                { max: 1000, level: 'good',      label: 'Good', color: '#84cc16', description: 'EU Good quality' },
                { max: 900,  level: 'sufficient', label: 'Sufficient', color: '#f59e0b', description: 'EU Sufficient (95th percentile basis)' },
                { max: Infinity, level: 'poor',   label: 'Poor', color: '#ef4444', description: 'Fails EU minimum standard' }
            ]
        },

        // Emergency / Disaster Assessment (GridDown-specific)
        emergency: {
            name: 'Emergency Assessment',
            shortName: 'Emergency',
            parameter: 'ecoli',
            thresholds: [
                { max: 0,     level: 'potable',      label: 'Potable', color: '#22c55e', description: 'Safe for drinking without additional treatment' },
                { max: 10,    level: 'treatable',     label: 'Treatable', color: '#84cc16', description: 'Potable after standard field treatment (boil/filter/purify)' },
                { max: 100,   level: 'caution',       label: 'Treat Required', color: '#f59e0b', description: 'Requires multi-stage treatment before any consumption' },
                { max: 1000,  level: 'non_potable',   label: 'Non-Potable', color: '#f97316', description: 'Hygiene/washing only with caution, not for consumption' },
                { max: 10000, level: 'contaminated',  label: 'Contaminated', color: '#ef4444', description: 'Avoid all skin contact, likely sewage or animal waste' },
                { max: Infinity, level: 'hazardous',  label: 'Hazardous', color: '#991b1b', description: 'Grossly contaminated, evacuate area if source water' }
            ]
        }
    };

    // Default standard for interpretation
    const DEFAULT_STANDARD = 'emergency';

    // ==================== ALERT ONE DEVICE CONFIG ====================

    const DEVICE_CONFIG = {
        name: 'Fluidion ALERT One',
        // Common USB serial chip vendor IDs the ALERT One may use
        usbFilters: [
            { usbVendorId: 0x0403 }, // FTDI (common in lab instruments)
            { usbVendorId: 0x067B }, // Prolific
            { usbVendorId: 0x10C4 }, // Silicon Labs CP210x
            { usbVendorId: 0x1A86 }, // CH340/CH341
            { usbVendorId: 0x2341 }, // Arduino-based (some custom instruments)
        ],
        baudRates: [115200, 9600, 57600, 19200, 38400],
        defaultBaudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',

        // Calibration IDs from manual
        calibrations: {
            '1.6.40': { name: 'E.coli TC River - Plastic v2', type: 'freshwater', target: 'ecoli_tc' },
            '1.6.41': { name: 'E.coli TC Seawater - Plastic v2', type: 'seawater', target: 'ecoli_tc' },
            '1.6.44': { name: 'Enterococci River - Plastic', type: 'freshwater', target: 'enterococci' },
            '1.6.45': { name: 'Enterococci Sea - Plastic', type: 'seawater', target: 'enterococci' }
        },

        // Volumes
        volumes: {
            freshwater: 50, // mL
            seawater: 37    // mL (9mL sample + 27mL sterile water + reagent)
        }
    };

    // ==================== STATE ====================

    let state = {
        // Connection
        serialPort: null,
        serialReader: null,
        isConnected: false,
        isConnecting: false,
        isDownloading: false,
        deviceInfo: null,

        // Data
        samples: [],           // All stored samples
        currentDownload: [],   // Samples from current serial download session
        rawSerialBuffer: '',   // Raw serial data buffer
        rawSerialLog: [],      // Complete raw serial log for debugging

        // Settings
        activeStandard: DEFAULT_STANDARD,
        baudRate: DEVICE_CONFIG.defaultBaudRate,
        showOnMap: true,
        alertsEnabled: true,

        // UI
        selectedSampleId: null,
        isImporting: false,

        // Stats
        totalSamplesCollected: 0,
        lastSampleTime: null,

        // Demo
        isDemoMode: false,

        // Subscribers for reactive updates
        subscribers: []
    };

    // IndexedDB
    const DB_NAME = 'griddown_waterquality';
    const DB_VERSION = 1;
    const STORE_NAME = 'samples';
    let db = null;

    // ==================== INITIALIZATION ====================

    async function init() {
        try {
            await initDB();
            await loadSamples();
            console.log(`[WaterQuality] Initialized with ${state.samples.length} stored samples`);
        } catch (e) {
            console.error('[WaterQuality] Init failed:', e);
        }
    }

    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('location', ['lat', 'lon'], { unique: false });
                    store.createIndex('riskLevel', 'interpretation.level', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('[WaterQuality] IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function loadSamples() {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                state.samples = request.result || [];
                state.totalSamplesCollected = state.samples.length;
                if (state.samples.length > 0) {
                    state.lastSampleTime = Math.max(...state.samples.map(s => s.timestamp));
                }
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async function saveSample(sample) {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(sample);
            tx.oncomplete = () => {
                // Update in-memory cache
                const idx = state.samples.findIndex(s => s.id === sample.id);
                if (idx >= 0) {
                    state.samples[idx] = sample;
                } else {
                    state.samples.push(sample);
                }
                state.totalSamplesCollected = state.samples.length;
                state.lastSampleTime = sample.timestamp;
                notifySubscribers();
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    async function deleteSample(sampleId) {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(sampleId);
            tx.oncomplete = () => {
                state.samples = state.samples.filter(s => s.id !== sampleId);
                state.totalSamplesCollected = state.samples.length;
                notifySubscribers();
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    async function clearAllSamples() {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            tx.oncomplete = () => {
                state.samples = [];
                state.totalSamplesCollected = 0;
                state.lastSampleTime = null;
                notifySubscribers();
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    // ==================== SERIAL CONNECTION (Web Serial API) ====================

    function isSerialAvailable() {
        return 'serial' in navigator;
    }

    async function connectSerial(baudRate) {
        if (!isSerialAvailable()) {
            throw new Error('Web Serial API not supported. Use Chrome or Edge on desktop/Android.');
        }

        if (state.isConnected) {
            await disconnectSerial();
        }

        state.isConnecting = true;
        notifySubscribers();

        try {
            // Request port - show all serial devices (ALERT One may use various chips)
            const port = await navigator.serial.requestPort({
                filters: DEVICE_CONFIG.usbFilters
            });

            const rate = baudRate || state.baudRate;

            await port.open({
                baudRate: rate,
                dataBits: DEVICE_CONFIG.dataBits,
                stopBits: DEVICE_CONFIG.stopBits,
                parity: DEVICE_CONFIG.parity,
                flowControl: DEVICE_CONFIG.flowControl
            });

            state.serialPort = port;
            state.isConnected = true;
            state.isConnecting = false;
            state.baudRate = rate;
            state.rawSerialBuffer = '';
            state.rawSerialLog = [];
            state.currentDownload = [];

            // Start reading
            startSerialReading();

            notifySubscribers();

            console.log(`[WaterQuality] Connected to serial device at ${rate} baud`);
            return true;

        } catch (e) {
            state.isConnecting = false;
            notifySubscribers();

            if (e.name === 'NotFoundError') {
                throw new Error('No device selected. Connect ALERT One via USB-C and try again.');
            }
            throw e;
        }
    }

    async function startSerialReading() {
        if (!state.serialPort || !state.serialPort.readable) return;

        const decoder = new TextDecoderStream();
        const inputDone = state.serialPort.readable.pipeTo(decoder.writable);
        state.serialReader = decoder.readable.getReader();

        state.isDownloading = true;
        notifySubscribers();

        (async () => {
            try {
                while (true) {
                    const { value, done } = await state.serialReader.read();
                    if (done) break;
                    if (value) {
                        processSerialData(value);
                    }
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('[WaterQuality] Serial read error:', e);
                }
            } finally {
                state.isDownloading = false;
                notifySubscribers();
            }
        })();
    }

    async function disconnectSerial() {
        if (state.serialReader) {
            try { await state.serialReader.cancel(); } catch (e) { /* ignore */ }
            state.serialReader = null;
        }

        if (state.serialPort) {
            try { await state.serialPort.close(); } catch (e) { /* ignore */ }
            state.serialPort = null;
        }

        state.isConnected = false;
        state.isDownloading = false;

        // Process any remaining buffer
        if (state.rawSerialBuffer.trim()) {
            processSerialLine(state.rawSerialBuffer.trim());
            state.rawSerialBuffer = '';
        }

        // Finalize download - save all parsed samples
        if (state.currentDownload.length > 0) {
            await finalizeDownload();
        }

        notifySubscribers();
        console.log('[WaterQuality] Disconnected from serial device');
    }

    // ==================== SERIAL DATA PARSING ====================
    // Flexible parser: handles CSV, key-value, and common lab instrument formats.
    // The ALERT One's exact serial protocol isn't publicly documented, so we 
    // attempt multiple parse strategies and keep the raw log for debugging.

    function processSerialData(data) {
        state.rawSerialLog.push({ time: Date.now(), data: data });
        state.rawSerialBuffer += data;

        // Process complete lines
        const lines = state.rawSerialBuffer.split('\n');
        state.rawSerialBuffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
                processSerialLine(trimmed);
            }
        }

        notifySubscribers();
    }

    function processSerialLine(line) {
        // Skip empty lines and common header markers
        if (!line || line.startsWith('#') || line.startsWith('//')) return;

        // Strategy 1: CSV format (most common for lab instruments)
        // Expected columns: ID, DateTime, E.coli, TotalColiform, Enterococci, Temp, Calibration, Volume, RiskLevel
        if (line.includes(',') && !line.includes(':')) {
            return parseCSVLine(line);
        }

        // Strategy 2: Key-Value format (e.g., "E.coli: 150 CFU/100mL")
        if (line.includes(':') && !line.startsWith('{')) {
            return parseKeyValueLine(line);
        }

        // Strategy 3: JSON format
        if (line.startsWith('{')) {
            try {
                const obj = JSON.parse(line);
                return parseJSONRecord(obj);
            } catch (e) {
                // Not valid JSON, continue
            }
        }

        // Strategy 4: Tab-separated
        if (line.includes('\t')) {
            return parseTSVLine(line);
        }

        // Store as raw data for manual review
        console.log('[WaterQuality] Unparsed serial line:', line);
    }

    // CSV column header detection
    let csvHeaders = null;

    function parseCSVLine(line) {
        const fields = line.split(',').map(f => f.trim());

        // Detect header row
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('e.coli') || lowerLine.includes('ecoli') ||
            lowerLine.includes('coliform') || lowerLine.includes('sample') ||
            lowerLine.includes('date') || lowerLine.includes('time') ||
            lowerLine.includes('measurement') || lowerLine.includes('id')) {
            csvHeaders = fields.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
            return;
        }

        // Parse data row
        if (csvHeaders) {
            return parseCSVWithHeaders(fields);
        }

        // No headers detected - try positional parsing
        return parseCSVPositional(fields);
    }

    function parseCSVWithHeaders(fields) {
        const record = {};
        csvHeaders.forEach((header, i) => {
            if (i < fields.length) record[header] = fields[i];
        });

        const sample = {
            ecoli: extractNumeric(record.e_coli || record.ecoli || record.e_coli_cfu || record.ec),
            totalColiform: extractNumeric(record.total_coliform || record.tc || record.coliform || record.total_coliforms),
            enterococci: extractNumeric(record.enterococci || record.ent || record.enterococcus),
            temperature: extractNumeric(record.temp || record.temperature || record.water_temp),
            timestamp: parseFlexibleDate(record.date || record.datetime || record.date_time || record.time),
            calibration: record.calibration || record.calib || record.cal || null,
            volume: extractNumeric(record.volume || record.vol),
            riskLevel: record.risk || record.risk_level || record.level || null,
            deviceId: record.device || record.serial || record.device_id || null
        };

        if (sample.ecoli !== null || sample.totalColiform !== null || sample.enterococci !== null) {
            queueParsedSample(sample);
        }
    }

    function parseCSVPositional(fields) {
        // Common positional formats for lab instruments:
        // [ID, DateTime, Value, Unit, Temp, Status] or similar
        const sample = {};
        let foundValue = false;

        for (let i = 0; i < fields.length; i++) {
            const val = fields[i];
            const num = extractNumeric(val);

            // Try to detect date/time fields
            if (!sample.timestamp && parseFlexibleDate(val)) {
                sample.timestamp = parseFlexibleDate(val);
                continue;
            }

            // First numeric value is likely E. coli count
            if (num !== null && !foundValue) {
                sample.ecoli = num;
                foundValue = true;
                continue;
            }

            // Second numeric could be total coliform or temperature
            if (num !== null && foundValue && sample.totalColiform === undefined) {
                // If small number (< 50), likely temperature
                if (num < 50 && num > -10) {
                    sample.temperature = num;
                } else {
                    sample.totalColiform = num;
                }
            }
        }

        if (foundValue) {
            queueParsedSample(sample);
        }
    }

    function parseKeyValueLine(line) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        const keyLower = key.trim().toLowerCase();

        // Build up a pending sample from key-value pairs
        if (!state._pendingKV) state._pendingKV = {};

        if (keyLower.includes('e.coli') || keyLower.includes('ecoli') || keyLower === 'ec') {
            state._pendingKV.ecoli = extractNumeric(value);
        } else if (keyLower.includes('coliform') || keyLower === 'tc') {
            state._pendingKV.totalColiform = extractNumeric(value);
        } else if (keyLower.includes('enterococ') || keyLower === 'ent') {
            state._pendingKV.enterococci = extractNumeric(value);
        } else if (keyLower.includes('temp')) {
            state._pendingKV.temperature = extractNumeric(value);
        } else if (keyLower.includes('date') || keyLower.includes('time')) {
            state._pendingKV.timestamp = parseFlexibleDate(value);
        } else if (keyLower.includes('calib')) {
            state._pendingKV.calibration = value;
        } else if (keyLower.includes('volume') || keyLower === 'vol') {
            state._pendingKV.volume = extractNumeric(value);
        } else if (keyLower.includes('risk') || keyLower.includes('level')) {
            state._pendingKV.riskLevel = value;
        } else if (keyLower.includes('serial') || keyLower.includes('device')) {
            state._pendingKV.deviceId = value;
        }

        // If we have at least one measurement, check if record seems complete
        // (heuristic: after an empty line or after seeing a key that repeats)
        if (state._pendingKV.ecoli !== undefined || state._pendingKV.enterococci !== undefined) {
            // Use a debounce to batch key-value pairs into records
            clearTimeout(state._kvFlushTimeout);
            state._kvFlushTimeout = setTimeout(() => {
                if (state._pendingKV && (state._pendingKV.ecoli !== undefined || state._pendingKV.enterococci !== undefined)) {
                    queueParsedSample(state._pendingKV);
                    state._pendingKV = {};
                }
            }, 500);
        }
    }

    function parseJSONRecord(obj) {
        const sample = {
            ecoli: obj.ecoli ?? obj.e_coli ?? obj['E.coli'] ?? obj.ec ?? null,
            totalColiform: obj.totalColiform ?? obj.total_coliform ?? obj.tc ?? obj.coliform ?? null,
            enterococci: obj.enterococci ?? obj.ent ?? obj.enterococcus ?? null,
            temperature: obj.temperature ?? obj.temp ?? obj.water_temp ?? null,
            timestamp: parseFlexibleDate(obj.date || obj.datetime || obj.timestamp || obj.time),
            calibration: obj.calibration ?? obj.calib ?? null,
            volume: obj.volume ?? obj.vol ?? null,
            riskLevel: obj.risk ?? obj.risk_level ?? null,
            deviceId: obj.device ?? obj.serial ?? obj.device_id ?? null,
            fluorescence: obj.fluorescence ?? null,
            absorbance: obj.absorbance ?? null
        };

        if (sample.ecoli !== null || sample.totalColiform !== null || sample.enterococci !== null) {
            queueParsedSample(sample);
        }
    }

    function parseTSVLine(line) {
        // Convert to CSV and reuse CSV parser
        parseCSVLine(line.replace(/\t/g, ','));
    }

    // ==================== SAMPLE CREATION ====================

    function queueParsedSample(rawData) {
        const sample = createSample({
            ecoli: rawData.ecoli ?? null,
            totalColiform: rawData.totalColiform ?? null,
            enterococci: rawData.enterococci ?? null,
            temperature: rawData.temperature ?? null,
            timestamp: rawData.timestamp || Date.now(),
            calibration: rawData.calibration || null,
            volume: rawData.volume || null,
            deviceRiskLevel: rawData.riskLevel || null,
            deviceId: rawData.deviceId || null,
            fluorescence: rawData.fluorescence || null,
            absorbance: rawData.absorbance || null,
            source: 'serial'
        });

        state.currentDownload.push(sample);
        notifySubscribers();

        console.log('[WaterQuality] Parsed sample:', sample.id, 
            'E.coli:', sample.ecoli, 
            'TC:', sample.totalColiform,
            'Risk:', sample.interpretation.level);
    }

    function createSample(data) {
        const now = Date.now();

        // Get current GPS position if available
        let lat = data.lat || null;
        let lon = data.lon || null;
        if (!lat && typeof GPSModule !== 'undefined') {
            const pos = GPSModule.getPosition();
            if (pos && pos.lat && pos.lon) {
                lat = pos.lat;
                lon = pos.lon;
            }
        }

        const sample = {
            id: data.id || `wq_${now}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: data.timestamp || now,
            source: data.source || 'manual',      // 'serial', 'import', 'manual'

            // Measurements
            ecoli: data.ecoli ?? null,              // CFU/100mL
            totalColiform: data.totalColiform ?? null, // CFU/100mL  
            enterococci: data.enterococci ?? null,   // CFU/100mL

            // Metadata
            temperature: data.temperature ?? null,   // °C water sample temp
            calibration: data.calibration || null,
            volume: data.volume || null,             // mL
            deviceId: data.deviceId || null,
            deviceRiskLevel: data.deviceRiskLevel || null,

            // Curve data (if available)
            fluorescence: data.fluorescence || null,
            absorbance: data.absorbance || null,

            // Location
            lat: lat,
            lon: lon,
            locationName: data.locationName || null,

            // User notes
            notes: data.notes || '',
            waterType: data.waterType || 'freshwater', // 'freshwater', 'seawater', 'brackish', 'drinking'
            samplePoint: data.samplePoint || '',        // Description of sampling location

            // Interpretation (computed)
            interpretation: null
        };

        // Compute interpretation
        sample.interpretation = interpretSample(sample);

        return sample;
    }

    async function finalizeDownload() {
        const count = state.currentDownload.length;
        for (const sample of state.currentDownload) {
            await saveSample(sample);
        }
        state.currentDownload = [];

        if (count > 0) {
            console.log(`[WaterQuality] Saved ${count} samples from device download`);
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast(`💧 Downloaded ${count} water quality sample${count > 1 ? 's' : ''} from ALERT One`, 'success');
            }
            if (typeof Events !== 'undefined') {
                Events.emit('waterquality:download-complete', { count });
            }
        }
    }

    // ==================== SMART INTERPRETATION ENGINE ====================

    function interpretSample(sample) {
        const results = {};

        // Interpret against all applicable standards
        for (const [key, standard] of Object.entries(STANDARDS)) {
            const value = getParameterValue(sample, standard.parameter);
            if (value !== null) {
                results[key] = interpretAgainstStandard(value, standard);
            }
        }

        // Primary interpretation based on active standard
        const activeResult = results[state.activeStandard];

        // Emergency-specific smart analysis
        const emergency = results.emergency || interpretAgainstStandard(
            sample.ecoli ?? sample.enterococci ?? 0,
            STANDARDS.emergency
        );

        // Build composite assessment
        const assessment = buildAssessment(sample, results);

        return {
            // Primary result
            level: activeResult ? activeResult.level : emergency.level,
            label: activeResult ? activeResult.label : emergency.label,
            color: activeResult ? activeResult.color : emergency.color,
            description: activeResult ? activeResult.description : emergency.description,
            standard: state.activeStandard,

            // All standards
            allStandards: results,

            // Emergency assessment (always computed)
            emergency: emergency,

            // Smart assessment
            assessment: assessment,

            // Treatment recommendation
            treatment: getTreatmentRecommendation(sample, emergency),

            // Use advisories
            advisories: getUseAdvisories(sample, results)
        };
    }

    function getParameterValue(sample, parameter) {
        switch (parameter) {
            case 'ecoli': return sample.ecoli;
            case 'enterococci': return sample.enterococci;
            case 'total_coliform': return sample.totalColiform;
            default: return sample.ecoli; // Default to E. coli
        }
    }

    function interpretAgainstStandard(value, standard) {
        if (value === null || value === undefined) {
            return { level: 'unknown', label: 'No Data', color: '#6b7280', description: 'No measurement available' };
        }

        for (const threshold of standard.thresholds) {
            if (value <= threshold.max) {
                return {
                    level: threshold.level,
                    label: threshold.label,
                    color: threshold.color,
                    description: threshold.description,
                    value: value,
                    standardName: standard.name
                };
            }
        }

        // Should not reach here, but fallback
        const last = standard.thresholds[standard.thresholds.length - 1];
        return { level: last.level, label: last.label, color: last.color, description: last.description };
    }

    function buildAssessment(sample, results) {
        const parts = [];

        // E. coli assessment
        if (sample.ecoli !== null) {
            parts.push(`E. coli: ${formatCount(sample.ecoli)} CFU/100mL`);

            if (sample.ecoli === 0) {
                parts.push('No E. coli detected — water passes bacteriological safety test.');
            } else if (sample.ecoli <= 1) {
                parts.push('Trace E. coli detected. Low risk for healthy adults with intact immune systems.');
            } else if (sample.ecoli <= 10) {
                parts.push('Low-level contamination. Standard purification (boiling 1 min, chlorine, UV) adequate.');
            } else if (sample.ecoli <= 100) {
                parts.push('Moderate contamination. Multi-barrier treatment recommended (filter + disinfect).');
            } else if (sample.ecoli <= 1000) {
                parts.push('High contamination. NOT safe for consumption even with field treatment. Seek alternative source.');
            } else if (sample.ecoli <= 10000) {
                parts.push('Severe contamination indicating likely sewage or animal waste. Avoid all contact.');
            } else {
                parts.push('EXTREME contamination. Potential raw sewage. Evacuate if this is a primary water source.');
            }
        }

        // Total Coliform context
        if (sample.totalColiform !== null) {
            parts.push(`Total Coliforms: ${formatCount(sample.totalColiform)} CFU/100mL`);
            if (sample.totalColiform > 0 && (sample.ecoli === null || sample.ecoli === 0)) {
                parts.push('Coliforms present without E. coli may indicate environmental bacteria rather than fecal contamination.');
            }
            if (sample.ecoli !== null && sample.totalColiform > 0) {
                const ratio = sample.ecoli / sample.totalColiform;
                if (ratio > 0.5) {
                    parts.push(`High E. coli/TC ratio (${(ratio * 100).toFixed(0)}%) suggests recent fecal contamination.`);
                } else if (ratio < 0.1) {
                    parts.push('Low E. coli proportion suggests environmental or aging contamination source.');
                }
            }
        }

        // Enterococci assessment
        if (sample.enterococci !== null) {
            parts.push(`Enterococci: ${formatCount(sample.enterococci)} CFU/100mL`);
            if (sample.enterococci > 35) {
                parts.push('Enterococci above EPA marine recreational threshold (35 CFU/100mL).');
            }
        }

        // Temperature context
        if (sample.temperature !== null) {
            if (sample.temperature > 25) {
                parts.push(`Water temp ${sample.temperature}°C — warm conditions accelerate bacterial growth.`);
            } else if (sample.temperature < 4) {
                parts.push(`Water temp ${sample.temperature}°C — cold inhibits growth but bacteria survive.`);
            }
        }

        return parts.join(' ');
    }

    function getTreatmentRecommendation(sample, emergency) {
        const ecoli = sample.ecoli;
        if (ecoli === null) return null;

        if (ecoli === 0) {
            return {
                level: 'none',
                title: 'No Treatment Required',
                icon: '✅',
                steps: ['Water passes bacteriological test', 'Standard precaution: verify with additional samples if source is unknown']
            };
        }

        if (ecoli <= 10) {
            return {
                level: 'standard',
                title: 'Standard Field Treatment',
                icon: '💧',
                steps: [
                    'Option 1: Boil for 1 minute (3 min above 6,500 ft / 2,000 m)',
                    'Option 2: UV purifier (e.g., SteriPEN) — follow device instructions',
                    'Option 3: Chlorine dioxide tablets — wait 30 min (4 hrs if cold/turbid)',
                    'Option 4: Iodine treatment — 5 drops per liter, wait 30 min',
                    'Pre-filter through cloth if water is turbid'
                ]
            };
        }

        if (ecoli <= 100) {
            return {
                level: 'multi_barrier',
                title: 'Multi-Barrier Treatment Required',
                icon: '⚠️',
                steps: [
                    'Step 1: Let sediment settle or pre-filter (cloth, coffee filter)',
                    'Step 2: Filter through 0.2μm or better filter (Sawyer, LifeStraw, Katadyn)',
                    'Step 3: Chemical disinfection OR boil after filtering',
                    'Step 4: Allow treated water to sit 30 min before use',
                    'VERIFY: Re-test after treatment if possible'
                ]
            };
        }

        if (ecoli <= 1000) {
            return {
                level: 'avoid',
                title: 'Seek Alternative Source',
                icon: '🚫',
                steps: [
                    'Contamination too high for reliable field treatment',
                    'Seek alternative water source immediately',
                    'If NO alternative: coagulation/flocculation → filter → boil → chemical disinfect',
                    'Use for hygiene/washing only with extreme caution',
                    'Do NOT use for drinking, cooking, or wound care'
                ]
            };
        }

        return {
            level: 'hazardous',
            title: 'Do Not Use — Hazardous',
            icon: '☠️',
            steps: [
                'DO NOT use this water for any purpose',
                'Likely sewage or concentrated animal waste contamination',
                'Avoid skin contact — wash immediately if exposed',
                'Mark location as hazardous on map',
                'Evacuate area if this is the primary water source',
                'Report to emergency management if possible'
            ]
        };
    }

    function getUseAdvisories(sample, results) {
        const advisories = [];
        const ecoli = sample.ecoli;

        if (ecoli === null && sample.enterococci === null) {
            return [{ use: 'unknown', safe: null, note: 'No data — test before use' }];
        }

        const val = ecoli ?? sample.enterococci ?? 0;

        advisories.push({
            use: 'Drinking',
            icon: '🚰',
            safe: val === 0,
            conditional: val > 0 && val <= 10,
            note: val === 0 ? 'Safe' : val <= 10 ? 'After treatment' : 'NO'
        });

        advisories.push({
            use: 'Cooking',
            icon: '🍳',
            safe: val <= 10,
            conditional: val > 10 && val <= 100,
            note: val <= 10 ? 'Safe (boil anyway)' : val <= 100 ? 'Boil thoroughly' : 'NO'
        });

        advisories.push({
            use: 'Wound Care',
            icon: '🩹',
            safe: val === 0,
            conditional: false,
            note: val === 0 ? 'Safe (use sterile technique)' : 'NO — use sterile/bottled water'
        });

        advisories.push({
            use: 'Bathing',
            icon: '🚿',
            safe: val <= 126,
            conditional: val > 126 && val <= 500,
            note: val <= 126 ? 'Safe' : val <= 500 ? 'Brief rinse only' : 'Avoid contact'
        });

        advisories.push({
            use: 'Laundry',
            icon: '👕',
            safe: val <= 500,
            conditional: val > 500 && val <= 1000,
            note: val <= 500 ? 'Safe' : val <= 1000 ? 'Rinse with clean water after' : 'NO'
        });

        advisories.push({
            use: 'Irrigation',
            icon: '🌱',
            safe: val <= 1000,
            conditional: val > 1000 && val <= 10000,
            note: val <= 126 ? 'Safe (any crop)' : val <= 1000 ? 'Non-food crops only' : 'NO'
        });

        advisories.push({
            use: 'Pet/Animal',
            icon: '🐕',
            safe: val <= 235,
            conditional: val > 235 && val <= 1000,
            note: val <= 235 ? 'Safe' : val <= 1000 ? 'Short-term only' : 'NO'
        });

        return advisories;
    }

    // ==================== MANUAL ENTRY ====================

    async function addManualSample(data) {
        const sample = createSample({
            ...data,
            source: 'manual',
            timestamp: data.timestamp || Date.now()
        });

        await saveSample(sample);

        // Trigger alert if dangerous
        checkAlerts(sample);

        return sample;
    }

    // ==================== FILE IMPORT ====================

    async function importFile(file) {
        state.isImporting = true;
        notifySubscribers();

        try {
            const text = await file.text();
            const lines = text.split('\n');
            let imported = 0;

            // Reset CSV header detection
            csvHeaders = null;

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.length > 0) {
                    processSerialLine(trimmed);
                }
            }

            // Flush any pending KV records
            if (state._pendingKV && (state._pendingKV.ecoli !== undefined || state._pendingKV.enterococci !== undefined)) {
                queueParsedSample(state._pendingKV);
                state._pendingKV = {};
            }

            // Save all parsed samples
            for (const sample of state.currentDownload) {
                sample.source = 'import';
                await saveSample(sample);
                imported++;
            }
            state.currentDownload = [];

            state.isImporting = false;
            notifySubscribers();

            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast(`💧 Imported ${imported} sample${imported !== 1 ? 's' : ''} from file`, 'success');
            }

            return imported;

        } catch (e) {
            state.isImporting = false;
            notifySubscribers();
            throw e;
        }
    }

    // ==================== ALERTS ====================

    function checkAlerts(sample) {
        if (!state.alertsEnabled) return;

        const interp = sample.interpretation;
        if (!interp || !interp.emergency) return;

        const level = interp.emergency.level;

        if (level === 'contaminated' || level === 'hazardous') {
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast(
                    `⚠️ WATER HAZARD: ${interp.emergency.label} — ${formatCount(sample.ecoli || sample.enterococci || 0)} CFU/100mL`,
                    'error'
                );
            }

            if (typeof Events !== 'undefined') {
                Events.emit('waterquality:hazard', {
                    sample: sample,
                    level: level,
                    message: interp.emergency.description
                });
            }
        } else if (level === 'non_potable' || level === 'caution') {
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast(
                    `💧 Water Quality Alert: ${interp.emergency.label}`,
                    'warning'
                );
            }
        }
    }

    // ==================== MAP INTEGRATION ====================

    function getMapMarkers() {
        if (!state.showOnMap) return [];

        return state.samples
            .filter(s => s.lat && s.lon)
            .map(s => ({
                id: s.id,
                lat: s.lat,
                lon: s.lon,
                type: 'waterquality',
                color: s.interpretation ? s.interpretation.color : '#6b7280',
                label: s.interpretation ? s.interpretation.label : '?',
                value: s.ecoli ?? s.enterococci ?? s.totalColiform ?? null,
                timestamp: s.timestamp,
                icon: getMarkerIcon(s)
            }));
    }

    function getMarkerIcon(sample) {
        if (!sample.interpretation) return '💧';
        const level = sample.interpretation.emergency?.level || sample.interpretation.level;

        switch (level) {
            case 'potable':
            case 'safe':
            case 'excellent':
                return '💧';
            case 'treatable':
            case 'low':
                return '💧';
            case 'caution':
            case 'moderate':
            case 'advisory':
                return '⚠️';
            case 'non_potable':
            case 'high':
            case 'closure':
                return '🚫';
            case 'contaminated':
            case 'very_high':
                return '☢️';
            case 'hazardous':
            case 'unsafe':
                return '☠️';
            default:
                return '💧';
        }
    }

    /**
     * Render water quality markers on Canvas 2D map
     */
    function renderMapOverlay(ctx, project) {
        if (!state.showOnMap) return;
        if (!ctx || !project) return;

        const markers = getMapMarkers();

        for (const marker of markers) {
            const px = project(marker.lat, marker.lon);
            if (!px) continue;

            const x = px.x;
            const y = px.y;
            const color = marker.color;

            // Draw marker circle
            ctx.save();

            // Outer ring
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fillStyle = color + '33';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner dot
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Value label
            if (marker.value !== null) {
                ctx.font = '10px monospace';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                // Background for text
                const text = formatCount(marker.value);
                const metrics = ctx.measureText(text);
                const pad = 3;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(x - metrics.width / 2 - pad, y - 26, metrics.width + pad * 2, 14);

                ctx.fillStyle = color;
                ctx.fillText(text, x, y - 14);
            }

            ctx.restore();
        }
    }

    // ==================== TREND ANALYSIS ====================

    function getTrend(locationName, days = 30) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const samples = state.samples
            .filter(s => s.timestamp >= cutoff)
            .filter(s => !locationName || s.locationName === locationName || s.samplePoint === locationName)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (samples.length < 2) return null;

        const ecoliValues = samples.filter(s => s.ecoli !== null).map(s => s.ecoli);

        if (ecoliValues.length < 2) return null;

        // Calculate geometric mean (standard for water quality)
        const logValues = ecoliValues.filter(v => v > 0).map(v => Math.log(v));
        const geoMean = logValues.length > 0
            ? Math.exp(logValues.reduce((a, b) => a + b, 0) / logValues.length)
            : 0;

        // Trend direction
        const firstHalf = ecoliValues.slice(0, Math.floor(ecoliValues.length / 2));
        const secondHalf = ecoliValues.slice(Math.floor(ecoliValues.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        let direction = 'stable';
        if (secondAvg > firstAvg * 1.5) direction = 'worsening';
        else if (secondAvg < firstAvg * 0.67) direction = 'improving';

        return {
            sampleCount: samples.length,
            ecoliCount: ecoliValues.length,
            min: Math.min(...ecoliValues),
            max: Math.max(...ecoliValues),
            geometricMean: geoMean,
            latest: ecoliValues[ecoliValues.length - 1],
            direction: direction,
            samples: samples
        };
    }

    // ==================== DEMO MODE ====================

    function startDemo() {
        state.isDemoMode = true;

        // Generate realistic demo samples
        const demoSamples = [
            { ecoli: 0, totalColiform: 3, temperature: 12, locationName: 'Mountain Spring A', waterType: 'freshwater', samplePoint: 'Spring outlet', lat: 38.95, lon: -119.95, notes: 'Clear, fast-flowing spring' },
            { ecoli: 8, totalColiform: 45, temperature: 15, locationName: 'Creek Crossing B', waterType: 'freshwater', samplePoint: 'Downstream of trail crossing', lat: 38.94, lon: -119.93, notes: 'Moderate flow, slight turbidity' },
            { ecoli: 240, totalColiform: 890, temperature: 22, locationName: 'Pond C', waterType: 'freshwater', samplePoint: 'Stagnant pond near campsite', lat: 38.93, lon: -119.94, notes: 'Standing water, warm, algae visible' },
            { ecoli: 4500, totalColiform: 12000, temperature: 19, locationName: 'Drainage D', waterType: 'freshwater', samplePoint: 'Urban runoff channel', lat: 38.92, lon: -119.92, notes: 'Discolored water, sewage odor' },
            { ecoli: 45, totalColiform: 200, temperature: 18, locationName: 'River E', waterType: 'freshwater', samplePoint: 'Main channel above rapids', lat: 38.96, lon: -119.91, notes: 'Good flow, upstream of settlement' },
        ];

        const now = Date.now();
        demoSamples.forEach((data, i) => {
            const sample = createSample({
                ...data,
                source: 'demo',
                timestamp: now - (i * 4 * 60 * 60 * 1000) // 4 hours apart
            });
            state.samples.push(sample);
        });

        state.totalSamplesCollected = state.samples.length;
        notifySubscribers();

        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast('💧 Demo mode: 5 sample water quality readings loaded', 'info');
        }
    }

    function stopDemo() {
        state.isDemoMode = false;
        state.samples = state.samples.filter(s => s.source !== 'demo');
        state.totalSamplesCollected = state.samples.length;
        notifySubscribers();
    }

    // ==================== UTILITY FUNCTIONS ====================

    function extractNumeric(str) {
        if (str === null || str === undefined) return null;
        if (typeof str === 'number') return str;
        const cleaned = String(str).replace(/[^0-9.\-eE+]/g, '');
        if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    function parseFlexibleDate(str) {
        if (!str) return null;
        if (typeof str === 'number') return str;

        // Try ISO format
        let d = new Date(str);
        if (!isNaN(d.getTime())) return d.getTime();

        // Try common date formats: DD/MM/YYYY HH:MM, MM/DD/YYYY HH:MM, YYYY-MM-DD HH:MM
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/,  // YYYY-MM-DD HH:MM
            /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/,  // DD/MM/YYYY or MM/DD/YYYY
        ];

        for (const fmt of formats) {
            const m = String(str).match(fmt);
            if (m) {
                d = new Date(str);
                if (!isNaN(d.getTime())) return d.getTime();
            }
        }

        return null;
    }

    function formatCount(value) {
        if (value === null || value === undefined) return '—';
        if (value === 0) return '0';
        if (value < 1) return '<1';
        if (value >= 100000) return (value / 1000).toFixed(0) + 'K';
        if (value >= 10000) return (value / 1000).toFixed(1) + 'K';
        return Math.round(value).toLocaleString();
    }

    function formatTimestamp(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
               d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    function timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    }

    // ==================== EVENT SUBSCRIBERS ====================

    function subscribe(callback) {
        state.subscribers.push(callback);
        return () => {
            state.subscribers = state.subscribers.filter(cb => cb !== callback);
        };
    }

    function notifySubscribers() {
        for (const cb of state.subscribers) {
            try { cb(state); } catch (e) { console.error('[WaterQuality] Subscriber error:', e); }
        }
    }

    // ==================== EXPORT / REPORTING ====================

    function exportCSV() {
        const headers = ['ID', 'Date', 'Time', 'E.coli (CFU/100mL)', 'Total Coliform (CFU/100mL)',
            'Enterococci (CFU/100mL)', 'Temp (°C)', 'Risk Level', 'Standard', 'Lat', 'Lon',
            'Location', 'Water Type', 'Source', 'Notes'];

        const rows = state.samples.map(s => [
            s.id,
            new Date(s.timestamp).toLocaleDateString(),
            new Date(s.timestamp).toLocaleTimeString(),
            s.ecoli ?? '',
            s.totalColiform ?? '',
            s.enterococci ?? '',
            s.temperature ?? '',
            s.interpretation ? s.interpretation.label : '',
            s.interpretation ? s.interpretation.standard : '',
            s.lat ?? '',
            s.lon ?? '',
            s.locationName || s.samplePoint || '',
            s.waterType || '',
            s.source || '',
            (s.notes || '').replace(/,/g, ';')
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        return csv;
    }

    function downloadCSV() {
        const csv = exportCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `griddown_waterquality_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==================== PUBLIC API ====================

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        // Connection
        isSerialAvailable,
        connectSerial,
        disconnectSerial,
        isConnected: () => state.isConnected,
        isConnecting: () => state.isConnecting,
        isDownloading: () => state.isDownloading,

        // Data
        getSamples: () => [...state.samples],
        getSample: (id) => state.samples.find(s => s.id === id) || null,
        addManualSample,
        deleteSample,
        clearAllSamples,
        importFile,
        getDeviceInfo: () => state.deviceInfo,

        // Interpretation
        interpretSample,
        getStandards: () => STANDARDS,
        getActiveStandard: () => state.activeStandard,
        setActiveStandard: (key) => {
            if (STANDARDS[key]) {
                state.activeStandard = key;
                // Re-interpret all samples
                state.samples.forEach(s => { s.interpretation = interpretSample(s); });
                notifySubscribers();
            }
        },
        getTreatmentRecommendation,
        getUseAdvisories,

        // Analysis
        getTrend,
        getStats: () => ({
            totalSamples: state.samples.length,
            lastSampleTime: state.lastSampleTime,
            bySource: {
                serial: state.samples.filter(s => s.source === 'serial').length,
                import: state.samples.filter(s => s.source === 'import').length,
                manual: state.samples.filter(s => s.source === 'manual').length,
                demo: state.samples.filter(s => s.source === 'demo').length
            },
            geotagged: state.samples.filter(s => s.lat && s.lon).length
        }),

        // Map
        getMapMarkers,
        renderMapOverlay,
        isShowOnMap: () => state.showOnMap,
        setShowOnMap: (show) => { state.showOnMap = show; notifySubscribers(); },

        // Demo
        startDemo,
        stopDemo,
        isDemoMode: () => state.isDemoMode,

        // Export
        exportCSV,
        downloadCSV,

        // Config
        getDeviceConfig: () => DEVICE_CONFIG,
        getBaudRate: () => state.baudRate,
        setBaudRate: (rate) => { state.baudRate = rate; },
        isAlertsEnabled: () => state.alertsEnabled,
        setAlertsEnabled: (enabled) => { state.alertsEnabled = enabled; },

        // Events
        subscribe,

        // Formatting helpers (public for panel use)
        formatCount,
        formatTimestamp,
        timeAgo,

        // Serial debug
        getRawSerialLog: () => [...state.rawSerialLog],
        getCurrentDownload: () => [...state.currentDownload]
    };

})();
