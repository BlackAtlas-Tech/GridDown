/**
 * RF Line-of-Sight Analysis Module for GridDown
 * Analyzes radio propagation paths between two points
 */

const RFLOSModule = (function() {
    'use strict';

    // ==================== CONSTANTS ====================
    
    const EARTH_RADIUS_M = 6371000;
    const K_FACTOR = 4/3;  // Standard atmospheric refraction
    const EFFECTIVE_RADIUS = EARTH_RADIUS_M * K_FACTOR;
    const SPEED_OF_LIGHT = 299.792458;  // m/μs
    
    const FREQUENCY_PRESETS = {
        meshtastic_us: { freq: 915, name: 'Meshtastic US (915 MHz)',   txPower: 22,  txGain: 2.15, rxGain: 2.15, rxSens: -136 },
        meshtastic_eu: { freq: 868, name: 'Meshtastic EU (868 MHz)',   txPower: 14,  txGain: 2.15, rxGain: 2.15, rxSens: -136 },
        vhf_2m:        { freq: 146, name: '2m Amateur (146 MHz)',      txPower: 37,  txGain: 2.15, rxGain: 2.15, rxSens: -120 },
        uhf_70cm:      { freq: 446, name: '70cm Amateur (446 MHz)',    txPower: 37,  txGain: 2.15, rxGain: 2.15, rxSens: -120 },
        gmrs:          { freq: 462, name: 'GMRS (462 MHz)',            txPower: 37,  txGain: 3.0,  rxGain: 3.0,  rxSens: -118 },
        frs:           { freq: 467, name: 'FRS (467 MHz)',             txPower: 30,  txGain: 0,    rxGain: 0,    rxSens: -118 },
        murs:          { freq: 151, name: 'MURS (151 MHz)',            txPower: 30,  txGain: 0,    rxGain: 0,    rxSens: -118 },
        marine:        { freq: 156.8, name: 'Marine VHF (156.8 MHz)',  txPower: 37,  txGain: 3.0,  rxGain: 3.0,  rxSens: -118 },
        cb:            { freq: 27, name: 'CB Radio (27 MHz)',          txPower: 34,  txGain: 0,    rxGain: 0,    rxSens: -110 },
        custom:        { freq: 915, name: 'Custom Frequency',         txPower: 22,  txGain: 2.15, rxGain: 2.15, rxSens: -120 }
    };

    // ==================== STATE ====================
    
    let pointA = null;
    let pointB = null;
    let antennaHeightA = 2;
    let antennaHeightB = 2;
    let selectedPreset = 'meshtastic_us';
    let customFrequency = 915;
    let currentAnalysis = null;
    let isSelectingPoint = null;  // 'A' or 'B' or null
    let subscribers = [];

    // Link budget parameters (initialized from default preset)
    let txPower = FREQUENCY_PRESETS.meshtastic_us.txPower;
    let txAntennaGain = FREQUENCY_PRESETS.meshtastic_us.txGain;
    let rxAntennaGain = FREQUENCY_PRESETS.meshtastic_us.rxGain;
    let rxSensitivity = FREQUENCY_PRESETS.meshtastic_us.rxSens;
    let linkBudgetExpanded = false;

    // Multi-hop relay state
    const MAX_RELAYS = 8;
    let relayMode = false;
    let relays = [];                // Array of { lat, lon, antennaHeight }
    let isSelectingRelay = -1;      // Index of relay being placed, -1 = not selecting
    let multiHopAnalysis = null;    // { hops: [], summary: {} }
    let activeHopIndex = 0;         // Which hop's profile to show in canvas

    // Viewshed state
    let viewshedMode = false;
    let viewshedCenter = null;      // { lat, lon }
    let viewshedRadius = 5;         // km
    let viewshedResolution = 'medium'; // 'coarse' (20°), 'medium' (10°), 'fine' (5°)
    let viewshedAntennaHeight = 2;
    let viewshedResult = null;      // { radials: [], center, radius, ... }
    let viewshedComputing = false;
    let isSelectingViewshed = false;

    // ==================== CORE CALCULATIONS ====================
    
    function earthCurvatureDrop(distanceM) {
        return (distanceM * distanceM) / (2 * EFFECTIVE_RADIUS);
    }
    
    function fresnelRadius(d1, d2, frequencyMHz) {
        if (d1 <= 0 || d2 <= 0) return 0;
        const wavelengthM = SPEED_OF_LIGHT / frequencyMHz;
        return Math.sqrt((wavelengthM * d1 * d2) / (d1 + d2));
    }
    
    function freeSpacePathLoss(distanceKm, frequencyMHz) {
        if (distanceKm <= 0 || frequencyMHz <= 0) return 0;
        return 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMHz) + 32.44;
    }
    
    function haversineDistance(p1, p2) {
        const R = EARTH_RADIUS_M;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lon - p1.lon) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 +
                  Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                  Math.sin(dLon/2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    
    function calculateBearing(p1, p2) {
        const lat1 = p1.lat * Math.PI / 180;
        const lat2 = p2.lat * Math.PI / 180;
        const dLon = (p2.lon - p1.lon) * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }
    
    function bearingToCardinal(bearing) {
        const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        return dirs[Math.round(bearing / 22.5) % 16];
    }

    // ==================== KNIFE-EDGE DIFFRACTION ====================

    /**
     * Compute the Fresnel-Kirchhoff diffraction parameter (v) for a single
     * knife-edge obstruction.
     *
     * @param {number} h   - Height of obstruction above LOS line (meters, positive = above)
     * @param {number} d1  - Distance from transmitter to obstruction (meters)
     * @param {number} d2  - Distance from obstruction to receiver (meters)
     * @param {number} freqMHz - Frequency in MHz
     * @returns {number} v parameter (positive = above LOS = loss)
     */
    function fresnelKirchhoffV(h, d1, d2, freqMHz) {
        if (d1 <= 0 || d2 <= 0) return 0;
        const wavelengthM = SPEED_OF_LIGHT / freqMHz;
        return h * Math.sqrt((2 * (d1 + d2)) / (wavelengthM * d1 * d2));
    }

    /**
     * Compute knife-edge diffraction loss from the v parameter.
     * Uses the ITU-R P.526-15 single-formula approximation:
     *   J(v) = 6.9 + 20·log10(√((v−0.1)² + 1) + v − 0.1)
     * This is continuous, monotonic, and accurate for all v > -0.78.
     *
     * @param {number} v - Fresnel-Kirchhoff parameter
     * @returns {number} Loss in dB (0 for v ≤ -0.78)
     */
    function knifeEdgeLoss(v) {
        if (v <= -0.78) return 0;
        const t = v - 0.1;
        return 6.9 + 20 * Math.log10(Math.sqrt(t * t + 1) + t);
    }

    /**
     * Find the dominant obstacle along a profile sub-path using the Deygout method.
     * Returns the index of the point with the highest v parameter.
     *
     * @param {Array} elevations  - Terrain elevations (meters)
     * @param {number} startIdx   - Start index in the elevations array
     * @param {number} endIdx     - End index in the elevations array
     * @param {number} startH     - Effective height at start (terrain + antenna - curvature)
     * @param {number} endH       - Effective height at end (terrain + antenna - curvature)
     * @param {Array} distances   - Cumulative distances from transmitter (meters)
     * @param {number} freqMHz    - Frequency
     * @returns {{ idx: number, v: number, h: number, loss: number } | null}
     */
    function findDominantObstacle(elevations, startIdx, endIdx, startH, endH, distances, freqMHz) {
        if (endIdx - startIdx < 2) return null;

        let maxV = -Infinity;
        let domIdx = -1;
        let domH = 0;

        const totalDist = distances[endIdx] - distances[startIdx];
        if (totalDist <= 0) return null;

        for (let i = startIdx + 1; i < endIdx; i++) {
            const f = (distances[i] - distances[startIdx]) / totalDist;
            const losH = startH + (endH - startH) * f;
            const h = elevations[i] - losH;  // positive = above LOS

            const d1 = distances[i] - distances[startIdx];
            const d2 = distances[endIdx] - distances[i];
            const v = fresnelKirchhoffV(h, d1, d2, freqMHz);

            if (v > maxV) {
                maxV = v;
                domIdx = i;
                domH = h;
            }
        }

        if (domIdx < 0 || maxV < -0.78) return null;

        return {
            idx: domIdx,
            v: maxV,
            h: domH,
            loss: knifeEdgeLoss(maxV)
        };
    }

    /**
     * Deygout method for multiple knife-edge diffraction.
     * Recursively finds dominant obstacles and sums their individual losses.
     * Applies a correction factor for sub-path interactions.
     *
     * @param {Array} elevations - Terrain elevations in meters
     * @param {number} startIdx  - Start index
     * @param {number} endIdx    - End index
     * @param {number} startH    - Effective transmitter height
     * @param {number} endH      - Effective receiver height
     * @param {Array} distances  - Cumulative distance array
     * @param {number} freqMHz   - Frequency
     * @param {number} depth     - Recursion depth (limit to 3)
     * @returns {{ totalLoss: number, obstacles: Array }}
     */
    function deygoutDiffraction(elevations, startIdx, endIdx, startH, endH, distances, freqMHz, depth = 0) {
        const result = { totalLoss: 0, obstacles: [] };

        if (depth > 3) return result;  // Limit recursion

        const dominant = findDominantObstacle(elevations, startIdx, endIdx, startH, endH, distances, freqMHz);
        if (!dominant || dominant.v < -0.78) return result;

        // Record this obstacle
        result.obstacles.push({
            idx: dominant.idx,
            v: Math.round(dominant.v * 100) / 100,
            h: Math.round(dominant.h * 10) / 10,
            loss: Math.round(dominant.loss * 10) / 10,
            distance: distances[dominant.idx],
            elevation: elevations[dominant.idx],
            isDominant: depth === 0
        });
        result.totalLoss += dominant.loss;

        // Recurse on sub-paths (transmitter→dominant and dominant→receiver)
        const domElev = elevations[dominant.idx];

        const leftResult = deygoutDiffraction(
            elevations, startIdx, dominant.idx, startH, domElev, distances, freqMHz, depth + 1
        );
        result.totalLoss += leftResult.totalLoss;
        result.obstacles.push(...leftResult.obstacles);

        const rightResult = deygoutDiffraction(
            elevations, dominant.idx, endIdx, domElev, endH, distances, freqMHz, depth + 1
        );
        result.totalLoss += rightResult.totalLoss;
        result.obstacles.push(...rightResult.obstacles);

        return result;
    }
    
    function interpolatePath(p1, p2, numPoints) {
        const points = [];
        for (let i = 0; i < numPoints; i++) {
            const f = i / (numPoints - 1);
            points.push({
                lat: p1.lat + (p2.lat - p1.lat) * f,
                lon: p1.lon + (p2.lon - p1.lon) * f
            });
        }
        return points;
    }
    
    function getCurrentFrequency() {
        return selectedPreset === 'custom' ? customFrequency : FREQUENCY_PRESETS[selectedPreset].freq;
    }

    /**
     * Compute link budget from current state.
     * @param {number} totalPathLoss - Total path loss in dB (FSPL + diffraction)
     * @returns {{ txPower, txGain, rxGain, rxSens, eirp, rxSignal, margin, viable }}
     */
    function computeLinkBudget(totalPathLoss) {
        const eirp = txPower + txAntennaGain;
        const rxSignal = eirp - totalPathLoss + rxAntennaGain;
        const margin = rxSignal - rxSensitivity;
        return {
            txPower: Math.round(txPower * 10) / 10,
            txGain: Math.round(txAntennaGain * 10) / 10,
            rxGain: Math.round(rxAntennaGain * 10) / 10,
            rxSens: Math.round(rxSensitivity * 10) / 10,
            eirp: Math.round(eirp * 10) / 10,
            rxSignal: Math.round(rxSignal * 10) / 10,
            margin: Math.round(margin * 10) / 10,
            viable: margin >= 0
        };
    }

    // ==================== MAIN ANALYSIS ====================

    /**
     * Analyze a single hop between two points.
     * This is the core engine — analyzePath() and analyzeMultiHop() both call this.
     *
     * @param {Object} from - { lat, lon }
     * @param {Object} to   - { lat, lon }
     * @param {number} antFrom - Antenna height at transmitter (meters)
     * @param {number} antTo   - Antenna height at receiver (meters)
     * @returns {Object} Single hop analysis result
     */
    async function analyzeHop(from, to, antFrom, antTo) {
        const distance = haversineDistance(from, to);
        if (distance < 100) throw new Error('Points must be >100m apart');
        if (distance > 500000) throw new Error('Path exceeds 500km limit');

        const bearing = calculateBearing(from, to);
        const freq = getCurrentFrequency();
        const numSamples = Math.max(50, Math.min(200, Math.ceil(distance / 100)));
        const pathPoints = interpolatePath(from, to, numSamples);

        // Fetch elevations
        let elevations;
        try {
            if (typeof ElevationModule !== 'undefined') {
                elevations = await ElevationModule.fetchElevations(pathPoints);
                elevations = elevations.map(e => e !== null ? e / 3.28084 : 0);
            } else {
                throw new Error('ElevationModule not available');
            }
        } catch (e) {
            console.error('Elevation fetch failed:', e);
            throw new Error('Could not fetch elevation data');
        }

        // Fill any nulls
        for (let i = 0; i < elevations.length; i++) {
            if (elevations[i] === null || elevations[i] === undefined) {
                elevations[i] = i > 0 ? elevations[i-1] : 0;
            }
        }

        const elevFrom = elevations[0];
        const elevTo = elevations[elevations.length - 1];
        const losStartH = elevFrom + antFrom;
        const losEndH = elevTo + antTo;

        let minClearancePct = Infinity;
        let minClearanceIdx = 0;
        const obstructions = [];
        const profile = [];

        for (let i = 0; i < pathPoints.length; i++) {
            const f = i / (pathPoints.length - 1);
            const distFromStart = f * distance;
            const distFromEnd = distance - distFromStart;
            const terrainH = elevations[i];
            const losH = losStartH + (losEndH - losStartH) * f;
            const curveDropA = earthCurvatureDrop(distFromStart);
            const curveDropB = earthCurvatureDrop(distFromEnd);
            const curveDrop = Math.min(curveDropA, curveDropB);
            const effectiveLosH = losH - curveDrop;
            const fresnelR = fresnelRadius(distFromStart, distFromEnd, freq);
            const clearance = effectiveLosH - terrainH;
            const clearancePct = fresnelR > 0 ? (clearance / fresnelR) * 100 : 100;

            if (i > 0 && i < pathPoints.length - 1) {
                if (clearancePct < minClearancePct) {
                    minClearancePct = clearancePct;
                    minClearanceIdx = i;
                }
                if (clearance < 0) {
                    obstructions.push({ distance: distFromStart, penetration: -clearance, elevation: terrainH });
                }
            }

            profile.push({
                distance: distFromStart,
                terrain: terrainH,
                los: effectiveLosH,
                fresnelUpper: effectiveLosH + fresnelR,
                fresnelLower: effectiveLosH - fresnelR,
                clearance,
                clearancePct
            });
        }

        const fspl = freeSpacePathLoss(distance / 1000, freq);

        const cumulativeDistances = profile.map(p => p.distance);
        const diffractionResult = deygoutDiffraction(
            elevations, 0, elevations.length - 1,
            losStartH, losEndH, cumulativeDistances, freq, 0
        );
        diffractionResult.obstacles.sort((a, b) => a.distance - b.distance);
        const diffractionLoss = Math.round(diffractionResult.totalLoss * 10) / 10;

        const status = obstructions.length > 0 ? 'obstructed' :
                       minClearancePct >= 60 ? 'clear' : 'marginal';

        const estimatedLoss = Math.round((fspl + diffractionLoss) * 10) / 10;

        return {
            from, to,
            antennaHeightFrom: antFrom,
            antennaHeightTo: antTo,
            frequency: freq,
            distance,
            bearing,
            bearingCardinal: bearingToCardinal(bearing),
            elevationFrom: elevFrom,
            elevationTo: elevTo,
            profile,
            fresnel: {
                midpointRadius: fresnelRadius(distance/2, distance/2, freq),
                minClearancePct: Math.round(minClearancePct),
                minClearanceIdx
            },
            obstructions,
            diffraction: {
                method: 'deygout',
                totalLoss: diffractionLoss,
                obstacleCount: diffractionResult.obstacles.length,
                obstacles: diffractionResult.obstacles,
                dominantObstacle: diffractionResult.obstacles.find(o => o.isDominant) || null
            },
            pathLoss: {
                freeSpace: Math.round(fspl * 10) / 10,
                diffraction: diffractionLoss,
                estimated: estimatedLoss
            },
            linkBudget: computeLinkBudget(estimatedLoss),
            status
        };
    }

    /**
     * Analyze direct path A→B (backward-compatible wrapper).
     */
    async function analyzePath() {
        if (!pointA || !pointB) throw new Error('Both points required');

        const result = await analyzeHop(pointA, pointB, antennaHeightA, antennaHeightB);

        // Map to legacy field names for backward compatibility
        currentAnalysis = {
            ...result,
            pointA: result.from,
            pointB: result.to,
            antennaHeightA: result.antennaHeightFrom,
            antennaHeightB: result.antennaHeightTo,
            elevationA: result.elevationFrom,
            elevationB: result.elevationTo
        };

        notifySubscribers('analysis', currentAnalysis);
        return currentAnalysis;
    }

    /**
     * Analyze a multi-hop relay path: A → R1 → R2 → ... → B
     * Each hop gets its own independent LOS, diffraction, and link budget analysis.
     *
     * @returns {{ hops: Array, summary: Object }}
     */
    async function analyzeMultiHop() {
        if (!pointA || !pointB) throw new Error('Both endpoints required');
        if (relays.length === 0) throw new Error('Add at least one relay point');

        // Build ordered waypoint chain: [A, relay0, relay1, ..., B]
        const chain = [
            { lat: pointA.lat, lon: pointA.lon, antennaHeight: antennaHeightA },
            ...relays.map(r => ({ lat: r.lat, lon: r.lon, antennaHeight: r.antennaHeight || 2 })),
            { lat: pointB.lat, lon: pointB.lon, antennaHeight: antennaHeightB }
        ];

        const hops = [];
        for (let i = 0; i < chain.length - 1; i++) {
            const from = chain[i];
            const to = chain[i + 1];
            try {
                const hopResult = await analyzeHop(
                    { lat: from.lat, lon: from.lon },
                    { lat: to.lat, lon: to.lon },
                    from.antennaHeight,
                    to.antennaHeight
                );
                hops.push({
                    index: i,
                    label: `${i === 0 ? 'A' : 'R' + i} → ${i === chain.length - 2 ? 'B' : 'R' + (i + 1)}`,
                    ...hopResult
                });
            } catch (err) {
                hops.push({
                    index: i,
                    label: `${i === 0 ? 'A' : 'R' + i} → ${i === chain.length - 2 ? 'B' : 'R' + (i + 1)}`,
                    error: err.message,
                    status: 'error'
                });
            }
        }

        // Summary: total distance, weakest hop, overall viability
        const validHops = hops.filter(h => !h.error);
        const totalDistance = validHops.reduce((sum, h) => sum + h.distance, 0);
        const weakestHop = validHops.length > 0
            ? validHops.reduce((w, h) => (h.linkBudget && h.linkBudget.margin < (w.linkBudget?.margin ?? Infinity)) ? h : w, validHops[0])
            : null;
        const allViable = validHops.length === hops.length &&
                          validHops.every(h => h.linkBudget && h.linkBudget.viable);
        const overallStatus = hops.some(h => h.error) ? 'error' :
                              allViable ? 'viable' : 'non-viable';

        multiHopAnalysis = {
            hops,
            chain,
            summary: {
                hopCount: hops.length,
                totalDistance,
                totalDistanceKm: Math.round(totalDistance / 100) / 10,
                weakestHop: weakestHop ? {
                    index: weakestHop.index,
                    label: weakestHop.label,
                    margin: weakestHop.linkBudget?.margin,
                    status: weakestHop.status
                } : null,
                allViable,
                overallStatus,
                errorCount: hops.filter(h => h.error).length
            }
        };

        // Also set currentAnalysis to the active hop for profile rendering
        if (validHops.length > 0) {
            activeHopIndex = Math.min(activeHopIndex, validHops.length - 1);
            currentAnalysis = validHops[activeHopIndex] || validHops[0];
        }

        notifySubscribers('multiHopAnalysis', multiHopAnalysis);
        return multiHopAnalysis;
    }

    // ==================== VIEWSHED ANALYSIS ====================

    /**
     * Analyze viewshed (coverage) from a single transmitter location.
     * Casts radial rays and checks LOS clearance along each.
     *
     * @returns {{ radials: Array, center, radius, coverage }}
     */
    async function analyzeViewshed() {
        const center = viewshedCenter;
        if (!center) throw new Error('Set a viewshed center point');

        const radiusM = viewshedRadius * 1000;
        const freq = getCurrentFrequency();
        const antH = viewshedAntennaHeight;

        const azSteps = viewshedResolution === 'coarse' ? 20 :
                        viewshedResolution === 'fine' ? 5 : 10;
        const numRadials = Math.round(360 / azSteps);
        const samplesPerRadial = Math.max(15, Math.min(40, Math.ceil(radiusM / 300)));

        viewshedComputing = true;
        notifySubscribers('viewshedProgress', { percent: 0, message: 'Collecting sample points...' });

        // Generate all sample points for all radials at once
        const allPoints = [];
        const radialMeta = [];  // Track which points belong to which radial

        for (let r = 0; r < numRadials; r++) {
            const azDeg = r * azSteps;
            const azRad = azDeg * Math.PI / 180;
            const startIdx = allPoints.length;
            for (let s = 0; s < samplesPerRadial; s++) {
                const f = (s + 1) / samplesPerRadial;
                const dist = f * radiusM;
                // Project point from center along azimuth
                const dLat = (dist * Math.cos(azRad)) / EARTH_RADIUS_M * (180 / Math.PI);
                const dLon = (dist * Math.sin(azRad)) / (EARTH_RADIUS_M * Math.cos(center.lat * Math.PI / 180)) * (180 / Math.PI);
                allPoints.push({ lat: center.lat + dLat, lon: center.lon + dLon });
            }
            radialMeta.push({ azimuth: azDeg, startIdx, count: samplesPerRadial });
        }

        // Also need the center elevation
        allPoints.unshift({ lat: center.lat, lon: center.lon });
        // Shift all radial start indices by 1
        for (const rm of radialMeta) rm.startIdx += 1;

        // Fetch all elevations in one batched call
        notifySubscribers('viewshedProgress', { percent: 10, message: `Fetching ${allPoints.length} elevation points...` });

        let allElevations;
        try {
            if (typeof ElevationModule !== 'undefined') {
                allElevations = await ElevationModule.fetchElevations(allPoints);
                allElevations = allElevations.map(e => e !== null ? e / 3.28084 : 0);
            } else {
                throw new Error('ElevationModule not available');
            }
        } catch (e) {
            viewshedComputing = false;
            throw new Error('Elevation fetch failed: ' + e.message);
        }

        const centerElev = allElevations[0];
        const txHeight = centerElev + antH;

        // Analyze each radial
        const radials = [];
        let clearCount = 0;
        let totalSamples = 0;

        for (let r = 0; r < radialMeta.length; r++) {
            const rm = radialMeta[r];
            const samples = [];
            let losReached = radiusM;  // How far LOS extends before first blockage

            for (let s = 0; s < rm.count; s++) {
                const idx = rm.startIdx + s;
                const f = (s + 1) / rm.count;
                const dist = f * radiusM;
                const terrainH = allElevations[idx];

                // LOS height at this distance (accounting for earth curvature)
                const curveDrop = earthCurvatureDrop(dist);
                const losH = txHeight - curveDrop;
                const clearance = losH - terrainH;

                // Fresnel check
                const distFromEnd = radiusM - dist;
                const fresnelR = fresnelRadius(dist, Math.max(distFromEnd, 1), freq);
                const clearancePct = fresnelR > 0 ? (clearance / fresnelR) * 100 : 100;

                const status = clearance < 0 ? 'blocked' :
                               clearancePct < 60 ? 'marginal' : 'clear';

                if (status === 'blocked' && losReached >= dist) {
                    losReached = dist;
                }

                samples.push({
                    distance: dist,
                    lat: allPoints[idx].lat,
                    lon: allPoints[idx].lon,
                    terrain: terrainH,
                    losHeight: losH,
                    clearance,
                    clearancePct: Math.round(clearancePct),
                    status
                });

                totalSamples++;
                if (status !== 'blocked') clearCount++;
            }

            radials.push({
                azimuth: rm.azimuth,
                samples,
                losReached,  // Maximum clear distance along this radial
                clearSamples: samples.filter(s => s.status === 'clear').length,
                marginalSamples: samples.filter(s => s.status === 'marginal').length,
                blockedSamples: samples.filter(s => s.status === 'blocked').length
            });

            // Progress
            const pct = 20 + Math.round((r / radialMeta.length) * 75);
            notifySubscribers('viewshedProgress', { percent: pct, message: `Analyzing radial ${r+1}/${radialMeta.length}...` });
        }

        viewshedComputing = false;

        const coveragePct = totalSamples > 0 ? Math.round((clearCount / totalSamples) * 100) : 0;

        viewshedResult = {
            center,
            radiusM,
            radiusKm: viewshedRadius,
            frequency: freq,
            antennaHeight: antH,
            centerElevation: centerElev,
            resolution: viewshedResolution,
            azimuthStep: azSteps,
            radials,
            coverage: {
                percent: coveragePct,
                clearSamples: clearCount,
                totalSamples
            }
        };

        notifySubscribers('viewshed', viewshedResult);
        return viewshedResult;
    }

    // ==================== MODULE INTEGRATION ====================

    /**
     * Get available external point sources for import.
     * Returns sources with their available points.
     */
    function getImportSources() {
        const sources = [];

        // Meshtastic nodes with positions
        if (typeof MeshtasticModule !== 'undefined') {
            try {
                const nodes = MeshtasticModule.getNodes();
                const withPos = nodes.filter(n => n.lat && n.lon && (Math.abs(n.lat) > 0.001 || Math.abs(n.lon) > 0.001));
                if (withPos.length > 0) {
                    sources.push({
                        id: 'meshtastic',
                        name: 'Mesh Nodes',
                        icon: '📻',
                        points: withPos.map(n => ({
                            lat: n.lat,
                            lon: n.lon,
                            label: n.shortName || n.longName || n.id || 'Node',
                            alt: n.alt || null
                        }))
                    });
                }
            } catch (e) { /* module not connected */ }
        }

        // Waypoints
        if (typeof State !== 'undefined') {
            try {
                const wps = State.get('waypoints') || [];
                const withPos = wps.filter(w => w.lat && w.lon);
                if (withPos.length > 0) {
                    sources.push({
                        id: 'waypoints',
                        name: 'Waypoints',
                        icon: '📌',
                        points: withPos.map(w => ({
                            lat: w.lat,
                            lon: w.lon,
                            label: w.name || w.type || 'Waypoint',
                            id: w.id
                        }))
                    });
                }
            } catch (e) { /* state not available */ }
        }

        // Route builder points
        if (typeof RouteBuilderModule !== 'undefined') {
            try {
                const rbState = RouteBuilderModule.getState();
                if (rbState.currentRoute && rbState.currentRoute.points && rbState.currentRoute.points.length >= 2) {
                    sources.push({
                        id: 'route',
                        name: 'Route Points',
                        icon: '🛤️',
                        points: rbState.currentRoute.points.map((p, i) => ({
                            lat: p.lat,
                            lon: p.lon,
                            label: `Route Pt ${i + 1}`
                        }))
                    });
                }
            } catch (e) { /* route builder not available */ }
        }

        return sources;
    }

    /**
     * Import points from an external source.
     * @param {string} sourceId - 'meshtastic', 'waypoints', or 'route'
     * @param {string} mode - 'endpoints' (set A+B), 'relays' (add as relay chain), 'viewshed' (set viewshed center)
     */
    function importFromSource(sourceId, mode) {
        const sources = getImportSources();
        const source = sources.find(s => s.id === sourceId);
        if (!source || source.points.length === 0) return false;

        const pts = source.points;

        if (mode === 'endpoints' && pts.length >= 2) {
            pointA = { lat: pts[0].lat, lon: pts[0].lon };
            pointB = { lat: pts[pts.length - 1].lat, lon: pts[pts.length - 1].lon };
            currentAnalysis = null;
            multiHopAnalysis = null;
            notifySubscribers('pointSet', { pointA, pointB });
            return true;
        }

        if (mode === 'relays' && pts.length >= 2) {
            pointA = { lat: pts[0].lat, lon: pts[0].lon };
            pointB = { lat: pts[pts.length - 1].lat, lon: pts[pts.length - 1].lon };
            relays = pts.slice(1, -1).map(p => ({ lat: p.lat, lon: p.lon, antennaHeight: 2 }));
            relayMode = true;
            currentAnalysis = null;
            multiHopAnalysis = null;
            notifySubscribers('update', null);
            return true;
        }

        if (mode === 'viewshed' && pts.length >= 1) {
            viewshedCenter = { lat: pts[0].lat, lon: pts[0].lon };
            viewshedMode = true;
            viewshedResult = null;
            notifySubscribers('update', null);
            return true;
        }

        return false;
    }
    
    function renderProfile(canvas, analysis) {
        if (!canvas || !analysis) return;
        
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        
        const pad = { t: 25, b: 35, l: 50, r: 15 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        
        const profile = analysis.profile;
        const maxDist = analysis.distance;
        
        let minE = Infinity, maxE = -Infinity;
        for (const p of profile) {
            minE = Math.min(minE, p.terrain, p.fresnelLower);
            maxE = Math.max(maxE, p.terrain, p.fresnelUpper);
        }
        const range = maxE - minE || 100;
        minE -= range * 0.1;
        maxE += range * 0.1;
        
        const toX = d => pad.l + (d / maxDist) * cw;
        const toY = e => pad.t + ch - ((e - minE) / (maxE - minE)) * ch;
        
        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        const eStep = Math.pow(10, Math.floor(Math.log10((maxE - minE) / 4)));
        for (let e = Math.ceil(minE/eStep)*eStep; e <= maxE; e += eStep) {
            ctx.beginPath();
            ctx.moveTo(pad.l, toY(e));
            ctx.lineTo(W - pad.r, toY(e));
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '9px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(e)}m`, pad.l - 4, toY(e) + 3);
        }
        
        // Fresnel zone
        ctx.fillStyle = 'rgba(251,191,36,0.15)';
        ctx.beginPath();
        for (let i = 0; i < profile.length; i++) {
            const x = toX(profile[i].distance);
            const y = toY(profile[i].fresnelUpper);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        for (let i = profile.length - 1; i >= 0; i--) {
            ctx.lineTo(toX(profile[i].distance), toY(profile[i].fresnelLower));
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(251,191,36,0.5)';
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Terrain
        ctx.fillStyle = 'rgba(34,197,94,0.3)';
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(minE));
        for (const p of profile) ctx.lineTo(toX(p.distance), toY(p.terrain));
        ctx.lineTo(toX(maxDist), toY(minE));
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < profile.length; i++) {
            const x = toX(profile[i].distance);
            const y = toY(profile[i].terrain);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // LOS line
        const losColor = analysis.status === 'clear' ? '#22c55e' :
                        analysis.status === 'marginal' ? '#eab308' : '#ef4444';
        ctx.strokeStyle = losColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(profile[0].los));
        ctx.lineTo(toX(maxDist), toY(profile[profile.length-1].los));
        ctx.stroke();
        
        // Endpoints
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(toX(0), toY(profile[0].los), 5, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(toX(maxDist), toY(profile[profile.length-1].los), 5, 0, Math.PI*2);
        ctx.fill();
        
        // Labels
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('A', toX(0), toY(profile[0].los) - 10);
        ctx.fillText('B', toX(maxDist), toY(profile[profile.length-1].los) - 10);
        
        // Obstructions (LOS-blocking points)
        ctx.fillStyle = '#ef4444';
        for (const obs of analysis.obstructions) {
            ctx.beginPath();
            ctx.arc(toX(obs.distance), toY(obs.elevation), 4, 0, Math.PI*2);
            ctx.fill();
        }

        // Knife-edge diffraction obstacles (from Deygout analysis)
        if (analysis.diffraction && analysis.diffraction.obstacles.length > 0) {
            for (const obs of analysis.diffraction.obstacles) {
                const x = toX(obs.distance);
                const y = toY(obs.elevation);

                if (obs.isDominant) {
                    // Dominant obstacle: larger diamond marker
                    ctx.fillStyle = '#f59e0b';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x, y - 7);
                    ctx.lineTo(x + 5, y);
                    ctx.lineTo(x, y + 7);
                    ctx.lineTo(x - 5, y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Label
                    ctx.fillStyle = '#f59e0b';
                    ctx.font = 'bold 8px system-ui';
                    ctx.textAlign = 'center';
                    ctx.fillText(`v=${obs.v.toFixed(1)}`, x, y - 10);
                } else {
                    // Secondary obstacles: small triangle marker
                    ctx.fillStyle = 'rgba(245,158,11,0.7)';
                    ctx.beginPath();
                    ctx.moveTo(x, y - 5);
                    ctx.lineTo(x + 3.5, y + 2);
                    ctx.lineTo(x - 3.5, y + 2);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
        
        // Title & status
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('RF Path Profile', pad.l, 15);
        
        ctx.fillStyle = losColor;
        ctx.textAlign = 'right';
        const statusLabel = analysis.diffraction && analysis.diffraction.totalLoss > 0
            ? `${analysis.status.toUpperCase()} (${analysis.fresnel.minClearancePct}%) Diff: ${analysis.diffraction.totalLoss}dB`
            : `${analysis.status.toUpperCase()} (${analysis.fresnel.minClearancePct}%)`;
        ctx.fillText(statusLabel, W - pad.r, 15);
        
        // X-axis label
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`Distance: ${(maxDist/1000).toFixed(2)} km`, W/2, H - 5);
    }

    /**
     * Render multi-hop analysis results as HTML.
     */
    function renderMultiHopResults(mha) {
        if (!mha || !mha.hops || mha.hops.length === 0) return '';

        const s = mha.summary;
        const statusColors = { clear: '#22c55e', marginal: '#eab308', obstructed: '#ef4444', error: '#ef4444' };
        const overallColor = s.overallStatus === 'viable' ? '#22c55e' : '#ef4444';
        const overallIcon = s.overallStatus === 'viable' ? '✅' : '❌';

        let hopRows = mha.hops.map((h, i) => {
            if (h.error) {
                return `<div style="display:flex;align-items:center;gap:6px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer" class="rflos-hop-row" data-hop="${i}">
                    <span style="font-size:10px;font-weight:600;color:#c084fc;width:50px">${h.label}</span>
                    <span style="font-size:10px;color:#ef4444;flex:1">Error: ${h.error}</span>
                </div>`;
            }
            const hopColor = statusColors[h.status] || '#888';
            const isActive = i === activeHopIndex;
            const marginStr = h.linkBudget ? `${h.linkBudget.margin > 0 ? '+' : ''}${h.linkBudget.margin}` : '?';
            const marginColor = h.linkBudget?.viable ? '#22c55e' : '#ef4444';
            return `<div style="display:flex;align-items:center;gap:6px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;${isActive ? 'background:rgba(168,85,247,0.15);border-radius:4px' : ''}" class="rflos-hop-row" data-hop="${i}">
                <span style="font-size:10px;font-weight:600;color:#c084fc;width:50px">${h.label}</span>
                <span style="font-size:9px;color:rgba(255,255,255,0.5);width:45px">${(h.distance/1000).toFixed(1)}km</span>
                <span style="font-size:9px;color:${hopColor};width:55px;text-transform:uppercase;font-weight:500">${h.status}</span>
                <span style="font-size:9px;color:${marginColor};text-align:right;flex:1;font-weight:600">${marginStr} dB</span>
            </div>`;
        }).join('');

        return `
            <div style="margin-top:12px;padding:12px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(168,85,247,0.3)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-weight:600;font-size:13px">Multi-Hop Analysis</span>
                    <span style="color:${overallColor};font-weight:600;font-size:11px">${overallIcon} ${s.overallStatus.toUpperCase()}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;margin-bottom:10px;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px">
                    <span style="color:rgba(255,255,255,0.5)">Hops:</span>
                    <span style="text-align:right">${s.hopCount}</span>
                    <span style="color:rgba(255,255,255,0.5)">Total Distance:</span>
                    <span style="text-align:right">${s.totalDistanceKm} km</span>
                    ${s.weakestHop ? `
                    <span style="color:rgba(255,255,255,0.5)">Bottleneck:</span>
                    <span style="text-align:right;color:${s.weakestHop.margin >= 0 ? '#22c55e' : '#ef4444'}">${s.weakestHop.label} (${s.weakestHop.margin > 0 ? '+' : ''}${s.weakestHop.margin} dB)</span>
                    ` : ''}
                </div>
                <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-bottom:6px">Click a hop to view its profile:</div>
                ${hopRows}
                <canvas id="rflos-canvas" width="340" height="180" style="width:100%;border-radius:4px;background:#0f172a;margin-top:10px"></canvas>
            </div>
        `;
    }

    /**
     * Render import sources section.
     */
    function renderImportSection() {
        const sources = getImportSources();
        if (sources.length === 0) return '';

        return `
            <div style="margin-bottom:10px;padding:8px;background:rgba(59,130,246,0.06);border-radius:6px;border:1px solid rgba(59,130,246,0.15)">
                <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:6px">Import from:</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px">
                    ${sources.map(s => `
                        <button class="btn btn--secondary rflos-import-src" data-source="${s.id}"
                                style="padding:3px 8px;font-size:9px" title="${s.points.length} point${s.points.length !== 1 ? 's' : ''}">
                            ${s.icon} ${s.name} (${s.points.length})
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render viewshed (coverage map) mode section.
     */
    function renderViewshedSection() {
        const resOptions = [
            { v: 'coarse', label: 'Fast (20°)', desc: '18 radials' },
            { v: 'medium', label: 'Medium (10°)', desc: '36 radials' },
            { v: 'fine', label: 'Detailed (5°)', desc: '72 radials' }
        ];

        let resultsHtml = '';
        if (viewshedResult) {
            const vr = viewshedResult;
            const covColor = vr.coverage.percent >= 70 ? '#22c55e' :
                             vr.coverage.percent >= 40 ? '#eab308' : '#ef4444';
            resultsHtml = `
                <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(168,85,247,0.3)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-weight:600;font-size:12px">Coverage Results</span>
                        <span style="font-size:13px;font-weight:700;color:${covColor}">${vr.coverage.percent}%</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px">
                        <span style="color:rgba(255,255,255,0.5)">Radius:</span>
                        <span style="text-align:right">${vr.radiusKm} km</span>
                        <span style="color:rgba(255,255,255,0.5)">TX Elevation:</span>
                        <span style="text-align:right">${Math.round(vr.centerElevation)}m + ${vr.antennaHeight}m ant</span>
                        <span style="color:rgba(255,255,255,0.5)">Frequency:</span>
                        <span style="text-align:right">${vr.frequency} MHz</span>
                        <span style="color:rgba(255,255,255,0.5)">Radials:</span>
                        <span style="text-align:right">${vr.radials.length} @ ${vr.azimuthStep}° intervals</span>
                        <span style="color:rgba(255,255,255,0.5)">Samples:</span>
                        <span style="text-align:right">${vr.coverage.totalSamples}</span>
                    </div>
                    <div style="margin-top:8px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${vr.coverage.percent}%;background:${covColor};border-radius:3px"></div>
                    </div>
                    <div style="display:flex;gap:10px;margin-top:6px;font-size:9px">
                        <span style="color:#22c55e">● Clear ${vr.coverage.clearSamples}</span>
                        <span style="color:#eab308">● Marginal ${vr.coverage.totalSamples - vr.coverage.clearSamples - (vr.radials.reduce((s,r)=>s+r.blockedSamples,0))}</span>
                        <span style="color:#ef4444">● Blocked ${vr.radials.reduce((s,r)=>s+r.blockedSamples,0)}</span>
                    </div>
                </div>
            `;
        }

        return `
            <!-- Viewshed Center -->
            <div style="margin-bottom:10px;padding:10px;background:rgba(168,85,247,0.1);border-radius:8px;border:1px solid rgba(168,85,247,0.3)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font-size:12px;font-weight:500;color:#c084fc">📡 Transmitter</span>
                    <div style="display:flex;gap:4px">
                        <button class="btn btn--secondary" id="rflos-vs-gps" style="padding:3px 8px;font-size:10px" title="Use GPS">📡 GPS</button>
                        <button class="btn btn--secondary" id="rflos-vs-select" style="padding:3px 8px;font-size:10px;${isSelectingViewshed ? 'background:#a855f7;color:#fff' : ''}">
                            ${isSelectingViewshed ? 'Click Map...' : viewshedCenter ? 'Change' : 'Select'}
                        </button>
                    </div>
                </div>
                ${viewshedCenter ? `<div style="font-size:10px;color:rgba(255,255,255,0.5)">${viewshedCenter.lat.toFixed(5)}°, ${viewshedCenter.lon.toFixed(5)}°</div>` :
                    `<div style="font-size:10px;color:rgba(255,255,255,0.4)">Click "Select" then click map</div>`}
                <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                    <label style="font-size:10px;color:rgba(255,255,255,0.6)">Antenna:</label>
                    <input type="number" id="rflos-vs-ant" value="${viewshedAntennaHeight}" min="0" max="500" step="0.5"
                           style="width:55px;padding:3px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                    <span style="font-size:10px;color:rgba(255,255,255,0.5)">m</span>
                </div>
            </div>

            <!-- Viewshed Parameters -->
            <div style="margin-bottom:10px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <label style="font-size:10px;color:rgba(255,255,255,0.6)">Radius:</label>
                    <input type="range" id="rflos-vs-radius" min="1" max="50" value="${viewshedRadius}" style="flex:1;accent-color:#a855f7">
                    <span id="rflos-vs-radius-val" style="font-size:10px;color:#c084fc;width:38px;text-align:right">${viewshedRadius} km</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <label style="font-size:10px;color:rgba(255,255,255,0.6)">Detail:</label>
                    <select id="rflos-vs-res" style="flex:1;padding:4px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                        ${resOptions.map(o => `<option value="${o.v}" ${o.v === viewshedResolution ? 'selected' : ''}>${o.label} — ${o.desc}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Frequency (shared) -->
            <div style="margin-bottom:10px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px">
                <div style="display:flex;align-items:center;gap:8px">
                    <label style="font-size:11px;font-weight:500">📻</label>
                    <select id="rflos-preset" style="flex:1;padding:4px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                        ${Object.entries(FREQUENCY_PRESETS).map(([k, v]) => `<option value="${k}" ${k === selectedPreset ? 'selected' : ''}>${v.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Analyze Viewshed -->
            <button class="btn btn--primary" id="rflos-analyze-vs" style="width:100%;padding:10px;font-size:12px;${!viewshedCenter ? 'opacity:0.5;cursor:not-allowed' : ''}" ${!viewshedCenter ? 'disabled' : ''}>
                ${viewshedComputing ? '⏳ Computing...' : '📡 Analyze Coverage'}
            </button>

            ${resultsHtml}
        `;
    }

    function renderPanel() {
        const presetOpts = Object.entries(FREQUENCY_PRESETS)
            .map(([k, v]) => `<option value="${k}" ${k === selectedPreset ? 'selected' : ''}>${v.name}</option>`)
            .join('');
        
        const statusColors = { clear: '#22c55e', marginal: '#eab308', obstructed: '#ef4444' };
        const statusIcons = { clear: '✅', marginal: '⚠️', obstructed: '❌' };
        
        let resultsHtml = '';
        if (currentAnalysis) {
            const a = currentAnalysis;
            resultsHtml = `
                <div style="margin-top:12px;padding:12px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(255,255,255,0.1)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                        <span style="font-weight:600;font-size:13px">Analysis Results</span>
                        <span style="color:${statusColors[a.status]};font-weight:600;font-size:12px">
                            ${statusIcons[a.status]} ${a.status.toUpperCase()}
                        </span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:12px">
                        <span style="color:rgba(255,255,255,0.6)">Distance:</span>
                        <span style="text-align:right">${(a.distance/1000).toFixed(2)} km</span>
                        <span style="color:rgba(255,255,255,0.6)">Bearing:</span>
                        <span style="text-align:right">${a.bearing.toFixed(1)}&deg; ${a.bearingCardinal}</span>
                        <span style="color:rgba(255,255,255,0.6)">Fresnel Clearance:</span>
                        <span style="text-align:right;color:${statusColors[a.status]}">${a.fresnel.minClearancePct}%</span>
                        <span style="color:rgba(255,255,255,0.6)">Free-Space Loss:</span>
                        <span style="text-align:right">${a.pathLoss.freeSpace} dB</span>
                        ${a.diffraction.totalLoss > 0 ? `
                        <span style="color:rgba(255,255,255,0.6)">Diffraction Loss:</span>
                        <span style="text-align:right;color:#f59e0b">${a.diffraction.totalLoss} dB</span>
                        ` : ''}
                        <span style="color:rgba(255,255,255,0.6)">Total Path Loss:</span>
                        <span style="text-align:right;font-weight:600">${a.pathLoss.estimated} dB</span>
                    </div>
                    ${a.linkBudget ? `
                    <div style="margin-bottom:12px;padding:10px;background:rgba(${a.linkBudget.viable ? '34,197,94' : '239,68,68'},0.1);border-radius:8px;border:1px solid rgba(${a.linkBudget.viable ? '34,197,94' : '239,68,68'},0.3)">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <span style="font-size:11px;font-weight:600">Link Budget</span>
                            <span style="font-size:12px;font-weight:700;color:${a.linkBudget.viable ? '#22c55e' : '#ef4444'}">
                                ${a.linkBudget.viable ? '✅' : '❌'} ${a.linkBudget.margin > 0 ? '+' : ''}${a.linkBudget.margin} dB margin
                            </span>
                        </div>
                        <div style="font-size:9px;color:rgba(255,255,255,0.6);font-family:monospace;line-height:1.6">
                            <div style="display:flex;justify-content:space-between">
                                <span>TX Power</span><span style="color:#fff">${a.linkBudget.txPower} dBm</span>
                            </div>
                            <div style="display:flex;justify-content:space-between">
                                <span>+ TX Antenna Gain</span><span style="color:#fff">${a.linkBudget.txGain} dBi</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:3px;margin-bottom:3px">
                                <span>= EIRP</span><span style="color:#60a5fa;font-weight:600">${a.linkBudget.eirp} dBm</span>
                            </div>
                            <div style="display:flex;justify-content:space-between">
                                <span>− Total Path Loss</span><span style="color:#f59e0b">${a.pathLoss.estimated} dB</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:3px;margin-bottom:3px">
                                <span>+ RX Antenna Gain</span><span style="color:#fff">${a.linkBudget.rxGain} dBi</span>
                            </div>
                            <div style="display:flex;justify-content:space-between">
                                <span>= RX Signal</span><span style="color:#a78bfa;font-weight:600">${a.linkBudget.rxSignal} dBm</span>
                            </div>
                            <div style="display:flex;justify-content:space-between">
                                <span>RX Sensitivity</span><span style="color:rgba(255,255,255,0.5)">${a.linkBudget.rxSens} dBm</span>
                            </div>
                        </div>
                    </div>` : ''}
                    <canvas id="rflos-canvas" width="340" height="180" style="width:100%;border-radius:4px;background:#0f172a"></canvas>
                    ${a.diffraction.obstacleCount > 0 ? `
                    <div style="margin-top:8px;padding:8px;background:rgba(245,158,11,0.1);border-radius:4px;border:1px solid rgba(245,158,11,0.2)">
                        <div style="font-size:10px;font-weight:600;color:#f59e0b;margin-bottom:4px">
                            Knife-Edge Diffraction (${a.diffraction.obstacleCount} obstacle${a.diffraction.obstacleCount > 1 ? 's' : ''})
                        </div>
                        ${a.diffraction.obstacles.map((obs, i) => `
                            <div style="font-size:9px;color:rgba(255,255,255,0.7);display:flex;justify-content:space-between;padding:2px 0;${obs.isDominant ? 'font-weight:600' : ''}">
                                <span>${obs.isDominant ? '▸ ' : '  '}${(obs.distance/1000).toFixed(1)} km @ ${Math.round(obs.elevation)}m</span>
                                <span style="color:#f59e0b">v=${obs.v.toFixed(1)} → ${obs.loss} dB</span>
                            </div>
                        `).join('')}
                    </div>` : ''}
                    ${a.obstructions.length > 0 && a.diffraction.obstacleCount === 0 ? `<div style="margin-top:8px;padding:6px;background:rgba(239,68,68,0.15);border-radius:4px;font-size:10px;color:#fca5a5">
                        ${a.obstructions.length} obstruction${a.obstructions.length > 1 ? 's' : ''} blocking line of sight
                    </div>` : ''}
                </div>
            `;
        }
        
        return `
            <div style="padding:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span style="font-weight:600;font-size:14px">📡 RF Line of Sight</span>
                    <div style="display:flex;gap:4px">
                        ${currentAnalysis || viewshedResult ? `<button class="btn btn--secondary" id="rflos-clear" style="padding:4px 8px;font-size:10px">Clear</button>` : ''}
                    </div>
                </div>

                ${renderImportSection()}

                <!-- Viewshed Toggle -->
                <div style="margin-bottom:10px;display:flex;gap:6px">
                    <button class="btn ${!viewshedMode ? 'btn--primary' : 'btn--secondary'}" id="rflos-mode-path" style="flex:1;padding:5px;font-size:10px">
                        📏 Path Analysis
                    </button>
                    <button class="btn ${viewshedMode ? 'btn--primary' : 'btn--secondary'}" id="rflos-mode-viewshed" style="flex:1;padding:5px;font-size:10px">
                        📡 Coverage Map
                    </button>
                </div>

                ${viewshedMode ? renderViewshedSection() : `
                
                <!-- Point A -->
                <div style="margin-bottom:10px;padding:10px;background:rgba(59,130,246,0.1);border-radius:8px;border:1px solid rgba(59,130,246,0.3)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <span style="font-size:12px;font-weight:500;color:#60a5fa">📍 Point A</span>
                        <div style="display:flex;gap:4px">
                            <button class="btn btn--secondary" id="rflos-gps-a" style="padding:3px 8px;font-size:10px" title="Use current GPS position">
                                📡 GPS
                            </button>
                            <button class="btn btn--secondary" id="rflos-select-a" style="padding:3px 8px;font-size:10px;${isSelectingPoint === 'A' ? 'background:#3b82f6;color:#fff' : ''}">
                                ${isSelectingPoint === 'A' ? 'Click Map...' : pointA ? 'Change' : 'Select'}
                            </button>
                        </div>
                    </div>
                    ${pointA ? `<div style="font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:4px">${pointA.lat.toFixed(5)}°, ${pointA.lon.toFixed(5)}°</div>` : 
                              `<div style="font-size:10px;color:rgba(255,255,255,0.4)">Click "Select" then click map</div>`}
                    <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                        <label style="font-size:10px;color:rgba(255,255,255,0.6)">Antenna:</label>
                        <input type="number" id="rflos-ant-a" value="${antennaHeightA}" min="0" max="500" step="0.5"
                               style="width:55px;padding:3px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                        <span style="font-size:10px;color:rgba(255,255,255,0.5)">m</span>
                    </div>
                </div>
                
                <!-- Point B -->
                <div style="margin-bottom:10px;padding:10px;background:rgba(34,197,94,0.1);border-radius:8px;border:1px solid rgba(34,197,94,0.3)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <span style="font-size:12px;font-weight:500;color:#4ade80">📍 Point B</span>
                        <button class="btn btn--secondary" id="rflos-select-b" style="padding:3px 8px;font-size:10px;${isSelectingPoint === 'B' ? 'background:#22c55e;color:#fff' : ''}">
                            ${isSelectingPoint === 'B' ? 'Click Map...' : pointB ? 'Change' : 'Select'}
                        </button>
                    </div>
                    ${pointB ? `<div style="font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:4px">${pointB.lat.toFixed(5)}°, ${pointB.lon.toFixed(5)}°</div>` : 
                              `<div style="font-size:10px;color:rgba(255,255,255,0.4)">Click "Select" then click map</div>`}
                    <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                        <label style="font-size:10px;color:rgba(255,255,255,0.6)">Antenna:</label>
                        <input type="number" id="rflos-ant-b" value="${antennaHeightB}" min="0" max="500" step="0.5"
                               style="width:55px;padding:3px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                        <span style="font-size:10px;color:rgba(255,255,255,0.5)">m</span>
                    </div>
                </div>
                
                <!-- Frequency -->
                <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px">

                <!-- Relay Mode -->
                <div style="margin-bottom:10px;padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;border:1px solid rgba(168,85,247,0.2)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${relayMode ? '8' : '0'}px">
                        <label style="font-size:11px;font-weight:500;color:#c084fc;display:flex;align-items:center;gap:6px;cursor:pointer">
                            <input type="checkbox" id="rflos-relay-mode" ${relayMode ? 'checked' : ''}
                                   style="accent-color:#a855f7">
                            🔁 Multi-Hop Relay
                        </label>
                        <span style="font-size:9px;color:rgba(255,255,255,0.3)">${relays.length}/${MAX_RELAYS}</span>
                    </div>
                    ${relayMode ? `
                    <div id="rflos-relay-list" style="margin-bottom:6px">
                        ${relays.map((r, i) => `
                        <div style="display:flex;align-items:center;gap:4px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                            <span style="font-size:10px;font-weight:600;color:#c084fc;width:22px">R${i+1}</span>
                            <span style="font-size:9px;color:rgba(255,255,255,0.5);flex:1">${r.lat.toFixed(4)}°, ${r.lon.toFixed(4)}°</span>
                            <input type="number" class="rflos-relay-ant" data-relay-idx="${i}" value="${r.antennaHeight}"
                                   min="0" max="500" step="0.5" title="Antenna height (m)"
                                   style="width:40px;padding:2px;font-size:9px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:3px;color:#fff;text-align:center">
                            <span style="font-size:8px;color:rgba(255,255,255,0.3)">m</span>
                            <button class="rflos-relay-remove" data-relay-idx="${i}" style="padding:2px 5px;font-size:9px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.3);border-radius:3px;color:#fca5a5;cursor:pointer" title="Remove relay">✕</button>
                        </div>
                        `).join('')}
                    </div>
                    <button class="btn btn--secondary" id="rflos-add-relay" style="width:100%;padding:5px;font-size:10px;${relays.length >= MAX_RELAYS ? 'opacity:0.4;cursor:not-allowed' : ''}" ${relays.length >= MAX_RELAYS ? 'disabled' : ''}>
                        ${isSelectingRelay >= 0 ? '📍 Click Map to Place Relay...' : '+ Add Relay Point'}
                    </button>
                    ` : ''}
                </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        <label style="font-size:11px;font-weight:500">📻 Frequency</label>
                        <select id="rflos-preset" style="flex:1;padding:4px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                            ${presetOpts}
                        </select>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                        <input type="number" id="rflos-freq" value="${getCurrentFrequency()}" min="1" max="100000" step="0.1"
                               style="width:70px;padding:4px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                        <span style="font-size:10px;color:rgba(255,255,255,0.5)">MHz</span>
                    </div>
                </div>

                <!-- Link Budget Parameters -->
                <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px">
                    <div id="rflos-lb-toggle" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                        <span style="font-size:10px;color:rgba(255,255,255,0.5);transition:transform 0.2s;${linkBudgetExpanded ? 'transform:rotate(90deg)' : ''}"">▶</span>
                        <label style="font-size:11px;font-weight:500;cursor:pointer">🔗 Link Budget</label>
                        <span style="font-size:9px;color:rgba(255,255,255,0.3);margin-left:auto">${txPower} dBm TX</span>
                    </div>
                    <div id="rflos-lb-body" style="display:${linkBudgetExpanded ? 'block' : 'none'};margin-top:8px">
                        <div style="display:grid;grid-template-columns:auto 1fr auto;gap:4px 6px;align-items:center">
                            <label style="font-size:9px;color:rgba(255,255,255,0.6)">TX Power</label>
                            <input type="number" id="rflos-tx-power" value="${txPower}" step="1" min="-20" max="60"
                                   style="width:100%;padding:3px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                            <span style="font-size:9px;color:rgba(255,255,255,0.4)">dBm</span>

                            <label style="font-size:9px;color:rgba(255,255,255,0.6)">TX Ant Gain</label>
                            <input type="number" id="rflos-tx-gain" value="${txAntennaGain}" step="0.5" min="-10" max="30"
                                   style="width:100%;padding:3px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                            <span style="font-size:9px;color:rgba(255,255,255,0.4)">dBi</span>

                            <label style="font-size:9px;color:rgba(255,255,255,0.6)">RX Ant Gain</label>
                            <input type="number" id="rflos-rx-gain" value="${rxAntennaGain}" step="0.5" min="-10" max="30"
                                   style="width:100%;padding:3px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                            <span style="font-size:9px;color:rgba(255,255,255,0.4)">dBi</span>

                            <label style="font-size:9px;color:rgba(255,255,255,0.6)">RX Sensitivity</label>
                            <input type="number" id="rflos-rx-sens" value="${rxSensitivity}" step="1" min="-160" max="0"
                                   style="width:100%;padding:3px;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff">
                            <span style="font-size:9px;color:rgba(255,255,255,0.4)">dBm</span>
                        </div>
                        <div style="margin-top:6px;font-size:8px;color:rgba(255,255,255,0.3)">
                            Pre-filled from radio preset. Edit for your specific equipment.
                        </div>
                    </div>
                </div>
                
                <!-- Analyze Button -->
                <button class="btn btn--primary" id="rflos-analyze" style="width:100%;padding:10px;font-size:12px;${!pointA || !pointB ? 'opacity:0.5;cursor:not-allowed' : ''}" ${!pointA || !pointB ? 'disabled' : ''}>
                    🔍 ${relayMode && relays.length > 0 ? `Analyze ${relays.length + 1} Hops` : 'Analyze RF Path'}
                </button>

                ${relayMode && multiHopAnalysis ? renderMultiHopResults(multiHopAnalysis) : ''}
                ${relayMode && multiHopAnalysis ? '' : resultsHtml}
                `}
                
                <div style="margin-top:10px;font-size:9px;color:rgba(255,255,255,0.3);text-align:center">
                    Elevation: Copernicus DEM GLO-90 © ESA
                </div>
            </div>
        `;
    }
    
    function attachHandlers(container) {
        const selectA = container.querySelector('#rflos-select-a');
        const selectB = container.querySelector('#rflos-select-b');
        const gpsA = container.querySelector('#rflos-gps-a');
        const antA = container.querySelector('#rflos-ant-a');
        const antB = container.querySelector('#rflos-ant-b');
        const presetSel = container.querySelector('#rflos-preset');
        const freqInput = container.querySelector('#rflos-freq');
        const analyzeBtn = container.querySelector('#rflos-analyze');
        const clearBtn = container.querySelector('#rflos-clear');
        
        if (selectA) {
            selectA.onclick = () => {
                isSelectingPoint = isSelectingPoint === 'A' ? null : 'A';
                notifySubscribers('selecting', isSelectingPoint);
            };
        }

        // Phase 1: GPS as Point A
        if (gpsA) {
            gpsA.onclick = () => {
                if (typeof GPSModule === 'undefined') {
                    alert('GPS module not available');
                    return;
                }
                const pos = GPSModule.getPosition();
                if (!pos || pos.lat === undefined || pos.lon === undefined) {
                    alert('No GPS position available. Enable GPS or set a manual position first.');
                    return;
                }
                pointA = { lat: pos.lat, lon: pos.lon };
                antennaHeightA = 1.5;  // Handheld height
                isSelectingPoint = null;
                currentAnalysis = null;
                notifySubscribers('pointSet', { pointA, pointB });
            };
        }
        
        if (selectB) {
            selectB.onclick = () => {
                isSelectingPoint = isSelectingPoint === 'B' ? null : 'B';
                notifySubscribers('selecting', isSelectingPoint);
            };
        }
        
        if (antA) antA.onchange = e => { antennaHeightA = parseFloat(e.target.value) || 2; };
        if (antB) antB.onchange = e => { antennaHeightB = parseFloat(e.target.value) || 2; };
        
        if (presetSel) {
            presetSel.onchange = e => {
                selectedPreset = e.target.value;
                const preset = FREQUENCY_PRESETS[selectedPreset];
                if (freqInput) freqInput.value = getCurrentFrequency();
                // Update link budget from preset
                txPower = preset.txPower;
                txAntennaGain = preset.txGain;
                rxAntennaGain = preset.rxGain;
                rxSensitivity = preset.rxSens;
                // Update link budget inputs if visible
                const txPwrEl = container.querySelector('#rflos-tx-power');
                const txGnEl = container.querySelector('#rflos-tx-gain');
                const rxGnEl = container.querySelector('#rflos-rx-gain');
                const rxSnEl = container.querySelector('#rflos-rx-sens');
                if (txPwrEl) txPwrEl.value = txPower;
                if (txGnEl) txGnEl.value = txAntennaGain;
                if (rxGnEl) rxGnEl.value = rxAntennaGain;
                if (rxSnEl) rxSnEl.value = rxSensitivity;
            };
        }
        
        if (freqInput) {
            freqInput.onchange = e => {
                customFrequency = parseFloat(e.target.value) || 915;
                selectedPreset = 'custom';
            };
        }

        // Link budget toggle
        const lbToggle = container.querySelector('#rflos-lb-toggle');
        const lbBody = container.querySelector('#rflos-lb-body');
        if (lbToggle && lbBody) {
            lbToggle.onclick = () => {
                linkBudgetExpanded = !linkBudgetExpanded;
                lbBody.style.display = linkBudgetExpanded ? 'block' : 'none';
                const arrow = lbToggle.querySelector('span');
                if (arrow) arrow.style.transform = linkBudgetExpanded ? 'rotate(90deg)' : '';
            };
        }

        // Link budget inputs
        const txPwrEl = container.querySelector('#rflos-tx-power');
        const txGnEl = container.querySelector('#rflos-tx-gain');
        const rxGnEl = container.querySelector('#rflos-rx-gain');
        const rxSnEl = container.querySelector('#rflos-rx-sens');
        if (txPwrEl) txPwrEl.onchange = e => { txPower = parseFloat(e.target.value) || 0; };
        if (txGnEl) txGnEl.onchange = e => { txAntennaGain = parseFloat(e.target.value) || 0; };
        if (rxGnEl) rxGnEl.onchange = e => { rxAntennaGain = parseFloat(e.target.value) || 0; };
        if (rxSnEl) rxSnEl.onchange = e => { rxSensitivity = parseFloat(e.target.value) || -120; };
        
        if (analyzeBtn) {
            analyzeBtn.onclick = async () => {
                analyzeBtn.disabled = true;
                analyzeBtn.textContent = '⏳ Analyzing...';
                try {
                    if (relayMode && relays.length > 0) {
                        await analyzeMultiHop();
                    } else {
                        multiHopAnalysis = null;
                        await analyzePath();
                    }
                } catch (err) {
                    alert('Analysis failed: ' + err.message);
                }
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = relayMode && relays.length > 0
                    ? `🔍 Analyze ${relays.length + 1} Hops`
                    : '🔍 Analyze RF Path';
                notifySubscribers('update', null);
            };
        }
        
        if (clearBtn) {
            clearBtn.onclick = () => {
                pointA = null;
                pointB = null;
                currentAnalysis = null;
                multiHopAnalysis = null;
                relays = [];
                activeHopIndex = 0;
                notifySubscribers('clear', null);
            };
        }

        // ── Relay mode handlers ──
        const relayModeCheck = container.querySelector('#rflos-relay-mode');
        if (relayModeCheck) {
            relayModeCheck.onchange = e => {
                relayMode = e.target.checked;
                if (!relayMode) {
                    multiHopAnalysis = null;
                    isSelectingRelay = -1;
                }
                currentAnalysis = null;
                notifySubscribers('update', null);
            };
        }

        const addRelayBtn = container.querySelector('#rflos-add-relay');
        if (addRelayBtn) {
            addRelayBtn.onclick = () => {
                if (relays.length >= MAX_RELAYS) return;
                if (isSelectingRelay >= 0) {
                    isSelectingRelay = -1;  // Cancel
                } else {
                    isSelectingRelay = relays.length;  // Next index
                }
                notifySubscribers('update', null);
            };
        }

        // Remove relay buttons
        container.querySelectorAll('.rflos-relay-remove').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.relayIdx);
                if (!isNaN(idx) && idx >= 0 && idx < relays.length) {
                    relays.splice(idx, 1);
                    multiHopAnalysis = null;
                    currentAnalysis = null;
                    activeHopIndex = 0;
                    notifySubscribers('update', null);
                }
            };
        });

        // Relay antenna height inputs
        container.querySelectorAll('.rflos-relay-ant').forEach(input => {
            input.onchange = e => {
                const idx = parseInt(e.target.dataset.relayIdx);
                if (!isNaN(idx) && idx >= 0 && idx < relays.length) {
                    relays[idx].antennaHeight = parseFloat(e.target.value) || 2;
                }
            };
        });

        // Hop row clicks (switch active profile)
        container.querySelectorAll('.rflos-hop-row').forEach(row => {
            row.onclick = () => {
                const hopIdx = parseInt(row.dataset.hop);
                if (!isNaN(hopIdx) && multiHopAnalysis && multiHopAnalysis.hops[hopIdx] && !multiHopAnalysis.hops[hopIdx].error) {
                    activeHopIndex = hopIdx;
                    currentAnalysis = multiHopAnalysis.hops[hopIdx];
                    notifySubscribers('update', null);
                }
            };
        });
        
        // ── Mode toggle (Path vs Viewshed) ──
        const modePath = container.querySelector('#rflos-mode-path');
        const modeVs = container.querySelector('#rflos-mode-viewshed');
        if (modePath) modePath.onclick = () => { viewshedMode = false; notifySubscribers('update', null); };
        if (modeVs) modeVs.onclick = () => { viewshedMode = true; notifySubscribers('update', null); };

        // ── Viewshed handlers ──
        const vsSelect = container.querySelector('#rflos-vs-select');
        if (vsSelect) {
            vsSelect.onclick = () => {
                isSelectingViewshed = !isSelectingViewshed;
                isSelectingPoint = null;
                isSelectingRelay = -1;
                notifySubscribers('update', null);
            };
        }

        const vsGps = container.querySelector('#rflos-vs-gps');
        if (vsGps) {
            vsGps.onclick = () => {
                if (typeof GPSModule === 'undefined') { alert('GPS not available'); return; }
                const pos = GPSModule.getPosition();
                if (!pos || pos.lat === undefined) { alert('No GPS position available'); return; }
                viewshedCenter = { lat: pos.lat, lon: pos.lon };
                viewshedAntennaHeight = 1.5;
                isSelectingViewshed = false;
                viewshedResult = null;
                notifySubscribers('update', null);
            };
        }

        const vsAnt = container.querySelector('#rflos-vs-ant');
        if (vsAnt) vsAnt.onchange = e => { viewshedAntennaHeight = parseFloat(e.target.value) || 2; };

        const vsRadius = container.querySelector('#rflos-vs-radius');
        const vsRadiusVal = container.querySelector('#rflos-vs-radius-val');
        if (vsRadius) {
            vsRadius.oninput = e => {
                viewshedRadius = parseInt(e.target.value) || 5;
                if (vsRadiusVal) vsRadiusVal.textContent = viewshedRadius + ' km';
            };
        }

        const vsRes = container.querySelector('#rflos-vs-res');
        if (vsRes) vsRes.onchange = e => { viewshedResolution = e.target.value; };

        const analyzeVsBtn = container.querySelector('#rflos-analyze-vs');
        if (analyzeVsBtn) {
            analyzeVsBtn.onclick = async () => {
                if (!viewshedCenter || viewshedComputing) return;
                analyzeVsBtn.disabled = true;
                analyzeVsBtn.textContent = '⏳ Computing...';
                try {
                    await analyzeViewshed();
                } catch (err) {
                    alert('Viewshed analysis failed: ' + err.message);
                }
                analyzeVsBtn.disabled = false;
                analyzeVsBtn.textContent = '📡 Analyze Coverage';
                notifySubscribers('update', null);
            };
        }

        // ── Import source handlers ──
        container.querySelectorAll('.rflos-import-src').forEach(btn => {
            btn.onclick = () => {
                const sourceId = btn.dataset.source;
                const source = getImportSources().find(s => s.id === sourceId);
                if (!source) return;

                // Choose mode based on context
                if (viewshedMode) {
                    importFromSource(sourceId, 'viewshed');
                } else if (relayMode && source.points.length >= 3) {
                    importFromSource(sourceId, 'relays');
                } else {
                    importFromSource(sourceId, 'endpoints');
                }
            };
        });

        // ── Viewshed preset handler (shared id) ──
        if (viewshedMode) {
            const vsPreset = container.querySelector('#rflos-preset');
            if (vsPreset) {
                vsPreset.onchange = e => {
                    selectedPreset = e.target.value;
                    const preset = FREQUENCY_PRESETS[selectedPreset];
                    txPower = preset.txPower;
                    txAntennaGain = preset.txGain;
                    rxAntennaGain = preset.rxGain;
                    rxSensitivity = preset.rxSens;
                };
            }
        }

        // Render profile canvas if analysis exists
        setTimeout(() => {
            const canvas = container.querySelector('#rflos-canvas');
            if (canvas && currentAnalysis) {
                renderProfile(canvas, currentAnalysis);
            }
        }, 50);
    }
    
    function handleMapClick(lat, lon) {
        // Handle viewshed center selection
        if (viewshedMode && isSelectingViewshed) {
            viewshedCenter = { lat, lon };
            isSelectingViewshed = false;
            viewshedResult = null;
            notifySubscribers('update', null);
            return true;
        }

        // Handle relay point placement
        if (relayMode && isSelectingRelay >= 0) {
            relays.push({ lat, lon, antennaHeight: 2 });
            isSelectingRelay = -1;
            multiHopAnalysis = null;
            currentAnalysis = null;
            notifySubscribers('update', null);
            return true;
        }

        if (!isSelectingPoint) return false;
        
        if (isSelectingPoint === 'A') {
            pointA = { lat, lon };
        } else if (isSelectingPoint === 'B') {
            pointB = { lat, lon };
        }
        
        isSelectingPoint = null;
        currentAnalysis = null;
        multiHopAnalysis = null;
        notifySubscribers('pointSet', { pointA, pointB });
        return true;
    }
    
    function renderMapOverlay(ctx, latLonToPixel) {
        const RELAY_COLORS = ['#c084fc','#f472b6','#fb923c','#facc15','#4ade80','#38bdf8','#818cf8','#a78bfa'];

        // ── Viewshed coverage overlay ──
        if (viewshedResult && viewshedResult.radials.length > 0) {
            const vr = viewshedResult;
            const cPx = latLonToPixel(vr.center.lat, vr.center.lon);

            for (const radial of vr.radials) {
                const azRad = radial.azimuth * Math.PI / 180;
                const nextAzRad = ((radial.azimuth + vr.azimuthStep) % 360) * Math.PI / 180;

                for (const sample of radial.samples) {
                    const sPx = latLonToPixel(sample.lat, sample.lon);

                    // Compute the arc wedge for this sample
                    const dxS = sPx.x - cPx.x;
                    const dyS = sPx.y - cPx.y;
                    const rPx = Math.sqrt(dxS * dxS + dyS * dyS);

                    if (rPx < 2) continue;

                    const color = sample.status === 'clear' ? 'rgba(34,197,94,0.18)' :
                                  sample.status === 'marginal' ? 'rgba(234,179,8,0.22)' :
                                  'rgba(239,68,68,0.15)';

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(sPx.x, sPx.y, Math.max(rPx * Math.sin(vr.azimuthStep * Math.PI / 360), 3), 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Center marker
            ctx.fillStyle = '#a855f7';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cPx.x, cPx.y, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('TX', cPx.x, cPx.y + 3.5);
        } else if (viewshedCenter && viewshedMode) {
            // Show center marker even before analysis
            const cPx = latLonToPixel(viewshedCenter.lat, viewshedCenter.lon);
            ctx.fillStyle = 'rgba(168,85,247,0.6)';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cPx.x, cPx.y, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('TX', cPx.x, cPx.y + 3.5);
        }

        if (pointA) {
            const pA = latLonToPixel(pointA.lat, pointA.lon);
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pA.x, pA.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('A', pA.x, pA.y + 3);
        }

        if (pointB) {
            const pB = latLonToPixel(pointB.lat, pointB.lon);
            ctx.fillStyle = '#22c55e';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pB.x, pB.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('B', pB.x, pB.y + 3);
        }

        // Draw relay points
        for (let i = 0; i < relays.length; i++) {
            const r = relays[i];
            const pR = latLonToPixel(r.lat, r.lon);
            ctx.fillStyle = RELAY_COLORS[i % RELAY_COLORS.length];
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pR.x, pR.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${i+1}`, pR.x, pR.y + 3);
        }

        // Draw path lines
        if (relayMode && multiHopAnalysis && multiHopAnalysis.hops.length > 0) {
            // Multi-hop: draw per-hop color-coded lines
            const chain = multiHopAnalysis.chain;
            for (let i = 0; i < multiHopAnalysis.hops.length; i++) {
                const hop = multiHopAnalysis.hops[i];
                const pFrom = latLonToPixel(chain[i].lat, chain[i].lon);
                const pTo = latLonToPixel(chain[i+1].lat, chain[i+1].lon);

                const color = hop.error ? '#ef4444' :
                    hop.status === 'clear' ? '#22c55e' :
                    hop.status === 'marginal' ? '#eab308' : '#ef4444';

                ctx.strokeStyle = color;
                ctx.lineWidth = i === activeHopIndex ? 4 : 2.5;
                ctx.setLineDash(hop.error ? [4, 4] : []);
                ctx.beginPath();
                ctx.moveTo(pFrom.x, pFrom.y);
                ctx.lineTo(pTo.x, pTo.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else if (relayMode && relays.length > 0 && pointA && pointB) {
            // Pre-analysis: draw dashed chain preview
            const chain = [pointA, ...relays, pointB];
            ctx.strokeStyle = 'rgba(168,85,247,0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            for (let i = 0; i < chain.length - 1; i++) {
                const pFrom = latLonToPixel(chain[i].lat, chain[i].lon);
                const pTo = latLonToPixel(chain[i+1].lat, chain[i+1].lon);
                ctx.beginPath();
                ctx.moveTo(pFrom.x, pFrom.y);
                ctx.lineTo(pTo.x, pTo.y);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        } else if (pointA && pointB) {
            // Single-hop mode
            const pA = latLonToPixel(pointA.lat, pointA.lon);
            const pB = latLonToPixel(pointB.lat, pointB.lon);

            const color = currentAnalysis ?
                (currentAnalysis.status === 'clear' ? '#22c55e' :
                 currentAnalysis.status === 'marginal' ? '#eab308' : '#ef4444') : '#60a5fa';

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.setLineDash(currentAnalysis ? [] : [6, 4]);
            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw obstructions on map
            if (currentAnalysis && currentAnalysis.obstructions.length > 0) {
                ctx.fillStyle = '#ef4444';
                for (const obs of currentAnalysis.obstructions) {
                    const f = obs.distance / currentAnalysis.distance;
                    const obsLat = pointA.lat + (pointB.lat - pointA.lat) * f;
                    const obsLon = pointA.lon + (pointB.lon - pointA.lon) * f;
                    const pObs = latLonToPixel(obsLat, obsLon);
                    ctx.beginPath();
                    ctx.arc(pObs.x, pObs.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    // ==================== EVENTS ====================
    
    function notifySubscribers(event, data) {
        subscribers.forEach(fn => {
            try { fn(event, data); } catch (e) { console.error('RFLOS event error:', e); }
        });
    }
    
    function subscribe(callback) {
        subscribers.push(callback);
        return () => { subscribers = subscribers.filter(fn => fn !== callback); };
    }

    // ==================== PUBLIC API ====================
    
    function init() {
        console.log('RFLOSModule initialized');
        return true;
    }
    
    return {
        init,
        renderPanel,
        attachHandlers,
        handleMapClick,
        renderMapOverlay,
        analyzePath,
        analyzeHop,
        analyzeMultiHop,
        analyzeViewshed,
        renderProfile,
        subscribe,
        getPresets: () => ({ ...FREQUENCY_PRESETS }),
        getState: () => ({ pointA, pointB, antennaHeightA, antennaHeightB, selectedPreset, currentAnalysis,
                           txPower, txAntennaGain, rxAntennaGain, rxSensitivity,
                           relayMode, relays: [...relays], multiHopAnalysis, activeHopIndex,
                           viewshedMode, viewshedCenter, viewshedRadius, viewshedResolution,
                           viewshedAntennaHeight, viewshedResult, viewshedComputing }),
        isSelecting: () => isSelectingPoint !== null || isSelectingRelay >= 0 || isSelectingViewshed,
        clearAnalysis: () => { pointA = null; pointB = null; currentAnalysis = null; isSelectingPoint = null;
                               multiHopAnalysis = null; relays = []; activeHopIndex = 0; isSelectingRelay = -1;
                               viewshedResult = null; viewshedCenter = null; isSelectingViewshed = false; },
        setPointA: (lat, lon) => { pointA = { lat, lon }; },
        setPointB: (lat, lon) => { pointB = { lat, lon }; },
        addRelay: (lat, lon, antennaHeight = 2) => { if (relays.length < MAX_RELAYS) relays.push({ lat, lon, antennaHeight }); },
        removeRelay: (idx) => { if (idx >= 0 && idx < relays.length) relays.splice(idx, 1); },
        setRelayMode: (enabled) => { relayMode = enabled; if (!enabled) { multiHopAnalysis = null; isSelectingRelay = -1; } },
        setViewshedMode: (enabled) => { viewshedMode = enabled; },
        setViewshedCenter: (lat, lon) => { viewshedCenter = { lat, lon }; viewshedResult = null; },
        getImportSources,
        importFromSource,
        // Expose calculations for testing
        utils: { earthCurvatureDrop, fresnelRadius, freeSpacePathLoss, haversineDistance, calculateBearing,
                 fresnelKirchhoffV, knifeEdgeLoss, findDominantObstacle, deygoutDiffraction, computeLinkBudget }
    };
})();

if (typeof window !== 'undefined') window.RFLOSModule = RFLOSModule;
