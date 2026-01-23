/**
 * GridDown Magnetic Declination Module
 * Calculates magnetic declination using World Magnetic Model (WMM2020)
 * Valid: 2020.0 - 2025.0 (with reduced accuracy through 2030)
 * 
 * Declination = angle between true north and magnetic north
 * Positive = east declination (magnetic north is east of true north)
 * Negative = west declination (magnetic north is west of true north)
 */
const DeclinationModule = (function() {
    'use strict';

    // WMM2020 Gauss coefficients (truncated to degree 12 for efficiency)
    // Full model has coefficients to degree 12, we use simplified version
    // Format: { n, m, gnm, hnm, dgnm, dhnm } where dgnm/dhnm are secular variation
    const WMM_EPOCH = 2020.0;
    const WMM_COEFFICIENTS = [
        // n, m, g(n,m), h(n,m), dg(n,m), dh(n,m)
        [1, 0, -29404.5, 0.0, 6.7, 0.0],
        [1, 1, -1450.7, 4652.9, 7.7, -25.1],
        [2, 0, -2500.0, 0.0, -11.5, 0.0],
        [2, 1, 2982.0, -2991.6, -7.1, -30.2],
        [2, 2, 1676.8, -734.8, -2.2, -23.9],
        [3, 0, 1363.9, 0.0, 2.8, 0.0],
        [3, 1, -2381.0, -82.2, -6.2, 5.7],
        [3, 2, 1236.2, 241.8, 3.4, -1.0],
        [3, 3, 525.7, -542.9, -12.2, 1.1],
        [4, 0, 903.1, 0.0, -1.1, 0.0],
        [4, 1, 809.4, 282.0, -1.6, 0.2],
        [4, 2, 86.2, -158.4, -6.0, 6.9],
        [4, 3, -309.4, 199.8, 5.4, 3.7],
        [4, 4, 47.9, -350.1, -5.5, -5.6],
        [5, 0, -234.4, 0.0, -0.3, 0.0],
        [5, 1, 363.1, 47.7, 0.6, 0.1],
        [5, 2, 187.8, 208.4, -0.7, 2.5],
        [5, 3, -140.7, -121.3, 0.1, -0.9],
        [5, 4, -151.2, 32.2, 1.2, 3.0],
        [5, 5, 13.7, 99.1, 1.0, 0.5],
        [6, 0, 65.9, 0.0, -0.6, 0.0],
        [6, 1, 65.6, -19.1, -0.4, 0.1],
        [6, 2, 73.0, 25.0, 0.5, -1.8],
        [6, 3, -121.5, 52.7, 1.4, -1.4],
        [6, 4, -36.2, -64.4, -1.4, 0.0],
        [6, 5, 13.5, 9.0, 0.0, 0.3],
        [6, 6, -64.7, 68.1, 0.8, 1.0],
        [7, 0, 80.6, 0.0, -0.1, 0.0],
        [7, 1, -76.8, -51.4, -0.3, 0.5],
        [7, 2, -8.3, -16.8, -0.1, 0.6],
        [7, 3, 56.5, 2.3, 0.7, -0.7],
        [7, 4, 15.8, 23.5, 0.2, -0.2],
        [7, 5, 6.4, -2.2, -0.5, -1.2],
        [7, 6, -7.2, -27.2, -0.8, 0.2],
        [7, 7, 9.8, -1.8, 1.0, 0.3],
        [8, 0, 23.6, 0.0, -0.1, 0.0],
        [8, 1, 9.8, 8.4, 0.1, -0.3],
        [8, 2, -17.5, -15.3, -0.1, 0.7],
        [8, 3, -0.4, 12.8, 0.5, -0.2],
        [8, 4, -21.1, -11.8, -0.1, 0.5],
        [8, 5, 15.3, 14.9, 0.4, -0.3],
        [8, 6, 13.7, 3.6, 0.5, -0.5],
        [8, 7, -16.5, -6.9, 0.0, 0.4],
        [8, 8, -0.3, 2.8, 0.4, 0.1]
    ];

    // Earth's reference ellipsoid (WGS84)
    const WGS84_A = 6378137.0;          // Semi-major axis (m)
    const WGS84_B = 6356752.3142;       // Semi-minor axis (m)
    const WGS84_RE = 6371200.0;         // Reference radius for WMM (m)
    
    // Current state
    let currentDeclination = null;
    let currentInclination = null;
    let currentPosition = null;
    let currentDate = null;

    /**
     * Calculate magnetic field components at a given location and date
     * @param {number} lat - Latitude in degrees (-90 to 90)
     * @param {number} lon - Longitude in degrees (-180 to 180)
     * @param {number} altKm - Altitude in kilometers above WGS84 ellipsoid
     * @param {number} decimalYear - Decimal year (e.g., 2024.5 for July 2024)
     * @returns {Object} { declination, inclination, totalIntensity, horizontalIntensity, x, y, z }
     */
    function calculate(lat, lon, altKm = 0, decimalYear = null) {
        // Default to current date
        if (decimalYear === null) {
            decimalYear = getDecimalYear();
        }

        // Time adjustment from epoch
        const dt = decimalYear - WMM_EPOCH;

        // Convert to radians
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;

        // Convert geodetic to geocentric coordinates
        const altM = altKm * 1000;
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);
        
        // Geocentric radius
        const rc = WGS84_A / Math.sqrt(1 - (1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A)) * sinLat * sinLat);
        const prc = (rc + altM) * cosLat;
        const arc = (rc * (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A) + altM) * sinLat;
        
        // Geocentric latitude
        const latGC = Math.atan2(arc, prc);
        const r = Math.sqrt(arc * arc + prc * prc);
        const sinLatGC = Math.sin(latGC);
        const cosLatGC = Math.cos(latGC);

        // Legendre functions and derivatives
        const maxN = 8;  // Using coefficients up to degree 8
        const P = [];
        const dP = [];
        
        for (let n = 0; n <= maxN + 1; n++) {
            P[n] = [];
            dP[n] = [];
            for (let m = 0; m <= n; m++) {
                P[n][m] = 0;
                dP[n][m] = 0;
            }
        }

        // Schmidt quasi-normalized associated Legendre functions
        P[0][0] = 1;
        P[1][0] = sinLatGC;
        P[1][1] = cosLatGC;
        dP[0][0] = 0;
        dP[1][0] = cosLatGC;
        dP[1][1] = -sinLatGC;

        for (let n = 2; n <= maxN; n++) {
            for (let m = 0; m <= n; m++) {
                if (n === m) {
                    P[n][n] = cosLatGC * P[n-1][n-1] * Math.sqrt((2*n - 1) / (2*n));
                    dP[n][n] = cosLatGC * dP[n-1][n-1] * Math.sqrt((2*n - 1) / (2*n)) - 
                              sinLatGC * P[n-1][n-1] * Math.sqrt((2*n - 1) / (2*n));
                } else if (n === m + 1) {
                    P[n][m] = sinLatGC * P[n-1][m] * Math.sqrt(2*n - 1);
                    dP[n][m] = sinLatGC * dP[n-1][m] * Math.sqrt(2*n - 1) + 
                              cosLatGC * P[n-1][m] * Math.sqrt(2*n - 1);
                } else {
                    const k = ((n - 1) * (n - 1) - m * m) / ((2*n - 1) * (2*n - 3));
                    P[n][m] = sinLatGC * P[n-1][m] - k * P[n-2][m];
                    P[n][m] *= Math.sqrt((2*n - 1) / (n*n - m*m));
                    dP[n][m] = sinLatGC * dP[n-1][m] + cosLatGC * P[n-1][m] - k * dP[n-2][m];
                    dP[n][m] *= Math.sqrt((2*n - 1) / (n*n - m*m));
                }
            }
        }

        // Calculate field components
        let Br = 0, Bt = 0, Bp = 0;

        for (const coef of WMM_COEFFICIENTS) {
            const [n, m, gnm, hnm, dgnm, dhnm] = coef;
            if (n > maxN) continue;

            // Time-adjusted coefficients
            const g = gnm + dgnm * dt;
            const h = hnm + dhnm * dt;

            // Radial factor
            const ratio = Math.pow(WGS84_RE / r, n + 2);

            // Longitude terms
            const cosMLon = Math.cos(m * lonRad);
            const sinMLon = Math.sin(m * lonRad);

            // Field components in spherical coordinates
            Br += (n + 1) * ratio * (g * cosMLon + h * sinMLon) * P[n][m];
            Bt += ratio * (g * cosMLon + h * sinMLon) * dP[n][m];
            if (m !== 0) {
                Bp += ratio * m * (g * sinMLon - h * cosMLon) * P[n][m] / cosLatGC;
            }
        }

        Bt = -Bt;

        // Convert to geodetic coordinates (simplified)
        const Bx = -Bt * Math.cos(latRad - latGC) - Br * Math.sin(latRad - latGC);  // North
        const By = Bp;  // East
        const Bz = Bt * Math.sin(latRad - latGC) - Br * Math.cos(latRad - latGC);   // Down

        // Calculate derived quantities
        const H = Math.sqrt(Bx * Bx + By * By);  // Horizontal intensity
        const F = Math.sqrt(H * H + Bz * Bz);    // Total intensity

        // Declination (angle from true north to magnetic north)
        let D = Math.atan2(By, Bx) * 180 / Math.PI;

        // Inclination (dip angle)
        const I = Math.atan2(Bz, H) * 180 / Math.PI;

        return {
            declination: D,
            inclination: I,
            totalIntensity: F,
            horizontalIntensity: H,
            x: Bx,  // North component (nT)
            y: By,  // East component (nT)
            z: Bz   // Down component (nT)
        };
    }

    /**
     * Get current decimal year
     */
    function getDecimalYear(date = null) {
        const d = date || new Date();
        const year = d.getFullYear();
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        const dayOfYear = (d - start) / (1000 * 60 * 60 * 24);
        const daysInYear = (end - start) / (1000 * 60 * 60 * 24);
        return year + dayOfYear / daysInYear;
    }

    /**
     * Get declination for a location (simplified interface)
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {number} Declination in degrees (positive = east)
     */
    function getDeclination(lat, lon) {
        const result = calculate(lat, lon);
        return result.declination;
    }

    /**
     * Update current position and recalculate
     */
    function updatePosition(lat, lon) {
        currentPosition = { lat, lon };
        currentDate = getDecimalYear();
        
        const result = calculate(lat, lon, 0, currentDate);
        currentDeclination = result.declination;
        currentInclination = result.inclination;

        // Emit event for UI updates
        if (typeof Events !== 'undefined') {
            Events.emit('declination:updated', {
                declination: currentDeclination,
                inclination: currentInclination,
                position: currentPosition
            });
        }

        return result;
    }

    /**
     * Get current declination (cached)
     */
    function getCurrent() {
        if (currentDeclination === null && currentPosition) {
            updatePosition(currentPosition.lat, currentPosition.lon);
        }
        return {
            declination: currentDeclination,
            inclination: currentInclination,
            position: currentPosition,
            date: currentDate
        };
    }

    /**
     * Convert true bearing to magnetic bearing
     * @param {number} trueBearing - True bearing in degrees
     * @param {number} declination - Declination (or null to use current)
     * @returns {number} Magnetic bearing in degrees
     */
    function trueToMagnetic(trueBearing, declination = null) {
        const dec = declination !== null ? declination : currentDeclination;
        if (dec === null) return trueBearing;
        
        let magnetic = trueBearing - dec;
        // Normalize to 0-360
        while (magnetic < 0) magnetic += 360;
        while (magnetic >= 360) magnetic -= 360;
        return magnetic;
    }

    /**
     * Convert magnetic bearing to true bearing
     * @param {number} magneticBearing - Magnetic bearing in degrees
     * @param {number} declination - Declination (or null to use current)
     * @returns {number} True bearing in degrees
     */
    function magneticToTrue(magneticBearing, declination = null) {
        const dec = declination !== null ? declination : currentDeclination;
        if (dec === null) return magneticBearing;
        
        let trueBearing = magneticBearing + dec;
        // Normalize to 0-360
        while (trueBearing < 0) trueBearing += 360;
        while (trueBearing >= 360) trueBearing -= 360;
        return trueBearing;
    }

    /**
     * Format declination for display
     * @param {number} dec - Declination in degrees
     * @returns {string} Formatted string like "14.2° E" or "7.5° W"
     */
    function formatDeclination(dec) {
        if (dec === null || dec === undefined) return '--';
        const abs = Math.abs(dec);
        const dir = dec >= 0 ? 'E' : 'W';
        return `${abs.toFixed(1)}° ${dir}`;
    }

    /**
     * Format inclination for display
     * @param {number} inc - Inclination in degrees
     * @returns {string} Formatted string like "62.3° Down"
     */
    function formatInclination(inc) {
        if (inc === null || inc === undefined) return '--';
        const abs = Math.abs(inc);
        const dir = inc >= 0 ? 'Down' : 'Up';
        return `${abs.toFixed(1)}° ${dir}`;
    }

    /**
     * Get model validity info
     */
    function getModelInfo() {
        const currentYear = getDecimalYear();
        const yearsFromEpoch = currentYear - WMM_EPOCH;
        
        let status, warning;
        if (yearsFromEpoch < 0) {
            status = 'invalid';
            warning = 'Date is before model epoch';
        } else if (yearsFromEpoch <= 5) {
            status = 'valid';
            warning = null;
        } else if (yearsFromEpoch <= 10) {
            status = 'degraded';
            warning = 'Model accuracy reduced - update recommended';
        } else {
            status = 'expired';
            warning = 'Model expired - results may be inaccurate';
        }

        return {
            model: 'WMM2020',
            epoch: WMM_EPOCH,
            validUntil: 2025.0,
            extendedUntil: 2030.0,
            currentYear,
            status,
            warning
        };
    }

    /**
     * Initialize module - subscribe to GPS updates
     */
    function init() {
        // Listen for GPS position updates
        if (typeof Events !== 'undefined') {
            Events.on('gps:position', (data) => {
                if (data && data.lat && data.lon) {
                    updatePosition(data.lat, data.lon);
                }
            });
        }

        // Initialize with map center if available
        if (typeof MapModule !== 'undefined' && MapModule.getMapState) {
            const mapState = MapModule.getMapState();
            if (mapState && mapState.lat && mapState.lon) {
                updatePosition(mapState.lat, mapState.lon);
            }
        }

        console.log('Declination module initialized (WMM2020)');
    }

    /**
     * Generate a grid of declination values for visualization
     */
    function generateGrid(bounds, resolution = 1) {
        const grid = [];
        for (let lat = bounds.south; lat <= bounds.north; lat += resolution) {
            for (let lon = bounds.west; lon <= bounds.east; lon += resolution) {
                const dec = getDeclination(lat, lon);
                grid.push({ lat, lon, declination: dec });
            }
        }
        return grid;
    }

    // Public API
    return {
        init,
        calculate,
        getDeclination,
        updatePosition,
        getCurrent,
        trueToMagnetic,
        magneticToTrue,
        formatDeclination,
        formatInclination,
        getModelInfo,
        getDecimalYear,
        generateGrid
    };
})();

window.DeclinationModule = DeclinationModule;
