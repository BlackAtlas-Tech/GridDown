/**
 * GridDown Print/PDF Export Module
 * Generates printable route cards, waypoint lists, and operational planning documents
 * Optimized for paper backup when electronics are unavailable
 */
const PrintModule = (function() {
    'use strict';

    // Print templates
    const TEMPLATES = {
        ROUTE_CARD: 'route-card',
        WAYPOINT_LIST: 'waypoint-list',
        FULL_PLAN: 'full-plan',
        COMM_PLAN: 'comm-plan',
        QUICK_REF: 'quick-ref'
    };

    /**
     * Generate and open print preview for a route card
     */
    function printRouteCard(route, options = {}) {
        const waypoints = State.get('waypoints');
        const html = generateRouteCard(route, waypoints, options);
        openPrintWindow(html, 'Route Card - ' + route.name);
    }

    /**
     * Generate and open print preview for waypoint list
     */
    function printWaypointList(waypoints, options = {}) {
        const html = generateWaypointList(waypoints, options);
        openPrintWindow(html, 'Waypoint List');
    }

    /**
     * Generate and open print preview for full operational plan
     */
    function printFullPlan(options = {}) {
        const routes = State.get('routes').filter(r => !r.isBuilding);
        const waypoints = State.get('waypoints');
        const html = generateFullPlan(routes, waypoints, options);
        openPrintWindow(html, 'Operational Plan');
    }

    /**
     * Generate and open print preview for communication plan
     */
    function printCommPlan(options = {}) {
        const html = generateCommPlan(options);
        openPrintWindow(html, 'Communication Plan');
    }

    /**
     * Generate and open print preview for quick reference card
     */
    function printQuickRef(options = {}) {
        const html = generateQuickRef(options);
        openPrintWindow(html, 'Quick Reference');
    }

    /**
     * Generate route card HTML
     */
    function generateRouteCard(route, waypoints, options = {}) {
        const points = route.points || [];
        const declination = getDeclination();
        const segments = calculateSegments(points, waypoints);
        
        // Get logistics if available
        let logistics = null;
        if (typeof LogisticsModule !== 'undefined' && points.length >= 2) {
            try {
                logistics = LogisticsModule.analyzeRoute(route, waypoints);
            } catch (e) {
                console.warn('Could not calculate logistics:', e);
            }
        }

        return getPrintStyles() + '<div class="print-page">' +
            '<div class="print-header">' +
                '<div class="print-title">' + escapeHtml(route.name) + '</div>' +
                '<div class="print-subtitle">Route Card</div>' +
                '<div class="print-meta">Generated: ' + new Date().toLocaleString() + ' | Declination: ' + (declination ? formatDeclination(declination) : 'N/A') + '</div>' +
            '</div>' +

            '<div class="print-section">' +
                '<div class="section-title">Route Summary</div>' +
                '<div class="stats-row">' +
                    '<div class="stat-box"><div class="stat-value">' + (route.distance || '0') + '</div><div class="stat-label">Miles</div></div>' +
                    '<div class="stat-box"><div class="stat-value">' + (route.duration || '0h') + '</div><div class="stat-label">Est. Time</div></div>' +
                    '<div class="stat-box"><div class="stat-value">' + (route.elevation || '0') + '</div><div class="stat-label">Elev Gain (ft)</div></div>' +
                    '<div class="stat-box"><div class="stat-value">' + points.length + '</div><div class="stat-label">Waypoints</div></div>' +
                '</div>' +
            '</div>' +

            '<div class="print-section">' +
                '<div class="section-title">Turn-by-Turn Directions</div>' +
                '<table class="data-table">' +
                    '<thead><tr>' +
                        '<th style="width:30px">#</th>' +
                        '<th>Waypoint</th>' +
                        '<th style="width:80px">Distance</th>' +
                        '<th style="width:60px">True°</th>' +
                        '<th style="width:60px">Mag°</th>' +
                        '<th style="width:70px">Cumulative</th>' +
                        '<th>Notes</th>' +
                    '</tr></thead>' +
                    '<tbody>' +
                        segments.map(function(seg, i) {
                            return '<tr class="' + (seg.isLinked ? 'waypoint-row' : '') + '">' +
                                '<td class="center">' + (i + 1) + '</td>' +
                                '<td><strong>' + seg.name + '</strong>' +
                                    (seg.type ? '<span class="type-badge type-' + seg.type + '">' + getTypeLabel(seg.type) + '</span>' : '') +
                                    '<div class="coord-small">' + formatCoordShort(seg.lat, seg.lon) + '</div></td>' +
                                '<td class="center mono">' + (i > 0 ? seg.distance.toFixed(1) : '—') + '</td>' +
                                '<td class="center mono">' + (i > 0 ? seg.trueBearing + '°' : '—') + '</td>' +
                                '<td class="center mono">' + (i > 0 ? seg.magBearing + '°' : '—') + '</td>' +
                                '<td class="center mono">' + seg.cumulative.toFixed(1) + '</td>' +
                                '<td class="notes">' + escapeHtml(seg.notes || '') + '</td>' +
                            '</tr>';
                        }).join('') +
                    '</tbody>' +
                '</table>' +
            '</div>' +

            (logistics ? 
                '<div class="print-section">' +
                    '<div class="section-title">Logistics Requirements</div>' +
                    '<div class="stats-row">' +
                        '<div class="stat-box"><div class="stat-value">' + logistics.summary.totalFuel.toFixed(1) + '</div><div class="stat-label">Gallons Fuel</div></div>' +
                        '<div class="stat-box"><div class="stat-value">' + logistics.summary.waterRequired.toFixed(1) + '</div><div class="stat-label">Gallons Water</div></div>' +
                        '<div class="stat-box ' + (logistics.summary.canComplete ? '' : 'warning') + '"><div class="stat-value">' + (logistics.summary.canComplete ? '✓' : '✗') + '</div><div class="stat-label">Feasible</div></div>' +
                    '</div>' +
                    (logistics.criticalPoints.length > 0 ?
                        '<div class="warning-box"><strong>⚠️ Critical Points:</strong><ul>' +
                            logistics.criticalPoints.map(function(cp) {
                                return '<li>' + escapeHtml(cp.location) + ': ' + escapeHtml(cp.issue) + '</li>';
                            }).join('') +
                        '</ul></div>'
                    : '') +
                '</div>'
            : '') +

            getBailoutSection(waypoints) +

            '<div class="print-footer"><div>GridDown Tactical Navigation</div><div>Page 1</div></div>' +
        '</div>';
    }

    function getBailoutSection(waypoints) {
        var bailouts = waypoints.filter(function(w) { return w.type === 'bailout'; });
        if (bailouts.length === 0) return '';
        return '<div class="print-section">' +
            '<div class="section-title">🚁 Bail-out Points</div>' +
            '<table class="data-table compact">' +
                '<thead><tr><th>Name</th><th>Coordinates</th><th>Notes</th></tr></thead>' +
                '<tbody>' +
                    bailouts.map(function(bp) {
                        return '<tr>' +
                            '<td><strong>' + escapeHtml(bp.name) + '</strong></td>' +
                            '<td class="mono">' + formatCoord(bp.lat || toLatFromY(bp.y), bp.lon || toLonFromX(bp.x)) + '</td>' +
                            '<td>' + escapeHtml(bp.notes || '') + '</td>' +
                        '</tr>';
                    }).join('') +
                '</tbody>' +
            '</table>' +
        '</div>';
    }

    /**
     * Generate waypoint list HTML
     */
    function generateWaypointList(waypoints, options) {
        var declination = getDeclination();
        var grouped = groupWaypointsByType(waypoints);
        
        var content = '';
        Object.keys(grouped).forEach(function(type) {
            var wps = grouped[type];
            content += '<div class="print-section">' +
                '<div class="section-title">' + getTypeIcon(type) + ' ' + getTypeLabel(type) + ' (' + wps.length + ')</div>' +
                '<table class="data-table">' +
                    '<thead><tr><th>Name</th><th style="width:180px">Coordinates</th><th style="width:50px">✓</th><th>Notes</th></tr></thead>' +
                    '<tbody>' +
                        wps.map(function(wp) {
                            return '<tr>' +
                                '<td><strong>' + escapeHtml(wp.name) + '</strong></td>' +
                                '<td class="mono">' + formatCoord(wp.lat || toLatFromY(wp.y), wp.lon || toLonFromX(wp.x)) + '</td>' +
                                '<td class="center">' + (wp.verified ? '✓' : '') + '</td>' +
                                '<td class="notes">' + escapeHtml(wp.notes || '') + '</td>' +
                            '</tr>';
                        }).join('') +
                    '</tbody>' +
                '</table>' +
            '</div>';
        });

        return getPrintStyles() + '<div class="print-page">' +
            '<div class="print-header">' +
                '<div class="print-title">Waypoint List</div>' +
                '<div class="print-subtitle">' + waypoints.length + ' Waypoints</div>' +
                '<div class="print-meta">Generated: ' + new Date().toLocaleString() + ' | Declination: ' + (declination ? formatDeclination(declination) : 'N/A') + '</div>' +
            '</div>' +
            content +
            '<div class="print-footer"><div>GridDown Tactical Navigation</div><div>Page 1</div></div>' +
        '</div>';
    }

    /**
     * Generate full operational plan HTML
     */
    function generateFullPlan(routes, waypoints, options) {
        var declination = getDeclination();
        var mapState = typeof MapModule !== 'undefined' ? MapModule.getMapState() : null;
        var pageNum = 1;
        var html = getPrintStyles();

        // Cover Page
        html += '<div class="print-page cover-page">' +
            '<div class="cover-content">' +
                '<div class="cover-title">OPERATIONAL PLAN</div>' +
                '<div class="cover-subtitle">' + (options.planName || 'Mission Planning Document') + '</div>' +
                '<div class="cover-meta">' +
                    '<div class="cover-meta-row"><span class="label">Generated:</span><span>' + new Date().toLocaleString() + '</span></div>' +
                    '<div class="cover-meta-row"><span class="label">Routes:</span><span>' + routes.length + '</span></div>' +
                    '<div class="cover-meta-row"><span class="label">Waypoints:</span><span>' + waypoints.length + '</span></div>' +
                    '<div class="cover-meta-row"><span class="label">Magnetic Declination:</span><span>' + (declination ? formatDeclination(declination) : 'N/A') + '</span></div>' +
                    (mapState ? '<div class="cover-meta-row"><span class="label">Area Center:</span><span>' + formatCoord(mapState.lat, mapState.lon) + '</span></div>' : '') +
                '</div>' +
            '</div>' +
            '<div class="print-footer"><div>GridDown Tactical Navigation</div><div>Page ' + (pageNum++) + '</div></div>' +
        '</div>';

        // Quick Reference Page
        html += generateQuickRefContent(waypoints, declination, pageNum++);

        // Route Cards
        routes.forEach(function(route) {
            html += '<div class="print-page">' +
                '<div class="print-header">' +
                    '<div class="print-title">' + escapeHtml(route.name) + '</div>' +
                    '<div class="print-subtitle">Route Card</div>' +
                '</div>' +
                generateRouteCardContent(route, waypoints, declination) +
                '<div class="print-footer"><div>GridDown Tactical Navigation</div><div>Page ' + (pageNum++) + '</div></div>' +
            '</div>';
        });

        // Complete Waypoint List
        if (waypoints.length > 0) {
            html += '<div class="print-page">' +
                '<div class="print-header">' +
                    '<div class="print-title">Complete Waypoint List</div>' +
                    '<div class="print-subtitle">' + waypoints.length + ' Waypoints</div>' +
                '</div>' +
                '<table class="data-table">' +
                    '<thead><tr><th style="width:30px">#</th><th>Name</th><th>Type</th><th style="width:180px">Coordinates</th><th>Notes</th></tr></thead>' +
                    '<tbody>' +
                        waypoints.map(function(wp, i) {
                            return '<tr>' +
                                '<td class="center">' + (i + 1) + '</td>' +
                                '<td><strong>' + escapeHtml(wp.name) + '</strong></td>' +
                                '<td>' + getTypeIcon(wp.type) + ' ' + getTypeLabel(wp.type) + '</td>' +
                                '<td class="mono">' + formatCoord(wp.lat || toLatFromY(wp.y), wp.lon || toLonFromX(wp.x)) + '</td>' +
                                '<td class="notes">' + escapeHtml(wp.notes || '') + '</td>' +
                            '</tr>';
                        }).join('') +
                    '</tbody>' +
                '</table>' +
                '<div class="print-footer"><div>GridDown Tactical Navigation</div><div>Page ' + pageNum + '</div></div>' +
            '</div>';
        }

        return html;
    }

    function generateQuickRefContent(waypoints, declination, pageNum) {
        var bailouts = waypoints.filter(function(w) { return w.type === 'bailout'; });
        var water = waypoints.filter(function(w) { return w.type === 'water'; });
        var fuel = waypoints.filter(function(w) { return w.type === 'fuel'; });

        return '<div class="print-page">' +
            '<div class="print-header"><div class="print-title">Quick Reference</div></div>' +
            '<div class="two-column">' +
                '<div class="column">' +
                    '<div class="print-section">' +
                        '<div class="section-title">📞 Emergency</div>' +
                        '<table class="data-table compact">' +
                            '<tr><td><strong>911</strong></td><td>Emergency Services</td></tr>' +
                            '<tr><td><strong>Ch 9</strong></td><td>CB Emergency</td></tr>' +
                            '<tr><td><strong>Ch 16</strong></td><td>Marine VHF</td></tr>' +
                        '</table>' +
                    '</div>' +
                    '<div class="print-section">' +
                        '<div class="section-title">🧭 Declination</div>' +
                        (declination ?
                            '<div class="declination-box"><div class="dec-value">' + formatDeclination(declination) + '</div>' +
                            '<div class="dec-note">' + (declination >= 0 ? 'Add to mag for true' : 'Subtract from mag for true') + '</div></div>' +
                            '<table class="data-table compact">' +
                                '<thead><tr><th>True</th><th>Mag</th></tr></thead>' +
                                '<tbody>' +
                                    [0, 45, 90, 135, 180, 225, 270, 315].map(function(t) {
                                        return '<tr><td class="mono">' + t + '°</td><td class="mono">' + trueTomMag(t, declination) + '°</td></tr>';
                                    }).join('') +
                                '</tbody>' +
                            '</table>'
                        : '<div class="empty-note">N/A</div>') +
                    '</div>' +
                '</div>' +
                '<div class="column">' +
                    '<div class="print-section">' +
                        '<div class="section-title">🚁 Bail-outs (' + bailouts.length + ')</div>' +
                        (bailouts.length > 0 ?
                            '<table class="data-table compact">' +
                                bailouts.slice(0, 5).map(function(bp) {
                                    return '<tr><td><strong>' + escapeHtml(bp.name) + '</strong></td></tr>' +
                                        '<tr><td class="mono" style="font-size:10px">' + formatCoordShort(bp.lat || toLatFromY(bp.y), bp.lon || toLonFromX(bp.x)) + '</td></tr>';
                                }).join('') +
                            '</table>'
                        : '<div class="empty-note">None</div>') +
                    '</div>' +
                    '<div class="print-section">' +
                        '<div class="section-title">💧 Water (' + water.length + ')</div>' +
                        (water.length > 0 ?
                            '<table class="data-table compact">' +
                                water.slice(0, 4).map(function(wp) {
                                    return '<tr><td>' + escapeHtml(wp.name) + '</td><td class="mono" style="font-size:10px">' + formatCoordShort(wp.lat || toLatFromY(wp.y), wp.lon || toLonFromX(wp.x)) + '</td></tr>';
                                }).join('') +
                            '</table>'
                        : '<div class="empty-note">None</div>') +
                    '</div>' +
                    '<div class="print-section">' +
                        '<div class="section-title">⛽ Fuel (' + fuel.length + ')</div>' +
                        (fuel.length > 0 ?
                            '<table class="data-table compact">' +
                                fuel.slice(0, 4).map(function(wp) {
                                    return '<tr><td>' + escapeHtml(wp.name) + '</td><td class="mono" style="font-size:10px">' + formatCoordShort(wp.lat || toLatFromY(wp.y), wp.lon || toLonFromX(wp.x)) + '</td></tr>';
                                }).join('') +
                            '</table>'
                        : '<div class="empty-note">None</div>') +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="print-footer"><div>GridDown Tactical Navigation</div><div>Page ' + pageNum + '</div></div>' +
        '</div>';
    }

    function generateRouteCardContent(route, waypoints, declination) {
        var points = route.points || [];
        var segments = calculateSegments(points, waypoints);

        return '<div class="stats-row" style="margin-bottom:12px">' +
                '<div class="stat-box"><div class="stat-value">' + (route.distance || '0') + '</div><div class="stat-label">Miles</div></div>' +
                '<div class="stat-box"><div class="stat-value">' + (route.duration || '0h') + '</div><div class="stat-label">Time</div></div>' +
                '<div class="stat-box"><div class="stat-value">' + (route.elevation || '0') + '</div><div class="stat-label">Elev (ft)</div></div>' +
                '<div class="stat-box"><div class="stat-value">' + points.length + '</div><div class="stat-label">Points</div></div>' +
            '</div>' +
            '<table class="data-table">' +
                '<thead><tr><th style="width:25px">#</th><th>Waypoint</th><th style="width:70px">Dist</th><th style="width:50px">T°</th><th style="width:50px">M°</th><th style="width:60px">Total</th></tr></thead>' +
                '<tbody>' +
                    segments.map(function(seg, i) {
                        return '<tr>' +
                            '<td class="center">' + (i + 1) + '</td>' +
                            '<td><strong>' + seg.name + '</strong><div class="coord-small">' + formatCoordShort(seg.lat, seg.lon) + '</div></td>' +
                            '<td class="center mono">' + (i > 0 ? seg.distance.toFixed(1) : '—') + '</td>' +
                            '<td class="center mono">' + (i > 0 ? seg.trueBearing + '°' : '—') + '</td>' +
                            '<td class="center mono">' + (i > 0 ? seg.magBearing + '°' : '—') + '</td>' +
                            '<td class="center mono">' + seg.cumulative.toFixed(1) + '</td>' +
                        '</tr>';
                    }).join('') +
                '</tbody>' +
            '</table>';
    }

    /**
     * Generate communication plan HTML
     */
    function generateCommPlan(options) {
        return getPrintStyles() + '<div class="print-page">' +
            '<div class="print-header">' +
                '<div class="print-title">Communication Plan</div>' +
                '<div class="print-meta">Generated: ' + new Date().toLocaleString() + '</div>' +
            '</div>' +
            '<div class="print-section">' +
                '<div class="section-title">📻 Radio Reference</div>' +
                '<div class="two-column">' +
                    '<div class="column">' +
                        '<table class="data-table compact">' +
                            '<thead><tr><th colspan="2">FRS Channels</th></tr></thead>' +
                            '<tbody>' +
                                [1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(function(ch) {
                                    var freq = 462.5625 + (ch - 1) * 0.025;
                                    return '<tr><td>Ch ' + ch + '</td><td class="mono">' + freq.toFixed(4) + ' MHz</td></tr>';
                                }).join('') +
                            '</tbody>' +
                        '</table>' +
                    '</div>' +
                    '<div class="column">' +
                        '<table class="data-table compact">' +
                            '<thead><tr><th colspan="2">GMRS Channels</th></tr></thead>' +
                            '<tbody>' +
                                [15,16,17,18,19,20,21,22].map(function(ch) {
                                    var freqs = {15: 462.550, 16: 462.575, 17: 462.600, 18: 462.625, 19: 462.650, 20: 462.675, 21: 462.700, 22: 462.725};
                                    return '<tr><td>Ch ' + ch + '</td><td class="mono">' + freqs[ch].toFixed(3) + ' MHz</td></tr>';
                                }).join('') +
                            '</tbody>' +
                        '</table>' +
                        '<table class="data-table compact" style="margin-top:12px">' +
                            '<thead><tr><th colspan="2">Emergency</th></tr></thead>' +
                            '<tbody>' +
                                '<tr><td>Marine VHF 16</td><td class="mono">156.800 MHz</td></tr>' +
                                '<tr><td>Aviation Guard</td><td class="mono">121.500 MHz</td></tr>' +
                                '<tr><td>CB Ch 9</td><td class="mono">27.065 MHz</td></tr>' +
                            '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="print-section">' +
                '<div class="section-title">🔤 NATO Phonetic Alphabet</div>' +
                '<table class="data-table compact phonetic-table">' +
                    '<tbody>' +
                        '<tr>' + ['A-Alpha', 'B-Bravo', 'C-Charlie', 'D-Delta', 'E-Echo', 'F-Foxtrot'].map(function(p) { return '<td>' + p + '</td>'; }).join('') + '</tr>' +
                        '<tr>' + ['G-Golf', 'H-Hotel', 'I-India', 'J-Juliet', 'K-Kilo', 'L-Lima'].map(function(p) { return '<td>' + p + '</td>'; }).join('') + '</tr>' +
                        '<tr>' + ['M-Mike', 'N-November', 'O-Oscar', 'P-Papa', 'Q-Quebec', 'R-Romeo'].map(function(p) { return '<td>' + p + '</td>'; }).join('') + '</tr>' +
                        '<tr>' + ['S-Sierra', 'T-Tango', 'U-Uniform', 'V-Victor', 'W-Whiskey', 'X-X-ray'].map(function(p) { return '<td>' + p + '</td>'; }).join('') + '</tr>' +
                        '<tr>' + ['Y-Yankee', 'Z-Zulu', '0-Zero', '1-One', '2-Two', '3-Three'].map(function(p) { return '<td>' + p + '</td>'; }).join('') + '</tr>' +
                        '<tr>' + ['4-Four', '5-Five', '6-Six', '7-Seven', '8-Eight', '9-Niner'].map(function(p) { return '<td>' + p + '</td>'; }).join('') + '</tr>' +
                    '</tbody>' +
                '</table>' +
            '</div>' +
            '<div class="print-footer"><div>GridDown Tactical Navigation</div><div>Page 1</div></div>' +
        '</div>';
    }

    /**
     * Generate quick reference card HTML
     */
    function generateQuickRef(options) {
        var waypoints = State.get('waypoints');
        var declination = getDeclination();
        var bailouts = waypoints.filter(function(w) { return w.type === 'bailout'; });
        var water = waypoints.filter(function(w) { return w.type === 'water'; });

        return getPrintStyles() + '<div class="print-page quick-ref">' +
            '<div class="print-header">' +
                '<div class="print-title">Quick Reference Card</div>' +
                '<div class="print-meta">' + new Date().toLocaleDateString() + '</div>' +
            '</div>' +
            '<div class="three-column">' +
                '<div class="column">' +
                    '<div class="section-title">🚁 Bail-outs</div>' +
                    (bailouts.length > 0 ? bailouts.slice(0, 4).map(function(bp) {
                        return '<div class="quick-item"><strong>' + escapeHtml(bp.name) + '</strong><br><span class="mono">' + formatCoordShort(bp.lat || toLatFromY(bp.y), bp.lon || toLonFromX(bp.x)) + '</span></div>';
                    }).join('') : '<div class="empty-note">None</div>') +
                '</div>' +
                '<div class="column">' +
                    '<div class="section-title">💧 Water</div>' +
                    (water.length > 0 ? water.slice(0, 4).map(function(wp) {
                        return '<div class="quick-item"><strong>' + escapeHtml(wp.name) + '</strong><br><span class="mono">' + formatCoordShort(wp.lat || toLatFromY(wp.y), wp.lon || toLonFromX(wp.x)) + '</span></div>';
                    }).join('') : '<div class="empty-note">None</div>') +
                '</div>' +
                '<div class="column">' +
                    '<div class="section-title">🧭 Declination</div>' +
                    (declination ?
                        '<div class="dec-box"><div class="dec-big">' + formatDeclination(declination) + '</div></div>' +
                        '<table class="mini-table">' +
                            '<tr><td>N</td><td>' + trueTomMag(0, declination) + '°M</td></tr>' +
                            '<tr><td>E</td><td>' + trueTomMag(90, declination) + '°M</td></tr>' +
                            '<tr><td>S</td><td>' + trueTomMag(180, declination) + '°M</td></tr>' +
                            '<tr><td>W</td><td>' + trueTomMag(270, declination) + '°M</td></tr>' +
                        '</table>'
                    : '<div class="empty-note">N/A</div>') +
                '</div>' +
            '</div>' +
            '<div class="section-title" style="margin-top:12px">📞 Emergency</div>' +
            '<div class="emergency-row">' +
                '<span><strong>911</strong> Emergency</span>' +
                '<span><strong>Ch 9</strong> CB Emergency</span>' +
                '<span><strong>Ch 16</strong> Marine VHF</span>' +
                '<span><strong>121.5</strong> Aviation Guard</span>' +
            '</div>' +
            '<div class="print-footer"><div>GridDown</div></div>' +
        '</div>';
    }

    /**
     * Get print styles
     */
    function getPrintStyles() {
        return '<style>' +
            '@page { size: letter; margin: 0.5in; }' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; line-height: 1.4; color: #000; background: #fff; }' +
            '.print-page { width: 7.5in; min-height: 10in; padding: 0.25in; page-break-after: always; position: relative; }' +
            '.print-page:last-child { page-break-after: auto; }' +
            '.print-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }' +
            '.print-title { font-size: 18px; font-weight: 700; }' +
            '.print-subtitle { font-size: 12px; color: #666; }' +
            '.print-meta { font-size: 9px; color: #888; margin-top: 4px; }' +
            '.print-section { margin-bottom: 16px; }' +
            '.section-title { font-size: 12px; font-weight: 700; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }' +
            '.stats-row { display: flex; gap: 12px; margin-bottom: 12px; }' +
            '.stat-box { flex: 1; text-align: center; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }' +
            '.stat-box.warning { border-color: #c00; background: #fee; }' +
            '.stat-value { font-size: 18px; font-weight: 700; }' +
            '.stat-label { font-size: 9px; color: #666; text-transform: uppercase; }' +
            '.data-table { width: 100%; border-collapse: collapse; font-size: 10px; }' +
            '.data-table th, .data-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }' +
            '.data-table th { background: #f5f5f5; font-weight: 600; }' +
            '.data-table.compact td, .data-table.compact th { padding: 3px 5px; }' +
            '.data-table tr:nth-child(even) { background: #fafafa; }' +
            '.center { text-align: center; }' +
            '.mono { font-family: "Courier New", monospace; }' +
            '.notes { font-size: 9px; color: #666; }' +
            '.coord-small { font-size: 9px; color: #666; font-family: "Courier New", monospace; }' +
            '.type-badge { display: inline-block; font-size: 8px; padding: 1px 4px; border-radius: 2px; background: #eee; margin-left: 4px; }' +
            '.waypoint-row { background: #f0f8ff !important; }' +
            '.warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 8px; border-radius: 4px; margin-top: 8px; }' +
            '.warning-box ul { margin: 4px 0 0 16px; }' +
            '.two-column { display: flex; gap: 16px; }' +
            '.two-column .column { flex: 1; }' +
            '.three-column { display: flex; gap: 12px; }' +
            '.three-column .column { flex: 1; }' +
            '.empty-note { color: #999; font-style: italic; padding: 4px; }' +
            '.declination-box { text-align: center; padding: 12px; background: #f5f5f5; border-radius: 4px; margin-bottom: 8px; }' +
            '.dec-value { font-size: 24px; font-weight: 700; }' +
            '.dec-note { font-size: 9px; color: #666; }' +
            '.phonetic-table td { text-align: center; font-size: 9px; padding: 3px !important; }' +
            '.print-footer { position: absolute; bottom: 0.25in; left: 0.25in; right: 0.25in; display: flex; justify-content: space-between; font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 4px; }' +
            '.cover-page { display: flex; flex-direction: column; }' +
            '.cover-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }' +
            '.cover-title { font-size: 36px; font-weight: 700; margin-bottom: 8px; }' +
            '.cover-subtitle { font-size: 18px; color: #666; margin-bottom: 32px; }' +
            '.cover-meta { text-align: left; border: 1px solid #ccc; padding: 16px; border-radius: 4px; }' +
            '.cover-meta-row { display: flex; gap: 8px; margin-bottom: 4px; }' +
            '.cover-meta-row .label { font-weight: 600; width: 150px; }' +
            '.quick-ref .quick-item { padding: 4px; border-bottom: 1px solid #eee; font-size: 10px; }' +
            '.quick-ref .dec-box { text-align: center; padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 6px; }' +
            '.quick-ref .dec-big { font-size: 20px; font-weight: 700; }' +
            '.quick-ref .mini-table { width: 100%; font-size: 9px; }' +
            '.quick-ref .mini-table td { padding: 2px 4px; border: none; }' +
            '.emergency-row { display: flex; justify-content: space-around; padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 10px; }' +
            '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-page { page-break-after: always; } }' +
        '</style>';
    }

    /**
     * Open print window
     */
    function openPrintWindow(html, title) {
        var printWindow = window.open('', '_blank', 'width=850,height=1100');
        
        if (!printWindow) {
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast('Pop-up blocked. Please allow pop-ups.', 'error');
            }
            return;
        }

        printWindow.document.write('<!DOCTYPE html><html><head><title>' + escapeHtml(title) + ' - GridDown</title><meta charset="UTF-8"></head><body>' + html + '<script>setTimeout(function() { window.print(); }, 500);</script></body></html>');
        printWindow.document.close();
    }

    // Helper functions
    function getDeclination() {
        if (typeof DeclinationModule !== 'undefined') {
            var current = DeclinationModule.getCurrent();
            return current ? current.declination : null;
        }
        return null;
    }

    function formatDeclination(dec) {
        if (dec === null) return 'N/A';
        var abs = Math.abs(dec);
        var dir = dec >= 0 ? 'E' : 'W';
        return abs.toFixed(1) + '° ' + dir;
    }

    function trueTomMag(trueBearing, declination) {
        if (declination === null) return trueBearing;
        var mag = trueBearing - declination;
        while (mag < 0) mag += 360;
        while (mag >= 360) mag -= 360;
        return Math.round(mag);
    }

    function formatCoord(lat, lon) {
        if (typeof Coordinates !== 'undefined') {
            return Coordinates.toDMS(lat, lon);
        }
        var latDir = lat >= 0 ? 'N' : 'S';
        var lonDir = lon >= 0 ? 'E' : 'W';
        return Math.abs(lat).toFixed(5) + '° ' + latDir + ', ' + Math.abs(lon).toFixed(5) + '° ' + lonDir;
    }

    function formatCoordShort(lat, lon) {
        if (typeof Coordinates !== 'undefined') {
            return Coordinates.formatShort(lat, lon);
        }
        var latDir = lat >= 0 ? 'N' : 'S';
        var lonDir = lon >= 0 ? 'E' : 'W';
        return Math.abs(lat).toFixed(4) + latDir + ' ' + Math.abs(lon).toFixed(4) + lonDir;
    }

    function toLatFromY(y) { return 37.4215 + (y - 50) * 0.002; }
    function toLonFromX(x) { return -119.1892 + (x - 50) * 0.004; }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getTypeIcon(type) {
        var icons = { water: '💧', fuel: '⛽', camp: '🏕️', resupply: '🏪', hazard: '⚠️', bailout: '🚁', custom: '📍' };
        return icons[type] || '📍';
    }

    function getTypeLabel(type) {
        var labels = { water: 'Water', fuel: 'Fuel', camp: 'Camp', resupply: 'Resupply', hazard: 'Hazard', bailout: 'Bail-out', custom: 'Custom' };
        return labels[type] || 'Point';
    }

    function groupWaypointsByType(waypoints) {
        var grouped = {};
        waypoints.forEach(function(wp) {
            var type = wp.type || 'custom';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(wp);
        });
        return grouped;
    }

    function calculateSegments(points, waypoints) {
        var segments = [];
        var cumulative = 0;
        var declination = getDeclination();

        for (var i = 0; i < points.length; i++) {
            var pt = points[i];
            var linkedWp = pt.waypointId ? waypoints.find(function(w) { return w.id === pt.waypointId; }) : null;
            
            var lat = (linkedWp && linkedWp.lat) || pt.lat || toLatFromY(pt.y || 50);
            var lon = (linkedWp && linkedWp.lon) || pt.lon || toLonFromX(pt.x || 50);
            var name = (linkedWp && linkedWp.name) || pt.name || ('Point ' + (i + 1));
            var type = linkedWp ? linkedWp.type : null;
            var notes = (linkedWp && linkedWp.notes) || pt.notes || '';

            var distance = 0;
            var trueBearing = 0;
            var magBearing = 0;

            if (i > 0) {
                var prevPt = points[i - 1];
                var prevWp = prevPt.waypointId ? waypoints.find(function(w) { return w.id === prevPt.waypointId; }) : null;
                var prevLat = (prevWp && prevWp.lat) || prevPt.lat || toLatFromY(prevPt.y || 50);
                var prevLon = (prevWp && prevWp.lon) || prevPt.lon || toLonFromX(prevPt.x || 50);
                
                distance = haversineDistance(prevLat, prevLon, lat, lon);
                trueBearing = calculateBearing(prevLat, prevLon, lat, lon);
                magBearing = declination !== null ? trueTomMag(trueBearing, declination) : trueBearing;
                cumulative += distance;
            }

            segments.push({
                name: name,
                lat: lat,
                lon: lon,
                type: type,
                notes: notes,
                isLinked: !!linkedWp,
                distance: distance,
                trueBearing: Math.round(trueBearing),
                magBearing: Math.round(magBearing),
                cumulative: cumulative
            });
        }

        return segments;
    }

    function haversineDistance(lat1, lon1, lat2, lon2) {
        var R = 3959;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var lat1Rad = lat1 * Math.PI / 180;
        var lat2Rad = lat2 * Math.PI / 180;
        var y = Math.sin(dLon) * Math.cos(lat2Rad);
        var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        var bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    /**
     * Show print options modal
     */
    function showPrintModal() {
        var routes = State.get('routes').filter(function(r) { return !r.isBuilding; });
        var waypoints = State.get('waypoints');
        
        var modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = '<div class="modal-backdrop" id="modal-backdrop">' +
            '<div class="modal" style="width:420px">' +
                '<div class="modal__header">' +
                    '<h3 class="modal__title">🖨️ Print / Export PDF</h3>' +
                    '<button class="modal__close" id="modal-close">' + Icons.get('close') + '</button>' +
                '</div>' +
                '<div class="modal__body">' +
                    '<p style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:16px">Generate printable documents for paper backup. Use browser\'s "Save as PDF" option to create PDF files.</p>' +
                    '<div class="section-label">Document Type</div>' +
                    '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">' +
                        '<button class="btn btn--secondary print-option" data-type="full" style="text-align:left;padding:12px">' +
                            '<div style="display:flex;align-items:center;gap:12px"><span style="font-size:20px">📋</span><div><div style="font-weight:600">Full Operational Plan</div><div style="font-size:11px;color:rgba(255,255,255,0.5)">Complete plan with all routes, waypoints, and references</div></div></div>' +
                        '</button>' +
                        (routes.length > 0 ? '<button class="btn btn--secondary print-option" data-type="route" style="text-align:left;padding:12px"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:20px">🗺️</span><div><div style="font-weight:600">Route Card</div><div style="font-size:11px;color:rgba(255,255,255,0.5)">Turn-by-turn with bearings for a single route</div></div></div></button>' : '') +
                        (waypoints.length > 0 ? '<button class="btn btn--secondary print-option" data-type="waypoints" style="text-align:left;padding:12px"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:20px">📍</span><div><div style="font-weight:600">Waypoint List</div><div style="font-size:11px;color:rgba(255,255,255,0.5)">All waypoints grouped by type with coordinates</div></div></div></button>' : '') +
                        '<button class="btn btn--secondary print-option" data-type="comm" style="text-align:left;padding:12px"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:20px">📻</span><div><div style="font-weight:600">Communication Plan</div><div style="font-size:11px;color:rgba(255,255,255,0.5)">Radio frequencies, phonetic alphabet, emergency channels</div></div></div></button>' +
                        '<button class="btn btn--secondary print-option" data-type="quick" style="text-align:left;padding:12px"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:20px">📇</span><div><div style="font-weight:600">Quick Reference Card</div><div style="font-size:11px;color:rgba(255,255,255,0.5)">Pocket-sized emergency info and key waypoints</div></div></div></button>' +
                    '</div>' +
                    '<div id="route-select-section" style="display:none;margin-bottom:16px">' +
                        '<div class="section-label">Select Route</div>' +
                        '<select id="route-select" style="width:100%">' +
                            routes.map(function(r) { return '<option value="' + r.id + '">' + escapeHtml(r.name) + '</option>'; }).join('') +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="modal__footer">' +
                    '<button class="btn btn--secondary" id="modal-cancel">Cancel</button>' +
                    '<button class="btn btn--primary" id="print-btn">🖨️ Print Preview</button>' +
                '</div>' +
            '</div>' +
        '</div>';

        var selectedType = 'full';
        var routeSection = modalContainer.querySelector('#route-select-section');

        modalContainer.querySelectorAll('.print-option').forEach(function(btn) {
            btn.onclick = function() {
                modalContainer.querySelectorAll('.print-option').forEach(function(b) {
                    b.style.background = '';
                    b.style.borderColor = '';
                });
                btn.style.background = 'rgba(249,115,22,0.1)';
                btn.style.borderColor = 'rgba(249,115,22,0.3)';
                selectedType = btn.dataset.type;
                routeSection.style.display = selectedType === 'route' ? 'block' : 'none';
            };
        });

        var firstOption = modalContainer.querySelector('.print-option');
        if (firstOption) firstOption.click();

        modalContainer.querySelector('#modal-close').onclick = function() { modalContainer.innerHTML = ''; };
        modalContainer.querySelector('#modal-cancel').onclick = function() { modalContainer.innerHTML = ''; };
        modalContainer.querySelector('#modal-backdrop').onclick = function(e) {
            if (e.target.id === 'modal-backdrop') modalContainer.innerHTML = '';
        };

        modalContainer.querySelector('#print-btn').onclick = function() {
            var routeSelect = modalContainer.querySelector('#route-select');
            modalContainer.innerHTML = '';

            switch (selectedType) {
                case 'full':
                    printFullPlan({});
                    break;
                case 'route':
                    var routeId = routeSelect ? routeSelect.value : null;
                    var route = routes.find(function(r) { return r.id === routeId; }) || routes[0];
                    if (route) printRouteCard(route, {});
                    break;
                case 'waypoints':
                    printWaypointList(waypoints, {});
                    break;
                case 'comm':
                    printCommPlan({});
                    break;
                case 'quick':
                    printQuickRef({});
                    break;
            }
        };
    }

    return {
        TEMPLATES: TEMPLATES,
        printRouteCard: printRouteCard,
        printWaypointList: printWaypointList,
        printFullPlan: printFullPlan,
        printCommPlan: printCommPlan,
        printQuickRef: printQuickRef,
        showPrintModal: showPrintModal,
        generateRouteCard: generateRouteCard,
        generateWaypointList: generateWaypointList,
        generateFullPlan: generateFullPlan,
        generateCommPlan: generateCommPlan,
        generateQuickRef: generateQuickRef
    };
})();

window.PrintModule = PrintModule;
