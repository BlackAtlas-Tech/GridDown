#!/usr/bin/env node
/**
 * GridDown Critical Path Test Suite
 * 
 * Tests core utility functions, state management, and coordinate conversions
 * without requiring a browser environment.
 * 
 * Run: node tests/test-runner.js
 */

// ============================================================
// Test Framework
// ============================================================
// Protect test harness output from modules that replace console.log
const _testLog = console.log.bind(console);

let totalTests = 0, passed = 0, failed = 0, skipped = 0;
const failures = [];
const suiteResults = {};
let currentSuite = '';

function suite(name, fn) {
    currentSuite = name;
    suiteResults[name] = { total: 0, passed: 0, failed: 0 };
    _testLog(`\n  ${name}`);
    fn();
}

function test(name, fn) {
    totalTests++;
    suiteResults[currentSuite].total++;
    try {
        fn();
        passed++;
        suiteResults[currentSuite].passed++;
        _testLog(`    ✅ ${name}`);
    } catch (e) {
        failed++;
        suiteResults[currentSuite].failed++;
        const msg = e.message || String(e);
        failures.push({ suite: currentSuite, test: name, error: msg });
        _testLog(`    ❌ ${name}`);
        _testLog(`       ${msg}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertClose(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(message || `Expected ~${expected} ±${tolerance}, got ${actual}`);
    }
}

function assertThrows(fn, message) {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) throw new Error(message || 'Expected function to throw');
}

// ============================================================
// Minimal Browser Mocks
// ============================================================
global.window = {
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
};
global.navigator = { maxTouchPoints: 0 };
global.document = {
    createElement: (tag) => ({
        tagName: tag,
        className: '', innerHTML: '', textContent: '',
        style: {}, children: [],
        setAttribute: () => {},
        addEventListener: () => {},
        appendChild: function(c) { this.children.push(c); return c; },
    }),
    createTextNode: (t) => ({ nodeType: 3, textContent: t }),
    getElementById: () => null,
};
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
    removeItem(k) { delete this._data[k]; },
};

// ============================================================
// Load Modules (extract IIFE contents for Node)
// ============================================================
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function loadIIFE(filePath, moduleName) {
    const code = fs.readFileSync(path.join(root, filePath), 'utf8');
    // Wrap in a function that returns the module via the IIFE pattern
    const wrapped = `
        const window = global.window;
        const navigator = global.navigator;
        const document = global.document;
        const localStorage = global.localStorage;
        ${code}
        return ${moduleName};
    `;
    try {
        const fn = new Function(wrapped);
        return fn();
    } catch (e) {
        _testLog(`  ⚠️  Could not load ${filePath}: ${e.message.substring(0, 80)}`);
        return null;
    }
}

// Helpers must load first (dependency for others)
const Helpers = loadIIFE('js/utils/helpers.js', 'Helpers');

// Make Helpers available globally for Coordinates and State
global.Helpers = Helpers;

// Mock dependencies for Coordinates
global.Storage = { Settings: { set: () => {}, get: async () => null } };
global.Events = { emit: () => {} };

const Coordinates = loadIIFE('js/utils/coordinates.js', 'Coordinates');

// Mock dependencies for State
global.Constants = {
    SAMPLE_WAYPOINTS: [
        { id: 'wp1', name: 'Camp Alpha', lat: 37.7749, lon: -122.4194, type: 'camp' },
        { id: 'wp2', name: 'Water Source', lat: 37.7850, lon: -122.4094, type: 'water' },
    ],
    SAMPLE_ROUTES: [
        { id: 'rt1', name: 'Trail A', points: [], isBuilding: false },
    ],
    SAMPLE_TEAM: [],
};
global.Storage = {
    Settings: { set: () => {}, get: async () => null },
    Waypoints: { getAll: async () => [], saveAll: async () => {} },
    Routes: { getAll: async () => [], saveAll: async () => {} },
};
global.UndoModule = undefined;

const State = loadIIFE('js/core/state.js', 'State');

// ============================================================
// Test Suites
// ============================================================

_testLog('\n╔══════════════════════════════════════════╗');
_testLog('║   GridDown Critical Path Test Suite      ║');
_testLog('╚══════════════════════════════════════════╝');

// ---- HELPERS ----
if (Helpers) {
    suite('Helpers.escapeHtml', () => {
        test('escapes angle brackets', () => {
            assertEqual(Helpers.escapeHtml('<script>alert("xss")</script>'),
                '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        test('escapes ampersands', () => {
            assertEqual(Helpers.escapeHtml('a&b'), 'a&amp;b');
        });

        test('escapes single quotes', () => {
            assertEqual(Helpers.escapeHtml("it's"), "it&#39;s");
        });

        test('handles null', () => {
            assertEqual(Helpers.escapeHtml(null), '');
        });

        test('handles undefined', () => {
            assertEqual(Helpers.escapeHtml(undefined), '');
        });

        test('handles numbers', () => {
            assertEqual(Helpers.escapeHtml(42), '42');
        });

        test('handles empty string', () => {
            assertEqual(Helpers.escapeHtml(''), '');
        });

        test('preserves safe text', () => {
            assertEqual(Helpers.escapeHtml('hello world'), 'hello world');
        });

        test('handles mixed dangerous content', () => {
            const input = '<img onerror="alert(1)" src=x>';
            const result = Helpers.escapeHtml(input);
            assert(!result.includes('<'), 'Should not contain unescaped <');
            assert(!result.includes('>'), 'Should not contain unescaped >');
        });
    });

    suite('Helpers.formatDistance', () => {
        test('shows feet under 1 mile', () => {
            assertEqual(Helpers.formatDistance(0.5), '2640 ft');
        });

        test('shows miles over 1 mile', () => {
            assertEqual(Helpers.formatDistance(3.7), '3.7 mi');
        });

        test('shows 0 ft for 0 miles', () => {
            assertEqual(Helpers.formatDistance(0), '0 ft');
        });

        test('boundary at exactly 1 mile', () => {
            assertEqual(Helpers.formatDistance(1), '1.0 mi');
        });
    });

    suite('Helpers.formatDuration', () => {
        test('shows minutes under 1 hour', () => {
            assertEqual(Helpers.formatDuration(0.5), '30 min');
        });

        test('shows hours and minutes', () => {
            assertEqual(Helpers.formatDuration(2.5), '2h 30m');
        });

        test('shows 0 min for 0', () => {
            assertEqual(Helpers.formatDuration(0), '0 min');
        });
    });

    suite('Helpers.clamp', () => {
        test('clamps below minimum', () => {
            assertEqual(Helpers.clamp(2, 5, 10), 5);
        });

        test('clamps above maximum', () => {
            assertEqual(Helpers.clamp(15, 5, 10), 10);
        });

        test('passes through in range', () => {
            assertEqual(Helpers.clamp(7, 5, 10), 7);
        });

        test('handles equal min/max', () => {
            assertEqual(Helpers.clamp(7, 5, 5), 5);
        });

        test('handles negative range', () => {
            assertEqual(Helpers.clamp(-5, -10, -1), -5);
        });
    });

    suite('Helpers.calcDistance', () => {
        test('same point returns 0', () => {
            assertEqual(Helpers.calcDistance(37, -122, 37, -122), 0);
        });

        test('NY to LA approximately 2450 miles', () => {
            const dist = Helpers.calcDistance(40.7128, -74.0060, 34.0522, -118.2437);
            assertClose(dist, 2451, 10, `NY-LA distance: ${dist}`);
        });

        test('short distance accuracy (1 mile)', () => {
            // 1 degree latitude ≈ 69 miles
            const dist = Helpers.calcDistance(37, -122, 37.01449, -122);
            assertClose(dist, 1.0, 0.05, `1 mile test: ${dist}`);
        });

        test('equator to pole', () => {
            const dist = Helpers.calcDistance(0, 0, 90, 0);
            assertClose(dist, 6218, 20, `Equator to pole: ${dist}`);
        });
    });

    suite('Helpers.generateId', () => {
        test('generates unique IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) ids.add(Helpers.generateId());
            assertEqual(ids.size, 100);
        });

        test('IDs are non-empty strings', () => {
            const id = Helpers.generateId();
            assert(typeof id === 'string', 'Should be string');
            assert(id.length > 5, 'Should be reasonably long');
        });
    });
} else {
    _testLog('  ⚠️  Helpers module not loaded, skipping');
}

// ---- COORDINATES ----
if (Coordinates) {
    suite('Coordinates.parse - Decimal Degrees', () => {
        test('parses "37.7749, -122.4194"', () => {
            const r = Coordinates.parse('37.7749, -122.4194');
            assert(r !== null, 'Should parse');
            assertClose(r.lat, 37.7749, 0.0001);
            assertClose(r.lon, -122.4194, 0.0001);
        });

        test('parses "37.7749° N, 122.4194° W"', () => {
            const r = Coordinates.parse('37.7749° N, 122.4194° W');
            assert(r !== null, 'Should parse');
            assertClose(r.lat, 37.7749, 0.0001);
            assertClose(r.lon, -122.4194, 0.0001);
        });

        test('parses southern hemisphere "-33.8688, 151.2093"', () => {
            const r = Coordinates.parse('-33.8688, 151.2093');
            assertClose(r.lat, -33.8688, 0.0001);
            assertClose(r.lon, 151.2093, 0.0001);
        });

        test('rejects out of range latitude', () => {
            const r = Coordinates.parse('91.0, -122.0');
            assertEqual(r, null);
        });

        test('rejects out of range longitude', () => {
            const r = Coordinates.parse('37.0, -181.0');
            assertEqual(r, null);
        });

        test('rejects garbage', () => {
            assertEqual(Coordinates.parse('not coordinates'), null);
        });

        test('rejects empty string', () => {
            assertEqual(Coordinates.parse(''), null);
        });
    });

    suite('Coordinates.parse - DMS', () => {
        test('parses standard DMS', () => {
            const r = Coordinates.parse('37° 46\' 29.6" N, 122° 25\' 9.8" W');
            assert(r !== null, 'Should parse');
            assertClose(r.lat, 37.7749, 0.01);
            assertClose(r.lon, -122.4194, 0.01);
        });
    });

    suite('Coordinates.parse - DDM', () => {
        test('parses degrees decimal minutes', () => {
            const r = Coordinates.parse('37° 46.494\' N, 122° 25.164\' W');
            assert(r !== null, 'Should parse');
            assertClose(r.lat, 37.7749, 0.001);
            assertClose(r.lon, -122.4194, 0.001);
        });
    });

    suite('Coordinates.format - DD', () => {
        test('formats positive lat/lon', () => {
            const r = Coordinates.toDD(37.7749, -122.4194);
            assert(r.includes('N'), 'Should contain N');
            assert(r.includes('W'), 'Should contain W');
            assert(r.includes('37.7749'), 'Should contain lat');
        });

        test('formats southern hemisphere', () => {
            const r = Coordinates.toDD(-33.8688, 151.2093);
            assert(r.includes('S'), 'Should contain S');
            assert(r.includes('E'), 'Should contain E');
        });
    });

    suite('Coordinates.format - DMS', () => {
        test('formats to DMS', () => {
            const r = Coordinates.toDMS(37.7749, -122.4194);
            assert(r.includes('37°'), 'Should contain degrees');
            assert(r.includes('N'), 'Should contain N');
            assert(r.includes('W'), 'Should contain W');
        });
    });

    suite('Coordinates.format - UTM', () => {
        test('formats to UTM', () => {
            const r = Coordinates.toUTM(37.7749, -122.4194);
            assert(r.includes('10'), 'Should contain zone 10');
            assert(r.includes('S'), 'Should contain band letter S');
        });
    });

    suite('Coordinates.UTM roundtrip', () => {
        test('lat/lon → UTM → lat/lon', () => {
            const utm = Coordinates.latLonToUTM(37.7749, -122.4194);
            const back = Coordinates.utmToLatLon(utm.zone, utm.letter, utm.easting, utm.northing);
            assertClose(back.lat, 37.7749, 0.001, `Lat roundtrip: ${back.lat}`);
            assertClose(back.lon, -122.4194, 0.001, `Lon roundtrip: ${back.lon}`);
        });

        test('roundtrip across zones', () => {
            const coords = [
                [51.5074, -0.1278],    // London (zone 30)
                [-33.8688, 151.2093],  // Sydney (zone 56)
                [35.6762, 139.6503],   // Tokyo (zone 54)
            ];
            coords.forEach(([lat, lon]) => {
                const utm = Coordinates.latLonToUTM(lat, lon);
                const back = Coordinates.utmToLatLon(utm.zone, utm.letter, utm.easting, utm.northing);
                assertClose(back.lat, lat, 0.001, `${lat} roundtrip`);
                assertClose(back.lon, lon, 0.001, `${lon} roundtrip`);
            });
        });
    });

    suite('Coordinates.distance', () => {
        test('same point returns 0', () => {
            assertEqual(Coordinates.distance(37, -122, 37, -122), 0);
        });

        test('NY to LA', () => {
            const dist = Coordinates.distance(40.7128, -74.0060, 34.0522, -118.2437);
            assertClose(dist, 2451, 10);
        });
    });

    suite('Coordinates.bearing', () => {
        test('due north = 0°', () => {
            const b = Coordinates.bearing(37, -122, 38, -122);
            assertClose(b, 0, 1);
        });

        test('due east ≈ 90°', () => {
            const b = Coordinates.bearing(0, 0, 0, 1);
            assertClose(b, 90, 1);
        });

        test('due south = 180°', () => {
            const b = Coordinates.bearing(38, -122, 37, -122);
            assertClose(b, 180, 1);
        });

        test('due west ≈ 270°', () => {
            const b = Coordinates.bearing(0, 1, 0, 0);
            assertClose(b, 270, 1);
        });
    });

    suite('Coordinates.bearingToCompass', () => {
        test('0° = N', () => assertEqual(Coordinates.bearingToCompass(0), 'N'));
        test('90° = E', () => assertEqual(Coordinates.bearingToCompass(90), 'E'));
        test('180° = S', () => assertEqual(Coordinates.bearingToCompass(180), 'S'));
        test('270° = W', () => assertEqual(Coordinates.bearingToCompass(270), 'W'));
        test('45° = NE', () => assertEqual(Coordinates.bearingToCompass(45), 'NE'));
        test('225° = SW', () => assertEqual(Coordinates.bearingToCompass(225), 'SW'));
        test('360° wraps to N', () => assertEqual(Coordinates.bearingToCompass(360), 'N'));
    });

    suite('Coordinates.isValid', () => {
        test('valid DD returns true', () => {
            assert(Coordinates.isValid('37.7749, -122.4194'));
        });

        test('invalid returns false', () => {
            assert(!Coordinates.isValid('not a coord'));
        });
    });
} else {
    _testLog('  ⚠️  Coordinates module not loaded, skipping');
}

// ---- STATE ----
if (State) {
    suite('State.get / State.set', () => {
        test('get returns initial state', () => {
            const s = State.get();
            assert(s !== null, 'State should not be null');
            assert(Array.isArray(s.waypoints), 'waypoints should be array');
        });

        test('set by path updates value', () => {
            State.set('activePanel', 'test-panel');
            assertEqual(State.get('activePanel'), 'test-panel');
            State.set('activePanel', 'map'); // restore
        });

        test('set by object merges', () => {
            State.set({ isOffline: true });
            assertEqual(State.get('isOffline'), true);
            State.set({ isOffline: false }); // restore
        });

        test('get nested path', () => {
            State.set('mapLayers', { baseLayer: 'topo', overlays: [], terrain: true });
            assertEqual(State.get('mapLayers.baseLayer'), 'topo');
            assertEqual(State.get('mapLayers.terrain'), true);
        });

        test('get non-existent path returns undefined', () => {
            assertEqual(State.get('nonExistent.deep.path'), undefined);
        });
    });

    suite('State.subscribe', () => {
        test('subscriber fires on change', () => {
            let called = false;
            const unsub = State.subscribe(() => { called = true; });
            State.set('activePanel', 'subscribe-test');
            assert(called, 'Subscriber should have been called');
            unsub();
            State.set('activePanel', 'map');
        });

        test('unsubscribe stops notifications', () => {
            let count = 0;
            const unsub = State.subscribe(() => count++);
            State.set('activePanel', 'a');
            unsub();
            State.set('activePanel', 'b');
            assertEqual(count, 1, `Should fire once, fired ${count}`);
            State.set('activePanel', 'map');
        });

        test('filtered subscriber only fires for watched paths', () => {
            let called = false;
            const unsub = State.subscribe(() => { called = true; }, ['isOffline']);
            State.set('activePanel', 'filtered-test');
            assert(!called, 'Should not fire for unrelated path');
            State.set('isOffline', true);
            assert(called, 'Should fire for watched path');
            unsub();
            State.set('isOffline', false);
            State.set('activePanel', 'map');
        });
    });

    suite('State.Waypoints CRUD', () => {
        test('add waypoint', () => {
            const before = State.get('waypoints').length;
            const wp = { id: 'test-wp-1', name: 'Test WP', lat: 37, lon: -122, type: 'camp' };
            State.Waypoints.add(wp);
            assertEqual(State.get('waypoints').length, before + 1);
        });

        test('find added waypoint', () => {
            const wp = State.get('waypoints').find(w => w.id === 'test-wp-1');
            assert(wp !== undefined, 'Should find waypoint');
            assertEqual(wp.name, 'Test WP');
        });

        test('update waypoint', () => {
            State.Waypoints.update('test-wp-1', { name: 'Updated WP' });
            const wp = State.get('waypoints').find(w => w.id === 'test-wp-1');
            assertEqual(wp.name, 'Updated WP');
        });

        test('update preserves other fields', () => {
            const wp = State.get('waypoints').find(w => w.id === 'test-wp-1');
            assertEqual(wp.lat, 37);
            assertEqual(wp.type, 'camp');
        });

        test('update non-existent ID does nothing', () => {
            const before = JSON.stringify(State.get('waypoints'));
            State.Waypoints.update('non-existent-id', { name: 'nope' });
            assertEqual(JSON.stringify(State.get('waypoints')), before);
        });

        test('remove waypoint', () => {
            const before = State.get('waypoints').length;
            State.Waypoints.remove('test-wp-1');
            assertEqual(State.get('waypoints').length, before - 1);
            assertEqual(State.get('waypoints').find(w => w.id === 'test-wp-1'), undefined);
        });

        test('remove clears selection if selected', () => {
            const wp = { id: 'select-test', name: 'Select', lat: 0, lon: 0, type: 'camp' };
            State.Waypoints.add(wp);
            State.Waypoints.select(wp);
            assertEqual(State.get('selectedWaypoint').id, 'select-test');
            State.Waypoints.remove('select-test');
            assertEqual(State.get('selectedWaypoint'), null);
        });

        test('setAll replaces all waypoints', () => {
            const newWps = [{ id: 'bulk-1', name: 'Bulk 1' }, { id: 'bulk-2', name: 'Bulk 2' }];
            State.Waypoints.setAll(newWps);
            assertEqual(State.get('waypoints').length, 2);
            assertEqual(State.get('waypoints')[0].id, 'bulk-1');
            // Restore
            State.Waypoints.setAll(Constants.SAMPLE_WAYPOINTS);
        });
    });

    suite('State.Routes CRUD', () => {
        test('add route', () => {
            const before = State.get('routes').length;
            const route = { id: 'test-rt-1', name: 'Test Route', points: [], isBuilding: false };
            State.Routes.add(route);
            assertEqual(State.get('routes').length, before + 1);
        });

        test('update route', () => {
            State.Routes.update('test-rt-1', { name: 'Updated Route' });
            const rt = State.get('routes').find(r => r.id === 'test-rt-1');
            assertEqual(rt.name, 'Updated Route');
        });

        test('remove route', () => {
            const before = State.get('routes').length;
            State.Routes.remove('test-rt-1');
            assertEqual(State.get('routes').length, before - 1);
        });

        test('remove clears selection', () => {
            const rt = { id: 'rt-sel', name: 'Sel', points: [], isBuilding: false };
            State.Routes.add(rt);
            State.Routes.select(rt);
            assertEqual(State.get('selectedRoute').id, 'rt-sel');
            State.Routes.remove('rt-sel');
            assertEqual(State.get('selectedRoute'), null);
        });
    });

    suite('State.Map actions', () => {
        test('setZoom clamps to range', () => {
            State.Map.setZoom(3);
            assertEqual(State.get('zoom'), 5, 'Should clamp minimum to 5');
            State.Map.setZoom(25);
            assertEqual(State.get('zoom'), 18, 'Should clamp maximum to 18');
            State.Map.setZoom(12);
        });

        test('zoomIn increments', () => {
            State.Map.setZoom(10);
            State.Map.zoomIn();
            assertEqual(State.get('zoom'), 11);
            State.Map.setZoom(12);
        });

        test('zoomOut decrements', () => {
            State.Map.setZoom(10);
            State.Map.zoomOut();
            assertEqual(State.get('zoom'), 9);
            State.Map.setZoom(12);
        });

        test('zoomIn at max stays at max', () => {
            State.Map.setZoom(18);
            State.Map.zoomIn();
            assertEqual(State.get('zoom'), 18);
            State.Map.setZoom(12);
        });
    });

    suite('State.UI actions', () => {
        test('togglePanel toggles', () => {
            State.set('isPanelOpen', false);
            State.UI.togglePanel();
            assertEqual(State.get('isPanelOpen'), true);
            State.UI.togglePanel();
            assertEqual(State.get('isPanelOpen'), false);
        });

        test('openPanel / closePanel', () => {
            State.UI.openPanel();
            assertEqual(State.get('isPanelOpen'), true);
            State.UI.closePanel();
            assertEqual(State.get('isPanelOpen'), false);
        });

        test('setOffline', () => {
            State.UI.setOffline(true);
            assertEqual(State.get('isOffline'), true);
            State.UI.setOffline(false);
        });
    });

    suite('State.Modal', () => {
        test('open sets type and data', () => {
            State.Modal.open('waypoint', { id: 'test' });
            const modal = State.get('modal');
            assertEqual(modal.isOpen, true);
            assertEqual(modal.type, 'waypoint');
            assertEqual(modal.data.id, 'test');
        });

        test('close resets modal', () => {
            State.Modal.close();
            const modal = State.get('modal');
            assertEqual(modal.isOpen, false);
            assertEqual(modal.type, null);
            assertEqual(modal.data, null);
        });

        test('isOpen returns boolean', () => {
            assertEqual(State.Modal.isOpen(), false);
            State.Modal.open('test');
            assertEqual(State.Modal.isOpen(), true);
            State.Modal.close();
        });
    });

    suite('State.withoutHistory', () => {
        test('runs function without recording undo', () => {
            let undoCalled = false;
            global.UndoModule = {
                recordWaypointAdd: () => { undoCalled = true; },
                recordWaypointEdit: () => { undoCalled = true; },
                recordWaypointDelete: () => { undoCalled = true; },
                recordRouteAdd: () => { undoCalled = true; },
                recordRouteEdit: () => { undoCalled = true; },
                recordRouteDelete: () => { undoCalled = true; },
            };
            State.withoutHistory(() => {
                State.Waypoints.add({ id: 'no-undo', name: 'No Undo', lat: 0, lon: 0 });
            });
            assert(!undoCalled, 'Undo should not be called inside withoutHistory');
            // Clean up inside withoutHistory to avoid triggering undo on remove
            State.withoutHistory(() => {
                State.Waypoints.remove('no-undo');
            });
            global.UndoModule = undefined;
        });
    });
} else {
    _testLog('  ⚠️  State module not loaded, skipping');
}

// ============================================================
// ---- EVENTS ----
// ============================================================

const Events = loadIIFE('js/core/events.js', 'Events');
if (Events) {
    suite('Events.on / Events.emit', () => {
        test('listener receives emitted data', () => {
            let received = null;
            Events.on('test:basic', (d) => { received = d; });
            Events.emit('test:basic', { value: 42 });
            assertEqual(received.value, 42);
            Events.off('test:basic', () => {});
        });

        test('multiple listeners on same event', () => {
            let count = 0;
            const cb1 = () => count++;
            const cb2 = () => count++;
            Events.on('test:multi', cb1);
            Events.on('test:multi', cb2);
            Events.emit('test:multi');
            assertEqual(count, 2);
            Events.off('test:multi', cb1);
            Events.off('test:multi', cb2);
        });

        test('emitting unknown event does not throw', () => {
            Events.emit('nonexistent:event', { data: true });
            assert(true, 'Should not throw');
        });
    });

    suite('Events.off', () => {
        test('removes specific listener', () => {
            let called = false;
            const cb = () => { called = true; };
            Events.on('test:off', cb);
            Events.off('test:off', cb);
            Events.emit('test:off');
            assert(!called, 'Listener should not be called after off');
        });

        test('unsubscribe via return value', () => {
            let called = false;
            const unsub = Events.on('test:unsub', () => { called = true; });
            unsub();
            Events.emit('test:unsub');
            assert(!called, 'Listener should not be called after unsubscribe');
        });
    });

    suite('Events.once', () => {
        test('fires only once', () => {
            let count = 0;
            Events.once('test:once', () => { count++; });
            Events.emit('test:once');
            Events.emit('test:once');
            Events.emit('test:once');
            assertEqual(count, 1);
        });

        test('passes data on single fire', () => {
            let received = null;
            Events.once('test:once-data', (d) => { received = d; });
            Events.emit('test:once-data', 'hello');
            assertEqual(received, 'hello');
        });
    });
} else {
    _testLog('  ⚠️  Events module not loaded, skipping');
}

// ============================================================
// ---- LOG ----
// ============================================================

// Log needs window.location for resolveInitialLevel
global.window.location = { search: '' };
const Log = loadIIFE('js/core/log.js', 'Log');
if (Log) {
    suite('Log.setLevel / getLevel', () => {
        test('default level is warn', () => {
            Log.init();
            assertEqual(Log.getLevel(), 'warn');
        });

        test('setLevel changes current level', () => {
            Log.setLevel('debug', false);
            assertEqual(Log.getLevel(), 'debug');
            Log.setLevel('warn', false);
        });

        test('invalid level is rejected', () => {
            Log.setLevel('invalid_level', false);
            // Should still be warn (unchanged)
            assertEqual(Log.getLevel(), 'warn');
        });
    });

    suite('Log.getStats', () => {
        test('returns level and suppressed count', () => {
            Log.setLevel('warn', false);
            const stats = Log.getStats();
            assertEqual(stats.level, 'warn');
            assert(typeof stats.suppressed === 'number', 'Should have suppressed count');
            assert(Array.isArray(stats.levels), 'Should list available levels');
            assertEqual(stats.levels.length, 5);
        });
    });

    suite('Log.LEVELS', () => {
        test('has correct hierarchy', () => {
            assert(Log.LEVELS.error < Log.LEVELS.warn, 'error < warn');
            assert(Log.LEVELS.warn < Log.LEVELS.info, 'warn < info');
            assert(Log.LEVELS.info < Log.LEVELS.log, 'info < log');
            assert(Log.LEVELS.log < Log.LEVELS.debug, 'log < debug');
        });
    });

    suite('Log.restore', () => {
        test('restores original console methods', () => {
            Log.setLevel('error', false);
            Log.restore();
            // After restore, console.log should work (not be noop)
            assert(typeof console.log === 'function', 'console.log should be a function');
        });
    });
} else {
    _testLog('  ⚠️  Log module not loaded, skipping');
}

// ============================================================
// ---- ERROR BOUNDARY ----
// ============================================================

// ErrorBoundary needs window.addEventListener
global.window.addEventListener = global.window.addEventListener || function() {};
const ErrorBoundary = loadIIFE('js/core/error-boundary.js', 'ErrorBoundary');
if (ErrorBoundary) {
    suite('ErrorBoundary.getErrors / clear', () => {
        test('starts empty', () => {
            ErrorBoundary.clear();
            const errors = ErrorBoundary.getErrors();
            assertEqual(errors.length, 0);
        });

        test('clear empties the buffer', () => {
            ErrorBoundary.clear();
            assertEqual(ErrorBoundary.getErrors().length, 0);
        });
    });

    suite('ErrorBoundary.getStats', () => {
        test('returns stats object', () => {
            ErrorBoundary.clear();
            const stats = ErrorBoundary.getStats();
            assert(typeof stats.total === 'number', 'Should have total');
            assert(typeof stats.captured === 'number', 'Should have captured');
            assert(typeof stats.suppressed === 'number', 'Should have suppressed');
            assert(typeof stats.byType === 'object', 'Should have byType');
            assert(typeof stats.byModule === 'object', 'Should have byModule');
        });
    });

    suite('ErrorBoundary.onError', () => {
        test('returns unsubscribe function', () => {
            const unsub = ErrorBoundary.onError(() => {});
            assert(typeof unsub === 'function', 'Should return unsubscribe function');
            unsub();
        });

        test('non-function argument returns noop unsubscribe', () => {
            const unsub = ErrorBoundary.onError('not a function');
            assert(typeof unsub === 'function', 'Should still return a function');
            unsub();
        });
    });

    suite('ErrorBoundary.formatReport', () => {
        test('empty buffer returns no-errors message', () => {
            ErrorBoundary.clear();
            const report = ErrorBoundary.formatReport();
            assertEqual(report, 'No errors captured.');
        });
    });
} else {
    _testLog('  ⚠️  ErrorBoundary module not loaded, skipping');
}

// ============================================================
// ---- DECLINATION ----
// ============================================================

global.Events = global.Events || { on: () => () => {}, emit: () => {} };
global.MapModule = undefined;
const DeclinationModule = loadIIFE('js/modules/declination.js', 'DeclinationModule');
if (DeclinationModule) {
    suite('Declination.getDecimalYear', () => {
        test('Jan 1 2024 returns ~2024.0', () => {
            const result = DeclinationModule.getDecimalYear(new Date(2024, 0, 1));
            assertClose(result, 2024.0, 0.01);
        });

        test('Jul 1 2024 returns ~2024.5', () => {
            const result = DeclinationModule.getDecimalYear(new Date(2024, 6, 1));
            assertClose(result, 2024.5, 0.01);
        });

        test('Dec 31 2024 returns ~2024.999', () => {
            const result = DeclinationModule.getDecimalYear(new Date(2024, 11, 31));
            assertClose(result, 2025.0, 0.01);
        });
    });

    suite('Declination.trueToMagnetic', () => {
        test('east declination subtracts', () => {
            const result = DeclinationModule.trueToMagnetic(90, 10);
            assertEqual(result, 80);
        });

        test('west declination adds', () => {
            const result = DeclinationModule.trueToMagnetic(90, -10);
            assertEqual(result, 100);
        });

        test('normalizes past 360', () => {
            const result = DeclinationModule.trueToMagnetic(5, -20);
            assertEqual(result, 25);
        });

        test('normalizes below 0', () => {
            const result = DeclinationModule.trueToMagnetic(5, 20);
            assertEqual(result, 345);
        });
    });

    suite('Declination.magneticToTrue', () => {
        test('east declination adds', () => {
            const result = DeclinationModule.magneticToTrue(80, 10);
            assertEqual(result, 90);
        });

        test('inverse of trueToMagnetic', () => {
            const dec = 14.2;
            const trueBearing = 270;
            const magnetic = DeclinationModule.trueToMagnetic(trueBearing, dec);
            const backToTrue = DeclinationModule.magneticToTrue(magnetic, dec);
            assertClose(backToTrue, trueBearing, 0.001);
        });

        test('roundtrip with negative declination', () => {
            const dec = -7.5;
            const trueBearing = 45;
            const magnetic = DeclinationModule.trueToMagnetic(trueBearing, dec);
            const backToTrue = DeclinationModule.magneticToTrue(magnetic, dec);
            assertClose(backToTrue, trueBearing, 0.001);
        });
    });

    suite('Declination.formatDeclination', () => {
        test('positive is East', () => {
            assertEqual(DeclinationModule.formatDeclination(14.2), '14.2° E');
        });

        test('negative is West', () => {
            assertEqual(DeclinationModule.formatDeclination(-7.5), '7.5° W');
        });

        test('zero is East', () => {
            assertEqual(DeclinationModule.formatDeclination(0), '0.0° E');
        });

        test('null returns --', () => {
            assertEqual(DeclinationModule.formatDeclination(null), '--');
        });

        test('undefined returns --', () => {
            assertEqual(DeclinationModule.formatDeclination(undefined), '--');
        });
    });

    suite('Declination.formatInclination', () => {
        test('positive is Down', () => {
            const result = DeclinationModule.formatInclination(62.3);
            assertEqual(result, '62.3° Down');
        });

        test('negative is Up', () => {
            const result = DeclinationModule.formatInclination(-15.0);
            assertEqual(result, '15.0° Up');
        });

        test('null returns --', () => {
            assertEqual(DeclinationModule.formatInclination(null), '--');
        });
    });

    suite('Declination.calculate (WMM)', () => {
        test('returns valid structure', () => {
            const result = DeclinationModule.calculate(38.9, -77.0, 0, 2024.0);
            assert(typeof result.declination === 'number', 'Should have declination');
            assert(typeof result.inclination === 'number', 'Should have inclination');
            assert(typeof result.totalIntensity === 'number', 'Should have totalIntensity');
            assert(typeof result.horizontalIntensity === 'number', 'Should have horizontalIntensity');
            assert(!isNaN(result.declination), 'Declination should not be NaN');
        });

        test('different locations produce different declinations', () => {
            const dc = DeclinationModule.calculate(38.9, -77.0, 0, 2024.0);
            const tokyo = DeclinationModule.calculate(35.68, 139.69, 0, 2024.0);
            assert(dc.declination !== tokyo.declination, 'DC and Tokyo should differ');
        });

        test('getDeclination returns just the number', () => {
            const dec = DeclinationModule.getDeclination(37.77, -122.42);
            assert(typeof dec === 'number', 'Should return a number');
            assert(!isNaN(dec), 'Should not be NaN');
        });

        test('total intensity is positive', () => {
            const result = DeclinationModule.calculate(0, 0, 0, 2024.0);
            assert(result.totalIntensity > 0, 'Total intensity should be positive');
        });

        test('altitude affects result', () => {
            const ground = DeclinationModule.calculate(37.77, -122.42, 0, 2024.0);
            const high = DeclinationModule.calculate(37.77, -122.42, 100, 2024.0);
            assert(ground.totalIntensity !== high.totalIntensity, 'Altitude should affect intensity');
        });
    });

    suite('Declination.getModelInfo', () => {
        test('returns model metadata', () => {
            const info = DeclinationModule.getModelInfo();
            assert(typeof info.epoch === 'number', 'Should have epoch');
            assert(typeof info.validUntil === 'number', 'Should have validUntil');
            assert(typeof info.model === 'string', 'Should have model name');
        });
    });
} else {
    _testLog('  ⚠️  DeclinationModule not loaded, skipping');
}

// ============================================================
// ---- TERRAIN ----
// ============================================================

// Terrain uses fetch for elevation data but pure math functions work without it
global.fetch = global.fetch || (() => Promise.reject('No network'));
global.ElevationModule = undefined;
global.SunMoonModule = undefined;
const TerrainModule = loadIIFE('js/modules/terrain.js', 'TerrainModule');
if (TerrainModule) {
    suite('Terrain.haversineDistance', () => {
        test('same point returns 0', () => {
            const d = TerrainModule.haversineDistance(37.77, -122.42, 37.77, -122.42);
            assertEqual(d, 0);
        });

        test('NY to LA approximately correct', () => {
            const d = TerrainModule.haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
            const km = d / 1000;
            assertClose(km, 3944, 50, 'NY to LA ~3944 km');
        });

        test('short distance accuracy', () => {
            // 1 degree latitude ~111.32 km
            const d = TerrainModule.haversineDistance(0, 0, 1, 0);
            assertClose(d / 1000, 111.32, 0.5);
        });

        test('equator to pole', () => {
            const d = TerrainModule.haversineDistance(0, 0, 90, 0);
            assertClose(d / 1000, 10008, 10, 'Equator to pole ~10008 km');
        });
    });

    suite('Terrain.calculateBearing', () => {
        test('due north is 0', () => {
            const b = TerrainModule.calculateBearing(0, 0, 1, 0);
            assertClose(b, 0, 0.1);
        });

        test('due east is 90', () => {
            const b = TerrainModule.calculateBearing(0, 0, 0, 1);
            assertClose(b, 90, 0.1);
        });

        test('due south is 180', () => {
            const b = TerrainModule.calculateBearing(1, 0, 0, 0);
            assertClose(b, 180, 0.1);
        });

        test('due west is 270', () => {
            const b = TerrainModule.calculateBearing(0, 1, 0, 0);
            assertClose(b, 270, 0.1);
        });

        test('NE is ~45', () => {
            const b = TerrainModule.calculateBearing(0, 0, 1, 1);
            assertClose(b, 45, 1);
        });
    });

    suite('Terrain.destinationPoint', () => {
        test('1000m north returns higher latitude', () => {
            const result = TerrainModule.destinationPoint(37.77, -122.42, 1000, 0);
            assert(result.lat > 37.77, 'Latitude should increase going north');
            assertClose(result.lon, -122.42, 0.01, 'Longitude should stay ~same');
        });

        test('roundtrip: go north then south', () => {
            const mid = TerrainModule.destinationPoint(0, 0, 5000, 0);
            const back = TerrainModule.destinationPoint(mid.lat, mid.lon, 5000, 180);
            assertClose(back.lat, 0, 0.001, 'Should return near origin lat');
            assertClose(back.lon, 0, 0.001, 'Should return near origin lon');
        });

        test('going east increases longitude', () => {
            const result = TerrainModule.destinationPoint(0, 0, 10000, 90);
            assertClose(result.lat, 0, 0.01, 'Latitude should stay ~0');
            assert(result.lon > 0, 'Longitude should increase going east');
        });
    });

    suite('Terrain.getCardinalDirection', () => {
        test('0° is N', () => assertEqual(TerrainModule.getCardinalDirection(0), 'N'));
        test('45° is NE', () => assertEqual(TerrainModule.getCardinalDirection(45), 'NE'));
        test('90° is E', () => assertEqual(TerrainModule.getCardinalDirection(90), 'E'));
        test('135° is SE', () => assertEqual(TerrainModule.getCardinalDirection(135), 'SE'));
        test('180° is S', () => assertEqual(TerrainModule.getCardinalDirection(180), 'S'));
        test('225° is SW', () => assertEqual(TerrainModule.getCardinalDirection(225), 'SW'));
        test('270° is W', () => assertEqual(TerrainModule.getCardinalDirection(270), 'W'));
        test('315° is NW', () => assertEqual(TerrainModule.getCardinalDirection(315), 'NW'));
        test('360° is N', () => assertEqual(TerrainModule.getCardinalDirection(360), 'N'));
    });

    suite('Terrain.calculateSlope', () => {
        test('flat terrain returns 0', () => {
            const slope = TerrainModule.calculateSlope(
                { lat: 0, lon: 0, elevation: 100 },
                { lat: 0.001, lon: 0, elevation: 100 }
            );
            assertClose(slope, 0, 0.1);
        });

        test('uphill produces positive slope', () => {
            const slope = TerrainModule.calculateSlope(
                { lat: 0, lon: 0, elevation: 0 },
                { lat: 0.001, lon: 0, elevation: 50 }
            );
            assert(slope > 0, 'Slope should be positive');
            assert(slope < 90, 'Slope should be less than 90°');
        });

        test('same point returns 0', () => {
            const slope = TerrainModule.calculateSlope(
                { lat: 37.77, lon: -122.42, elevation: 100 },
                { lat: 37.77, lon: -122.42, elevation: 200 }
            );
            assertEqual(slope, 0);
        });

        test('steep slope is large', () => {
            // ~111m horizontal, 100m vertical = ~42°
            const slope = TerrainModule.calculateSlope(
                { lat: 0, lon: 0, elevation: 0 },
                { lat: 0.001, lon: 0, elevation: 100 }
            );
            assertClose(slope, 42, 5, 'Should be around 42°');
        });
    });

    suite('Terrain.classifySlope', () => {
        test('0° is flat', () => assertEqual(TerrainModule.classifySlope(0), 'flat'));
        test('3° is flat', () => assertEqual(TerrainModule.classifySlope(3), 'flat'));
        test('10° is gentle', () => assertEqual(TerrainModule.classifySlope(10), 'gentle'));
        test('20° is moderate', () => assertEqual(TerrainModule.classifySlope(20), 'moderate'));
        test('30° is steep', () => assertEqual(TerrainModule.classifySlope(30), 'steep'));
        test('40° is verysteep', () => assertEqual(TerrainModule.classifySlope(40), 'verysteep'));
        test('60° is cliff', () => assertEqual(TerrainModule.classifySlope(60), 'cliff'));
        test('negative slope uses absolute value', () => assertEqual(TerrainModule.classifySlope(-20), 'moderate'));
    });

    suite('Terrain.assessTrafficability', () => {
        test('5° is easy for foot', () => assertEqual(TerrainModule.assessTrafficability(5, 'foot'), 'easy'));
        test('20° is moderate for foot', () => assertEqual(TerrainModule.assessTrafficability(20, 'foot'), 'moderate'));
        test('30° is difficult for foot', () => assertEqual(TerrainModule.assessTrafficability(30, 'foot'), 'difficult'));
        test('40° is extreme for foot', () => assertEqual(TerrainModule.assessTrafficability(40, 'foot'), 'extreme'));

        test('5° is easy for vehicle_4x4', () => assertEqual(TerrainModule.assessTrafficability(5, 'vehicle_4x4'), 'easy'));
        test('25° is difficult for vehicle_4x4', () => assertEqual(TerrainModule.assessTrafficability(25, 'vehicle_4x4'), 'difficult'));
        test('40° is impassable for vehicle_4x4', () => assertEqual(TerrainModule.assessTrafficability(40, 'vehicle_4x4'), 'impassable'));

        test('3° is easy for vehicle_standard', () => assertEqual(TerrainModule.assessTrafficability(3, 'vehicle_standard'), 'easy'));
        test('8° is moderate for vehicle_standard', () => assertEqual(TerrainModule.assessTrafficability(8, 'vehicle_standard'), 'moderate'));
        test('12° is difficult for vehicle_standard', () => assertEqual(TerrainModule.assessTrafficability(12, 'vehicle_standard'), 'difficult'));
        test('25° is impassable for vehicle_standard', () => assertEqual(TerrainModule.assessTrafficability(25, 'vehicle_standard'), 'impassable'));

        test('unknown mode returns unknown', () => assertEqual(TerrainModule.assessTrafficability(10, 'submarine'), 'unknown'));
    });
} else {
    _testLog('  ⚠️  TerrainModule not loaded, skipping');
}

// ============================================================
// ---- HIKING ----
// ============================================================

global.GPSModule = undefined;
const HikingModule = loadIIFE('js/modules/hiking.js', 'HikingModule');
if (HikingModule) {
    suite('Hiking.formatDuration', () => {
        test('0 hours returns 0m', () => assertEqual(HikingModule.formatDuration(0), '0m'));
        test('0.5 hours returns 30m', () => assertEqual(HikingModule.formatDuration(0.5), '30m'));
        test('1.0 hours returns 1h', () => assertEqual(HikingModule.formatDuration(1.0), '1h'));
        test('1.5 hours returns 1h 30m', () => assertEqual(HikingModule.formatDuration(1.5), '1h 30m'));
        test('2.75 hours returns 2h 45m', () => assertEqual(HikingModule.formatDuration(2.75), '2h 45m'));
        test('null returns --', () => assertEqual(HikingModule.formatDuration(null), '--'));
        test('NaN returns --', () => assertEqual(HikingModule.formatDuration(NaN), '--'));
    });

    suite('Hiking.formatTimeFromHours', () => {
        test('0 hours is 12:00 AM', () => assertEqual(HikingModule.formatTimeFromHours(0), '12:00 AM'));
        test('6.5 hours is 6:30 AM', () => assertEqual(HikingModule.formatTimeFromHours(6.5), '6:30 AM'));
        test('12.0 hours is 12:00 PM', () => assertEqual(HikingModule.formatTimeFromHours(12.0), '12:00 PM'));
        test('13.25 hours is 1:15 PM', () => assertEqual(HikingModule.formatTimeFromHours(13.25), '1:15 PM'));
        test('23.0 hours is 11:00 PM', () => assertEqual(HikingModule.formatTimeFromHours(23.0), '11:00 PM'));
        test('null returns --:--', () => assertEqual(HikingModule.formatTimeFromHours(null), '--:--'));
        test('NaN returns --:--', () => assertEqual(HikingModule.formatTimeFromHours(NaN), '--:--'));
    });

    suite('Hiking.calculateNaismith', () => {
        test('flat 5 miles at 2.5 mph = 2h', () => {
            const result = HikingModule.calculateNaismith(5, 0, 0, 2.5);
            assertClose(result.totalHours, 2.0, 0.01);
            assertEqual(result.method, 'naismith');
        });

        test('flat 10 miles at 3.0 mph = 3.33h', () => {
            const result = HikingModule.calculateNaismith(10, 0, 0, 3.0);
            assertClose(result.totalHours, 3.33, 0.05);
        });

        test('2000ft gain adds ~1h at moderate pace', () => {
            const flat = HikingModule.calculateNaismith(5, 0, 0, 2.5);
            const climb = HikingModule.calculateNaismith(5, 2000, 0, 2.5);
            const addedTime = climb.totalHours - flat.totalHours;
            assertClose(addedTime, 1.0, 0.2, 'Should add ~1h for 2000ft gain');
        });

        test('descent with >500ft adds time', () => {
            const flat = HikingModule.calculateNaismith(5, 0, 0, 2.5);
            const down = HikingModule.calculateNaismith(5, 0, 1000, 2.5);
            assert(down.totalHours > flat.totalHours, 'Descent should add some time');
        });

        test('ascent time is returned separately', () => {
            const result = HikingModule.calculateNaismith(5, 2000, 0, 2.5);
            assert(result.ascentTimeHours > 0, 'Should have ascent time');
            assert(result.baseTimeHours > 0, 'Should have base time');
        });
    });

    suite('Hiking.calculateTobler', () => {
        test('flat terrain returns distance/speed', () => {
            const result = HikingModule.calculateTobler(5, 0, 0, 2.5);
            assertClose(result.totalHours, 2.0, 0.01);
            assertEqual(result.method, 'tobler');
        });

        test('elevation gain slows estimated time', () => {
            const flat = HikingModule.calculateTobler(5, 0, 0, 2.5);
            const climb = HikingModule.calculateTobler(5, 3000, 0, 2.5);
            assert(climb.totalHours > flat.totalHours, 'Climb should be slower');
        });

        test('returns average speed', () => {
            const result = HikingModule.calculateTobler(5, 1000, 500, 2.5);
            assert(typeof result.averageSpeedMph === 'number', 'Should have averageSpeedMph');
            assert(result.averageSpeedMph > 0, 'Speed should be positive');
            assert(result.averageSpeedMph < 10, 'Speed should be reasonable');
        });
    });

    suite('Hiking.estimateHikingTime', () => {
        test('combines Naismith and Tobler', () => {
            const result = HikingModule.estimateHikingTime(5, 1000, 500, { flatSpeedMph: 2.5, includeRestStops: false });
            assert(result.naismith !== undefined, 'Should include naismith');
            assert(result.tobler !== undefined, 'Should include tobler');
            // Moving time should be average of both methods
            const avg = (result.naismith.totalHours + result.tobler.totalHours) / 2;
            assertClose(result.movingTimeHours, avg, 0.01);
        });

        test('includes rest stops when enabled', () => {
            const withRest = HikingModule.estimateHikingTime(10, 2000, 1000, { flatSpeedMph: 2.5, includeRestStops: true });
            const withoutRest = HikingModule.estimateHikingTime(10, 2000, 1000, { flatSpeedMph: 2.5, includeRestStops: false });
            assert(withRest.totalTimeHours >= withoutRest.totalTimeHours, 'Should be longer with rest stops');
            assert(withRest.restStops >= 0, 'Should have rest stop count');
        });

        test('formatted output included', () => {
            const result = HikingModule.estimateHikingTime(5, 1000, 0, { flatSpeedMph: 2.5 });
            assert(typeof result.formatted.movingTime === 'string', 'Should have formatted moving time');
            assert(typeof result.formatted.totalTime === 'string', 'Should have formatted total time');
            assert(typeof result.formatted.pace === 'string', 'Should have formatted pace');
        });

        test('short hike has no rest stops', () => {
            const result = HikingModule.estimateHikingTime(1, 0, 0, { flatSpeedMph: 3.0, includeRestStops: true });
            assertEqual(result.restStops, 0);
        });
    });

    suite('Hiking.PACE_PRESETS', () => {
        test('has expected presets', () => {
            assert(HikingModule.PACE_PRESETS.slow !== undefined, 'Should have slow');
            assert(HikingModule.PACE_PRESETS.moderate !== undefined, 'Should have moderate');
            assert(HikingModule.PACE_PRESETS.fast !== undefined, 'Should have fast');
            assert(HikingModule.PACE_PRESETS.trail_runner !== undefined, 'Should have trail_runner');
        });

        test('speeds are in ascending order', () => {
            const p = HikingModule.PACE_PRESETS;
            assert(p.slow.flatSpeed < p.moderate.flatSpeed, 'slow < moderate');
            assert(p.moderate.flatSpeed < p.fast.flatSpeed, 'moderate < fast');
            assert(p.fast.flatSpeed < p.trail_runner.flatSpeed, 'fast < trail_runner');
        });
    });
} else {
    _testLog('  ⚠️  HikingModule not loaded, skipping');
}

// ============================================================
// ---- RADIO ----
// ============================================================

const RadioModule = loadIIFE('js/modules/radio.js', 'RadioModule');
if (RadioModule) {
    suite('Radio.formatFreq', () => {
        test('formats to 4 decimal places by default', () => {
            assertEqual(RadioModule.formatFreq(462.5625), '462.5625');
        });

        test('pads with zeros', () => {
            assertEqual(RadioModule.formatFreq(146.52), '146.5200');
        });

        test('custom decimal places', () => {
            assertEqual(RadioModule.formatFreq(462.5625, 2), '462.56');
        });

        test('handles string input', () => {
            assertEqual(RadioModule.formatFreq('146.520', 3), '146.520');
        });
    });

    suite('Radio.calcRepeaterInput', () => {
        test('positive offset', () => {
            const input = RadioModule.calcRepeaterInput(146.94, 0.6);
            assertClose(input, 147.54, 0.001);
        });

        test('negative offset', () => {
            const input = RadioModule.calcRepeaterInput(146.94, -0.6);
            assertClose(input, 146.34, 0.001);
        });

        test('UHF 5 MHz offset', () => {
            const input = RadioModule.calcRepeaterInput(443.0, 5.0);
            assertClose(input, 448.0, 0.001);
        });
    });

    suite('Radio.FRS_CHANNELS', () => {
        test('has 22 channels', () => {
            assertEqual(RadioModule.FRS_CHANNELS.length, 22);
        });

        test('channel 1 is 462.5625 MHz', () => {
            assertClose(RadioModule.FRS_CHANNELS[0].freq, 462.5625, 0.001);
        });

        test('all channels have freq property', () => {
            RadioModule.FRS_CHANNELS.forEach(ch => {
                assert(typeof ch.freq === 'number', `Channel ${ch.channel} should have freq`);
            });
        });
    });

    suite('Radio.EMERGENCY_FREQUENCIES', () => {
        test('exists and is non-empty', () => {
            assert(Array.isArray(RadioModule.EMERGENCY_FREQUENCIES), 'Should be array');
            assert(RadioModule.EMERGENCY_FREQUENCIES.length > 0, 'Should have entries');
        });

        test('includes 121.5 MHz', () => {
            const found = RadioModule.EMERGENCY_FREQUENCIES.some(f => Math.abs(f.freq - 121.5) < 0.01);
            assert(found, 'Should include aviation distress 121.5 MHz');
        });
    });

    suite('Radio.getByCategory', () => {
        test('frs returns FRS channels', () => {
            const result = RadioModule.getByCategory('frs');
            assertEqual(result.length, 22);
        });

        test('unknown category returns empty array', () => {
            const result = RadioModule.getByCategory('nonexistent');
            assertEqual(result.length, 0);
        });

        test('emergency returns emergency frequencies', () => {
            const result = RadioModule.getByCategory('emergency');
            assert(result.length > 0, 'Should have emergency frequencies');
        });
    });

    suite('Radio.searchAll', () => {
        test('finds FRS channels by frequency', () => {
            const results = RadioModule.searchAll('462.5625');
            assert(results.length > 0, 'Should find FRS channel 1');
        });

        test('finds by name/notes content', () => {
            const results = RadioModule.searchAll('emergency');
            assert(results.length > 0, 'Should find emergency-related frequencies');
        });

        test('empty query returns nothing', () => {
            const results = RadioModule.searchAll('zzz_nonexistent_xyz');
            assertEqual(results.length, 0);
        });

        test('results include _category field', () => {
            const results = RadioModule.searchAll('462');
            results.forEach(r => {
                assert(typeof r._category === 'string', 'Should have _category');
            });
        });
    });

    suite('Radio.CTCSS_TONES', () => {
        test('exists and has standard tones', () => {
            assert(Array.isArray(RadioModule.CTCSS_TONES), 'Should be array');
            assert(RadioModule.CTCSS_TONES.length >= 38, 'Should have at least 38 standard tones');
        });
    });
} else {
    _testLog('  ⚠️  RadioModule not loaded, skipping');
}

// ============================================================
// ---- WEATHER ----
// ============================================================

global.fetch = global.fetch || (() => Promise.reject('No network'));
const WeatherModule = loadIIFE('js/modules/weather.js', 'WeatherModule');
if (WeatherModule) {
    suite('Weather.windDirectionToCardinal', () => {
        test('0° is N', () => assertEqual(WeatherModule.windDirectionToCardinal(0), 'N'));
        test('90° is E', () => assertEqual(WeatherModule.windDirectionToCardinal(90), 'E'));
        test('180° is S', () => assertEqual(WeatherModule.windDirectionToCardinal(180), 'S'));
        test('270° is W', () => assertEqual(WeatherModule.windDirectionToCardinal(270), 'W'));
        test('45° is NE', () => assertEqual(WeatherModule.windDirectionToCardinal(45), 'NE'));
        test('225° is SW', () => assertEqual(WeatherModule.windDirectionToCardinal(225), 'SW'));
        test('360° wraps to N', () => assertEqual(WeatherModule.windDirectionToCardinal(360), 'N'));
        test('350° rounds to N', () => assertEqual(WeatherModule.windDirectionToCardinal(350), 'N'));
        test('null returns --', () => assertEqual(WeatherModule.windDirectionToCardinal(null), '--'));
        test('NaN returns --', () => assertEqual(WeatherModule.windDirectionToCardinal(NaN), '--'));
        test('negative normalizes', () => assertEqual(WeatherModule.windDirectionToCardinal(-90), 'W'));
    });

    suite('Weather.getBeaufortScale', () => {
        test('0 mph is calm', () => assertEqual(WeatherModule.getBeaufortScale(0).scale, 0));
        test('5 mph is light breeze', () => assertEqual(WeatherModule.getBeaufortScale(5).scale, 2));
        test('15 mph is moderate breeze', () => assertEqual(WeatherModule.getBeaufortScale(15).scale, 4));
        test('35 mph is high wind', () => assertEqual(WeatherModule.getBeaufortScale(35).scale, 7));
        test('50 mph is strong gale', () => assertEqual(WeatherModule.getBeaufortScale(50).scale, 9));
        test('75 mph is hurricane', () => assertEqual(WeatherModule.getBeaufortScale(75).scale, 12));
        test('returns label string', () => {
            assert(typeof WeatherModule.getBeaufortScale(10).label === 'string', 'Should have label');
        });
        test('returns color string', () => {
            assert(WeatherModule.getBeaufortScale(10).color.startsWith('#'), 'Should be hex color');
        });
    });

    suite('Weather.calcDewpoint', () => {
        test('100% humidity means dewpoint equals temp', () => {
            const dp = WeatherModule.calcDewpoint(70, 100);
            assertClose(dp, 70, 0.5, 'At 100% RH, dewpoint = temp');
        });

        test('50% humidity gives lower dewpoint', () => {
            const dp = WeatherModule.calcDewpoint(80, 50);
            assert(dp < 80, 'Dewpoint should be below temp');
            assert(dp > 50, 'Dewpoint should be reasonable');
        });

        test('low humidity gives much lower dewpoint', () => {
            const dp = WeatherModule.calcDewpoint(90, 20);
            assert(dp < 60, 'Dewpoint should be well below temp at low humidity');
        });

        test('null temp returns null', () => {
            assertEqual(WeatherModule.calcDewpoint(null, 50), null);
        });

        test('0% humidity returns null', () => {
            assertEqual(WeatherModule.calcDewpoint(70, 0), null);
        });

        test('freezing conditions', () => {
            const dp = WeatherModule.calcDewpoint(32, 80);
            assert(dp < 32, 'Dewpoint should be below freezing at 80% RH');
            assert(dp > 20, 'Dewpoint should be reasonable');
        });
    });

    suite('Weather.formatWind', () => {
        test('formats speed and direction', () => {
            const result = WeatherModule.formatWind(15, 180);
            assert(result.includes('15'), 'Should include speed');
            assert(result.includes('S'), 'Should include direction');
        });

        test('null speed returns --', () => {
            assertEqual(WeatherModule.formatWind(null, 90), '--');
        });

        test('null direction omits cardinal', () => {
            const result = WeatherModule.formatWind(10, null);
            assert(result.includes('10'), 'Should include speed');
        });
    });

    suite('Weather.getCurrentWind', () => {
        test('returns null before any fetch', () => {
            assertEqual(WeatherModule.getCurrentWind(), null);
        });
    });
} else {
    _testLog('  ⚠️  WeatherModule not loaded, skipping');
}

// ============================================================
// Results
// ============================================================
_testLog('\n╔══════════════════════════════════════════╗');
_testLog('║              Results                     ║');
_testLog('╚══════════════════════════════════════════╝');

Object.entries(suiteResults).forEach(([name, r]) => {
    const status = r.failed === 0 ? '✅' : '❌';
    _testLog(`  ${status} ${name}: ${r.passed}/${r.total} passed`);
});

_testLog(`\n  Total: ${passed} passed, ${failed} failed out of ${totalTests}`);

if (failures.length > 0) {
    _testLog('\n  Failed tests:');
    failures.forEach(f => {
        _testLog(`    ❌ [${f.suite}] ${f.test}`);
        _testLog(`       ${f.error}`);
    });
}

process.exit(failed > 0 ? 1 : 0);
