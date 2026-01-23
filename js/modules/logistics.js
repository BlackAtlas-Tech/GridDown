/**
 * GridDown Logistics Module - Comprehensive Route & Resource Analysis
 * Calculates fuel, water, food requirements and identifies critical resupply points
 */
const LogisticsModule = (function() {
    'use strict';

    // Extended vehicle profiles with detailed consumption data
    const VEHICLE_PROFILES = {
        truck_4x4: {
            name: '4x4 Truck',
            icon: '🚙',
            fuelCapacity: 30,          // gallons
            auxFuelCapacity: 0,        // additional jerry cans
            consumption: {
                highway: 15,            // mpg
                road: 12,               // mpg - maintained dirt/gravel
                trail: 8,               // mpg - unmaintained trails
                crawl: 4                // mpg - technical terrain
            },
            speed: {
                highway: 65,            // mph
                road: 35,
                trail: 15,
                crawl: 5
            },
            cargoCapacity: 1000,        // lbs
            waterCapacity: 20,          // gallons carriable
            passengerCapacity: 4
        },
        jeep: {
            name: 'Jeep/SUV',
            icon: '🚗',
            fuelCapacity: 22,
            auxFuelCapacity: 0,
            consumption: {
                highway: 18,
                road: 14,
                trail: 10,
                crawl: 5
            },
            speed: {
                highway: 70,
                road: 40,
                trail: 18,
                crawl: 6
            },
            cargoCapacity: 600,
            waterCapacity: 15,
            passengerCapacity: 4
        },
        atv: {
            name: 'ATV/UTV',
            icon: '🏍️',
            fuelCapacity: 8,
            auxFuelCapacity: 0,
            consumption: {
                highway: 25,
                road: 22,
                trail: 18,
                crawl: 12
            },
            speed: {
                highway: 45,
                road: 35,
                trail: 25,
                crawl: 10
            },
            cargoCapacity: 300,
            waterCapacity: 5,
            passengerCapacity: 2
        },
        motorcycle: {
            name: 'Dual Sport Motorcycle',
            icon: '🏍️',
            fuelCapacity: 4,
            auxFuelCapacity: 0,
            consumption: {
                highway: 50,
                road: 45,
                trail: 35,
                crawl: 20
            },
            speed: {
                highway: 70,
                road: 45,
                trail: 25,
                crawl: 8
            },
            cargoCapacity: 50,
            waterCapacity: 2,
            passengerCapacity: 1
        }
    };

    // Personnel profiles for foot travel and resource consumption
    const PERSONNEL_PROFILES = {
        fit_adult: {
            name: 'Fit Adult',
            icon: '🚶',
            pace: {                      // miles per hour
                flat: 3.0,
                moderate: 2.0,
                steep: 1.0,
                technical: 0.5
            },
            dailyDistance: {             // sustainable miles per day
                easy: 20,
                moderate: 15,
                difficult: 10,
                extreme: 5
            },
            consumption: {
                waterBase: 0.5,          // gallons per day (base)
                waterPerMile: 0.04,      // additional per mile
                waterHeatMultiplier: 1.5, // multiplier for hot weather
                caloriesBase: 2000,      // per day (base)
                caloriesPerMile: 100,    // additional per mile
                caloriesPerElevation: 0.5 // per foot gained
            },
            carryCapacity: 45            // lbs comfortable pack weight
        },
        average_adult: {
            name: 'Average Adult',
            icon: '🚶',
            pace: {
                flat: 2.5,
                moderate: 1.5,
                steep: 0.75,
                technical: 0.3
            },
            dailyDistance: {
                easy: 15,
                moderate: 10,
                difficult: 7,
                extreme: 3
            },
            consumption: {
                waterBase: 0.5,
                waterPerMile: 0.05,
                waterHeatMultiplier: 1.5,
                caloriesBase: 1800,
                caloriesPerMile: 120,
                caloriesPerElevation: 0.6
            },
            carryCapacity: 30
        },
        child: {
            name: 'Child (8-14)',
            icon: '🧒',
            pace: {
                flat: 2.0,
                moderate: 1.0,
                steep: 0.5,
                technical: 0.2
            },
            dailyDistance: {
                easy: 10,
                moderate: 6,
                difficult: 4,
                extreme: 2
            },
            consumption: {
                waterBase: 0.35,
                waterPerMile: 0.03,
                waterHeatMultiplier: 1.7,
                caloriesBase: 1500,
                caloriesPerMile: 80,
                caloriesPerElevation: 0.4
            },
            carryCapacity: 15
        },
        elderly: {
            name: 'Elderly/Limited',
            icon: '🧓',
            pace: {
                flat: 1.5,
                moderate: 0.75,
                steep: 0.3,
                technical: 0.1
            },
            dailyDistance: {
                easy: 8,
                moderate: 5,
                difficult: 3,
                extreme: 1
            },
            consumption: {
                waterBase: 0.4,
                waterPerMile: 0.04,
                waterHeatMultiplier: 2.0,
                caloriesBase: 1600,
                caloriesPerMile: 100,
                caloriesPerElevation: 0.5
            },
            carryCapacity: 15
        }
    };

    // Terrain type definitions
    const TERRAIN_TYPES = {
        highway: { name: 'Highway/Paved', difficulty: 1, icon: '🛣️' },
        road: { name: 'Dirt/Gravel Road', difficulty: 2, icon: '🛤️' },
        trail: { name: 'Unmaintained Trail', difficulty: 3, icon: '🏔️' },
        crawl: { name: 'Technical/Off-Trail', difficulty: 4, icon: '⛰️' }
    };

    // Current analysis state
    let analysisState = {
        vehicle: 'truck_4x4',
        personnel: [],
        auxFuel: 0,
        hotWeather: false,
        safetyMargin: 0.15  // 15% reserve requirement
    };

    /**
     * Calculate distance between two lat/lon points (Haversine formula)
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
     * Analyze a route for logistics requirements
     */
    function analyzeRoute(route, waypoints, options = {}) {
        const config = { ...analysisState, ...options };
        const vehicle = VEHICLE_PROFILES[config.vehicle];
        const segments = [];
        const resupplyPoints = [];
        
        let totalDistance = 0;
        let totalFuel = 0;
        let totalTime = 0;
        let currentFuel = vehicle.fuelCapacity + config.auxFuel;
        let fuelAtStart = currentFuel;
        
        // Build route segments
        if (!route.points || route.points.length < 2) {
            return { error: 'Route must have at least 2 points' };
        }

        for (let i = 1; i < route.points.length; i++) {
            const p1 = route.points[i - 1];
            const p2 = route.points[i];
            
            // Get coordinates
            const wp1 = p1.waypointId ? waypoints.find(w => w.id === p1.waypointId) : null;
            const wp2 = p2.waypointId ? waypoints.find(w => w.id === p2.waypointId) : null;
            
            const lat1 = wp1?.lat || p1.lat || (37.4215 + ((p1.y || 50) - 50) * 0.002);
            const lon1 = wp1?.lon || p1.lon || (-119.1892 + ((p1.x || 50) - 50) * 0.004);
            const lat2 = wp2?.lat || p2.lat || (37.4215 + ((p2.y || 50) - 50) * 0.002);
            const lon2 = wp2?.lon || p2.lon || (-119.1892 + ((p2.x || 50) - 50) * 0.004);
            
            const distance = calcDistance(lat1, lon1, lat2, lon2);
            const terrain = p2.terrain || 'road';
            const consumption = vehicle.consumption[terrain] || vehicle.consumption.road;
            const speed = vehicle.speed[terrain] || vehicle.speed.road;
            
            const fuelUsed = distance / consumption;
            const time = distance / speed;
            
            totalDistance += distance;
            totalFuel += fuelUsed;
            totalTime += time;
            currentFuel -= fuelUsed;
            
            // Check if this waypoint is a fuel cache
            const isFuelCache = wp2?.type === 'fuel';
            
            segments.push({
                from: wp1?.name || `Point ${i}`,
                to: wp2?.name || `Point ${i + 1}`,
                distance: distance,
                terrain: terrain,
                fuelUsed: fuelUsed,
                time: time,
                fuelRemaining: currentFuel,
                fuelCacheAvailable: isFuelCache,
                warning: currentFuel < fuelAtStart * config.safetyMargin
            });
            
            // Refuel at fuel caches
            if (isFuelCache && currentFuel < fuelAtStart) {
                const refuelAmount = fuelAtStart - currentFuel;
                resupplyPoints.push({
                    name: wp2.name,
                    mileMarker: totalDistance,
                    type: 'fuel',
                    required: refuelAmount,
                    critical: currentFuel < fuelAtStart * config.safetyMargin
                });
                currentFuel = fuelAtStart; // Assume full refuel
            }
        }
        
        // Calculate water requirements for personnel
        const waterAnalysis = analyzeWaterRequirements(totalDistance, totalTime, config);
        
        // Find water resupply points
        const waterWaypoints = waypoints.filter(w => w.type === 'water');
        
        return {
            summary: {
                totalDistance: totalDistance,
                totalTime: totalTime,
                totalFuel: totalFuel,
                fuelCapacity: fuelAtStart,
                fuelDeficit: Math.max(0, totalFuel - fuelAtStart),
                canComplete: totalFuel <= fuelAtStart * (1 - config.safetyMargin),
                waterRequired: waterAnalysis.total,
                caloriesRequired: waterAnalysis.calories
            },
            segments: segments,
            resupplyPoints: resupplyPoints,
            waterAnalysis: waterAnalysis,
            criticalPoints: identifyCriticalPoints(segments, resupplyPoints)
        };
    }

    /**
     * Analyze water requirements for personnel
     */
    function analyzeWaterRequirements(distance, timeHours, config) {
        const days = timeHours / 8; // Assume 8 hours travel per day
        let totalWater = 0;
        let totalCalories = 0;
        const breakdown = [];
        
        config.personnel.forEach(p => {
            const profile = PERSONNEL_PROFILES[p.type] || PERSONNEL_PROFILES.average_adult;
            const count = p.count || 1;
            
            let water = (profile.consumption.waterBase * days + profile.consumption.waterPerMile * distance) * count;
            if (config.hotWeather) {
                water *= profile.consumption.waterHeatMultiplier;
            }
            
            const calories = (profile.consumption.caloriesBase * days + profile.consumption.caloriesPerMile * distance) * count;
            
            totalWater += water;
            totalCalories += calories;
            
            breakdown.push({
                type: profile.name,
                count: count,
                water: water,
                calories: calories,
                dailyWater: water / days,
                dailyCalories: calories / days
            });
        });
        
        return {
            total: totalWater,
            calories: totalCalories,
            days: days,
            breakdown: breakdown,
            perDay: totalWater / days,
            caloriesPerDay: totalCalories / days
        };
    }

    /**
     * Identify critical resupply points
     */
    function identifyCriticalPoints(segments, resupplyPoints) {
        const critical = [];
        
        segments.forEach((seg, i) => {
            if (seg.warning) {
                critical.push({
                    segment: i + 1,
                    location: seg.to,
                    issue: 'Low fuel warning',
                    severity: seg.fuelRemaining < 0 ? 'CRITICAL' : 'WARNING',
                    fuelRemaining: seg.fuelRemaining
                });
            }
        });
        
        resupplyPoints.forEach(rp => {
            if (rp.critical) {
                critical.push({
                    location: rp.name,
                    mileMarker: rp.mileMarker,
                    issue: `Critical ${rp.type} resupply`,
                    severity: 'CRITICAL',
                    required: rp.required
                });
            }
        });
        
        return critical;
    }

    /**
     * Run what-if scenario analysis
     */
    function runScenario(route, waypoints, scenario) {
        const baseAnalysis = analyzeRoute(route, waypoints);
        const modifiedWaypoints = [...waypoints];
        
        switch (scenario.type) {
            case 'cache_empty':
                // Simulate a fuel/water cache being empty
                const cacheIndex = modifiedWaypoints.findIndex(w => w.id === scenario.cacheId);
                if (cacheIndex >= 0) {
                    modifiedWaypoints[cacheIndex] = {
                        ...modifiedWaypoints[cacheIndex],
                        type: 'hazard', // Convert to hazard
                        notes: 'SCENARIO: Cache empty'
                    };
                }
                break;
                
            case 'detour':
                // Add extra distance
                // This would modify route points
                break;
                
            case 'breakdown':
                // Simulate reduced speed/efficiency
                break;
        }
        
        const scenarioAnalysis = analyzeRoute(route, modifiedWaypoints);
        
        return {
            baseline: baseAnalysis,
            scenario: scenarioAnalysis,
            comparison: {
                fuelDifference: scenarioAnalysis.summary.totalFuel - baseAnalysis.summary.totalFuel,
                timeDifference: scenarioAnalysis.summary.totalTime - baseAnalysis.summary.totalTime,
                stillViable: scenarioAnalysis.summary.canComplete,
                newCriticalPoints: scenarioAnalysis.criticalPoints.filter(
                    cp => !baseAnalysis.criticalPoints.some(bp => bp.location === cp.location)
                )
            }
        };
    }

    /**
     * Generate logistics report
     */
    function generateReport(analysis) {
        const s = analysis.summary;
        const report = {
            feasibility: s.canComplete ? 'FEASIBLE' : 'NOT FEASIBLE',
            distance: `${s.totalDistance.toFixed(1)} miles`,
            duration: `${Math.floor(s.totalTime)}h ${Math.round((s.totalTime % 1) * 60)}m`,
            fuel: {
                required: `${s.totalFuel.toFixed(1)} gallons`,
                capacity: `${s.fuelCapacity.toFixed(1)} gallons`,
                deficit: s.fuelDeficit > 0 ? `${s.fuelDeficit.toFixed(1)} gallons SHORT` : 'None',
                reserve: `${((s.fuelCapacity - s.totalFuel) / s.fuelCapacity * 100).toFixed(0)}%`
            },
            water: {
                required: `${s.waterRequired.toFixed(1)} gallons`,
                perDay: `${(analysis.waterAnalysis.perDay || 0).toFixed(1)} gallons/day`
            },
            food: {
                calories: `${Math.round(s.caloriesRequired)} total`,
                perDay: `${Math.round(analysis.waterAnalysis.caloriesPerDay || 0)}/day`
            },
            criticalCount: analysis.criticalPoints.length,
            resupplyCount: analysis.resupplyPoints.length
        };
        
        return report;
    }

    /**
     * Set analysis configuration
     */
    function setConfig(config) {
        analysisState = { ...analysisState, ...config };
    }

    /**
     * Get current configuration
     */
    function getConfig() {
        return { ...analysisState };
    }

    /**
     * Get all profiles
     */
    function getProfiles() {
        return {
            vehicles: VEHICLE_PROFILES,
            personnel: PERSONNEL_PROFILES,
            terrain: TERRAIN_TYPES
        };
    }

    // Public API
    return {
        analyzeRoute,
        analyzeWaterRequirements,
        runScenario,
        generateReport,
        setConfig,
        getConfig,
        getProfiles,
        VEHICLE_PROFILES,
        PERSONNEL_PROFILES,
        TERRAIN_TYPES
    };
})();

window.LogisticsModule = LogisticsModule;
