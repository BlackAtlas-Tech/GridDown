/**
 * GridDown ↔ RF Sentinel Integration Gap Tests
 * Verifies all 8 fixes are structurally correct
 */

// Minimal mocks for testing module-level JS in Node
global.window = {};
global.document = { 
    head: { appendChild: () => {} },
    createElement: () => ({ style: {} }),
    getElementById: () => null 
};
global.console = { 
    log: () => {}, debug: () => {}, warn: () => {}, error: () => {} 
};
global.WebSocket = class { constructor() {} };
global.setTimeout = (fn) => fn;
global.clearTimeout = () => {};
global.setInterval = () => 1;
global.clearInterval = () => {};
global.Date = Date;
global.Math = Math;
global.JSON = JSON;
global.Map = Map;
global.Set = Set;
global.Array = Array;
global.Infinity = Infinity;
global.fetch = () => Promise.reject('no network');
global.AbortSignal = { timeout: () => {} };

// Mock Events module
global.Events = { emit: () => {}, on: () => {} };
global.EventManager = { createScopedManager: () => ({ clear: () => {} }), SCOPES: {} };
global.State = { get: () => [] };
global.Storage = { Settings: { get: () => null, set: () => {} } };
global.ModalsModule = { showToast: () => {}, showModal: () => {} };
global.MapModule = { render: () => {} };
global.Icons = { get: () => '' };

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, testName) {
    total++;
    if (condition) {
        passed++;
    } else {
        failed++;
        process.stdout.write(`  FAIL: ${testName}\n`);
    }
}

function test(name, fn) {
    process.stdout.write(`\n[TEST] ${name}\n`);
    try {
        fn();
    } catch (e) {
        failed++;
        total++;
        process.stdout.write(`  ERROR: ${e.message}\n`);
    }
}

// ============ Load Module Source (evaluate as IIFE returns) ============

const fs = require('fs');

// Load rfsentinel.js
const rfSrc = fs.readFileSync('/home/claude/griddown/js/modules/rfsentinel.js', 'utf8');
eval(rfSrc);  // Sets window.RFSentinelModule
const RFS = window.RFSentinelModule;

// ============ GAP 1: fisb_update WebSocket type ============
test('Gap 1: fisb_update WebSocket case exists', () => {
    const src = rfSrc;
    assert(src.includes("case 'fisb_update':"), 'fisb_update case in switch');
    assert(src.includes('handleFisBUpdate(message.data'), 'calls handleFisBUpdate');
});

// ============ GAP 2: weather_conditions WebSocket type ============
test('Gap 2: weather_conditions WebSocket case + state', () => {
    const src = rfSrc;
    assert(src.includes("case 'weather_conditions':"), 'weather_conditions case in switch');
    assert(src.includes('handleWeatherConditions(message.data'), 'calls handleWeatherConditions');
    assert(typeof RFS.getWeatherConditions === 'function', 'getWeatherConditions exported');
    assert(RFS.getWeatherConditions() === null, 'initially null');
});

// ============ GAP 3: Weather module FIS-B hooks ============
test('Gap 3: Weather module has RF Sentinel hooks', () => {
    const weatherSrc = fs.readFileSync('/home/claude/griddown/js/modules/weather.js', 'utf8');
    eval(weatherSrc);  // Sets window.WeatherModule
    const WM = window.WeatherModule;
    
    assert(typeof WM.handleRFSentinelWeather === 'function', 'handleRFSentinelWeather exported');
    assert(typeof WM.handleRFSentinelConditions === 'function', 'handleRFSentinelConditions exported');
    assert(typeof WM.getRFSentinelWeather === 'function', 'getRFSentinelWeather exported');
    assert(typeof WM.getRFSentinelConditions === 'function', 'getRFSentinelConditions exported');
    
    // Test data flow
    WM.handleRFSentinelWeather({
        metars: [{ station: 'KJFK', raw: 'METAR test' }],
        tafs: [],
        sigmets: [{ type: 'SIGMET', area: 'test' }],
        tfrs: [],
        pireps: [],
        lastUpdate: Date.now(),
        isStale: false
    });
    
    const fisb = WM.getRFSentinelWeather();
    assert(fisb !== null, 'FIS-B data stored');
    assert(fisb.metars.length === 1, 'METARs preserved');
    assert(fisb.sigmets.length === 1, 'SIGMETs preserved');
    
    WM.handleRFSentinelConditions({
        temperature_c: 22.5,
        humidity: 65,
        wind_speed_mps: 5.2,
        wind_direction: 270,
        pressure_hpa: 1013,
        conditions: 'Partly cloudy'
    });
    
    const cond = WM.getRFSentinelConditions();
    assert(cond !== null, 'Conditions stored');
    assert(cond.temperature_c === 22.5, 'Temperature preserved');
    assert(cond.wind_speed_mps === 5.2, 'Wind speed preserved');
});

