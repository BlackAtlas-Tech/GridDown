/**
 * GridDown Measure Module - Distance and Bearing Tool
 * Click-to-measure with multi-point support, elevation profile, and export
 */
const MeasureModule = (function() {
    'use strict';

    // Measurement state
    let isActive = false;
    let measurePoints = [];
    let hoverPoint = null;
    let segmentDistances = [];
    let totalDistance = 0;
    
    // Track initialization
    let initialized = false;
    let cleanupFunctions = [];

    // Units configuration
    const UNITS = {
        imperial: {
            distance: { name: 'miles', abbr: 'mi', factor: 1 },
            smallDistance: { name: 'feet', abbr: 'ft', factor: 5280 },
            speed: { name: 'mph', factor: 1 },
            elevation: { name: 'feet', abbr: 'ft', factor: 3.28084 }
        },
        metric: {
            distance: { name: 'kilometers', abbr: 'km', factor: 1.60934 },
            smallDistance: { name: 'meters', abbr: 'm', factor: 1609.34 },
            speed: { name: 'km/h', factor: 1.60934 },
            elevation: { name: 'meters', abbr: 'm', factor: 1 }
        }
    };

    let currentUnits = 'imperial';

    /**
     * Initialize the measure module
     */
    function init() {
        // Prevent double initialization
        if (initialized) {
            console.debug('MeasureModule already initialized');
            return;
        }
        
        // Load units preference
        loadUnitsPreference();
        
        // Listen for unit changes
        if (typeof Events !== 'undefined') {
            Events.on('settings:unitsChanged', (data) => {
                currentUnits = data.units;
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyDown);
        cleanupFunctions.push(() => document.removeEventListener('keydown', handleKeyDown));
        
        initialized = true;
    }
    
    /**
     * Handle keyboard shortcuts for measure mode
     */
    function handleKeyDown(e) {
        if (!isActive) return;
        
        // Escape - exit measure mode
        if (e.key === 'Escape') {
            toggle();
            if (typeof Events !== 'undefined') {
                Events.emit('measure:updated');
            }
            if (typeof MapModule !== 'undefined') {
                MapModule.render();
                MapModule.renderControls();
            }
        }
        
        // Ctrl+Z - undo last point
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            removeLastPoint();
            if (typeof Events !== 'undefined') {
                Events.emit('measure:updated');
            }
            if (typeof MapModule !== 'undefined') {
                MapModule.render();
            }
        }
        
        // Delete/Backspace - also undo last point
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Only if not focused on an input
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                removeLastPoint();
                if (typeof Events !== 'undefined') {
                    Events.emit('measure:updated');
                }
                if (typeof MapModule !== 'undefined') {
                    MapModule.render();
                }
            }
        }
        
        // C - clear all measurements
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                clear();
                if (typeof Events !== 'undefined') {
                    Events.emit('measure:updated');
                }
                if (typeof MapModule !== 'undefined') {
                    MapModule.render();
                }
            }
        }
    }

    /**
     * Load units preference from storage
     */
    async function loadUnitsPreference() {
        try {
            if (typeof Storage !== 'undefined') {
                const units = await Storage.Settings.get('units', 'imperial');
                currentUnits = units;
            }
        } catch (e) {
            console.warn('Could not load units preference');
        }
    }

    /**
     * Toggle measurement mode
     */
    function toggle() {
        isActive = !isActive;
        
        if (!isActive) {
            // Clear measurements when deactivating
            clear();
        }
        
        // Emit event for UI updates
        if (typeof Events !== 'undefined') {
            Events.emit('measure:toggle', { active: isActive });
        }
        
        // Update cursor
        const canvas = document.getElementById('map-canvas');
        if (canvas) {
            canvas.style.cursor = isActive ? 'crosshair' : 'grab';
        }
        
        return isActive;
    }

    /**
     * Check if measurement mode is active
     */
    function isActiveMode() {
        return isActive;
    }

    /**
     * Add a measurement point
     */
    function addPoint(lat, lon, elevation = null) {
        const point = {
            lat,
            lon,
            elevation,
            index: measurePoints.length
        };
        
        measurePoints.push(point);
        recalculate();
        
        // Emit event
        if (typeof Events !== 'undefined') {
            Events.emit('measure:pointAdded', { point, total: measurePoints.length });
        }
        
        return point;
    }

    /**
     * Remove the last point
     */
    function removeLastPoint() {
        if (measurePoints.length > 0) {
            measurePoints.pop();
            recalculate();
            
            if (typeof Events !== 'undefined') {
                Events.emit('measure:pointRemoved', { total: measurePoints.length });
            }
        }
    }

    /**
     * Clear all measurement points
     */
    function clear() {
        measurePoints = [];
        segmentDistances = [];
        totalDistance = 0;
        hoverPoint = null;
        
        if (typeof Events !== 'undefined') {
            Events.emit('measure:cleared');
        }
    }

    /**
     * Set hover point for live preview
     */
    function setHoverPoint(lat, lon) {
        if (!isActive || measurePoints.length === 0) {
            hoverPoint = null;
            return null;
        }
        
        hoverPoint = { lat, lon };
        
        // Calculate preview distance to last point
        const lastPoint = measurePoints[measurePoints.length - 1];
        const previewDistance = calculateDistance(lastPoint.lat, lastPoint.lon, lat, lon);
        const previewBearing = calculateBearing(lastPoint.lat, lastPoint.lon, lat, lon);
        
        return {
            distance: previewDistance,
            bearing: previewBearing,
            totalWithPreview: totalDistance + previewDistance
        };
    }

    /**
     * Recalculate all distances and bearings
     */
    function recalculate() {
        segmentDistances = [];
        totalDistance = 0;
        
        for (let i = 1; i < measurePoints.length; i++) {
            const p1 = measurePoints[i - 1];
            const p2 = measurePoints[i];
            
            const distance = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
            const bearing = calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon);
            
            segmentDistances.push({
                from: i - 1,
                to: i,
                distance,
                bearing,
                cumulativeDistance: totalDistance + distance
            });
            
            totalDistance += distance;
        }
    }

    /**
     * Calculate distance between two points (Haversine formula)
     * @returns distance in miles
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 + 
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    /**
     * Calculate bearing from point 1 to point 2
     * @returns bearing in degrees (0-360)
     */
    function calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        
        let θ = Math.atan2(y, x) * 180 / Math.PI;
        return (θ + 360) % 360;
    }

    /**
     * Convert bearing to compass direction
     */
    function bearingToCompass(deg) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                          'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(deg / 22.5) % 16;
        return directions[index];
    }

    /**
     * Format distance with appropriate units
     */
    function formatDistance(miles, short = false) {
        const units = UNITS[currentUnits];
        
        // Use small units for distances under 0.1 miles
        if (miles < 0.1) {
            const value = miles * units.smallDistance.factor;
            return short 
                ? `${Math.round(value)} ${units.smallDistance.abbr}`
                : `${Math.round(value)} ${units.smallDistance.name}`;
        }
        
        const value = miles * units.distance.factor;
        return short 
            ? `${value.toFixed(2)} ${units.distance.abbr}`
            : `${value.toFixed(2)} ${units.distance.name}`;
    }

    /**
     * Format bearing with degrees and compass
     * @param {number} deg - True bearing in degrees
     * @param {boolean} includeMagnetic - Whether to include magnetic bearing
     */
    function formatBearing(deg, includeMagnetic = false) {
        const compass = bearingToCompass(deg);
        const trueBrg = `${Math.round(deg).toString().padStart(3, '0')}° ${compass}`;
        
        if (includeMagnetic && typeof DeclinationModule !== 'undefined') {
            const current = DeclinationModule.getCurrent();
            if (current && current.declination !== null) {
                const magBrg = DeclinationModule.trueToMagnetic(deg, current.declination);
                return `${trueBrg} (M: ${Math.round(magBrg)}°)`;
            }
        }
        return trueBrg;
    }
    
    /**
     * Format bearing with both true and magnetic values for detailed display
     */
    function formatBearingDetailed(deg) {
        const compass = bearingToCompass(deg);
        const result = {
            true: Math.round(deg),
            trueFormatted: `${Math.round(deg).toString().padStart(3, '0')}°`,
            compass: compass
        };
        
        if (typeof DeclinationModule !== 'undefined') {
            const current = DeclinationModule.getCurrent();
            if (current && current.declination !== null) {
                result.magnetic = Math.round(DeclinationModule.trueToMagnetic(deg, current.declination));
                result.magneticFormatted = `${result.magnetic.toString().padStart(3, '0')}°`;
                result.declination = current.declination;
            }
        }
        
        return result;
    }

    /**
     * Get measurement data for rendering
     */
    function getMeasurementData() {
        return {
            isActive,
            points: measurePoints,
            segments: segmentDistances,
            totalDistance,
            hoverPoint,
            formattedTotal: formatDistance(totalDistance),
            pointCount: measurePoints.length
        };
    }

    /**
     * Get detailed results for display
     */
    function getResults() {
        if (measurePoints.length < 2) {
            return null;
        }
        
        // Get current declination
        let declination = null;
        if (typeof DeclinationModule !== 'undefined') {
            const current = DeclinationModule.getCurrent();
            if (current && current.declination !== null) {
                declination = current.declination;
            }
        }
        
        const results = {
            totalDistance: totalDistance,
            formattedDistance: formatDistance(totalDistance),
            declination: declination,
            segments: segmentDistances.map((seg, i) => {
                const bearingDetail = formatBearingDetailed(seg.bearing);
                return {
                    index: i + 1,
                    from: measurePoints[seg.from],
                    to: measurePoints[seg.to],
                    distance: seg.distance,
                    formattedDistance: formatDistance(seg.distance),
                    bearing: seg.bearing,
                    formattedBearing: formatBearing(seg.bearing),
                    bearingDetail: bearingDetail,
                    cumulativeDistance: seg.cumulativeDistance,
                    formattedCumulative: formatDistance(seg.cumulativeDistance)
                };
            }),
            startPoint: measurePoints[0],
            endPoint: measurePoints[measurePoints.length - 1],
            pointCount: measurePoints.length
        };
        
        // Calculate direct distance and bearing (start to end)
        if (measurePoints.length >= 2) {
            const start = measurePoints[0];
            const end = measurePoints[measurePoints.length - 1];
            results.directDistance = calculateDistance(start.lat, start.lon, end.lat, end.lon);
            results.formattedDirectDistance = formatDistance(results.directDistance);
            results.directBearing = calculateBearing(start.lat, start.lon, end.lat, end.lon);
            results.formattedDirectBearing = formatBearing(results.directBearing);
            results.directBearingDetail = formatBearingDetailed(results.directBearing);
        }
        
        // Calculate estimated times at different speeds
        results.estimatedTimes = {
            walk: formatTime(totalDistance / 3),      // 3 mph walking
            hike: formatTime(totalDistance / 2),      // 2 mph hiking
            bike: formatTime(totalDistance / 12),     // 12 mph biking
            drive: formatTime(totalDistance / 30),    // 30 mph driving
            offroad: formatTime(totalDistance / 15)   // 15 mph offroad
        };
        
        return results;
    }

    /**
     * Format time duration
     */
    function formatTime(hours) {
        if (hours < 1/60) {
            return '< 1 min';
        } else if (hours < 1) {
            return `${Math.round(hours * 60)} min`;
        } else {
            const h = Math.floor(hours);
            const m = Math.round((hours - h) * 60);
            return m > 0 ? `${h}h ${m}m` : `${h}h`;
        }
    }

    /**
     * Export measurement as GPX track
     */
    function exportAsGPX() {
        if (measurePoints.length < 2) {
            return null;
        }
        
        let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
        gpx += '<gpx version="1.1" creator="GridDown Measure Tool"\n';
        gpx += '    xmlns="http://www.topografix.com/GPX/1/1">\n';
        gpx += '    <metadata>\n';
        gpx += '        <name>Measurement</name>\n';
        gpx += '        <desc>Distance: ' + formatDistance(totalDistance) + '</desc>\n';
        gpx += '        <time>' + new Date().toISOString() + '</time>\n';
        gpx += '    </metadata>\n';
        gpx += '    <trk>\n';
        gpx += '        <name>Measured Route</name>\n';
        gpx += '        <trkseg>\n';
        
        measurePoints.forEach((pt, i) => {
            gpx += `            <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">\n`;
            if (pt.elevation) {
                gpx += `                <ele>${pt.elevation}</ele>\n`;
            }
            gpx += `                <name>Point ${i + 1}</name>\n`;
            gpx += '            </trkpt>\n';
        });
        
        gpx += '        </trkseg>\n';
        gpx += '    </trk>\n';
        gpx += '</gpx>';
        
        return gpx;
    }

    /**
     * Convert measurement to a route
     */
    function convertToRoute(name = 'Measured Route') {
        if (measurePoints.length < 2) {
            return null;
        }
        
        const route = {
            id: typeof Helpers !== 'undefined' ? Helpers.generateId() : Date.now().toString(),
            name: name,
            points: measurePoints.map(pt => ({
                lat: pt.lat,
                lon: pt.lon,
                x: 50 + (pt.lon + 119.1892) / 0.004,
                y: 50 + (pt.lat - 37.4215) / 0.002,
                elevation: pt.elevation
            })),
            distance: totalDistance.toFixed(1),
            duration: formatTime(totalDistance / 15), // Assume 15 mph
            elevation: '0',
            source: 'measure-tool'
        };
        
        return route;
    }

    /**
     * Render measurement overlay on canvas
     */
    function render(ctx, latLonToPixel, width, height) {
        if (!isActive && measurePoints.length === 0) return;
        
        const data = getMeasurementData();
        
        if (data.points.length === 0) return;
        
        // Draw measurement lines
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        data.points.forEach((pt, i) => {
            const pixel = latLonToPixel(pt.lat, pt.lon);
            if (i === 0) {
                ctx.moveTo(pixel.x, pixel.y);
            } else {
                ctx.lineTo(pixel.x, pixel.y);
            }
        });
        
        // Draw line to hover point
        if (data.hoverPoint && isActive) {
            const hoverPixel = latLonToPixel(data.hoverPoint.lat, data.hoverPoint.lon);
            ctx.lineTo(hoverPixel.x, hoverPixel.y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw measurement points
        data.points.forEach((pt, i) => {
            const pixel = latLonToPixel(pt.lat, pt.lon);
            
            // Outer circle
            ctx.beginPath();
            ctx.arc(pixel.x, pixel.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
            
            // Inner circle
            ctx.beginPath();
            ctx.arc(pixel.x, pixel.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            
            // Point number
            ctx.fillStyle = '#1e3a5f';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((i + 1).toString(), pixel.x, pixel.y);
        });
        
        // Draw segment labels
        if (data.segments.length > 0) {
            ctx.font = '11px system-ui';
            ctx.textAlign = 'center';
            
            data.segments.forEach(seg => {
                const p1 = data.points[seg.from];
                const p2 = data.points[seg.to];
                const pixel1 = latLonToPixel(p1.lat, p1.lon);
                const pixel2 = latLonToPixel(p2.lat, p2.lon);
                
                // Midpoint of segment
                const midX = (pixel1.x + pixel2.x) / 2;
                const midY = (pixel1.y + pixel2.y) / 2;
                
                // Calculate offset perpendicular to line
                const angle = Math.atan2(pixel2.y - pixel1.y, pixel2.x - pixel1.x);
                const offsetX = Math.sin(angle) * 15;
                const offsetY = -Math.cos(angle) * 15;
                
                const labelX = midX + offsetX;
                const labelY = midY + offsetY;
                
                // Background
                const text = formatDistance(seg.distance, true);
                const metrics = ctx.measureText(text);
                const padding = 4;
                
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(
                    labelX - metrics.width / 2 - padding,
                    labelY - 7 - padding,
                    metrics.width + padding * 2,
                    14 + padding * 2
                );
                
                // Text
                ctx.fillStyle = '#3b82f6';
                ctx.fillText(text, labelX, labelY);
                
                // Bearing (smaller, below distance)
                const bearingText = formatBearing(seg.bearing);
                ctx.font = '9px system-ui';
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fillText(bearingText, labelX, labelY + 12);
                ctx.font = '11px system-ui';
            });
        }
        
        // Draw hover preview
        if (data.hoverPoint && isActive && data.points.length > 0) {
            const lastPoint = data.points[data.points.length - 1];
            const lastPixel = latLonToPixel(lastPoint.lat, lastPoint.lon);
            const hoverPixel = latLonToPixel(data.hoverPoint.lat, data.hoverPoint.lon);
            
            // Preview point
            ctx.beginPath();
            ctx.arc(hoverPixel.x, hoverPixel.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
            ctx.fill();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Preview distance label
            const previewDist = calculateDistance(lastPoint.lat, lastPoint.lon, data.hoverPoint.lat, data.hoverPoint.lon);
            const previewBearing = calculateBearing(lastPoint.lat, lastPoint.lon, data.hoverPoint.lat, data.hoverPoint.lon);
            
            const midX = (lastPixel.x + hoverPixel.x) / 2;
            const midY = (lastPixel.y + hoverPixel.y) / 2;
            
            const text = formatDistance(previewDist, true);
            const metrics = ctx.measureText(text);
            
            ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            ctx.fillRect(midX - metrics.width / 2 - 4, midY - 11, metrics.width + 8, 22);
            
            ctx.fillStyle = '#93c5fd';
            ctx.fillText(text, midX, midY - 2);
            
            ctx.font = '9px system-ui';
            ctx.fillText(formatBearing(previewBearing), midX, midY + 9);
        }
    }

    /**
     * Render results panel HTML
     */
    function renderResultsPanel() {
        const results = getResults();
        
        if (!results) {
            return `
                <div style="padding:16px;text-align:center;color:rgba(255,255,255,0.5)">
                    <div style="font-size:32px;margin-bottom:8px">📏</div>
                    <div style="font-size:13px">Click on the map to start measuring</div>
                    <div style="font-size:11px;margin-top:8px;color:rgba(255,255,255,0.3);line-height:1.6">
                        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:8px">
                            <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:10px">Click</kbd> add point</span>
                            <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:10px">Ctrl+Z</kbd> undo</span>
                            <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:10px">C</kbd> clear</span>
                            <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:10px">Esc</kbd> exit</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div style="padding:12px">
                <!-- Declination Notice -->
                ${results.declination !== null ? `
                    <div style="padding:8px 10px;background:rgba(34,197,94,0.1);border-radius:8px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
                        <span style="color:#22c55e">⊕</span>
                        <span style="font-size:11px;color:rgba(255,255,255,0.7)">
                            Magnetic declination: <strong style="color:#22c55e">${typeof DeclinationModule !== 'undefined' ? DeclinationModule.formatDeclination(results.declination) : results.declination.toFixed(1) + '°'}</strong>
                        </span>
                    </div>
                ` : ''}
                
                <!-- Total Distance -->
                <div style="padding:16px;background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(59,130,246,0.05));border:1px solid rgba(59,130,246,0.3);border-radius:12px;margin-bottom:12px">
                    <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Distance</div>
                    <div style="font-size:28px;font-weight:700;color:#3b82f6">${results.formattedDistance}</div>
                    ${results.pointCount > 2 ? `
                        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px">
                            Direct: ${results.formattedDirectDistance} @ ${results.formattedDirectBearing}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Point to Point Bearing (for 2 points) -->
                ${results.pointCount === 2 ? `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                        <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;text-align:center">
                            <div style="font-size:10px;color:rgba(255,255,255,0.4)">TRUE BEARING</div>
                            <div style="font-size:18px;font-weight:600;color:#f97316;font-family:'IBM Plex Mono',monospace">
                                ${Math.round(results.directBearing).toString().padStart(3, '0')}°
                            </div>
                            <div style="font-size:11px;color:rgba(255,255,255,0.5)">${bearingToCompass(results.directBearing)}</div>
                            ${results.directBearingDetail && results.directBearingDetail.magnetic !== undefined ? `
                                <div style="font-size:10px;color:#22c55e;margin-top:4px">
                                    Mag: ${results.directBearingDetail.magneticFormatted}
                                </div>
                            ` : ''}
                        </div>
                        <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;text-align:center">
                            <div style="font-size:10px;color:rgba(255,255,255,0.4)">BACK BEARING</div>
                            <div style="font-size:18px;font-weight:600;color:#8b5cf6;font-family:'IBM Plex Mono',monospace">
                                ${Math.round((results.directBearing + 180) % 360).toString().padStart(3, '0')}°
                            </div>
                            <div style="font-size:11px;color:rgba(255,255,255,0.5)">${bearingToCompass((results.directBearing + 180) % 360)}</div>
                            ${results.directBearingDetail && results.directBearingDetail.magnetic !== undefined ? `
                                <div style="font-size:10px;color:#22c55e;margin-top:4px">
                                    Mag: ${((results.directBearingDetail.magnetic + 180) % 360).toString().padStart(3, '0')}°
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Estimated Travel Times -->
                <div style="margin-bottom:12px">
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px">Estimated Travel Time</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
                        <div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;text-align:center">
                            <div style="font-size:12px">🚶</div>
                            <div style="font-size:12px;font-weight:500">${results.estimatedTimes.walk}</div>
                            <div style="font-size:9px;color:rgba(255,255,255,0.4)">Walk</div>
                        </div>
                        <div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;text-align:center">
                            <div style="font-size:12px">🚗</div>
                            <div style="font-size:12px;font-weight:500">${results.estimatedTimes.drive}</div>
                            <div style="font-size:9px;color:rgba(255,255,255,0.4)">Drive</div>
                        </div>
                        <div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;text-align:center">
                            <div style="font-size:12px">🏔️</div>
                            <div style="font-size:12px;font-weight:500">${results.estimatedTimes.offroad}</div>
                            <div style="font-size:9px;color:rgba(255,255,255,0.4)">Off-road</div>
                        </div>
                    </div>
                </div>
                
                <!-- Segment Details -->
                ${results.segments.length > 1 ? `
                    <div style="margin-bottom:12px">
                        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px">Segments (${results.segments.length})</div>
                        <div style="max-height:150px;overflow-y:auto">
                            ${results.segments.map((seg, i) => `
                                <div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,0.02);border-radius:6px;margin-bottom:4px;font-size:12px">
                                    <span style="width:20px;text-align:center;color:rgba(255,255,255,0.4)">${i + 1}</span>
                                    <span style="flex:1;font-family:'IBM Plex Mono',monospace">${seg.formattedDistance}</span>
                                    <span style="color:#f97316;font-family:'IBM Plex Mono',monospace;font-size:11px">${Math.round(seg.bearing)}°T</span>
                                    ${seg.bearingDetail && seg.bearingDetail.magnetic !== undefined ? `
                                        <span style="color:#22c55e;font-family:'IBM Plex Mono',monospace;font-size:11px">${seg.bearingDetail.magnetic}°M</span>
                                    ` : ''}
                                    <span style="color:rgba(255,255,255,0.4);font-size:10px">${bearingToCompass(seg.bearing)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Coordinates -->
                <div style="margin-bottom:12px">
                    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px">Coordinates</div>
                    <div style="display:flex;gap:8px">
                        <div style="flex:1;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px">
                            <div style="font-size:9px;color:rgba(255,255,255,0.4)">START</div>
                            <div style="font-size:11px;font-family:'IBM Plex Mono',monospace">
                                ${typeof Coordinates !== 'undefined' 
                                    ? Coordinates.formatShort(results.startPoint.lat, results.startPoint.lon)
                                    : `${results.startPoint.lat.toFixed(4)}°, ${results.startPoint.lon.toFixed(4)}°`}
                            </div>
                        </div>
                        <div style="flex:1;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px">
                            <div style="font-size:9px;color:rgba(255,255,255,0.4)">END</div>
                            <div style="font-size:11px;font-family:'IBM Plex Mono',monospace">
                                ${typeof Coordinates !== 'undefined' 
                                    ? Coordinates.formatShort(results.endPoint.lat, results.endPoint.lon)
                                    : `${results.endPoint.lat.toFixed(4)}°, ${results.endPoint.lon.toFixed(4)}°`}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Actions -->
                <div style="display:flex;gap:8px">
                    <button class="btn btn--secondary" id="measure-undo-btn" style="flex:1;padding:8px;font-size:12px" ${measurePoints.length <= 1 ? 'disabled' : ''}>
                        ↩️ Undo
                    </button>
                    <button class="btn btn--secondary" id="measure-clear-btn" style="flex:1;padding:8px;font-size:12px">
                        🗑️ Clear
                    </button>
                </div>
                
                <div style="display:flex;gap:8px;margin-top:8px">
                    <button class="btn btn--secondary" id="measure-to-route-btn" style="flex:1;padding:8px;font-size:12px">
                        🛣️ Save as Route
                    </button>
                    <button class="btn btn--secondary" id="measure-export-btn" style="flex:1;padding:8px;font-size:12px">
                        📤 Export GPX
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Bind event handlers to results panel
     */
    function bindResultsPanelEvents(container) {
        const undoBtn = container.querySelector('#measure-undo-btn');
        const clearBtn = container.querySelector('#measure-clear-btn');
        const toRouteBtn = container.querySelector('#measure-to-route-btn');
        const exportBtn = container.querySelector('#measure-export-btn');
        
        if (undoBtn) {
            undoBtn.onclick = () => {
                removeLastPoint();
                if (typeof Events !== 'undefined') {
                    Events.emit('measure:updated');
                }
            };
        }
        
        if (clearBtn) {
            clearBtn.onclick = () => {
                clear();
                if (typeof Events !== 'undefined') {
                    Events.emit('measure:updated');
                }
            };
        }
        
        if (toRouteBtn) {
            toRouteBtn.onclick = () => {
                const route = convertToRoute();
                if (route) {
                    State.Routes.add(route);
                    Storage.Routes.save(route);
                    if (typeof ModalsModule !== 'undefined') {
                        ModalsModule.showToast('Route saved!', 'success');
                    }
                    clear();
                    toggle(); // Exit measure mode
                    State.UI.setActivePanel('routes');
                }
            };
        }
        
        if (exportBtn) {
            exportBtn.onclick = () => {
                const gpx = exportAsGPX();
                if (gpx) {
                    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `measurement-${new Date().toISOString().split('T')[0]}.gpx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    if (typeof ModalsModule !== 'undefined') {
                        ModalsModule.showToast('GPX exported', 'success');
                    }
                }
            };
        }
    }

    // Public API
    return {
        init,
        toggle,
        isActive: isActiveMode,
        addPoint,
        removeLastPoint,
        clear,
        setHoverPoint,
        getMeasurementData,
        getResults,
        formatDistance,
        formatBearing,
        calculateDistance,
        calculateBearing,
        bearingToCompass,
        convertToRoute,
        exportAsGPX,
        render,
        renderResultsPanel,
        bindResultsPanelEvents
    };
})();

window.MeasureModule = MeasureModule;
