/**
 * GridDown Contingency Planning Module
 * Provides bail-out analysis, alternate routes, time checkpoints, and itinerary generation
 */
const ContingencyModule = (function() {
    'use strict';

    // Configuration
    const config = {
        // Default travel speeds by terrain (mph)
        speeds: {
            highway: 55,
            road: 30,
            trail: 12,
            crawl: 5,
            foot: 3
        },
        // Buffer time percentage for ETAs
        timeBuffer: 0.15, // 15% buffer
        // Maximum search radius from last known point (miles)
        maxSearchRadius: 10,
        // Checkpoint interval (miles)
        checkpointInterval: 10,
        // Overdue threshold (hours past ETA)
        overdueThreshold: 2
    };

    // Current trip plan state
    let currentPlan = null;

    /**
     * Initialize the module
     */
    function init() {
        console.log('ContingencyModule initialized');
    }

    /**
     * Calculate distance between two points using Haversine formula
     */
    function calcDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 + 
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    /**
     * Get coordinates from a waypoint or point object
     */
    function getCoords(point, waypoints) {
        let lat, lon;
        
        if (point.waypointId) {
            const wp = waypoints.find(w => w.id === point.waypointId);
            if (wp) {
                lat = wp.lat || (37.4215 + (wp.y - 50) * 0.002);
                lon = wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
                return { lat, lon, name: wp.name, type: wp.type };
            }
        }
        
        lat = point.lat || (37.4215 + ((point.y || 50) - 50) * 0.002);
        lon = point.lon || (-119.1892 + ((point.x || 50) - 50) * 0.004);
        
        return { lat, lon, name: point.name || null, type: point.type || null };
    }

    /**
     * Calculate cumulative distances along a route
     */
    function calculateRouteDistances(route, waypoints) {
        if (!route || !route.points || route.points.length < 2) {
            return [];
        }

        const distances = [{ index: 0, cumulative: 0, coords: getCoords(route.points[0], waypoints) }];
        let cumulative = 0;

        for (let i = 1; i < route.points.length; i++) {
            const prev = getCoords(route.points[i - 1], waypoints);
            const curr = getCoords(route.points[i], waypoints);
            const segmentDist = calcDistance(prev.lat, prev.lon, curr.lat, curr.lon);
            cumulative += segmentDist;
            
            distances.push({
                index: i,
                cumulative: cumulative,
                segmentDistance: segmentDist,
                coords: curr,
                terrain: route.points[i].terrain || 'road'
            });
        }

        return distances;
    }

    // =========================================================================
    // BAIL-OUT ANALYSIS
    // =========================================================================

    /**
     * Find all bail-out points from waypoints
     */
    function getBailoutPoints(waypoints) {
        return waypoints
            .filter(w => w.type === 'bailout')
            .map(w => ({
                id: w.id,
                name: w.name,
                lat: w.lat || (37.4215 + (w.y - 50) * 0.002),
                lon: w.lon || (-119.1892 + (w.x - 50) * 0.004),
                notes: w.notes || '',
                verified: w.verified || false
            }));
    }

    /**
     * Analyze bail-out options for every point along a route
     */
    function analyzeBailouts(route, waypoints) {
        if (!route || !route.points || route.points.length < 2) {
            return { error: 'Invalid route' };
        }

        const bailoutPoints = getBailoutPoints(waypoints);
        if (bailoutPoints.length === 0) {
            return { 
                error: 'No bail-out points defined',
                recommendation: 'Add bail-out waypoints (🚁) to enable analysis'
            };
        }

        const routeDistances = calculateRouteDistances(route, waypoints);
        const analysis = [];

        // Analyze each point along the route
        routeDistances.forEach((point, idx) => {
            const pointCoords = point.coords;
            
            // Calculate distance to each bail-out point
            const bailoutOptions = bailoutPoints.map(bp => {
                const distance = calcDistance(pointCoords.lat, pointCoords.lon, bp.lat, bp.lon);
                const estimatedTime = distance / config.speeds.road; // Assume road speed for bail-out
                
                return {
                    ...bp,
                    distance: distance,
                    estimatedTime: estimatedTime,
                    bearing: calculateBearing(pointCoords.lat, pointCoords.lon, bp.lat, bp.lon)
                };
            }).sort((a, b) => a.distance - b.distance);

            analysis.push({
                mileMarker: point.cumulative,
                pointIndex: idx,
                location: pointCoords.name || `Mile ${point.cumulative.toFixed(1)}`,
                coords: pointCoords,
                nearestBailout: bailoutOptions[0],
                allBailouts: bailoutOptions,
                riskLevel: assessBailoutRisk(bailoutOptions[0]?.distance)
            });
        });

        // Find critical sections (areas far from bail-outs)
        const criticalSections = findCriticalSections(analysis);

        return {
            routeName: route.name,
            totalDistance: routeDistances[routeDistances.length - 1]?.cumulative || 0,
            bailoutPoints: bailoutPoints,
            pointAnalysis: analysis,
            criticalSections: criticalSections,
            summary: generateBailoutSummary(analysis, criticalSections)
        };
    }

    /**
     * Assess risk level based on distance to nearest bail-out
     */
    function assessBailoutRisk(distance) {
        if (distance === undefined || distance === null) {
            return { level: 'unknown', color: '#6b7280', label: 'Unknown' };
        }
        if (distance <= 5) {
            return { level: 'low', color: '#22c55e', label: 'Low Risk' };
        }
        if (distance <= 15) {
            return { level: 'moderate', color: '#f59e0b', label: 'Moderate Risk' };
        }
        if (distance <= 30) {
            return { level: 'high', color: '#f97316', label: 'High Risk' };
        }
        return { level: 'critical', color: '#ef4444', label: 'Critical Risk' };
    }

    /**
     * Find sections of route that are far from bail-out points
     */
    function findCriticalSections(analysis) {
        const criticalSections = [];
        let sectionStart = null;

        analysis.forEach((point, idx) => {
            const isCritical = point.nearestBailout?.distance > 15;
            
            if (isCritical && sectionStart === null) {
                sectionStart = { index: idx, mileMarker: point.mileMarker };
            } else if (!isCritical && sectionStart !== null) {
                criticalSections.push({
                    startMile: sectionStart.mileMarker,
                    endMile: analysis[idx - 1].mileMarker,
                    length: analysis[idx - 1].mileMarker - sectionStart.mileMarker,
                    maxDistanceToBailout: Math.max(
                        ...analysis.slice(sectionStart.index, idx).map(p => p.nearestBailout?.distance || 0)
                    )
                });
                sectionStart = null;
            }
        });

        // Handle section that extends to end of route
        if (sectionStart !== null) {
            const lastPoint = analysis[analysis.length - 1];
            criticalSections.push({
                startMile: sectionStart.mileMarker,
                endMile: lastPoint.mileMarker,
                length: lastPoint.mileMarker - sectionStart.mileMarker,
                maxDistanceToBailout: Math.max(
                    ...analysis.slice(sectionStart.index).map(p => p.nearestBailout?.distance || 0)
                )
            });
        }

        return criticalSections;
    }

    /**
     * Generate summary of bail-out analysis
     */
    function generateBailoutSummary(analysis, criticalSections) {
        const avgDistance = analysis.reduce((sum, p) => sum + (p.nearestBailout?.distance || 0), 0) / analysis.length;
        const maxDistance = Math.max(...analysis.map(p => p.nearestBailout?.distance || 0));
        const minDistance = Math.min(...analysis.map(p => p.nearestBailout?.distance || Infinity));

        return {
            avgDistanceToBailout: avgDistance,
            maxDistanceToBailout: maxDistance,
            minDistanceToBailout: minDistance,
            criticalSectionCount: criticalSections.length,
            criticalMiles: criticalSections.reduce((sum, s) => sum + s.length, 0),
            overallRisk: maxDistance > 30 ? 'high' : maxDistance > 15 ? 'moderate' : 'low'
        };
    }

    /**
     * Get bail-out recommendation for a specific mile marker
     */
    function getBailoutAtMile(route, waypoints, mileMarker) {
        const analysis = analyzeBailouts(route, waypoints);
        if (analysis.error) return analysis;

        // Find the closest analyzed point to the requested mile marker
        const point = analysis.pointAnalysis.reduce((closest, p) => {
            return Math.abs(p.mileMarker - mileMarker) < Math.abs(closest.mileMarker - mileMarker) ? p : closest;
        });

        return {
            mileMarker: mileMarker,
            actualMileMarker: point.mileMarker,
            location: point.location,
            nearestBailout: point.nearestBailout,
            alternatives: point.allBailouts.slice(1, 3), // Next 2 alternatives
            riskLevel: point.riskLevel,
            recommendation: generateBailoutRecommendation(point)
        };
    }

    /**
     * Generate bail-out recommendation text
     */
    function generateBailoutRecommendation(point) {
        const bp = point.nearestBailout;
        if (!bp) return 'No bail-out points available';

        const direction = getCardinalDirection(bp.bearing);
        let recommendation = `Nearest exit: ${bp.name} - ${bp.distance.toFixed(1)} miles ${direction}`;
        
        if (bp.estimatedTime < 1) {
            recommendation += ` (~${Math.round(bp.estimatedTime * 60)} min)`;
        } else {
            recommendation += ` (~${bp.estimatedTime.toFixed(1)} hours)`;
        }

        if (bp.notes) {
            recommendation += `. Note: ${bp.notes}`;
        }

        return recommendation;
    }

    // =========================================================================
    // ALTERNATE ROUTE COMPARISON
    // =========================================================================

    /**
     * Compare two routes with detailed metrics
     */
    function compareRoutes(primaryRoute, alternateRoute, waypoints) {
        if (!primaryRoute || !alternateRoute) {
            return { error: 'Both routes required for comparison' };
        }

        const primaryAnalysis = analyzeRouteMetrics(primaryRoute, waypoints);
        const alternateAnalysis = analyzeRouteMetrics(alternateRoute, waypoints);

        const comparison = {
            primary: {
                name: primaryRoute.name,
                ...primaryAnalysis
            },
            alternate: {
                name: alternateRoute.name,
                ...alternateAnalysis
            },
            differences: {
                distance: alternateAnalysis.totalDistance - primaryAnalysis.totalDistance,
                time: alternateAnalysis.estimatedTime - primaryAnalysis.estimatedTime,
                fuel: alternateAnalysis.estimatedFuel - primaryAnalysis.estimatedFuel,
                riskScore: alternateAnalysis.riskScore - primaryAnalysis.riskScore
            },
            recommendation: generateRouteRecommendation(primaryAnalysis, alternateAnalysis)
        };

        return comparison;
    }

    /**
     * Analyze detailed metrics for a route
     */
    function analyzeRouteMetrics(route, waypoints) {
        const routeDistances = calculateRouteDistances(route, waypoints);
        const totalDistance = routeDistances[routeDistances.length - 1]?.cumulative || 0;

        // Calculate terrain breakdown
        const terrainBreakdown = { highway: 0, road: 0, trail: 0, crawl: 0 };
        routeDistances.forEach((point, i) => {
            if (i > 0) {
                const terrain = point.terrain || 'road';
                terrainBreakdown[terrain] = (terrainBreakdown[terrain] || 0) + point.segmentDistance;
            }
        });

        // Estimate time based on terrain
        let estimatedTime = 0;
        Object.entries(terrainBreakdown).forEach(([terrain, distance]) => {
            estimatedTime += distance / (config.speeds[terrain] || config.speeds.road);
        });

        // Estimate fuel (assume 15 mpg average, adjusted by terrain)
        const fuelEfficiency = {
            highway: 18, road: 15, trail: 10, crawl: 5
        };
        let estimatedFuel = 0;
        Object.entries(terrainBreakdown).forEach(([terrain, distance]) => {
            estimatedFuel += distance / (fuelEfficiency[terrain] || 15);
        });

        // Count resources along route
        const resourcesOnRoute = countRouteResources(route, waypoints);

        // Calculate risk score (higher = more risky)
        const bailoutAnalysis = analyzeBailouts(route, waypoints);
        const riskScore = calculateRouteRiskScore(terrainBreakdown, totalDistance, bailoutAnalysis);

        return {
            totalDistance,
            terrainBreakdown,
            estimatedTime,
            estimatedTimeWithBuffer: estimatedTime * (1 + config.timeBuffer),
            estimatedFuel,
            resourcesOnRoute,
            riskScore,
            bailoutSummary: bailoutAnalysis.summary || null
        };
    }

    /**
     * Count resources available along a route
     */
    function countRouteResources(route, waypoints) {
        const resources = {
            water: 0,
            fuel: 0,
            camp: 0,
            resupply: 0,
            bailout: 0
        };

        route.points.forEach(point => {
            if (point.waypointId) {
                const wp = waypoints.find(w => w.id === point.waypointId);
                if (wp && resources.hasOwnProperty(wp.type)) {
                    resources[wp.type]++;
                }
            }
        });

        return resources;
    }

    /**
     * Calculate risk score for a route
     */
    function calculateRouteRiskScore(terrainBreakdown, totalDistance, bailoutAnalysis) {
        let score = 0;

        // Terrain difficulty
        score += (terrainBreakdown.trail || 0) * 2;
        score += (terrainBreakdown.crawl || 0) * 5;

        // Distance from bail-outs
        if (bailoutAnalysis.summary) {
            score += bailoutAnalysis.summary.maxDistanceToBailout * 0.5;
            score += bailoutAnalysis.summary.criticalMiles * 0.3;
        }

        // Normalize to 0-100 scale
        return Math.min(100, Math.round(score));
    }

    /**
     * Generate route recommendation
     */
    function generateRouteRecommendation(primary, alternate) {
        const dominated = {
            byPrimary: alternate.totalDistance > primary.totalDistance && 
                       alternate.estimatedTime > primary.estimatedTime &&
                       alternate.riskScore >= primary.riskScore,
            byAlternate: primary.totalDistance > alternate.totalDistance && 
                         primary.estimatedTime > alternate.estimatedTime &&
                         primary.riskScore >= alternate.riskScore
        };

        if (dominated.byPrimary) {
            return {
                choice: 'primary',
                reason: 'Primary route is shorter, faster, and equally or less risky'
            };
        }
        
        if (dominated.byAlternate) {
            return {
                choice: 'alternate',
                reason: 'Alternate route is shorter, faster, and equally or less risky'
            };
        }

        // Trade-off analysis
        if (alternate.riskScore < primary.riskScore - 10) {
            return {
                choice: 'alternate',
                reason: `Alternate is significantly safer (risk ${alternate.riskScore} vs ${primary.riskScore}) despite being ${(alternate.totalDistance - primary.totalDistance).toFixed(1)} miles longer`
            };
        }

        if (primary.estimatedTime < alternate.estimatedTime * 0.8) {
            return {
                choice: 'primary',
                reason: `Primary is 20%+ faster (${formatDuration(primary.estimatedTime)} vs ${formatDuration(alternate.estimatedTime)})`
            };
        }

        return {
            choice: 'either',
            reason: 'Both routes are viable. Primary is shorter; alternate may offer different conditions.'
        };
    }

    // =========================================================================
    // TIME-BASED CHECKPOINTS
    // =========================================================================

    /**
     * Generate time-based checkpoints for a route
     */
    function generateCheckpoints(route, waypoints, options = {}) {
        const {
            departureTime = new Date(),
            intervalMiles = config.checkpointInterval,
            includeSearchAreas = true
        } = options;

        if (!route || !route.points || route.points.length < 2) {
            return { error: 'Invalid route' };
        }

        const routeDistances = calculateRouteDistances(route, waypoints);
        const totalDistance = routeDistances[routeDistances.length - 1]?.cumulative || 0;
        const checkpoints = [];

        // Start checkpoint
        const startCoords = getCoords(route.points[0], waypoints);
        checkpoints.push({
            id: 'start',
            type: 'start',
            name: startCoords.name || 'Start Point',
            mileMarker: 0,
            coords: startCoords,
            expectedTime: new Date(departureTime),
            overdueTime: new Date(departureTime.getTime() + config.overdueThreshold * 60 * 60 * 1000),
            searchArea: null
        });

        // Generate checkpoints at intervals
        let currentTime = departureTime.getTime();
        let lastCheckpointMile = 0;

        for (let targetMile = intervalMiles; targetMile < totalDistance; targetMile += intervalMiles) {
            // Find the route point closest to this mile marker
            const closestPoint = routeDistances.reduce((closest, p) => {
                return Math.abs(p.cumulative - targetMile) < Math.abs(closest.cumulative - targetMile) ? p : closest;
            });

            // Calculate time to this checkpoint
            const segmentDistance = closestPoint.cumulative - lastCheckpointMile;
            const terrain = closestPoint.terrain || 'road';
            const segmentTime = (segmentDistance / config.speeds[terrain]) * 60 * 60 * 1000; // ms
            currentTime += segmentTime;

            const expectedTime = new Date(currentTime);
            const overdueTime = new Date(currentTime + config.overdueThreshold * 60 * 60 * 1000);

            const checkpoint = {
                id: `cp_${checkpoints.length}`,
                type: 'checkpoint',
                name: closestPoint.coords.name || `Checkpoint ${checkpoints.length}`,
                mileMarker: closestPoint.cumulative,
                coords: closestPoint.coords,
                expectedTime: expectedTime,
                overdueTime: overdueTime,
                terrain: terrain,
                searchArea: includeSearchAreas ? generateSearchArea(closestPoint.coords, checkpoints[checkpoints.length - 1]?.coords) : null
            };

            checkpoints.push(checkpoint);
            lastCheckpointMile = closestPoint.cumulative;
        }

        // End checkpoint
        const endPoint = routeDistances[routeDistances.length - 1];
        const endCoords = endPoint.coords;
        const finalSegmentDistance = totalDistance - lastCheckpointMile;
        const finalTerrain = endPoint.terrain || 'road';
        const finalSegmentTime = (finalSegmentDistance / config.speeds[finalTerrain]) * 60 * 60 * 1000;
        currentTime += finalSegmentTime;

        checkpoints.push({
            id: 'end',
            type: 'end',
            name: endCoords.name || 'Destination',
            mileMarker: totalDistance,
            coords: endCoords,
            expectedTime: new Date(currentTime),
            overdueTime: new Date(currentTime + config.overdueThreshold * 60 * 60 * 1000),
            searchArea: includeSearchAreas ? generateSearchArea(endCoords, checkpoints[checkpoints.length - 1]?.coords) : null
        });

        return {
            routeName: route.name,
            departureTime: departureTime,
            totalDistance: totalDistance,
            estimatedArrival: new Date(currentTime),
            estimatedDuration: (currentTime - departureTime.getTime()) / (60 * 60 * 1000), // hours
            checkpoints: checkpoints,
            overdueProtocol: generateOverdueProtocol(checkpoints)
        };
    }

    /**
     * Generate search area between two points
     */
    function generateSearchArea(currentCoords, previousCoords) {
        if (!previousCoords) {
            return {
                type: 'radius',
                center: currentCoords,
                radius: config.maxSearchRadius,
                description: `Search ${config.maxSearchRadius} mile radius from ${currentCoords.name || 'this point'}`
            };
        }

        // Create a corridor between previous and current checkpoint
        const midLat = (currentCoords.lat + previousCoords.lat) / 2;
        const midLon = (currentCoords.lon + previousCoords.lon) / 2;
        const segmentDistance = calcDistance(previousCoords.lat, previousCoords.lon, currentCoords.lat, currentCoords.lon);

        return {
            type: 'corridor',
            start: previousCoords,
            end: currentCoords,
            center: { lat: midLat, lon: midLon },
            width: Math.min(5, segmentDistance * 0.3), // 30% of segment or 5 miles max
            length: segmentDistance,
            description: `Search corridor from ${previousCoords.name || 'previous checkpoint'} to ${currentCoords.name || 'this point'} (${segmentDistance.toFixed(1)} miles)`
        };
    }

    /**
     * Generate overdue protocol instructions
     */
    function generateOverdueProtocol(checkpoints) {
        const protocol = [];

        checkpoints.forEach((cp, idx) => {
            if (idx === 0) return; // Skip start

            const prevCp = checkpoints[idx - 1];
            
            protocol.push({
                checkpoint: cp.name,
                overdueTime: cp.overdueTime,
                action: `If no contact by ${formatTime(cp.overdueTime)}:`,
                searchInstructions: [
                    `1. Attempt radio/phone contact`,
                    `2. Wait 30 minutes for delayed check-in`,
                    `3. If still no contact, begin search in: ${cp.searchArea?.description || 'last known area'}`,
                    `4. Contact local SAR if not located within 2 hours`
                ],
                lastKnownPosition: prevCp.coords,
                searchBoundary: cp.searchArea
            });
        });

        return protocol;
    }

    // =========================================================================
    // ITINERARY GENERATION
    // =========================================================================

    /**
     * Generate a complete trip itinerary
     */
    function generateItinerary(route, waypoints, options = {}) {
        const {
            departureTime = new Date(),
            travelerName = 'Traveler',
            vehicleInfo = 'Vehicle',
            emergencyContacts = [],
            notes = ''
        } = options;

        if (!route || !route.points || route.points.length < 2) {
            return { error: 'Invalid route' };
        }

        // Get checkpoint data
        const checkpointData = generateCheckpoints(route, waypoints, { departureTime });
        if (checkpointData.error) return checkpointData;

        // Get bail-out analysis
        const bailoutData = analyzeBailouts(route, waypoints);

        // Get route metrics
        const routeMetrics = analyzeRouteMetrics(route, waypoints);

        // Build itinerary
        const itinerary = {
            // Header info
            title: `Trip Plan: ${route.name}`,
            generatedAt: new Date(),
            traveler: travelerName,
            vehicle: vehicleInfo,
            
            // Trip summary
            summary: {
                route: route.name,
                totalDistance: `${routeMetrics.totalDistance.toFixed(1)} miles`,
                estimatedDuration: formatDuration(routeMetrics.estimatedTime),
                departureTime: formatDateTime(departureTime),
                expectedArrival: formatDateTime(checkpointData.estimatedArrival),
                latestArrival: formatDateTime(new Date(checkpointData.estimatedArrival.getTime() + config.overdueThreshold * 60 * 60 * 1000))
            },

            // Detailed checkpoints
            checkpoints: checkpointData.checkpoints.map(cp => ({
                name: cp.name,
                mileMarker: `Mile ${cp.mileMarker.toFixed(1)}`,
                coordinates: `${cp.coords.lat.toFixed(5)}, ${cp.coords.lon.toFixed(5)}`,
                expectedTime: formatDateTime(cp.expectedTime),
                overdueTime: formatDateTime(cp.overdueTime),
                type: cp.type
            })),

            // Bail-out points
            bailoutPoints: (bailoutData.bailoutPoints || []).map(bp => ({
                name: bp.name,
                coordinates: `${bp.lat.toFixed(5)}, ${bp.lon.toFixed(5)}`,
                notes: bp.notes
            })),

            // Emergency protocol
            emergencyProtocol: {
                overdueThreshold: `${config.overdueThreshold} hours past expected arrival`,
                contacts: emergencyContacts,
                instructions: [
                    `If no contact by ${formatDateTime(new Date(checkpointData.estimatedArrival.getTime() + config.overdueThreshold * 60 * 60 * 1000))}:`,
                    '1. Attempt to reach traveler via phone/radio',
                    '2. Contact emergency contacts listed below',
                    '3. If unable to establish contact within 1 hour, notify local authorities',
                    '4. Provide this itinerary and last known checkpoint to search teams'
                ],
                searchAreas: checkpointData.overdueProtocol
            },

            // Resources on route
            resources: routeMetrics.resourcesOnRoute,

            // Additional notes
            notes: notes,

            // Raw data for export
            rawData: {
                route: route,
                checkpoints: checkpointData,
                bailouts: bailoutData,
                metrics: routeMetrics
            }
        };

        // Store as current plan
        currentPlan = itinerary;

        return itinerary;
    }

    /**
     * Export itinerary as plain text
     */
    function exportItineraryAsText(itinerary) {
        if (!itinerary) {
            itinerary = currentPlan;
        }
        if (!itinerary) {
            return 'No itinerary generated';
        }

        const lines = [];
        const divider = '═'.repeat(60);
        const thinDivider = '─'.repeat(60);

        // Header
        lines.push(divider);
        lines.push(`  ${itinerary.title.toUpperCase()}`);
        lines.push(`  Generated: ${formatDateTime(itinerary.generatedAt)}`);
        lines.push(divider);
        lines.push('');

        // Traveler Info
        lines.push('TRAVELER INFORMATION');
        lines.push(thinDivider);
        lines.push(`Name:     ${itinerary.traveler}`);
        lines.push(`Vehicle:  ${itinerary.vehicle}`);
        lines.push('');

        // Trip Summary
        lines.push('TRIP SUMMARY');
        lines.push(thinDivider);
        lines.push(`Route:              ${itinerary.summary.route}`);
        lines.push(`Total Distance:     ${itinerary.summary.totalDistance}`);
        lines.push(`Est. Duration:      ${itinerary.summary.estimatedDuration}`);
        lines.push(`Departure:          ${itinerary.summary.departureTime}`);
        lines.push(`Expected Arrival:   ${itinerary.summary.expectedArrival}`);
        lines.push(`Latest Arrival:     ${itinerary.summary.latestArrival}`);
        lines.push('');

        // Checkpoints
        lines.push('CHECKPOINTS');
        lines.push(thinDivider);
        itinerary.checkpoints.forEach((cp, i) => {
            const marker = cp.type === 'start' ? '🚩' : cp.type === 'end' ? '🏁' : '📍';
            lines.push(`${marker} ${cp.name}`);
            lines.push(`   ${cp.mileMarker} | ${cp.coordinates}`);
            lines.push(`   Expected: ${cp.expectedTime}`);
            lines.push(`   Overdue:  ${cp.overdueTime}`);
            if (i < itinerary.checkpoints.length - 1) lines.push('');
        });
        lines.push('');

        // Bail-out Points
        if (itinerary.bailoutPoints && itinerary.bailoutPoints.length > 0) {
            lines.push('BAIL-OUT POINTS');
            lines.push(thinDivider);
            itinerary.bailoutPoints.forEach(bp => {
                lines.push(`🚁 ${bp.name}`);
                lines.push(`   ${bp.coordinates}`);
                if (bp.notes) lines.push(`   Note: ${bp.notes}`);
            });
            lines.push('');
        }

        // Resources
        lines.push('RESOURCES ON ROUTE');
        lines.push(thinDivider);
        lines.push(`Water Sources:    ${itinerary.resources.water}`);
        lines.push(`Fuel Caches:      ${itinerary.resources.fuel}`);
        lines.push(`Camp Sites:       ${itinerary.resources.camp}`);
        lines.push(`Resupply Points:  ${itinerary.resources.resupply}`);
        lines.push(`Bail-out Points:  ${itinerary.resources.bailout}`);
        lines.push('');

        // Emergency Protocol
        lines.push(divider);
        lines.push('  EMERGENCY PROTOCOL');
        lines.push(divider);
        lines.push('');
        itinerary.emergencyProtocol.instructions.forEach(inst => {
            lines.push(inst);
        });
        lines.push('');

        // Emergency Contacts
        if (itinerary.emergencyProtocol.contacts && itinerary.emergencyProtocol.contacts.length > 0) {
            lines.push('EMERGENCY CONTACTS');
            lines.push(thinDivider);
            itinerary.emergencyProtocol.contacts.forEach(contact => {
                lines.push(`${contact.name}: ${contact.phone}`);
                if (contact.relation) lines.push(`   (${contact.relation})`);
            });
            lines.push('');
        }

        // Search Areas
        lines.push('SEARCH AREAS (IF OVERDUE)');
        lines.push(thinDivider);
        itinerary.emergencyProtocol.searchAreas.forEach((area, i) => {
            lines.push(`${i + 1}. ${area.checkpoint}`);
            lines.push(`   If overdue by: ${formatDateTime(area.overdueTime)}`);
            lines.push(`   Search: ${area.searchBoundary?.description || 'Last known area'}`);
            lines.push(`   Last Known: ${area.lastKnownPosition.lat.toFixed(5)}, ${area.lastKnownPosition.lon.toFixed(5)}`);
        });
        lines.push('');

        // Notes
        if (itinerary.notes) {
            lines.push('ADDITIONAL NOTES');
            lines.push(thinDivider);
            lines.push(itinerary.notes);
            lines.push('');
        }

        // Footer
        lines.push(divider);
        lines.push('  Share this itinerary with emergency contacts');
        lines.push('  Update contacts at each checkpoint if possible');
        lines.push(divider);

        return lines.join('\n');
    }

    /**
     * Export itinerary as JSON
     */
    function exportItineraryAsJSON(itinerary) {
        if (!itinerary) {
            itinerary = currentPlan;
        }
        if (!itinerary) {
            return null;
        }

        return JSON.stringify(itinerary, null, 2);
    }

    /**
     * Download itinerary as text file
     */
    function downloadItinerary(itinerary, format = 'text') {
        if (!itinerary) {
            itinerary = currentPlan;
        }
        if (!itinerary) {
            console.error('No itinerary to download');
            return;
        }

        let content, filename, mimeType;

        if (format === 'json') {
            content = exportItineraryAsJSON(itinerary);
            filename = `trip-plan-${formatDateForFilename(new Date())}.json`;
            mimeType = 'application/json';
        } else {
            content = exportItineraryAsText(itinerary);
            filename = `trip-plan-${formatDateForFilename(new Date())}.txt`;
            mimeType = 'text/plain';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Calculate bearing between two points
     */
    function calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    /**
     * Get cardinal direction from bearing
     */
    function getCardinalDirection(bearing) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                          'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(bearing / 22.5) % 16;
        return directions[index];
    }

    /**
     * Format duration in hours to readable string
     */
    function formatDuration(hours) {
        if (hours < 1) {
            return `${Math.round(hours * 60)} min`;
        }
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }

    /**
     * Format time for display
     */
    function formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }

    /**
     * Format date and time for display
     */
    function formatDateTime(date) {
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    /**
     * Format date for filename
     */
    function formatDateForFilename(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Get current plan
     */
    function getCurrentPlan() {
        return currentPlan;
    }

    /**
     * Clear current plan
     */
    function clearCurrentPlan() {
        currentPlan = null;
    }

    /**
     * Update configuration
     */
    function setConfig(newConfig) {
        Object.assign(config, newConfig);
    }

    /**
     * Get configuration
     */
    function getConfig() {
        return { ...config };
    }

    // Public API
    return {
        init,
        
        // Bail-out analysis
        analyzeBailouts,
        getBailoutAtMile,
        getBailoutPoints,
        
        // Route comparison
        compareRoutes,
        analyzeRouteMetrics,
        
        // Checkpoints
        generateCheckpoints,
        
        // Itinerary
        generateItinerary,
        exportItineraryAsText,
        exportItineraryAsJSON,
        downloadItinerary,
        getCurrentPlan,
        clearCurrentPlan,
        
        // Utilities
        calcDistance,
        formatDuration,
        formatDateTime,
        setConfig,
        getConfig
    };
})();

window.ContingencyModule = ContingencyModule;
