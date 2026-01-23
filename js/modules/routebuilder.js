/**
 * GridDown Route Builder Module - Interactive Route Creation
 * Click-to-create routes with drag reordering and auto-calculations
 */
const RouteBuilderModule = (function() {
    'use strict';

    let isBuilding = false;
    let currentRoute = null;
    let selectedPointIndex = -1;
    let isDraggingPoint = false;

    /**
     * Start building a new route
     */
    function startNewRoute(name = 'New Route') {
        currentRoute = {
            id: Helpers.generateId(),
            name: name,
            points: [],
            distance: '0',
            duration: '0h 0m',
            elevation: '0',
            isBuilding: true
        };
        isBuilding = true;
        selectedPointIndex = -1;
        
        // Add to state temporarily
        const routes = State.get('routes');
        State.Routes.setAll([...routes, currentRoute]);
        State.Routes.select(currentRoute);
        
        // Update UI
        updateBuildingUI();
        
        return currentRoute;
    }

    /**
     * Add a point to the current route
     */
    function addPoint(lat, lon, waypointId = null) {
        if (!isBuilding || !currentRoute) return null;

        const point = {
            lat: lat,
            lon: lon,
            x: lonToX(lon),
            y: latToY(lat),
            waypointId: waypointId,
            terrain: 'road' // default terrain
        };

        currentRoute.points.push(point);
        recalculateRoute();
        updateRouteInState();
        
        return point;
    }

    /**
     * Insert a point at specific index
     */
    function insertPoint(index, lat, lon) {
        if (!isBuilding || !currentRoute) return null;

        const point = {
            lat: lat,
            lon: lon,
            x: lonToX(lon),
            y: latToY(lat),
            terrain: 'road'
        };

        currentRoute.points.splice(index, 0, point);
        recalculateRoute();
        updateRouteInState();
        
        return point;
    }

    /**
     * Remove a point from the route
     */
    function removePoint(index) {
        if (!currentRoute || index < 0 || index >= currentRoute.points.length) return;

        currentRoute.points.splice(index, 1);
        
        if (selectedPointIndex === index) {
            selectedPointIndex = -1;
        } else if (selectedPointIndex > index) {
            selectedPointIndex--;
        }
        
        recalculateRoute();
        updateRouteInState();
    }

    /**
     * Move a point to new coordinates
     */
    function movePoint(index, lat, lon) {
        if (!currentRoute || index < 0 || index >= currentRoute.points.length) return;

        currentRoute.points[index].lat = lat;
        currentRoute.points[index].lon = lon;
        currentRoute.points[index].x = lonToX(lon);
        currentRoute.points[index].y = latToY(lat);
        
        recalculateRoute();
        updateRouteInState();
    }

    /**
     * Reorder points (drag and drop)
     */
    function reorderPoints(fromIndex, toIndex) {
        if (!currentRoute) return;
        if (fromIndex < 0 || fromIndex >= currentRoute.points.length) return;
        if (toIndex < 0 || toIndex >= currentRoute.points.length) return;

        const point = currentRoute.points.splice(fromIndex, 1)[0];
        currentRoute.points.splice(toIndex, 0, point);
        
        recalculateRoute();
        updateRouteInState();
    }

    /**
     * Set terrain type for a segment
     */
    function setSegmentTerrain(pointIndex, terrain) {
        if (!currentRoute || pointIndex < 0 || pointIndex >= currentRoute.points.length) return;
        
        currentRoute.points[pointIndex].terrain = terrain;
        recalculateRoute();
        updateRouteInState();
    }

    /**
     * Link a point to an existing waypoint
     */
    function linkToWaypoint(pointIndex, waypointId) {
        if (!currentRoute || pointIndex < 0 || pointIndex >= currentRoute.points.length) return;

        const waypoints = State.get('waypoints');
        const wp = waypoints.find(w => w.id === waypointId);
        
        if (wp) {
            currentRoute.points[pointIndex].waypointId = waypointId;
            currentRoute.points[pointIndex].lat = wp.lat || (37.4215 + (wp.y - 50) * 0.002);
            currentRoute.points[pointIndex].lon = wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
            currentRoute.points[pointIndex].name = wp.name;
            
            recalculateRoute();
            updateRouteInState();
        }
    }

    /**
     * Finish building and save the route
     */
    function finishRoute() {
        if (!currentRoute) return null;

        if (currentRoute.points.length < 2) {
            ModalsModule.showToast('Route needs at least 2 points', 'error');
            return null;
        }

        currentRoute.isBuilding = false;
        isBuilding = false;
        
        // Record for undo BEFORE saving
        if (typeof UndoModule !== 'undefined') {
            UndoModule.recordRouteAdd(currentRoute);
        }
        
        // Save to storage
        Storage.Routes.save(currentRoute);
        
        const finishedRoute = { ...currentRoute };
        currentRoute = null;
        selectedPointIndex = -1;
        
        ModalsModule.showToast('Route saved! (Ctrl+Z to undo)', 'success');
        updateBuildingUI();
        
        return finishedRoute;
    }

    /**
     * Cancel route building
     */
    function cancelRoute() {
        if (!currentRoute) return;

        // Remove from state
        const routes = State.get('routes').filter(r => r.id !== currentRoute.id);
        State.Routes.setAll(routes);
        State.Routes.select(null);
        
        currentRoute = null;
        isBuilding = false;
        selectedPointIndex = -1;
        
        updateBuildingUI();
    }

    /**
     * Edit an existing route
     */
    function editRoute(routeId) {
        const routes = State.get('routes');
        const route = routes.find(r => r.id === routeId);
        
        if (route) {
            currentRoute = { ...route, isBuilding: true };
            isBuilding = true;
            selectedPointIndex = -1;
            
            // Update in state
            updateRouteInState();
            State.Routes.select(currentRoute);
            
            updateBuildingUI();
        }
    }

    /**
     * Delete a route
     */
    function deleteRoute(routeId) {
        const routes = State.get('routes');
        const routeToDelete = routes.find(r => r.id === routeId);
        const routeIndex = routes.findIndex(r => r.id === routeId);
        
        // Record for undo BEFORE making changes
        if (routeToDelete && typeof UndoModule !== 'undefined') {
            UndoModule.recordRouteDelete(routeToDelete, routeIndex);
        }
        
        const filteredRoutes = routes.filter(r => r.id !== routeId);
        State.Routes.setAll(filteredRoutes);
        Storage.Routes.delete(routeId);
        
        if (currentRoute && currentRoute.id === routeId) {
            currentRoute = null;
            isBuilding = false;
        }
        
        State.Routes.select(null);
        ModalsModule.showToast('Route deleted (Ctrl+Z to undo)', 'success');
    }

    /**
     * Recalculate route statistics
     */
    function recalculateRoute() {
        if (!currentRoute || currentRoute.points.length < 2) {
            if (currentRoute) {
                currentRoute.distance = '0';
                currentRoute.duration = '0h 0m';
                currentRoute.elevation = '0';
            }
            return;
        }

        let totalDistance = 0;
        let totalTime = 0;
        let elevationGain = 0;

        // Speed by terrain type (mph)
        const speeds = {
            highway: 55,
            road: 30,
            trail: 12,
            crawl: 5
        };

        for (let i = 1; i < currentRoute.points.length; i++) {
            const p1 = currentRoute.points[i - 1];
            const p2 = currentRoute.points[i];
            
            const segmentDistance = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
            const terrain = p2.terrain || 'road';
            const speed = speeds[terrain] || 30;
            
            totalDistance += segmentDistance;
            totalTime += segmentDistance / speed;
            
            // Elevation (if available)
            if (p1.elevation && p2.elevation && p2.elevation > p1.elevation) {
                elevationGain += p2.elevation - p1.elevation;
            }
        }

        currentRoute.distance = totalDistance.toFixed(1);
        currentRoute.duration = formatDuration(totalTime);
        currentRoute.elevation = elevationGain.toFixed(0);
    }

    /**
     * Update route in state
     */
    function updateRouteInState() {
        if (!currentRoute) return;

        const routes = State.get('routes');
        const index = routes.findIndex(r => r.id === currentRoute.id);
        
        if (index >= 0) {
            routes[index] = { ...currentRoute };
            State.Routes.setAll([...routes]);
        }
    }

    /**
     * Update UI to reflect building state
     */
    function updateBuildingUI() {
        // Emit event for other modules to react
        Events.emit('route:building', { 
            isBuilding: isBuilding, 
            route: currentRoute 
        });
    }

    /**
     * Handle map click during route building
     */
    function handleMapClick(coords) {
        if (!isBuilding) return false;

        // Check if clicking near an existing waypoint
        const waypoints = State.get('waypoints');
        const nearbyWaypoint = waypoints.find(wp => {
            const wpLat = wp.lat || (37.4215 + (wp.y - 50) * 0.002);
            const wpLon = wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
            const dist = haversineDistance(coords.lat, coords.lon, wpLat, wpLon);
            return dist < 0.1; // Within ~500ft
        });

        if (nearbyWaypoint) {
            const wpLat = nearbyWaypoint.lat || (37.4215 + (nearbyWaypoint.y - 50) * 0.002);
            const wpLon = nearbyWaypoint.lon || (-119.1892 + (nearbyWaypoint.x - 50) * 0.004);
            addPoint(wpLat, wpLon, nearbyWaypoint.id);
        } else {
            addPoint(coords.lat, coords.lon);
        }

        return true; // Handled
    }

    /**
     * Select a point for editing
     */
    function selectPoint(index) {
        selectedPointIndex = index;
        Events.emit('route:pointSelected', { index, point: currentRoute?.points[index] });
    }

    /**
     * Get current building state
     */
    function getState() {
        return {
            isBuilding,
            currentRoute,
            selectedPointIndex
        };
    }

    /**
     * Reverse the route direction
     */
    function reverseRoute() {
        if (!currentRoute || currentRoute.points.length < 2) return;
        
        currentRoute.points.reverse();
        recalculateRoute();
        updateRouteInState();
    }

    /**
     * Create route from waypoints
     */
    function createFromWaypoints(waypointIds) {
        const waypoints = State.get('waypoints');
        const routeWaypoints = waypointIds
            .map(id => waypoints.find(w => w.id === id))
            .filter(Boolean);

        if (routeWaypoints.length < 2) {
            ModalsModule.showToast('Select at least 2 waypoints', 'error');
            return null;
        }

        startNewRoute('Route from Waypoints');
        
        routeWaypoints.forEach(wp => {
            const lat = wp.lat || (37.4215 + (wp.y - 50) * 0.002);
            const lon = wp.lon || (-119.1892 + (wp.x - 50) * 0.004);
            addPoint(lat, lon, wp.id);
        });

        return currentRoute;
    }

    // Helper functions
    function lonToX(lon) {
        return 50 + (lon + 119.1892) / 0.004;
    }

    function latToY(lat) {
        return 50 + (lat - 37.4215) / 0.002;
    }

    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 3959;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 + 
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function formatDuration(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    }

    // Public API
    return {
        startNewRoute,
        addPoint,
        insertPoint,
        removePoint,
        movePoint,
        reorderPoints,
        setSegmentTerrain,
        linkToWaypoint,
        finishRoute,
        cancelRoute,
        editRoute,
        deleteRoute,
        reverseRoute,
        createFromWaypoints,
        handleMapClick,
        selectPoint,
        getState,
        recalculateRoute
    };
})();

window.RouteBuilderModule = RouteBuilderModule;