// ============ GAP 4: hitTest and getTrackDetails ============
test('Gap 4: hitTest and getTrackDetails exist and exported', () => {
    assert(typeof RFS.hitTest === 'function', 'hitTest exported');
    assert(typeof RFS.getTrackDetails === 'function', 'getTrackDetails exported');
    
    // hitTest returns null when not connected
    const result = RFS.hitTest(100, 100, () => ({ x: 0, y: 0 }));
    assert(result === null, 'hitTest returns null when disconnected');
    
    // getTrackDetails handles null
    const details = RFS.getTrackDetails(null);
    assert(Array.isArray(details), 'getTrackDetails returns array');
    assert(details.length === 0, 'empty for null track');
    
    // getTrackDetails with aircraft
    const acDetails = RFS.getTrackDetails({
        type: 'aircraft',
        callsign: 'UAL123',
        icao: 'A1B2C3',
        squawk: '7700',
        lat: 37.5,
        lon: -122.0,
        altitude_m: 3048,
        speed_mps: 120,
        heading: 270,
        lastUpdate: Date.now()
    });
    assert(acDetails.length > 5, 'aircraft has multiple detail fields');
    assert(acDetails.some(d => d.label === 'Callsign' && d.value === 'UAL123'), 'callsign present');
    assert(acDetails.some(d => d.label === 'ICAO' && d.value === 'A1B2C3'), 'ICAO present');
    assert(acDetails.some(d => d.label === 'Squawk' && d.value.includes('EMERGENCY')), 'squawk 7700 flagged');
    assert(acDetails.some(d => d.label === 'Altitude'), 'altitude present');
    assert(acDetails.some(d => d.label === 'Speed'), 'speed present');
    assert(acDetails.some(d => d.label === 'Heading'), 'heading present');
    
    // getTrackDetails with ship
    const shipDetails = RFS.getTrackDetails({
        type: 'ship',
        name: 'MAERSK TITAN',
        mmsi: '123456789',
        ship_type: 'Cargo',
        destination: 'USNYC',
        lat: 40.0,
        lon: -74.0,
        lastUpdate: Date.now()
    });
    assert(shipDetails.some(d => d.label === 'MMSI'), 'ship MMSI present');
    assert(shipDetails.some(d => d.label === 'Ship Type'), 'ship type present');
    assert(shipDetails.some(d => d.label === 'Destination'), 'ship destination present');
    
    // getTrackDetails with drone
    const droneDetails = RFS.getTrackDetails({
        type: 'drone',
        operator_id: 'FA1234567',
        uas_id: 'SERIAL-XYZ',
        manufacturer: 'DJI',
        lat: 37.5,
        lon: -122.0,
        lastUpdate: Date.now()
    });
    assert(droneDetails.some(d => d.label === 'Operator ID'), 'drone operator present');
    assert(droneDetails.some(d => d.label === 'UAS ID'), 'drone UAS ID present');
    assert(droneDetails.some(d => d.label === 'Manufacturer'), 'drone manufacturer present');

    // Check map.js has the click handler
    const mapSrc = fs.readFileSync('/home/claude/griddown/js/modules/map.js', 'utf8');
    assert(mapSrc.includes('RFSentinelModule.hitTest(x, y, latLonToPixel)'), 'map calls hitTest');
    assert(mapSrc.includes('RFSentinelModule.getTrackDetails(hitTrack)'), 'map calls getTrackDetails');
    assert(mapSrc.includes("ModalsModule.showModal(title, bodyHtml)"), 'map shows modal on click');
});

// ============ GAP 5: Station location ============
test('Gap 5: Station location stored and rendered', () => {
    assert(typeof RFS.getStationLocation === 'function', 'getStationLocation exported');
    
    const src = rfSrc;
    assert(src.includes('state.stationLocation ='), 'handleLocationUpdate stores location');
    assert(src.includes('function renderStationMarker'), 'renderStationMarker function exists');
    assert(src.includes('renderStationMarker(ctx, width, height, latLonToPixel, zoom)'), 'renderOnMap calls renderStationMarker');
    assert(src.includes("'RF Sentinel'"), 'station label text exists');
});

