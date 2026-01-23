/**
 * GridDown GPX Module - Import/Export GPX Files
 * Supports GPX 1.1 format for waypoints, routes, and tracks
 */
const GPXModule = (function() {
    'use strict';

    /**
     * Parse GPX XML string into waypoints and routes
     */
    function parseGPX(gpxString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(gpxString, 'application/xml');
        
        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid GPX file: ' + parseError.textContent);
        }

        const result = {
            waypoints: [],
            routes: [],
            tracks: [],
            metadata: {}
        };

        // Parse metadata
        const metadata = doc.querySelector('metadata');
        if (metadata) {
            result.metadata.name = getElementText(metadata, 'name');
            result.metadata.desc = getElementText(metadata, 'desc');
            result.metadata.author = getElementText(metadata, 'author > name');
            result.metadata.time = getElementText(metadata, 'time');
        }

        // Parse waypoints
        const wpts = doc.querySelectorAll('wpt');
        wpts.forEach((wpt, index) => {
            const waypoint = parseWaypoint(wpt, index);
            if (waypoint) result.waypoints.push(waypoint);
        });

        // Parse routes
        const rtes = doc.querySelectorAll('rte');
        rtes.forEach((rte, index) => {
            const route = parseRoute(rte, index);
            if (route) result.routes.push(route);
        });

        // Parse tracks (convert to routes)
        const trks = doc.querySelectorAll('trk');
        trks.forEach((trk, index) => {
            const track = parseTrack(trk, index);
            if (track) result.tracks.push(track);
        });

        return result;
    }

    /**
     * Parse a single waypoint element
     */
    function parseWaypoint(wpt, index) {
        const lat = parseFloat(wpt.getAttribute('lat'));
        const lon = parseFloat(wpt.getAttribute('lon'));
        
        if (isNaN(lat) || isNaN(lon)) return null;

        const name = getElementText(wpt, 'name') || `Waypoint ${index + 1}`;
        const desc = getElementText(wpt, 'desc') || getElementText(wpt, 'cmt') || '';
        const ele = parseFloat(getElementText(wpt, 'ele')) || null;
        const sym = getElementText(wpt, 'sym') || '';
        const type = getElementText(wpt, 'type') || '';

        // Map GPX symbol/type to GridDown waypoint type
        const griddownType = mapSymbolToType(sym, type, name, desc);

        return {
            id: Helpers.generateId(),
            name: name,
            lat: lat,
            lon: lon,
            x: lonToX(lon),
            y: latToY(lat),
            elevation: ele,
            type: griddownType,
            notes: desc,
            verified: false,
            source: 'gpx'
        };
    }

    /**
     * Parse a route element
     */
    function parseRoute(rte, index) {
        const name = getElementText(rte, 'name') || `Route ${index + 1}`;
        const desc = getElementText(rte, 'desc') || '';
        const points = [];

        const rtepts = rte.querySelectorAll('rtept');
        rtepts.forEach((rtept) => {
            const lat = parseFloat(rtept.getAttribute('lat'));
            const lon = parseFloat(rtept.getAttribute('lon'));
            const ele = parseFloat(getElementText(rtept, 'ele')) || null;
            const ptName = getElementText(rtept, 'name') || '';

            if (!isNaN(lat) && !isNaN(lon)) {
                points.push({
                    lat: lat,
                    lon: lon,
                    x: lonToX(lon),
                    y: latToY(lat),
                    elevation: ele,
                    name: ptName
                });
            }
        });

        if (points.length < 2) return null;

        // Calculate route statistics
        const stats = calculateRouteStats(points);

        return {
            id: Helpers.generateId(),
            name: name,
            notes: desc,
            points: points,
            distance: stats.distance.toFixed(1),
            duration: formatDuration(stats.estimatedTime),
            elevation: stats.elevationGain.toFixed(0),
            source: 'gpx'
        };
    }

    /**
     * Parse a track element (convert to route format)
     */
    function parseTrack(trk, index) {
        const name = getElementText(trk, 'name') || `Track ${index + 1}`;
        const desc = getElementText(trk, 'desc') || '';
        const points = [];

        // Tracks can have multiple segments
        const trksegs = trk.querySelectorAll('trkseg');
        trksegs.forEach((seg) => {
            const trkpts = seg.querySelectorAll('trkpt');
            trkpts.forEach((trkpt) => {
                const lat = parseFloat(trkpt.getAttribute('lat'));
                const lon = parseFloat(trkpt.getAttribute('lon'));
                const ele = parseFloat(getElementText(trkpt, 'ele')) || null;
                const time = getElementText(trkpt, 'time') || null;

                if (!isNaN(lat) && !isNaN(lon)) {
                    points.push({
                        lat: lat,
                        lon: lon,
                        x: lonToX(lon),
                        y: latToY(lat),
                        elevation: ele,
                        time: time
                    });
                }
            });
        });

        // Simplify track if too many points (keep every Nth point)
        const simplifiedPoints = simplifyTrack(points, 100);

        if (simplifiedPoints.length < 2) return null;

        const stats = calculateRouteStats(simplifiedPoints);

        return {
            id: Helpers.generateId(),
            name: name,
            notes: desc,
            points: simplifiedPoints,
            distance: stats.distance.toFixed(1),
            duration: formatDuration(stats.estimatedTime),
            elevation: stats.elevationGain.toFixed(0),
            source: 'gpx-track'
        };
    }

    /**
     * Simplify a track by reducing point count
     */
    function simplifyTrack(points, maxPoints) {
        if (points.length <= maxPoints) return points;
        
        const step = Math.ceil(points.length / maxPoints);
        const simplified = [];
        
        for (let i = 0; i < points.length; i += step) {
            simplified.push(points[i]);
        }
        
        // Always include last point
        if (simplified[simplified.length - 1] !== points[points.length - 1]) {
            simplified.push(points[points.length - 1]);
        }
        
        return simplified;
    }

    /**
     * Export waypoints and routes to GPX format
     */
    function exportGPX(waypoints, routes, options = {}) {
        const exportName = options.name || 'GridDown Export';
        const desc = options.description || 'Exported from GridDown';
        const author = options.author || 'GridDown User';
        const time = new Date().toISOString();

        let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
        gpx += '<gpx version="1.1" creator="GridDown PWA"\n';
        gpx += '    xmlns="http://www.topografix.com/GPX/1/1"\n';
        gpx += '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
        gpx += '    xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';
        gpx += '    <metadata>\n';
        gpx += '        <name>' + escapeXml(exportName) + '</name>\n';
        gpx += '        <desc>' + escapeXml(desc) + '</desc>\n';
        gpx += '        <author><name>' + escapeXml(author) + '</name></author>\n';
        gpx += '        <time>' + time + '</time>\n';
        gpx += '    </metadata>\n';

        // Export waypoints
        waypoints.forEach(function(wp) {
            const lat = wp.lat || (37.4215 + (wp.y - 50) * 0.002);
            const lon = wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
            const sym = typeToSymbol(wp.type);

            gpx += '    <wpt lat="' + lat.toFixed(6) + '" lon="' + lon.toFixed(6) + '">\n';
            gpx += '        <name>' + escapeXml(wp.name) + '</name>\n';
            gpx += '        <desc>' + escapeXml(wp.notes || '') + '</desc>\n';
            gpx += '        <sym>' + sym + '</sym>\n';
            gpx += '        <type>' + escapeXml(wp.type) + '</type>\n';
            if (wp.elevation) {
                gpx += '        <ele>' + wp.elevation + '</ele>\n';
            }
            gpx += '    </wpt>\n';
        });

        // Export routes
        routes.forEach(function(route) {
            gpx += '    <rte>\n';
            gpx += '        <name>' + escapeXml(route.name) + '</name>\n';
            gpx += '        <desc>' + escapeXml(route.notes || route.description || '') + '</desc>\n';
            
            if (route.points) {
                route.points.forEach(function(pt, idx) {
                    const lat = pt.lat || (37.4215 + ((pt.y || 50) - 50) * 0.002);
                    const lon = pt.lon || (-119.1892 + ((pt.x || 50) - 50) * 0.004);
                    
                    gpx += '        <rtept lat="' + lat.toFixed(6) + '" lon="' + lon.toFixed(6) + '">\n';
                    if (pt.name) {
                        gpx += '            <name>' + escapeXml(pt.name) + '</name>\n';
                    }
                    if (pt.elevation) {
                        gpx += '            <ele>' + pt.elevation + '</ele>\n';
                    }
                    gpx += '        </rtept>\n';
                });
            }
            gpx += '    </rte>\n';
        });

        gpx += '</gpx>';
        return gpx;
    }

    /**
     * Download GPX file
     */
    function downloadGPX(waypoints, routes, filename) {
        filename = filename || 'griddown-export.gpx';
        const gpxContent = exportGPX(waypoints, routes);
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import GPX from file input
     */
    function importFromFile(file) {
        return new Promise(function(resolve, reject) {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const result = parseGPX(e.target.result);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = function() { reject(new Error('Failed to read file')); };
            reader.readAsText(file);
        });
    }

    // Helper functions
    function getElementText(parent, selector) {
        const el = parent.querySelector(selector);
        return el ? el.textContent.trim() : '';
    }

    function escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function mapSymbolToType(sym, type, name, desc) {
        const combined = (sym + ' ' + type + ' ' + name + ' ' + desc).toLowerCase();
        
        if (combined.includes('water') || combined.includes('spring') || combined.includes('creek')) {
            return 'water';
        }
        if (combined.includes('fuel') || combined.includes('gas') || combined.includes('cache')) {
            return 'fuel';
        }
        if (combined.includes('camp') || combined.includes('tent') || combined.includes('shelter')) {
            return 'camp';
        }
        if (combined.includes('danger') || combined.includes('hazard') || combined.includes('warning')) {
            return 'hazard';
        }
        if (combined.includes('hospital') || combined.includes('emergency') || combined.includes('bailout') || combined.includes('exit')) {
            return 'bailout';
        }
        if (combined.includes('store') || combined.includes('supply') || combined.includes('resupply') || combined.includes('town')) {
            return 'resupply';
        }
        
        return 'custom';
    }

    function typeToSymbol(type) {
        var symbols = {
            water: 'Water Source',
            fuel: 'Gas Station',
            camp: 'Campground',
            resupply: 'Store',
            hazard: 'Danger Area',
            bailout: 'Hospital',
            custom: 'Flag'
        };
        return symbols[type] || 'Flag';
    }

    // Coordinate conversion helpers (approximate for display)
    function lonToX(lon) {
        return 50 + (lon + 119.1892) / 0.004;
    }

    function latToY(lat) {
        return 50 + (lat - 37.4215) / 0.002;
    }

    function calculateRouteStats(points) {
        var distance = 0;
        var elevationGain = 0;
        var elevationLoss = 0;

        for (var i = 1; i < points.length; i++) {
            var p1 = points[i - 1];
            var p2 = points[i];
            
            // Calculate distance using Haversine
            distance += haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
            
            // Calculate elevation change
            if (p1.elevation && p2.elevation) {
                var eleDiff = p2.elevation - p1.elevation;
                if (eleDiff > 0) elevationGain += eleDiff;
                else elevationLoss += Math.abs(eleDiff);
            }
        }

        // Estimate time: ~15mph average for vehicle, ~3mph for foot
        var estimatedTime = distance / 15;

        return {
            distance: distance,
            elevationGain: elevationGain,
            elevationLoss: elevationLoss,
            estimatedTime: estimatedTime
        };
    }

    function haversineDistance(lat1, lon1, lat2, lon2) {
        var R = 3959; // Earth's radius in miles
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function formatDuration(hours) {
        var h = Math.floor(hours);
        var m = Math.round((hours - h) * 60);
        return h + 'h ' + m + 'm';
    }

    // Public API
    return {
        parseGPX: parseGPX,
        exportGPX: exportGPX,
        downloadGPX: downloadGPX,
        importFromFile: importFromFile,
        calculateRouteStats: calculateRouteStats
    };
})();

window.GPXModule = GPXModule;
