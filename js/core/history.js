/**
 * GridDown History Module - Undo/Redo Functionality
 * Tracks state changes and allows reverting/replaying actions
 */
const HistoryModule = (function() {
    'use strict';

    // History stacks
    let undoStack = [];
    let redoStack = [];
    
    // Configuration
    const MAX_HISTORY = 50;  // Maximum number of undo steps
    
    // Action types
    const ActionTypes = {
        // Waypoints
        WAYPOINT_ADD: 'waypoint:add',
        WAYPOINT_DELETE: 'waypoint:delete',
        WAYPOINT_UPDATE: 'waypoint:update',
        WAYPOINT_BULK: 'waypoint:bulk',
        
        // Routes
        ROUTE_ADD: 'route:add',
        ROUTE_DELETE: 'route:delete',
        ROUTE_UPDATE: 'route:update',
        ROUTE_BULK: 'route:bulk',
        
        // Batch operations
        BATCH: 'batch'
    };

    // Subscribers for history changes
    const subscribers = new Set();

    /**
     * Record an action that can be undone
     * @param {string} type - Action type from ActionTypes
     * @param {object} undoData - Data needed to undo the action
     * @param {object} redoData - Data needed to redo the action
     * @param {string} description - Human-readable description
     */
    function record(type, undoData, redoData, description = '') {
        const action = {
            type,
            undoData,
            redoData,
            description: description || getDefaultDescription(type, undoData),
            timestamp: Date.now()
        };

        undoStack.push(action);
        
        // Clear redo stack when new action is recorded
        redoStack = [];
        
        // Trim history if too long
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }

        notifySubscribers();
        console.log(`[History] Recorded: ${action.description}`);
    }

    /**
     * Record a waypoint addition
     */
    function recordWaypointAdd(waypoint) {
        record(
            ActionTypes.WAYPOINT_ADD,
            { waypoint: { ...waypoint } },
            { waypoint: { ...waypoint } },
            `Add waypoint "${waypoint.name}"`
        );
    }

    /**
     * Record a waypoint deletion
     */
    function recordWaypointDelete(waypoint) {
        record(
            ActionTypes.WAYPOINT_DELETE,
            { waypoint: { ...waypoint } },
            { waypointId: waypoint.id },
            `Delete waypoint "${waypoint.name}"`
        );
    }

    /**
     * Record a waypoint update
     */
    function recordWaypointUpdate(oldWaypoint, newWaypoint) {
        record(
            ActionTypes.WAYPOINT_UPDATE,
            { waypoint: { ...oldWaypoint } },
            { waypoint: { ...newWaypoint } },
            `Update waypoint "${newWaypoint.name}"`
        );
    }

    /**
     * Record a route addition
     */
    function recordRouteAdd(route) {
        record(
            ActionTypes.ROUTE_ADD,
            { route: { ...route } },
            { route: { ...route } },
            `Add route "${route.name}"`
        );
    }

    /**
     * Record a route deletion
     */
    function recordRouteDelete(route) {
        record(
            ActionTypes.ROUTE_DELETE,
            { route: { ...route } },
            { routeId: route.id },
            `Delete route "${route.name}"`
        );
    }

    /**
     * Record a route update
     */
    function recordRouteUpdate(oldRoute, newRoute) {
        record(
            ActionTypes.ROUTE_UPDATE,
            { route: { ...oldRoute } },
            { route: { ...newRoute } },
            `Update route "${newRoute.name}"`
        );
    }

    /**
     * Record multiple waypoints (e.g., from import)
     */
    function recordWaypointBulk(oldWaypoints, newWaypoints, description) {
        record(
            ActionTypes.WAYPOINT_BULK,
            { waypoints: oldWaypoints.map(w => ({ ...w })) },
            { waypoints: newWaypoints.map(w => ({ ...w })) },
            description || `Bulk waypoint change (${newWaypoints.length} waypoints)`
        );
    }

    /**
     * Record multiple routes (e.g., from import)
     */
    function recordRouteBulk(oldRoutes, newRoutes, description) {
        record(
            ActionTypes.ROUTE_BULK,
            { routes: oldRoutes.map(r => ({ ...r })) },
            { routes: newRoutes.map(r => ({ ...r })) },
            description || `Bulk route change (${newRoutes.length} routes)`
        );
    }

    /**
     * Start a batch operation (groups multiple actions into one undo step)
     */
    let batchActions = null;
    
    function startBatch(description) {
        batchActions = {
            description,
            actions: []
        };
    }

    /**
     * End a batch operation
     */
    function endBatch() {
        if (batchActions && batchActions.actions.length > 0) {
            record(
                ActionTypes.BATCH,
                { actions: batchActions.actions },
                { actions: batchActions.actions },
                batchActions.description
            );
        }
        batchActions = null;
    }

    /**
     * Undo the last action
     * @returns {boolean} True if an action was undone
     */
    function undo() {
        if (undoStack.length === 0) {
            console.log('[History] Nothing to undo');
            showToast('Nothing to undo', 'info');
            return false;
        }

        const action = undoStack.pop();
        
        try {
            executeUndo(action);
            redoStack.push(action);
            notifySubscribers();
            
            console.log(`[History] Undone: ${action.description}`);
            showToast(`Undone: ${action.description}`, 'success');
            
            // Persist changes
            State.persist();
            
            return true;
        } catch (e) {
            console.error('[History] Undo failed:', e);
            // Put action back on stack
            undoStack.push(action);
            showToast('Undo failed', 'error');
            return false;
        }
    }

    /**
     * Redo the last undone action
     * @returns {boolean} True if an action was redone
     */
    function redo() {
        if (redoStack.length === 0) {
            console.log('[History] Nothing to redo');
            showToast('Nothing to redo', 'info');
            return false;
        }

        const action = redoStack.pop();
        
        try {
            executeRedo(action);
            undoStack.push(action);
            notifySubscribers();
            
            console.log(`[History] Redone: ${action.description}`);
            showToast(`Redone: ${action.description}`, 'success');
            
            // Persist changes
            State.persist();
            
            return true;
        } catch (e) {
            console.error('[History] Redo failed:', e);
            // Put action back on stack
            redoStack.push(action);
            showToast('Redo failed', 'error');
            return false;
        }
    }

    /**
     * Execute an undo operation
     */
    function executeUndo(action) {
        const { type, undoData } = action;

        switch (type) {
            case ActionTypes.WAYPOINT_ADD:
                // Undo add = delete
                removeWaypointDirect(undoData.waypoint.id);
                break;

            case ActionTypes.WAYPOINT_DELETE:
                // Undo delete = restore
                addWaypointDirect(undoData.waypoint);
                break;

            case ActionTypes.WAYPOINT_UPDATE:
                // Undo update = restore old version
                updateWaypointDirect(undoData.waypoint.id, undoData.waypoint);
                break;

            case ActionTypes.WAYPOINT_BULK:
                // Restore previous waypoints state
                setWaypointsDirect(undoData.waypoints);
                break;

            case ActionTypes.ROUTE_ADD:
                // Undo add = delete
                removeRouteDirect(undoData.route.id);
                break;

            case ActionTypes.ROUTE_DELETE:
                // Undo delete = restore
                addRouteDirect(undoData.route);
                break;

            case ActionTypes.ROUTE_UPDATE:
                // Undo update = restore old version
                updateRouteDirect(undoData.route.id, undoData.route);
                break;

            case ActionTypes.ROUTE_BULK:
                // Restore previous routes state
                setRoutesDirect(undoData.routes);
                break;

            case ActionTypes.BATCH:
                // Undo batch in reverse order
                for (let i = undoData.actions.length - 1; i >= 0; i--) {
                    executeUndo(undoData.actions[i]);
                }
                break;

            default:
                console.warn(`[History] Unknown action type: ${type}`);
        }
    }

    /**
     * Execute a redo operation
     */
    function executeRedo(action) {
        const { type, redoData } = action;

        switch (type) {
            case ActionTypes.WAYPOINT_ADD:
                // Redo add = add again
                addWaypointDirect(redoData.waypoint);
                break;

            case ActionTypes.WAYPOINT_DELETE:
                // Redo delete = delete again
                removeWaypointDirect(redoData.waypointId);
                break;

            case ActionTypes.WAYPOINT_UPDATE:
                // Redo update = apply new version
                updateWaypointDirect(redoData.waypoint.id, redoData.waypoint);
                break;

            case ActionTypes.WAYPOINT_BULK:
                // Apply new waypoints state
                setWaypointsDirect(redoData.waypoints);
                break;

            case ActionTypes.ROUTE_ADD:
                // Redo add = add again
                addRouteDirect(redoData.route);
                break;

            case ActionTypes.ROUTE_DELETE:
                // Redo delete = delete again
                removeRouteDirect(redoData.routeId);
                break;

            case ActionTypes.ROUTE_UPDATE:
                // Redo update = apply new version
                updateRouteDirect(redoData.route.id, redoData.route);
                break;

            case ActionTypes.ROUTE_BULK:
                // Apply new routes state
                setRoutesDirect(redoData.routes);
                break;

            case ActionTypes.BATCH:
                // Redo batch in forward order
                for (const batchAction of redoData.actions) {
                    executeRedo(batchAction);
                }
                break;

            default:
                console.warn(`[History] Unknown action type: ${type}`);
        }
    }

    // ==========================================
    // Direct state manipulation (bypasses history recording)
    // These use State.withoutHistory or the recordHistory=false flag
    // ==========================================

    function addWaypointDirect(waypoint) {
        State.Waypoints.add(waypoint, false);  // false = don't record history
    }

    function removeWaypointDirect(id) {
        State.Waypoints.remove(id, false);  // false = don't record history
    }

    function updateWaypointDirect(id, data) {
        State.Waypoints.update(id, data, false);  // false = don't record history
    }

    function setWaypointsDirect(waypoints) {
        State.Waypoints.setAll(waypoints, false);  // false = don't record history
    }

    function addRouteDirect(route) {
        State.Routes.add(route, false);  // false = don't record history
    }

    function removeRouteDirect(id) {
        State.Routes.remove(id, false);  // false = don't record history
    }

    function updateRouteDirect(id, data) {
        State.Routes.update(id, data, false);  // false = don't record history
    }

    function setRoutesDirect(routes) {
        State.Routes.setAll(routes, false);  // false = don't record history
    }

    // ==========================================
    // Utility functions
    // ==========================================

    function getDefaultDescription(type, data) {
        switch (type) {
            case ActionTypes.WAYPOINT_ADD:
                return `Add waypoint`;
            case ActionTypes.WAYPOINT_DELETE:
                return `Delete waypoint`;
            case ActionTypes.WAYPOINT_UPDATE:
                return `Update waypoint`;
            case ActionTypes.ROUTE_ADD:
                return `Add route`;
            case ActionTypes.ROUTE_DELETE:
                return `Delete route`;
            case ActionTypes.ROUTE_UPDATE:
                return `Update route`;
            default:
                return `Action`;
        }
    }

    function showToast(message, type) {
        if (typeof ModalsModule !== 'undefined' && ModalsModule.showToast) {
            ModalsModule.showToast(message, type);
        }
    }

    /**
     * Get history state for UI
     */
    function getState() {
        return {
            canUndo: undoStack.length > 0,
            canRedo: redoStack.length > 0,
            undoCount: undoStack.length,
            redoCount: redoStack.length,
            lastAction: undoStack.length > 0 ? undoStack[undoStack.length - 1].description : null,
            nextRedo: redoStack.length > 0 ? redoStack[redoStack.length - 1].description : null
        };
    }

    /**
     * Get recent history for display
     */
    function getRecentHistory(count = 10) {
        return undoStack.slice(-count).reverse().map((action, index) => ({
            index,
            description: action.description,
            timestamp: action.timestamp,
            type: action.type
        }));
    }

    /**
     * Clear all history
     */
    function clear() {
        undoStack = [];
        redoStack = [];
        notifySubscribers();
        console.log('[History] Cleared');
    }

    /**
     * Subscribe to history changes
     */
    function subscribe(callback) {
        subscribers.add(callback);
        callback(getState());
        return () => subscribers.delete(callback);
    }

    /**
     * Notify subscribers of history changes
     */
    function notifySubscribers() {
        const state = getState();
        subscribers.forEach(cb => {
            try {
                cb(state);
            } catch (e) {
                console.error('[History] Subscriber error:', e);
            }
        });
    }

    // Track initialization
    let keyboardInitialized = false;
    let keyboardHandler = null;

    /**
     * Initialize keyboard shortcuts
     */
    function initKeyboardShortcuts() {
        // Prevent double initialization
        if (keyboardInitialized) {
            console.debug('[History] Keyboard shortcuts already initialized');
            return;
        }
        
        keyboardHandler = (e) => {
            // Check if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl+Z or Cmd+Z = Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            
            // Ctrl+Shift+Z or Cmd+Shift+Z = Redo
            // Also Ctrl+Y = Redo (Windows convention)
            if ((e.ctrlKey || e.metaKey) && (
                (e.key === 'z' && e.shiftKey) || 
                (e.key === 'y' && !e.shiftKey)
            )) {
                e.preventDefault();
                redo();
            }
        };
        
        document.addEventListener('keydown', keyboardHandler);
        keyboardInitialized = true;

        console.log('[History] Keyboard shortcuts initialized (Ctrl+Z / Ctrl+Shift+Z)');
    }
    
    /**
     * Remove keyboard shortcuts (for cleanup)
     */
    function removeKeyboardShortcuts() {
        if (keyboardHandler) {
            document.removeEventListener('keydown', keyboardHandler);
            keyboardHandler = null;
        }
        keyboardInitialized = false;
    }

    // Public API
    return {
        // Recording
        record,
        recordWaypointAdd,
        recordWaypointDelete,
        recordWaypointUpdate,
        recordRouteAdd,
        recordRouteDelete,
        recordRouteUpdate,
        recordWaypointBulk,
        recordRouteBulk,
        startBatch,
        endBatch,
        
        // Undo/Redo
        undo,
        redo,
        
        // State
        getState,
        getRecentHistory,
        clear,
        subscribe,
        
        // Setup
        initKeyboardShortcuts,
        removeKeyboardShortcuts,
        
        // Constants
        ActionTypes
    };
})();

window.HistoryModule = HistoryModule;
