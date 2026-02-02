/**
 * GridDown Elevation Module - Route Elevation Analysis
 * Uses Open-Meteo Elevation API (free, no key required)
 */
const ElevationModule = (function() {
    'use strict';

    // Cache for elevation data to reduce API calls
    const elevationCache = new Map();
    const CACHE_PRECISION = 4; // Decimal places for cache key

    // API endpoint
    const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation';
    
    let initialized = false;

    /**
     * Initialize the module
     */
    function init() {
        if (initialized) {
            console.debug('ElevationModule already initialized');
            return;
        }
        initialized = true;
        console.log('ElevationModule initialized');
    }

    /**
     * Get cache key for coordinates
     */
    function getCacheKey(lat, lon) {
        return `${lat.toFixed(CACHE_PRECISION)},${lon.toFixed(CACHE_PRECISION)}`;
    }

    /**
     * Fetch elevation for a batch of coordinates
     * Open-Meteo accepts up to 100 coordinates per request
     */
    async function fetchElevations(coordinates) {
        if (!coordinates || coordinates.length === 0) return [];

        // Check cache first
        const uncached = [];
        const results = new Array(coordinates.length);
        
        coordinates.forEach((coord, i) => {
            const key = getCacheKey(coord.lat, coord.lon);
            if (elevationCache.has(key)) {
                results[i] = elevationCache.get(key);
            } else {
                uncached.push({ index: i, coord });
            }
        });

        // If all cached, return early
        if (uncached.length === 0) {
            return results;
        }

        // Batch uncached coordinates (API limit is 100)
        const batches = [];
        for (let i = 0; i < uncached.length; i += 100) {
            batches.push(uncached.slice(i, i + 100));
        }

        // Fetch each batch
        for (const batch of batches) {
            try {
                const lats = batch.map(b => b.coord.lat.toFixed(6)).join(',');
                const lons = batch.map(b => b.coord.lon.toFixed(6)).join(',');
                
                const response = await fetch(
                    `${ELEVATION_API}?latitude=${lats}&longitude=${lons}`
                );
                
                if (!response.ok) {
                    throw new Error(`Elevation API error: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.elevation && Array.isArray(data.elevation)) {
                    batch.forEach((b, i) => {
                        const elevation = data.elevation[i];
                        const elevationFeet = elevation * 3.28084; // Convert meters to feet
                        results[b.index] = elevationFeet;
                        
                        // Cache the result
                        const key = getCacheKey(b.coord.lat, b.coord.lon);
                        elevationCache.set(key, elevationFeet);
                    });
                }
            } catch (err) {
                console.error('Elevation fetch error:', err);
                // Fill with null for failed fetches
                batch.forEach(b => {
                    if (results[b.index] === undefined) {
                        results[b.index] = null;
                    }
                });
            }
        }

        return results;
    }
    
    /**
     * Get elevation for a single point
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<number|null>} Elevation in feet or null on error
     */
    async function getElevation(lat, lon) {
        const results = await fetchElevations([{ lat, lon }]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Interpolate points along a route for smoother elevation profile
     */
    function interpolateRoutePoints(points, targetCount = 50) {
        if (points.length < 2) return points;
        if (points.length >= targetCount) return points;

        const interpolated = [];
        const totalDistance = calculateTotalDistance(points);
        const segmentLength = totalDistance / (targetCount - 1);

        let currentDistance = 0;
        let pointIndex = 0;
        
        interpolated.push({ ...points[0], distance: 0 });

        for (let i = 1; i < targetCount - 1; i++) {
            const targetDistance = i * segmentLength;
            
            // Find the segment containing this distance
            while (pointIndex < points.length - 1) {
                const segDist = haversineDistance(
                    points[pointIndex].lat, points[pointIndex].lon,
                    points[pointIndex + 1].lat, points[pointIndex + 1].lon
                );
                
                if (currentDistance + segDist >= targetDistance) {
                    // Interpolate within this segment
                    const ratio = (targetDistance - currentDistance) / segDist;
                    const lat = points[pointIndex].lat + ratio * (points[pointIndex + 1].lat - points[pointIndex].lat);
                    const lon = points[pointIndex].lon + ratio * (points[pointIndex + 1].lon - points[pointIndex].lon);
                    
                    interpolated.push({ lat, lon, distance: targetDistance });
                    break;
                }
                
                currentDistance += segDist;
                pointIndex++;
            }
        }

        interpolated.push({ 
            ...points[points.length - 1], 
            distance: totalDistance 
        });

        return interpolated;
    }

    /**
     * Calculate total distance of route in miles
     */
    function calculateTotalDistance(points) {
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            total += haversineDistance(
                points[i - 1].lat, points[i - 1].lon,
                points[i].lat, points[i].lon
            );
        }
        return total;
    }

    /**
     * Haversine distance in miles
     */
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Analyze a route for elevation data
     * Returns elevation profile with statistics
     */
    async function analyzeRoute(route, waypoints) {
        if (!route || !route.points || route.points.length < 2) {
            return null;
        }

        // Extract coordinates from route points
        const coordinates = route.points.map(point => {
            let lat, lon;
            
            if (point.waypointId) {
                const wp = waypoints.find(w => w.id === point.waypointId);
                if (wp) {
                    lat = wp.lat || (37.4215 + (wp.y - 50) * 0.002);
                    lon = wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
                }
            }
            
            if (!lat || !lon) {
                lat = point.lat || (37.4215 + ((point.y || 50) - 50) * 0.002);
                lon = point.lon || (-119.1892 + ((point.x || 50) - 50) * 0.004);
            }
            
            return { lat, lon };
        });

        // Interpolate for smoother profile (aim for ~50-100 points)
        const targetPoints = Math.min(100, Math.max(50, coordinates.length * 3));
        const interpolated = interpolateRoutePoints(coordinates, targetPoints);

        // Fetch elevations
        const elevations = await fetchElevations(interpolated);

        // Build profile data
        let cumulativeDistance = 0;
        const profilePoints = [];
        
        for (let i = 0; i < interpolated.length; i++) {
            if (i > 0) {
                cumulativeDistance += haversineDistance(
                    interpolated[i - 1].lat, interpolated[i - 1].lon,
                    interpolated[i].lat, interpolated[i].lon
                );
            }
            
            profilePoints.push({
                distance: cumulativeDistance,
                elevation: elevations[i],
                lat: interpolated[i].lat,
                lon: interpolated[i].lon
            });
        }

        // Calculate statistics
        const validElevations = profilePoints
            .map(p => p.elevation)
            .filter(e => e !== null && !isNaN(e));

        if (validElevations.length === 0) {
            return null;
        }

        const stats = calculateElevationStats(profilePoints);

        return {
            points: profilePoints,
            totalDistance: cumulativeDistance,
            ...stats
        };
    }

    /**
     * Calculate elevation statistics
     */
    function calculateElevationStats(points) {
        let totalGain = 0;
        let totalLoss = 0;
        let maxElevation = -Infinity;
        let minElevation = Infinity;
        const grades = [];

        for (let i = 0; i < points.length; i++) {
            const elev = points[i].elevation;
            
            if (elev === null || isNaN(elev)) continue;
            
            maxElevation = Math.max(maxElevation, elev);
            minElevation = Math.min(minElevation, elev);

            if (i > 0 && points[i - 1].elevation !== null) {
                const elevChange = elev - points[i - 1].elevation;
                const distChange = points[i].distance - points[i - 1].distance;
                
                if (elevChange > 0) {
                    totalGain += elevChange;
                } else {
                    totalLoss += Math.abs(elevChange);
                }

                // Calculate grade (rise/run as percentage)
                if (distChange > 0) {
                    // Convert miles to feet for grade calculation
                    const distFeet = distChange * 5280;
                    const grade = (elevChange / distFeet) * 100;
                    grades.push({
                        distance: points[i].distance,
                        grade: grade,
                        elevation: elev
                    });
                }
            }
        }

        // Analyze grade distribution
        const gradeDistribution = analyzeGradeDistribution(grades);
        
        // Find steep sections
        const steepSections = findSteepSections(grades, points);

        return {
            totalElevationGain: totalGain,
            totalElevationLoss: totalLoss,
            maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
            minElevation: minElevation === Infinity ? 0 : minElevation,
            averageGrade: grades.length > 0 
                ? grades.reduce((sum, g) => sum + Math.abs(g.grade), 0) / grades.length 
                : 0,
            gradeDistribution,
            steepSections,
            grades
        };
    }

    /**
     * Analyze grade distribution
     */
    function analyzeGradeDistribution(grades) {
        const distribution = {
            flat: 0,      // 0-3%
            gentle: 0,    // 3-6%
            moderate: 0,  // 6-10%
            steep: 0,     // 10-15%
            verysteep: 0  // 15%+
        };

        grades.forEach(g => {
            const absGrade = Math.abs(g.grade);
            if (absGrade < 3) distribution.flat++;
            else if (absGrade < 6) distribution.gentle++;
            else if (absGrade < 10) distribution.moderate++;
            else if (absGrade < 15) distribution.steep++;
            else distribution.verysteep++;
        });

        const total = grades.length || 1;
        return {
            flat: (distribution.flat / total) * 100,
            gentle: (distribution.gentle / total) * 100,
            moderate: (distribution.moderate / total) * 100,
            steep: (distribution.steep / total) * 100,
            verysteep: (distribution.verysteep / total) * 100
        };
    }

    /**
     * Find steep sections that may be problematic
     */
    function findSteepSections(grades, points) {
        const steepSections = [];
        let inSteepSection = false;
        let sectionStart = null;
        let sectionMaxGrade = 0;

        grades.forEach((g, i) => {
            const absGrade = Math.abs(g.grade);
            
            if (absGrade >= 10 && !inSteepSection) {
                // Start of steep section
                inSteepSection = true;
                sectionStart = g.distance;
                sectionMaxGrade = absGrade;
            } else if (absGrade >= 10 && inSteepSection) {
                // Continue steep section
                sectionMaxGrade = Math.max(sectionMaxGrade, absGrade);
            } else if (absGrade < 10 && inSteepSection) {
                // End of steep section
                steepSections.push({
                    startDistance: sectionStart,
                    endDistance: g.distance,
                    maxGrade: sectionMaxGrade,
                    direction: g.grade > 0 ? 'uphill' : 'downhill'
                });
                inSteepSection = false;
                sectionStart = null;
                sectionMaxGrade = 0;
            }
        });

        // Close any open section
        if (inSteepSection && grades.length > 0) {
            steepSections.push({
                startDistance: sectionStart,
                endDistance: grades[grades.length - 1].distance,
                maxGrade: sectionMaxGrade,
                direction: sectionMaxGrade > 0 ? 'uphill' : 'downhill'
            });
        }

        return steepSections;
    }

    /**
     * Render elevation profile on canvas
     */
    function renderProfile(canvas, profile, options = {}) {
        if (!canvas || !profile || !profile.points) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        const width = canvas.parentElement?.clientWidth || 300;
        const height = options.height || 150;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const padding = { top: 20, right: 20, bottom: 30, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Clear canvas
        ctx.fillStyle = '#1a1f2e';
        ctx.fillRect(0, 0, width, height);

        // Get data bounds
        const validPoints = profile.points.filter(p => p.elevation !== null);
        if (validPoints.length < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Insufficient elevation data', width / 2, height / 2);
            return;
        }

        const minElev = profile.minElevation - 100;
        const maxElev = profile.maxElevation + 100;
        const maxDist = profile.totalDistance;

        // Helper to convert data to canvas coordinates
        const toX = (distance) => padding.left + (distance / maxDist) * chartWidth;
        const toY = (elevation) => padding.top + chartHeight - ((elevation - minElev) / (maxElev - minElev)) * chartHeight;

        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;

        // Horizontal grid lines (elevation)
        const elevStep = Math.ceil((maxElev - minElev) / 5 / 500) * 500;
        for (let e = Math.ceil(minElev / elevStep) * elevStep; e <= maxElev; e += elevStep) {
            const y = toY(e);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '10px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(e)}'`, padding.left - 5, y + 3);
        }

        // Vertical grid lines (distance)
        const distStep = Math.ceil(maxDist / 5);
        for (let d = 0; d <= maxDist; d += distStep) {
            const x = toX(d);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '10px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${d.toFixed(1)} mi`, x, height - 10);
        }

        // Draw elevation fill
        ctx.beginPath();
        ctx.moveTo(toX(validPoints[0].distance), height - padding.bottom);
        
        validPoints.forEach(point => {
            ctx.lineTo(toX(point.distance), toY(point.elevation));
        });
        
        ctx.lineTo(toX(validPoints[validPoints.length - 1].distance), height - padding.bottom);
        ctx.closePath();

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
        gradient.addColorStop(1, 'rgba(249, 115, 22, 0.05)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw elevation line
        ctx.beginPath();
        ctx.moveTo(toX(validPoints[0].distance), toY(validPoints[0].elevation));
        
        validPoints.forEach(point => {
            ctx.lineTo(toX(point.distance), toY(point.elevation));
        });

        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Mark steep sections
        profile.steepSections?.forEach(section => {
            const x1 = toX(section.startDistance);
            const x2 = toX(section.endDistance);
            ctx.fillStyle = section.direction === 'uphill' 
                ? 'rgba(239, 68, 68, 0.2)' 
                : 'rgba(59, 130, 246, 0.2)';
            ctx.fillRect(x1, padding.top, x2 - x1, chartHeight);
        });

        // Draw axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Distance (miles)', width / 2, height - 2);
        
        ctx.save();
        ctx.translate(12, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Elevation (ft)', 0, 0);
        ctx.restore();
    }

    /**
     * Render grade distribution chart
     */
    function renderGradeDistribution(element, profile) {
        if (!element || !profile || !profile.gradeDistribution) return;

        const dist = profile.gradeDistribution;
        const categories = [
            { key: 'flat', label: 'Flat (0-3%)', color: '#22c55e' },
            { key: 'gentle', label: 'Gentle (3-6%)', color: '#84cc16' },
            { key: 'moderate', label: 'Moderate (6-10%)', color: '#eab308' },
            { key: 'steep', label: 'Steep (10-15%)', color: '#f97316' },
            { key: 'verysteep', label: 'Very Steep (15%+)', color: '#ef4444' }
        ];

        element.innerHTML = `
            <div class="grade-distribution">
                ${categories.map(cat => `
                    <div class="grade-distribution__row">
                        <div class="grade-distribution__label">${cat.label}</div>
                        <div class="grade-distribution__bar-container">
                            <div class="grade-distribution__bar" 
                                 style="width: ${dist[cat.key]}%; background: ${cat.color}"></div>
                        </div>
                        <div class="grade-distribution__value">${dist[cat.key].toFixed(0)}%</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Get logistics impact from elevation profile
     */
    function getLogisticsImpact(profile) {
        if (!profile) {
            return { fuelMultiplier: 1, timeMultiplier: 1, warnings: [] };
        }

        const warnings = [];
        let fuelMultiplier = 1;
        let timeMultiplier = 1;

        // Elevation gain impacts
        const gainPer1000ft = profile.totalElevationGain / 1000;
        fuelMultiplier += gainPer1000ft * 0.05; // 5% more fuel per 1000ft gain
        timeMultiplier += gainPer1000ft * 0.1;  // 10% more time per 1000ft gain

        // Steep sections
        profile.steepSections?.forEach((section, i) => {
            const length = section.endDistance - section.startDistance;
            const severity = section.maxGrade >= 15 ? 'Severe' : 'Moderate';
            const impact = section.direction === 'uphill' 
                ? 'Increased fuel consumption' 
                : 'Brake wear, slow descent';

            warnings.push({
                location: `Mile ${section.startDistance.toFixed(1)}-${section.endDistance.toFixed(1)}`,
                grade: section.maxGrade.toFixed(0),
                direction: section.direction,
                severity,
                impact
            });

            // Additional multipliers for steep sections
            if (section.maxGrade >= 15) {
                fuelMultiplier += length * 0.1;
                timeMultiplier += length * 0.15;
            }
        });

        // Grade distribution impacts
        const dist = profile.gradeDistribution;
        if (dist.steep + dist.verysteep > 30) {
            warnings.push({
                location: 'Overall route',
                grade: `${(dist.steep + dist.verysteep).toFixed(0)}% difficult`,
                severity: 'Warning',
                impact: 'Consider alternate route or additional fuel'
            });
        }

        return {
            fuelMultiplier: Math.min(fuelMultiplier, 2.5), // Cap at 2.5x
            timeMultiplier: Math.min(timeMultiplier, 3),   // Cap at 3x
            warnings,
            summary: {
                totalGain: profile.totalElevationGain,
                totalLoss: profile.totalElevationLoss,
                steepSectionCount: profile.steepSections?.length || 0,
                difficultPercentage: dist.steep + dist.verysteep
            }
        };
    }

    /**
     * Clear elevation cache
     */
    function clearCache() {
        elevationCache.clear();
    }

    // Public API
    return {
        init,
        analyzeRoute,
        renderProfile,
        renderGradeDistribution,
        getLogisticsImpact,
        clearCache,
        fetchElevations,
        getElevation
    };
})();

window.ElevationModule = ElevationModule;