// ============ GAP 6: Alerts routed to GridDown AlertModule ============
test('Gap 6: Alert bridging in app.js', () => {
    const appSrc = fs.readFileSync('/home/claude/griddown/js/app.js', 'utf8');
    
    // Emergency squawk → AlertModule
    assert(appSrc.includes("Events.on('rfsentinel:emergency:squawk'"), 'squawk listener exists');
    assert(appSrc.includes("AlertModule.trigger({") && appSrc.includes("source: 'rfsentinel'"), 'routes to AlertModule');
    assert(appSrc.includes("severity: info.severity === 'critical' ? 'emergency' : 'critical'"), 'maps severity');
    
    // AIS emergency → AlertModule
    assert(appSrc.includes("Events.on('rfsentinel:emergency:ais'"), 'AIS emergency listener exists');
    
    // General alerts → AlertModule
    assert(appSrc.includes("Events.on('rfsentinel:alert'"), 'general alert listener exists');
    
    // Correlation non-compliant → AlertModule
    assert(appSrc.includes("Events.on('rfsentinel:correlation:new'"), 'correlation listener exists');
    assert(appSrc.includes('Non-Compliant Drone Detected'), 'non-compliant drone alert message');
    
    // Weather bridges
    assert(appSrc.includes("Events.on('rfsentinel:weather:updated'"), 'FIS-B weather bridge exists');
    assert(appSrc.includes("Events.on('rfsentinel:weather:fisb'"), 'FIS-B specific bridge exists');
    assert(appSrc.includes("Events.on('rfsentinel:weather:conditions'"), 'conditions bridge exists');
    assert(appSrc.includes('WeatherModule.handleRFSentinelWeather('), 'calls handleRFSentinelWeather');
    assert(appSrc.includes('WeatherModule.handleRFSentinelConditions('), 'calls handleRFSentinelConditions');
});

// ============ GAP 8: Correlations stored ============
test('Gap 8: Correlations stored, rendered, and exported', () => {
    assert(typeof RFS.getCorrelations === 'function', 'getCorrelations exported');
    assert(typeof RFS.getCorrelationForTrack === 'function', 'getCorrelationForTrack exported');
    
    const src = rfSrc;
    assert(src.includes('state.correlations.set('), 'correlation_new stores data');
    assert(src.includes('state.correlations.delete('), 'correlation_lost removes data');
    assert(src.includes('function renderCorrelationLines'), 'renderCorrelationLines exists');
    assert(src.includes('renderCorrelationLines(ctx, latLonToPixel, now)'), 'renderOnMap calls renderCorrelationLines');
    assert(src.includes("ctx.setLineDash([4, 4])"), 'dashed lines for correlations');
});

// ============ GAP 9: fpv in disconnect reset ============
test('Gap 9: fpv included in trackCounts disconnect reset', () => {
    const src = rfSrc;
    // Find the disconnect reset line
    const resetMatch = src.match(/trackCounts\s*=\s*\{[^}]+\}/g);
    assert(resetMatch && resetMatch.length >= 1, 'trackCounts reset found');
    
    // All reset lines should include fpv
    const allHaveFpv = resetMatch.every(m => m.includes('fpv'));
    assert(allHaveFpv, 'all trackCounts resets include fpv');
});

// ============ MQTT ROUTING ============
test('MQTT: New topic subscriptions and routing', () => {
    const src = rfSrc;
    assert(src.includes("'rfsentinel/correlation/#'"), 'subscribes to correlation topics');
    assert(src.includes("'rfsentinel/status/#'"), 'subscribes to status topics');
    assert(src.includes("topic.startsWith('rfsentinel/correlation')"), 'routes correlation topics');
    assert(src.includes("topic.startsWith('rfsentinel/status')"), 'routes status topics');
    assert(src.includes("topic.includes('/conditions')"), 'differentiates weather/conditions');
    assert(src.includes('handleFisBUpdate(payload)'), 'MQTT routes to FIS-B handler');
    assert(src.includes('handleWeatherConditions(payload)'), 'MQTT routes to conditions handler');
    assert(src.includes('handleLocationUpdate(payload)'), 'MQTT routes location from status');
});

// ============ DISTANCE CALCULATION ============
test('Distance from station in track details', () => {
    const src = rfSrc;
    assert(src.includes('function haversineDistance'), 'haversine function exists');
    assert(src.includes('state.stationLocation && lat && lon'), 'checks station location for distance');
    assert(src.includes('haversineDistance('), 'calls haversine in getTrackDetails');
    assert(src.includes('distNm') && src.includes('distKm'), 'shows distance in nm and km');
});

// ============ RESULTS ============
process.stdout.write(`\n${'='.repeat(50)}\n`);
process.stdout.write(`Results: ${passed}/${total} passed`);
if (failed > 0) {
    process.stdout.write(`, ${failed} FAILED`);
}
process.stdout.write('\n');
process.exit(failed > 0 ? 1 : 0);
