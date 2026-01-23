/**
 * GridDown Navigation Module - Active Route Guidance
 * Provides turn-by-turn navigation with bearing/distance to waypoints and off-route alerts
 */
const NavigationModule = (function() {
    'use strict';

    // Navigation state
    let state = {
        isActive: false,
        route: null,
        routeId: null,
        currentPointIndex: 0,
        totalPoints: 0,
        
        // Current navigation info
        currentPosition: null,
        distanceToNext: null,          // miles
        bearingToNext: null,           // degrees
        distanceRemaining: null,       // total remaining miles
        timeRemaining: null,           // estimated hours remaining
        
        // Off-route detection
        isOffRoute: false,
        offRouteDistance: null,        // distance from route line in miles
        offRouteThreshold: 0.05,       // 0.05 miles = ~250 feet
        offRouteAlertShown: false,
        
        // Auto-advance
        waypointReachedThreshold: 0.03, // 0.03 miles = ~150 feet
        
        // Compass heading (from device or GPS)
        deviceHeading: null,
        
        // Settings
        settings: {
            voiceGuidance: false,
            offRouteAlerts: true,
            autoAdvance: true,
            keepScreenOn: true,
            centerOnPosition: true,
            showBreadcrumbs: true
        },
        
        // Track breadcrumbs (position history)
        breadcrumbs: [],
        maxBreadcrumbs: 100,
        
        // Stats
        stats: {
            distanceTraveled: 0,
            elapsedTime: 0,
            startTime: null,
            avgSpeed: 0
        }
    };

    // GPS subscription cleanup
    let gpsUnsubscribe = null;
    let compassUnsubscribe = null;
    let updateInterval = null;
    let wakeLock = null;
    
    // Scoped event manager for cleanup
    let navEvents = null;
    
    // Track initialization
    let initialized = false;

    // Subscribers for navigation updates
    const subscribers = new Set();

    /**
     * Initialize navigation module
     */
    async function init() {
        // Prevent double initialization
        if (initialized) {
            console.debug('NavigationModule already initialized');
            return state;
        }
        
        // Create scoped event manager
        navEvents = EventManager.createScopedManager(EventManager.SCOPES.NAVIGATION);
        
        // Load saved settings
        await loadSettings();
        
        // Listen for GPS module events if available
        if (typeof Events !== 'undefined') {
            Events.on('gps:positionUpdate', handlePositionUpdate);
        }
        
        initialized = true;
        console.log('NavigationModule initialized');
        return state;
    }

    /**
     * Load saved navigation settings
     */
    async function loadSettings() {
        try {
            const saved = await Storage.Settings.get('navigationSettings');
            if (saved) {
                state.settings = { ...state.settings, ...saved };
            }
        } catch (e) {
            console.warn('Failed to load navigation settings:', e);
        }
    }

    /**
     * Save navigation settings
     */
    async function saveSettings(newSettings) {
        state.settings = { ...state.settings, ...newSettings };
        try {
            await Storage.Settings.set('navigationSettings', state.settings);
        } catch (e) {
            console.warn('Failed to save navigation settings:', e);
        }
    }

    /**
     * Start navigation on a route
     */
    async function startNavigation(routeId, startPointIndex = 0) {
        const routes = State.get('routes');
        const route = routes.find(r => r.id === routeId);
        
        if (!route || !route.points || route.points.length < 2) {
            throw new Error('Invalid route for navigation');
        }

        // Stop any existing navigation
        if (state.isActive) {
            stopNavigation();
        }

        // Initialize navigation state
        state.isActive = true;
        state.route = route;
        state.routeId = routeId;
        state.currentPointIndex = startPointIndex;
        state.totalPoints = route.points.length;
        state.isOffRoute = false;
        state.offRouteAlertShown = false;
        state.breadcrumbs = [];
        
        state.stats = {
            distanceTraveled: 0,
            elapsedTime: 0,
            startTime: Date.now(),
            avgSpeed: 0
        };

        // Subscribe to GPS updates
        if (typeof GPSModule !== 'undefined') {
            // Start GPS if not already active
            if (!GPSModule.isActive()) {
                GPSModule.startInternalGPS();
            }
            
            gpsUnsubscribe = GPSModule.subscribe(handleGPSUpdate);
        }

        // Try to acquire wake lock to keep screen on
        if (state.settings.keepScreenOn) {
            acquireWakeLock();
        }

        // Start compass if available
        startCompass();

        // Initial calculation
        const pos = GPSModule?.getPosition();
        if (pos) {
            handlePositionUpdate(pos);
        }

        // Emit navigation started event
        if (typeof Events !== 'undefined') {
            Events.emit('navigation:started', { routeId, route: state.route });
        }

        notifySubscribers();
        
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast('Navigation started', 'success');
        }

        return state;
    }

    /**
     * Stop navigation
     */
    function stopNavigation() {
        state.isActive = false;
        state.route = null;
        state.routeId = null;
        state.currentPointIndex = 0;
        state.isOffRoute = false;
        
        // Cleanup subscriptions
        if (gpsUnsubscribe) {
            gpsUnsubscribe();
            gpsUnsubscribe = null;
        }

        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }

        // Release wake lock
        releaseWakeLock();

        // Stop compass
        stopCompass();

        // Emit navigation stopped event
        if (typeof Events !== 'undefined') {
            Events.emit('navigation:stopped', { stats: state.stats });
        }

        notifySubscribers();
        
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast('Navigation stopped', 'info');
        }
    }

    /**
     * Handle GPS position update
     */
    function handleGPSUpdate(gpsState) {
        if (!state.isActive || !gpsState.currentPosition) return;
        
        handlePositionUpdate(gpsState.currentPosition);
        
        // Update device heading if available
        if (gpsState.heading !== null && gpsState.heading !== undefined) {
            state.deviceHeading = gpsState.heading;
        }
    }

    /**
     * Handle position update from any source
     */
    function handlePositionUpdate(position) {
        if (!state.isActive || !state.route) return;

        const prevPosition = state.currentPosition;
        state.currentPosition = {
            lat: position.lat,
            lon: position.lon
        };

        // Add to breadcrumbs
        if (state.settings.showBreadcrumbs) {
            addBreadcrumb(position);
        }

        // Update distance traveled
        if (prevPosition) {
            const dist = haversineDistance(
                prevPosition.lat, prevPosition.lon,
                position.lat, position.lon
            );
            state.stats.distanceTraveled += dist;
            
            // Update average speed
            const elapsedHours = (Date.now() - state.stats.startTime) / 3600000;
            if (elapsedHours > 0) {
                state.stats.avgSpeed = state.stats.distanceTraveled / elapsedHours;
            }
        }

        // Calculate navigation info
        calculateNavigation();

        // Check if reached current waypoint
        if (state.settings.autoAdvance) {
            checkWaypointReached();
        }

        // Check off-route status
        if (state.settings.offRouteAlerts) {
            checkOffRoute();
        }

        // Center map on position if enabled
        if (state.settings.centerOnPosition && typeof MapModule !== 'undefined') {
            MapModule.setCenter(position.lat, position.lon);
        }

        // Notify subscribers
        notifySubscribers();

        // Emit update event
        if (typeof Events !== 'undefined') {
            Events.emit('navigation:update', getNavigationInfo());
        }
    }

    /**
     * Add a breadcrumb (position history point)
     */
    function addBreadcrumb(position) {
        state.breadcrumbs.push({
            lat: position.lat,
            lon: position.lon,
            timestamp: Date.now()
        });
        
        // Limit breadcrumbs
        if (state.breadcrumbs.length > state.maxBreadcrumbs) {
            state.breadcrumbs.shift();
        }
    }

    /**
     * Calculate navigation to next waypoint
     */
    function calculateNavigation() {
        if (!state.currentPosition || !state.route || state.currentPointIndex >= state.route.points.length) {
            return;
        }

        const waypoints = State.get('waypoints');
        const nextPoint = state.route.points[state.currentPointIndex];
        
        // Get coordinates of next point
        const nextLat = getPointLat(nextPoint, waypoints);
        const nextLon = getPointLon(nextPoint, waypoints);

        // Calculate distance to next
        state.distanceToNext = haversineDistance(
            state.currentPosition.lat, state.currentPosition.lon,
            nextLat, nextLon
        );

        // Calculate bearing to next
        state.bearingToNext = calculateBearing(
            state.currentPosition.lat, state.currentPosition.lon,
            nextLat, nextLon
        );

        // Calculate remaining distance (sum of all remaining segments)
        state.distanceRemaining = state.distanceToNext;
        for (let i = state.currentPointIndex; i < state.route.points.length - 1; i++) {
            const p1 = state.route.points[i];
            const p2 = state.route.points[i + 1];
            state.distanceRemaining += haversineDistance(
                getPointLat(p1, waypoints), getPointLon(p1, waypoints),
                getPointLat(p2, waypoints), getPointLon(p2, waypoints)
            );
        }

        // Estimate remaining time based on average speed or default
        const avgSpeed = state.stats.avgSpeed > 0 ? state.stats.avgSpeed : 15; // default 15 mph
        state.timeRemaining = state.distanceRemaining / avgSpeed;
    }

    /**
     * Check if user has reached the current waypoint
     */
    function checkWaypointReached() {
        if (state.distanceToNext !== null && state.distanceToNext <= state.waypointReachedThreshold) {
            // Waypoint reached!
            const reachedIndex = state.currentPointIndex;
            
            if (state.currentPointIndex < state.route.points.length - 1) {
                // Advance to next waypoint
                state.currentPointIndex++;
                
                // Announce waypoint reached
                announceWaypoint('reached', reachedIndex);
                
                // Emit event
                if (typeof Events !== 'undefined') {
                    Events.emit('navigation:waypointReached', {
                        index: reachedIndex,
                        nextIndex: state.currentPointIndex,
                        remaining: state.route.points.length - state.currentPointIndex
                    });
                }
                
                if (typeof ModalsModule !== 'undefined') {
                    ModalsModule.showToast(`Waypoint ${reachedIndex + 1} reached!`, 'success');
                }
                
                // Recalculate for new target
                calculateNavigation();
            } else {
                // Destination reached!
                announceDestinationReached();
                
                if (typeof Events !== 'undefined') {
                    Events.emit('navigation:destinationReached', {
                        stats: state.stats
                    });
                }
                
                if (typeof ModalsModule !== 'undefined') {
                    ModalsModule.showToast('🎉 Destination reached!', 'success');
                }
            }
            
            notifySubscribers();
        }
    }

    /**
     * Check if user is off-route
     */
    function checkOffRoute() {
        if (!state.currentPosition || !state.route || state.route.points.length < 2) {
            return;
        }

        const waypoints = State.get('waypoints');
        
        // Find distance to nearest route segment
        let minDistance = Infinity;
        
        for (let i = 0; i < state.route.points.length - 1; i++) {
            const p1 = state.route.points[i];
            const p2 = state.route.points[i + 1];
            
            const dist = distanceToSegment(
                state.currentPosition.lat, state.currentPosition.lon,
                getPointLat(p1, waypoints), getPointLon(p1, waypoints),
                getPointLat(p2, waypoints), getPointLon(p2, waypoints)
            );
            
            minDistance = Math.min(minDistance, dist);
        }

        state.offRouteDistance = minDistance;
        const wasOffRoute = state.isOffRoute;
        state.isOffRoute = minDistance > state.offRouteThreshold;

        // Alert if just went off route
        if (state.isOffRoute && !wasOffRoute) {
            announceOffRoute();
            
            if (typeof Events !== 'undefined') {
                Events.emit('navigation:offRoute', {
                    distance: minDistance,
                    threshold: state.offRouteThreshold
                });
            }
            
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast('⚠️ You are off route!', 'warning');
            }
        }
        
        // Alert if back on route
        if (!state.isOffRoute && wasOffRoute) {
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast('✓ Back on route', 'success');
            }
            
            if (typeof Events !== 'undefined') {
                Events.emit('navigation:backOnRoute', {});
            }
        }
    }

    /**
     * Calculate distance from a point to a line segment
     */
    function distanceToSegment(lat, lon, lat1, lon1, lat2, lon2) {
        // Convert to flat coordinates for simplicity (good enough for short distances)
        const x = lon;
        const y = lat;
        const x1 = lon1;
        const y1 = lat1;
        const x2 = lon2;
        const y2 = lat2;

        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return haversineDistance(lat, lon, yy, xx);
    }

    /**
     * Get coordinates from a route point
     */
    function getPointLat(point, waypoints) {
        if (point.waypointId) {
            const wp = waypoints.find(w => w.id === point.waypointId);
            if (wp) {
                return wp.lat || (37.4215 + (wp.y - 50) * 0.002);
            }
        }
        return point.lat || (37.4215 + ((point.y || 50) - 50) * 0.002);
    }

    function getPointLon(point, waypoints) {
        if (point.waypointId) {
            const wp = waypoints.find(w => w.id === point.waypointId);
            if (wp) {
                return wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
            }
        }
        return point.lon || (-119.1892 + ((point.x || 50) - 50) * 0.004);
    }

    /**
     * Manually advance to next waypoint
     */
    function nextWaypoint() {
        if (!state.isActive || !state.route) return;
        
        if (state.currentPointIndex < state.route.points.length - 1) {
            state.currentPointIndex++;
            calculateNavigation();
            notifySubscribers();
            
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast(`Skipped to waypoint ${state.currentPointIndex + 1}`, 'info');
            }
        }
    }

    /**
     * Go back to previous waypoint
     */
    function previousWaypoint() {
        if (!state.isActive || !state.route) return;
        
        if (state.currentPointIndex > 0) {
            state.currentPointIndex--;
            calculateNavigation();
            notifySubscribers();
            
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast(`Returned to waypoint ${state.currentPointIndex + 1}`, 'info');
            }
        }
    }

    /**
     * Jump to specific waypoint
     */
    function goToWaypoint(index) {
        if (!state.isActive || !state.route) return;
        
        if (index >= 0 && index < state.route.points.length) {
            state.currentPointIndex = index;
            calculateNavigation();
            notifySubscribers();
        }
    }

    // ==========================================
    // Voice / Audio Announcements
    // ==========================================

    function announceWaypoint(type, index) {
        if (!state.settings.voiceGuidance) return;
        
        const waypoints = State.get('waypoints');
        const point = state.route.points[index];
        let name = `Waypoint ${index + 1}`;
        
        if (point.waypointId) {
            const wp = waypoints.find(w => w.id === point.waypointId);
            if (wp) name = wp.name;
        }
        
        speak(`${name} ${type}`);
    }

    function announceOffRoute() {
        if (!state.settings.voiceGuidance) return;
        speak('Warning: You are off route');
    }

    function announceDestinationReached() {
        if (!state.settings.voiceGuidance) return;
        speak('You have arrived at your destination');
    }

    function speak(text) {
        if (!('speechSynthesis' in window)) return;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        window.speechSynthesis.speak(utterance);
    }

    // ==========================================
    // Compass Support
    // ==========================================

    function startCompass() {
        if ('DeviceOrientationEvent' in window) {
            // Check if we need to request permission (iOS 13+)
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // Will need user gesture to request permission
                state.compassAvailable = true;
                state.compassNeedsPermission = true;
            } else {
                navEvents.on(window, 'deviceorientation', handleCompass);
                state.compassAvailable = true;
            }
        }
    }

    function stopCompass() {
        // EventManager will handle cleanup when scope is cleared
        navEvents?.onCleanup(() => {
            window.removeEventListener('deviceorientation', handleCompass);
        });
    }

    async function requestCompassPermission() {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    navEvents.on(window, 'deviceorientation', handleCompass);
                    state.compassNeedsPermission = false;
                    return true;
                }
            } catch (e) {
                console.warn('Compass permission denied:', e);
            }
        }
        return false;
    }

    function handleCompass(event) {
        // webkitCompassHeading for iOS, alpha for others
        let heading = event.webkitCompassHeading || (360 - event.alpha);
        
        if (heading !== null && heading !== undefined) {
            state.deviceHeading = heading;
            notifySubscribers();
        }
    }

    // ==========================================
    // Wake Lock (Keep Screen On)
    // ==========================================

    async function acquireWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock acquired');
                
                wakeLock.addEventListener('release', () => {
                    console.log('Wake lock released');
                });
            } catch (e) {
                console.warn('Wake lock failed:', e);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    // ==========================================
    // Utility Functions
    // ==========================================

    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

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

    function formatDistance(miles) {
        if (miles === null || miles === undefined) return '--';
        if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
        if (miles < 10) return `${miles.toFixed(2)} mi`;
        return `${miles.toFixed(1)} mi`;
    }

    function formatBearing(degrees) {
        if (degrees === null || degrees === undefined) return '--';
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                           'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return `${Math.round(degrees)}° ${directions[index]}`;
    }

    /**
     * Get magnetic bearing from true bearing
     */
    function getMagneticBearing(trueBearing) {
        if (trueBearing === null || trueBearing === undefined) return null;
        if (typeof DeclinationModule === 'undefined') return null;
        
        const current = DeclinationModule.getCurrent();
        if (!current || current.declination === null) return null;
        
        return DeclinationModule.trueToMagnetic(trueBearing, current.declination);
    }

    /**
     * Format magnetic bearing for display
     */
    function formatMagneticBearing(trueBearing) {
        const magBearing = getMagneticBearing(trueBearing);
        if (magBearing === null) return '--';
        
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                           'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(magBearing / 22.5) % 16;
        return `${Math.round(magBearing)}°M ${directions[index]}`;
    }

    function formatDuration(hours) {
        if (hours === null || hours === undefined) return '--';
        if (hours < 1/60) return `${Math.round(hours * 3600)}s`;
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    }

    function formatSpeed(mph) {
        if (mph === null || mph === undefined || mph === 0) return '--';
        return `${mph.toFixed(1)} mph`;
    }

    // ==========================================
    // Subscription System
    // ==========================================

    function subscribe(callback) {
        subscribers.add(callback);
        callback(getNavigationInfo());
        return () => subscribers.delete(callback);
    }

    function notifySubscribers() {
        const info = getNavigationInfo();
        subscribers.forEach(cb => {
            try {
                cb(info);
            } catch (e) {
                console.error('Navigation subscriber error:', e);
            }
        });
        
        // Update HUD
        updateHUD();
    }
    
    /**
     * Update the navigation HUD in the DOM
     */
    function updateHUD() {
        const container = document.getElementById('nav-hud-container');
        if (!container) return;
        
        const html = renderHUD();
        container.innerHTML = html;
        
        if (html && state.isActive) {
            bindHUDEvents(container);
        }
    }

    /**
     * Get current navigation info
     */
    function getNavigationInfo() {
        const waypoints = State.get('waypoints');
        let nextPointName = null;
        let nextPointType = null;
        
        if (state.route && state.currentPointIndex < state.route.points.length) {
            const nextPoint = state.route.points[state.currentPointIndex];
            if (nextPoint.waypointId) {
                const wp = waypoints.find(w => w.id === nextPoint.waypointId);
                if (wp) {
                    nextPointName = wp.name;
                    nextPointType = wp.type;
                }
            }
            if (!nextPointName) {
                nextPointName = `Point ${state.currentPointIndex + 1}`;
            }
        }

        // Calculate relative bearing (how much to turn)
        let relativeBearing = null;
        if (state.bearingToNext !== null && state.deviceHeading !== null) {
            relativeBearing = state.bearingToNext - state.deviceHeading;
            // Normalize to -180 to 180
            while (relativeBearing > 180) relativeBearing -= 360;
            while (relativeBearing < -180) relativeBearing += 360;
        }

        return {
            isActive: state.isActive,
            routeName: state.route?.name || null,
            routeId: state.routeId,
            
            currentPointIndex: state.currentPointIndex,
            totalPoints: state.totalPoints,
            nextPointName,
            nextPointType,
            
            currentPosition: state.currentPosition,
            distanceToNext: state.distanceToNext,
            distanceToNextFormatted: formatDistance(state.distanceToNext),
            bearingToNext: state.bearingToNext,
            bearingToNextFormatted: formatBearing(state.bearingToNext),
            bearingToNextMagnetic: getMagneticBearing(state.bearingToNext),
            bearingToNextMagneticFormatted: formatMagneticBearing(state.bearingToNext),
            relativeBearing,
            
            distanceRemaining: state.distanceRemaining,
            distanceRemainingFormatted: formatDistance(state.distanceRemaining),
            timeRemaining: state.timeRemaining,
            timeRemainingFormatted: formatDuration(state.timeRemaining),
            
            isOffRoute: state.isOffRoute,
            offRouteDistance: state.offRouteDistance,
            offRouteDistanceFormatted: formatDistance(state.offRouteDistance),
            
            deviceHeading: state.deviceHeading,
            
            breadcrumbs: state.breadcrumbs,
            
            stats: {
                distanceTraveled: state.stats.distanceTraveled,
                distanceTraveledFormatted: formatDistance(state.stats.distanceTraveled),
                elapsedTime: (Date.now() - (state.stats.startTime || Date.now())) / 3600000,
                elapsedTimeFormatted: formatDuration((Date.now() - (state.stats.startTime || Date.now())) / 3600000),
                avgSpeed: state.stats.avgSpeed,
                avgSpeedFormatted: formatSpeed(state.stats.avgSpeed)
            },
            
            settings: { ...state.settings }
        };
    }

    /**
     * Get the route being navigated
     */
    function getActiveRoute() {
        return state.route;
    }

    /**
     * Check if navigation is active
     */
    function isActive() {
        return state.isActive;
    }

    /**
     * Get current settings
     */
    function getSettings() {
        return { ...state.settings };
    }

    /**
     * Get full navigation state
     */
    function getState() {
        return {
            isActive: state.isActive,
            route: state.route,
            routeId: state.routeId,
            currentPointIndex: state.currentPointIndex,
            totalPoints: state.totalPoints,
            currentPosition: state.currentPosition,
            distanceToNext: state.distanceToNext,
            bearingToNext: state.bearingToNext,
            distanceRemaining: state.distanceRemaining,
            timeRemaining: state.timeRemaining,
            isOffRoute: state.isOffRoute,
            offRouteDistance: state.offRouteDistance,
            deviceHeading: state.deviceHeading,
            breadcrumbs: state.breadcrumbs,
            settings: { ...state.settings },
            stats: { ...state.stats }
        };
    }

    /**
     * Update settings
     */
    function updateSettings(newSettings) {
        return saveSettings(newSettings);
    }

    /**
     * Recenter map on current position
     */
    function recenter() {
        if (state.currentPosition && typeof MapModule !== 'undefined') {
            MapModule.setCenter(state.currentPosition.lat, state.currentPosition.lon);
        }
    }

    // ==========================================
    // Rendering Helpers
    // ==========================================

    /**
     * Render the navigation HUD overlay
     */
    function renderHUD() {
        const info = getNavigationInfo();
        
        if (!info.isActive) {
            return '';
        }

        const offRouteClass = info.isOffRoute ? 'nav-hud--off-route' : '';
        const turnIndicator = getTurnIndicator(info.relativeBearing);
        
        return `
            <div class="nav-hud ${offRouteClass}">
                <div class="nav-hud__header">
                    <div class="nav-hud__route-name">${info.routeName || 'Navigation'}</div>
                    <div class="nav-hud__progress">${info.currentPointIndex + 1}/${info.totalPoints}</div>
                </div>
                
                <div class="nav-hud__main">
                    <div class="nav-hud__compass">
                        <div class="nav-hud__compass-ring" style="transform: rotate(${-(info.deviceHeading || 0)}deg)">
                            <div class="nav-hud__compass-needle" style="transform: rotate(${info.bearingToNext || 0}deg)"></div>
                        </div>
                        <div class="nav-hud__compass-bearing">${Math.round(info.bearingToNext || 0)}°T</div>
                    </div>
                    
                    <div class="nav-hud__info">
                        <div class="nav-hud__next-point">
                            ${info.nextPointType ? Constants.WAYPOINT_TYPES[info.nextPointType]?.icon || '📍' : '📍'}
                            <span>${info.nextPointName || 'Next Point'}</span>
                        </div>
                        
                        <div class="nav-hud__distance">
                            <span class="nav-hud__distance-value">${info.distanceToNextFormatted}</span>
                            <span class="nav-hud__turn-indicator">${turnIndicator}</span>
                        </div>
                        
                        <div class="nav-hud__bearing">
                            <span style="color:#f97316">${info.bearingToNextFormatted}</span>
                            ${info.bearingToNextMagnetic !== null ? `
                                <span style="color:#22c55e;margin-left:8px;font-size:12px">M: ${Math.round(info.bearingToNextMagnetic)}°</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                ${info.isOffRoute ? `
                    <div class="nav-hud__alert">
                        ⚠️ OFF ROUTE - ${info.offRouteDistanceFormatted} from path
                    </div>
                ` : ''}
                
                <div class="nav-hud__footer">
                    <div class="nav-hud__stat">
                        <span class="nav-hud__stat-label">Remaining</span>
                        <span class="nav-hud__stat-value">${info.distanceRemainingFormatted}</span>
                    </div>
                    <div class="nav-hud__stat">
                        <span class="nav-hud__stat-label">ETA</span>
                        <span class="nav-hud__stat-value">${info.timeRemainingFormatted}</span>
                    </div>
                    <div class="nav-hud__stat">
                        <span class="nav-hud__stat-label">Avg Speed</span>
                        <span class="nav-hud__stat-value">${info.stats.avgSpeedFormatted}</span>
                    </div>
                </div>
                
                <div class="nav-hud__controls">
                    <button class="nav-hud__btn" id="nav-prev-btn" ${info.currentPointIndex === 0 ? 'disabled' : ''}>◀ Prev</button>
                    <button class="nav-hud__btn nav-hud__btn--stop" id="nav-stop-btn">✕ Stop</button>
                    <button class="nav-hud__btn" id="nav-next-btn" ${info.currentPointIndex >= info.totalPoints - 1 ? 'disabled' : ''}>Next ▶</button>
                </div>
            </div>
        `;
    }

    /**
     * Get turn indicator based on relative bearing
     */
    function getTurnIndicator(relativeBearing) {
        if (relativeBearing === null) return '↑';
        
        if (relativeBearing > 150 || relativeBearing < -150) return '↓ U-Turn';
        if (relativeBearing > 60) return '↱ Right';
        if (relativeBearing > 30) return '↗ Slight R';
        if (relativeBearing < -60) return '↰ Left';
        if (relativeBearing < -30) return '↖ Slight L';
        return '↑ Ahead';
    }

    /**
     * Bind HUD button events
     */
    function bindHUDEvents(container) {
        const prevBtn = container.querySelector('#nav-prev-btn');
        const nextBtn = container.querySelector('#nav-next-btn');
        const stopBtn = container.querySelector('#nav-stop-btn');
        
        if (prevBtn) prevBtn.onclick = previousWaypoint;
        if (nextBtn) nextBtn.onclick = nextWaypoint;
        if (stopBtn) stopBtn.onclick = stopNavigation;
    }
    
    /**
     * Cleanup navigation module resources
     */
    function destroy() {
        // Stop any active navigation
        if (state.isActive) {
            stopNavigation();
        }
        
        // Release wake lock
        releaseWakeLock();
        
        // Clear scoped event manager
        if (navEvents) {
            navEvents.clear();
            navEvents = null;
        }
        
        initialized = false;
        console.log('NavigationModule destroyed');
    }

    // Public API
    return {
        init,
        destroy,
        startNavigation,
        stopNavigation,
        nextWaypoint,
        previousWaypoint,
        goToWaypoint,
        recenter,
        
        isActive,
        getState,
        getNavigationInfo,
        getActiveRoute,
        getSettings,
        saveSettings,
        updateSettings,
        requestCompassPermission,
        
        subscribe,
        
        // Rendering
        renderHUD,
        updateHUD,
        bindHUDEvents,
        
        // Formatting helpers
        formatDistance,
        formatBearing,
        formatDuration
    };
})();

window.NavigationModule = NavigationModule;
