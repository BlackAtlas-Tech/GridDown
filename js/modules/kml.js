/**
 * GridDown KML Module - Import/Export KML/KMZ Files
 * Supports KML 2.2 format for placemarks (waypoints) and paths (routes)
 * Compatible with Google Earth, Google Maps, and other GIS applications
 */
const KMLModule = (function() {
    'use strict';

    // KML icon style mappings for GridDown waypoint types
    const ICON_STYLES = {
        water: { 
            href: 'http://maps.google.com/mapfiles/kml/shapes/water.png',
            color: 'ff82b8ff' // AABBGGRR format (blue)
        },
        fuel: { 
            href: 'http://maps.google.com/mapfiles/kml/shapes/gas_stations.png',
            color: 'ff0b9ff5' // orange
        },
        camp: { 
            href: 'http://maps.google.com/mapfiles/kml/shapes/campground.png',
            color: 'ff81b910' // green
        },
        resupply: { 
            href: 'http://maps.google.com/mapfiles/kml/shapes/shopping.png',
            color: 'ff6b5cf8' // purple
        },
        hazard: { 
            href: 'http://maps.google.com/mapfiles/kml/shapes/caution.png',
            color: 'ff4444ef' // red
        },
        bailout: { 
            href: 'http://maps.google.com/mapfiles/kml/shapes/hospitals.png',
            color: 'ff9948ec' // pink
        },
        custom: { 
            href: 'http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png',
            color: 'ff808080' // gray
        }
    };

    // Route line style colors by terrain type
    const LINE_COLORS = {
        highway: 'ff00ff00',  // green
        road: 'ff00aaff',     // orange
        trail: 'ff0066ff',    // red-orange
        crawl: 'ff0000ff'     // red
    };

    /**
     * Parse KML XML string into waypoints and routes
     */
    function parseKML(kmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(kmlString, 'application/xml');
        
        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid KML file: ' + parseError.textContent);
        }

        const result = {
            waypoints: [],
            routes: [],
            metadata: {}
        };

        // Parse document metadata
        const docElement = doc.querySelector('Document');
        if (docElement) {
            result.metadata.name = getElementText(docElement, ':scope > name');
            result.metadata.description = getElementText(docElement, ':scope > description');
        }

        // Parse all Placemarks
        const placemarks = doc.querySelectorAll('Placemark');
        placemarks.forEach((placemark, index) => {
            // Check if it's a point (waypoint) or line (route)
            const point = placemark.querySelector('Point');
            const lineString = placemark.querySelector('LineString');
            const multiGeometry = placemark.querySelector('MultiGeometry');

            if (point) {
                const waypoint = parsePlacemarkAsWaypoint(placemark, point, index);
                if (waypoint) result.waypoints.push(waypoint);
            } else if (lineString) {
                const route = parsePlacemarkAsRoute(placemark, lineString, index);
                if (route) result.routes.push(route);
            } else if (multiGeometry) {
                // MultiGeometry can contain multiple lines - treat as single route
                const lines = multiGeometry.querySelectorAll('LineString');
                if (lines.length > 0) {
                    const route = parseMultiGeometryAsRoute(placemark, lines, index);
                    if (route) result.routes.push(route);
                }
            }
        });

        // Also check for Folder structures (nested placemarks)
        const folders = doc.querySelectorAll('Folder');
        folders.forEach(folder => {
            const folderName = getElementText(folder, ':scope > name') || '';
            const folderPlacemarks = folder.querySelectorAll(':scope > Placemark');
            
            folderPlacemarks.forEach((placemark, index) => {
                const point = placemark.querySelector('Point');
                const lineString = placemark.querySelector('LineString');

                if (point) {
                    const waypoint = parsePlacemarkAsWaypoint(placemark, point, index, folderName);
                    if (waypoint) result.waypoints.push(waypoint);
                } else if (lineString) {
                    const route = parsePlacemarkAsRoute(placemark, lineString, index);
                    if (route) result.routes.push(route);
                }
            });
        });

        return result;
    }

    /**
     * Parse a Placemark with Point geometry as a waypoint
     */
    function parsePlacemarkAsWaypoint(placemark, point, index, folderHint = '') {
        const coordsText = getElementText(point, 'coordinates');
        if (!coordsText) return null;

        const coords = parseCoordinates(coordsText)[0];
        if (!coords) return null;

        const name = getElementText(placemark, 'name') || `Waypoint ${index + 1}`;
        const description = getElementText(placemark, 'description') || '';
        
        // Try to get extended data
        const extendedData = {};
        const dataElements = placemark.querySelectorAll('ExtendedData Data, ExtendedData SimpleData');
        dataElements.forEach(data => {
            const dataName = data.getAttribute('name');
            const dataValue = data.textContent;
            if (dataName && dataValue) {
                extendedData[dataName] = dataValue;
            }
        });

        // Determine waypoint type from style, name, description, or folder
        const styleUrl = getElementText(placemark, 'styleUrl') || '';
        const griddownType = inferWaypointType(name, description, styleUrl, folderHint);

        return {
            id: Helpers.generateId(),
            name: name,
            lat: coords.lat,
            lon: coords.lon,
            x: lonToX(coords.lon),
            y: latToY(coords.lat),
            elevation: coords.alt || null,
            type: griddownType,
            notes: cleanDescription(description),
            verified: false,
            source: 'kml',
            ...extendedData
        };
    }

    /**
     * Parse a Placemark with LineString geometry as a route
     */
    function parsePlacemarkAsRoute(placemark, lineString, index) {
        const coordsText = getElementText(lineString, 'coordinates');
        if (!coordsText) return null;

        const coords = parseCoordinates(coordsText);
        if (coords.length < 2) return null;

        const name = getElementText(placemark, 'name') || `Route ${index + 1}`;
        const description = getElementText(placemark, 'description') || '';

        const points = coords.map((c, i) => ({
            lat: c.lat,
            lon: c.lon,
            x: lonToX(c.lon),
            y: latToY(c.lat),
            elevation: c.alt || null,
            terrain: 'road'
        }));

        const stats = calculateRouteStats(points);

        return {
            id: Helpers.generateId(),
            name: name,
            notes: cleanDescription(description),
            points: points,
            distance: stats.distance.toFixed(1),
            duration: formatDuration(stats.estimatedTime),
            elevation: stats.elevationGain.toFixed(0),
            source: 'kml'
        };
    }

    /**
     * Parse MultiGeometry with multiple LineStrings as a single route
     */
    function parseMultiGeometryAsRoute(placemark, lineStrings, index) {
        const allCoords = [];
        
        lineStrings.forEach(lineString => {
            const coordsText = getElementText(lineString, 'coordinates');
            if (coordsText) {
                const coords = parseCoordinates(coordsText);
                allCoords.push(...coords);
            }
        });

        if (allCoords.length < 2) return null;

        const name = getElementText(placemark, 'name') || `Route ${index + 1}`;
        const description = getElementText(placemark, 'description') || '';

        const points = allCoords.map(c => ({
            lat: c.lat,
            lon: c.lon,
            x: lonToX(c.lon),
            y: latToY(c.lat),
            elevation: c.alt || null,
            terrain: 'road'
        }));

        const stats = calculateRouteStats(points);

        return {
            id: Helpers.generateId(),
            name: name,
            notes: cleanDescription(description),
            points: points,
            distance: stats.distance.toFixed(1),
            duration: formatDuration(stats.estimatedTime),
            elevation: stats.elevationGain.toFixed(0),
            source: 'kml'
        };
    }

    /**
     * Parse KML coordinate string into array of {lat, lon, alt}
     * KML format: lon,lat,alt lon,lat,alt (space-separated, each is comma-separated)
     */
    function parseCoordinates(coordString) {
        const coords = [];
        const trimmed = coordString.trim();
        
        // Split by whitespace (space, newline, etc.)
        const tuples = trimmed.split(/\s+/);
        
        tuples.forEach(tuple => {
            const parts = tuple.split(',');
            if (parts.length >= 2) {
                const lon = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                const alt = parts.length > 2 ? parseFloat(parts[2]) : null;
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    coords.push({ lat, lon, alt: isNaN(alt) ? null : alt });
                }
            }
        });
        
        return coords;
    }

    /**
     * Export waypoints and routes to KML format
     */
    function exportKML(waypoints, routes, options = {}) {
        const exportName = options.name || 'GridDown Export';
        const description = options.description || 'Exported from GridDown';

        let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
        kml += '  <Document>\n';
        kml += '    <name>' + escapeXml(exportName) + '</name>\n';
        kml += '    <description>' + escapeXml(description) + '</description>\n';
        
        // Add styles for each waypoint type
        kml += generateStyles();
        
        // Export waypoints grouped by type
        const waypointsByType = {};
        waypoints.forEach(wp => {
            const type = wp.type || 'custom';
            if (!waypointsByType[type]) waypointsByType[type] = [];
            waypointsByType[type].push(wp);
        });

        Object.entries(waypointsByType).forEach(([type, wps]) => {
            const typeConfig = Constants.WAYPOINT_TYPES[type] || Constants.WAYPOINT_TYPES.custom;
            
            kml += '    <Folder>\n';
            kml += '      <name>' + escapeXml(typeConfig.label) + '</name>\n';
            
            wps.forEach(wp => {
                kml += generatePlacemarkForWaypoint(wp);
            });
            
            kml += '    </Folder>\n';
        });

        // Export routes
        if (routes.length > 0) {
            kml += '    <Folder>\n';
            kml += '      <name>Routes</name>\n';
            
            routes.forEach(route => {
                kml += generatePlacemarkForRoute(route);
            });
            
            kml += '    </Folder>\n';
        }

        kml += '  </Document>\n';
        kml += '</kml>';
        
        return kml;
    }

    /**
     * Generate KML style definitions
     */
    function generateStyles() {
        let styles = '';
        
        Object.entries(ICON_STYLES).forEach(([type, style]) => {
            styles += '    <Style id="style-' + type + '">\n';
            styles += '      <IconStyle>\n';
            styles += '        <color>' + style.color + '</color>\n';
            styles += '        <scale>1.0</scale>\n';
            styles += '        <Icon><href>' + style.href + '</href></Icon>\n';
            styles += '      </IconStyle>\n';
            styles += '      <LabelStyle>\n';
            styles += '        <scale>0.8</scale>\n';
            styles += '      </LabelStyle>\n';
            styles += '    </Style>\n';
        });

        // Route line styles
        styles += '    <Style id="style-route">\n';
        styles += '      <LineStyle>\n';
        styles += '        <color>ff0066ff</color>\n';
        styles += '        <width>3</width>\n';
        styles += '      </LineStyle>\n';
        styles += '    </Style>\n';

        return styles;
    }

    /**
     * Generate KML Placemark for a waypoint
     */
    function generatePlacemarkForWaypoint(wp) {
        const lat = wp.lat || (37.4215 + (wp.y - 50) * 0.002);
        const lon = wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
        const type = wp.type || 'custom';
        const typeConfig = Constants.WAYPOINT_TYPES[type] || Constants.WAYPOINT_TYPES.custom;

        let placemark = '      <Placemark>\n';
        placemark += '        <name>' + escapeXml(wp.name) + '</name>\n';
        
        // Build description with structured data
        let desc = wp.notes || '';
        if (wp.verified) desc += '\n[Verified]';
        if (wp.confidence) desc += '\nConfidence: ' + wp.confidence + '/5';
        if (wp.visibility) desc += '\nVisibility: ' + wp.visibility;
        
        placemark += '        <description>' + escapeXml(desc.trim()) + '</description>\n';
        placemark += '        <styleUrl>#style-' + type + '</styleUrl>\n';
        
        // Extended data for GridDown-specific fields
        placemark += '        <ExtendedData>\n';
        placemark += '          <Data name="griddown_type"><value>' + type + '</value></Data>\n';
        placemark += '          <Data name="griddown_id"><value>' + wp.id + '</value></Data>\n';
        if (wp.confidence) {
            placemark += '          <Data name="confidence"><value>' + wp.confidence + '</value></Data>\n';
        }
        if (wp.visibility) {
            placemark += '          <Data name="visibility"><value>' + wp.visibility + '</value></Data>\n';
        }
        if (wp.verified) {
            placemark += '          <Data name="verified"><value>true</value></Data>\n';
        }
        placemark += '        </ExtendedData>\n';
        
        placemark += '        <Point>\n';
        placemark += '          <coordinates>' + lon.toFixed(6) + ',' + lat.toFixed(6);
        if (wp.elevation) placemark += ',' + wp.elevation;
        placemark += '</coordinates>\n';
        placemark += '        </Point>\n';
        placemark += '      </Placemark>\n';

        return placemark;
    }

    /**
     * Generate KML Placemark for a route
     */
    function generatePlacemarkForRoute(route) {
        if (!route.points || route.points.length < 2) return '';

        let placemark = '      <Placemark>\n';
        placemark += '        <name>' + escapeXml(route.name) + '</name>\n';
        
        let desc = route.notes || '';
        desc += '\nDistance: ' + (route.distance || '0') + ' mi';
        desc += '\nDuration: ' + (route.duration || '0h');
        desc += '\nElevation: ' + (route.elevation || '0') + ' ft';
        
        placemark += '        <description>' + escapeXml(desc.trim()) + '</description>\n';
        placemark += '        <styleUrl>#style-route</styleUrl>\n';
        
        placemark += '        <ExtendedData>\n';
        placemark += '          <Data name="griddown_id"><value>' + route.id + '</value></Data>\n';
        placemark += '          <Data name="distance"><value>' + (route.distance || '0') + '</value></Data>\n';
        placemark += '          <Data name="duration"><value>' + (route.duration || '0h') + '</value></Data>\n';
        placemark += '        </ExtendedData>\n';
        
        placemark += '        <LineString>\n';
        placemark += '          <tessellate>1</tessellate>\n';
        placemark += '          <coordinates>\n';
        
        route.points.forEach(pt => {
            const lat = pt.lat || (37.4215 + ((pt.y || 50) - 50) * 0.002);
            const lon = pt.lon || (-119.1892 + ((pt.x || 50) - 50) * 0.004);
            placemark += '            ' + lon.toFixed(6) + ',' + lat.toFixed(6);
            if (pt.elevation) placemark += ',' + pt.elevation;
            placemark += '\n';
        });
        
        placemark += '          </coordinates>\n';
        placemark += '        </LineString>\n';
        placemark += '      </Placemark>\n';

        return placemark;
    }

    /**
     * Download KML file
     */
    function downloadKML(waypoints, routes, filename) {
        filename = filename || 'griddown-export.kml';
        const kmlContent = exportKML(waypoints, routes);
        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
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
     * Import KML from file input
     */
    function importFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const filename = file.name.toLowerCase();
            
            // Check if it's a KMZ (zipped KML)
            if (filename.endsWith('.kmz')) {
                importFromKMZ(file).then(resolve).catch(reject);
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const result = parseKML(e.target.result);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Import from KMZ file (zipped KML)
     * Note: Requires JSZip library for full support, falls back to treating as KML
     */
    function importFromKMZ(file) {
        return new Promise((resolve, reject) => {
            // Check if JSZip is available
            if (typeof JSZip !== 'undefined') {
                JSZip.loadAsync(file).then(zip => {
                    // Find the doc.kml file (standard KMZ structure)
                    const kmlFile = zip.file(/\.kml$/i)[0];
                    if (kmlFile) {
                        return kmlFile.async('string');
                    }
                    throw new Error('No KML file found in KMZ');
                }).then(kmlContent => {
                    const result = parseKML(kmlContent);
                    resolve(result);
                }).catch(reject);
            } else {
                // Without JSZip, we can't extract KMZ
                reject(new Error('KMZ files require the JSZip library. Please use a .kml file instead.'));
            }
        });
    }

    // Helper functions
    
    function getElementText(parent, selector) {
        try {
            const el = parent.querySelector(selector);
            return el ? el.textContent.trim() : '';
        } catch (e) {
            return '';
        }
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

    function cleanDescription(desc) {
        if (!desc) return '';
        // Remove HTML tags that Google Earth sometimes adds
        return desc.replace(/<[^>]*>/g, '').trim();
    }

    function inferWaypointType(name, description, styleUrl, folderHint) {
        const combined = (name + ' ' + description + ' ' + styleUrl + ' ' + folderHint).toLowerCase();
        
        if (combined.includes('water') || combined.includes('spring') || combined.includes('creek') || combined.includes('stream')) {
            return 'water';
        }
        if (combined.includes('fuel') || combined.includes('gas') || combined.includes('cache') || combined.includes('diesel')) {
            return 'fuel';
        }
        if (combined.includes('camp') || combined.includes('tent') || combined.includes('shelter') || combined.includes('bivouac')) {
            return 'camp';
        }
        if (combined.includes('danger') || combined.includes('hazard') || combined.includes('warning') || combined.includes('caution')) {
            return 'hazard';
        }
        if (combined.includes('hospital') || combined.includes('emergency') || combined.includes('bailout') || combined.includes('exit') || combined.includes('rescue')) {
            return 'bailout';
        }
        if (combined.includes('store') || combined.includes('supply') || combined.includes('resupply') || combined.includes('town') || combined.includes('shop')) {
            return 'resupply';
        }
        
        return 'custom';
    }

    // Coordinate conversion helpers
    function lonToX(lon) {
        return 50 + (lon + 119.1892) / 0.004;
    }

    function latToY(lat) {
        return 50 + (lat - 37.4215) / 0.002;
    }

    function calculateRouteStats(points) {
        let distance = 0;
        let elevationGain = 0;
        let elevationLoss = 0;

        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            
            distance += haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
            
            if (p1.elevation && p2.elevation) {
                const eleDiff = p2.elevation - p1.elevation;
                if (eleDiff > 0) elevationGain += eleDiff;
                else elevationLoss += Math.abs(eleDiff);
            }
        }

        // Estimate 15mph average
        const estimatedTime = distance / 15;

        return {
            distance: distance,
            elevationGain: elevationGain,
            elevationLoss: elevationLoss,
            estimatedTime: estimatedTime
        };
    }

    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function formatDuration(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return h + 'h ' + m + 'm';
    }

    // Public API
    return {
        parseKML: parseKML,
        exportKML: exportKML,
        downloadKML: downloadKML,
        importFromFile: importFromFile
    };
})();

window.KMLModule = KMLModule;
