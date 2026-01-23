/**
 * GridDown EventManager - Centralized Event Listener Management
 * Prevents memory leaks by tracking and cleaning up event listeners,
 * intervals, timeouts, and other resources
 */
const EventManager = (function() {
    'use strict';

    // Track all registered listeners by scope
    // Structure: { scopeId: [{ target, event, handler, options }] }
    const listeners = new Map();
    
    // Track intervals and timeouts by scope
    // Structure: { scopeId: { intervals: Set, timeouts: Set, cleanupFns: [] } }
    const resources = new Map();
    
    // Global scope for app-wide listeners
    const GLOBAL_SCOPE = '__global__';
    
    // Counter for generating unique scope IDs
    let scopeCounter = 0;
    
    /**
     * Initialize resources tracking for a scope
     */
    function ensureResources(scope) {
        if (!resources.has(scope)) {
            resources.set(scope, {
                intervals: new Set(),
                timeouts: new Set(),
                cleanupFns: []
            });
        }
        return resources.get(scope);
    }

    /**
     * Generate a unique scope ID
     * @returns {string}
     */
    function createScope() {
        return `scope_${++scopeCounter}_${Date.now()}`;
    }

    /**
     * Add an event listener with tracking
     * @param {EventTarget} target - DOM element or other event target
     * @param {string} event - Event name (e.g., 'click', 'keydown')
     * @param {Function} handler - Event handler function
     * @param {Object} options - Optional: { scope, ...addEventListenerOptions }
     * @returns {Function} Cleanup function to remove this specific listener
     */
    function on(target, event, handler, options = {}) {
        const { scope = GLOBAL_SCOPE, ...listenerOptions } = options;
        
        // Initialize scope if needed
        if (!listeners.has(scope)) {
            listeners.set(scope, []);
        }
        
        // Add the listener
        target.addEventListener(event, handler, listenerOptions);
        
        // Track it
        const entry = { target, event, handler, options: listenerOptions };
        listeners.get(scope).push(entry);
        
        // Return cleanup function
        return () => off(target, event, handler, scope);
    }

    /**
     * Add a one-time event listener
     * @param {EventTarget} target
     * @param {string} event
     * @param {Function} handler
     * @param {Object} options
     * @returns {Function} Cleanup function
     */
    function once(target, event, handler, options = {}) {
        const { scope = GLOBAL_SCOPE, ...listenerOptions } = options;
        
        const wrappedHandler = (e) => {
            handler(e);
            off(target, event, wrappedHandler, scope);
        };
        
        return on(target, event, wrappedHandler, { scope, ...listenerOptions });
    }

    /**
     * Remove a specific event listener
     * @param {EventTarget} target
     * @param {string} event
     * @param {Function} handler
     * @param {string} scope
     */
    function off(target, event, handler, scope = GLOBAL_SCOPE) {
        target.removeEventListener(event, handler);
        
        // Remove from tracking
        if (listeners.has(scope)) {
            const scopeListeners = listeners.get(scope);
            const index = scopeListeners.findIndex(
                l => l.target === target && l.event === event && l.handler === handler
            );
            if (index > -1) {
                scopeListeners.splice(index, 1);
            }
        }
    }

    /**
     * Remove all listeners for a specific scope
     * @param {string} scope
     */
    function clearScope(scope) {
        // Clear event listeners
        if (listeners.has(scope)) {
            const scopeListeners = listeners.get(scope);
            for (const { target, event, handler, options } of scopeListeners) {
                try {
                    target.removeEventListener(event, handler, options);
                } catch (e) {
                    console.debug('EventManager: Could not remove listener', e);
                }
            }
            listeners.delete(scope);
        }
        
        // Clear intervals, timeouts, and custom cleanup functions
        if (resources.has(scope)) {
            const res = resources.get(scope);
            
            // Clear all intervals
            for (const id of res.intervals) {
                clearInterval(id);
            }
            res.intervals.clear();
            
            // Clear all timeouts
            for (const id of res.timeouts) {
                clearTimeout(id);
            }
            res.timeouts.clear();
            
            // Run custom cleanup functions
            for (const fn of res.cleanupFns) {
                try { fn(); } catch (e) { console.debug('EventManager: Cleanup error', e); }
            }
            res.cleanupFns = [];
            
            resources.delete(scope);
        }
    }

    /**
     * Remove all tracked listeners and resources (use with caution)
     */
    function clearAll() {
        for (const scope of listeners.keys()) {
            clearScope(scope);
        }
        for (const scope of resources.keys()) {
            clearScope(scope);
        }
    }
    
    /**
     * Create a tracked setInterval
     * @param {Function} callback
     * @param {number} delay
     * @param {string} scope
     * @returns {number} Interval ID
     */
    function setTrackedInterval(callback, delay, scope = GLOBAL_SCOPE) {
        const res = ensureResources(scope);
        const id = setInterval(callback, delay);
        res.intervals.add(id);
        return id;
    }
    
    /**
     * Clear a tracked interval
     * @param {number} id
     * @param {string} scope
     */
    function clearTrackedInterval(id, scope = GLOBAL_SCOPE) {
        clearInterval(id);
        if (resources.has(scope)) {
            resources.get(scope).intervals.delete(id);
        }
    }
    
    /**
     * Create a tracked setTimeout
     * @param {Function} callback
     * @param {number} delay
     * @param {string} scope
     * @returns {number} Timeout ID
     */
    function setTrackedTimeout(callback, delay, scope = GLOBAL_SCOPE) {
        const res = ensureResources(scope);
        const id = setTimeout(() => {
            res.timeouts.delete(id);
            callback();
        }, delay);
        res.timeouts.add(id);
        return id;
    }
    
    /**
     * Clear a tracked timeout
     * @param {number} id
     * @param {string} scope
     */
    function clearTrackedTimeout(id, scope = GLOBAL_SCOPE) {
        clearTimeout(id);
        if (resources.has(scope)) {
            resources.get(scope).timeouts.delete(id);
        }
    }
    
    /**
     * Register a custom cleanup function
     * @param {Function} fn
     * @param {string} scope
     */
    function onCleanup(fn, scope = GLOBAL_SCOPE) {
        const res = ensureResources(scope);
        res.cleanupFns.push(fn);
    }

    /**
     * Get count of listeners and resources for debugging
     * @param {string} scope - Optional scope to count
     * @returns {Object} { total, byScope } or { scope, listeners, intervals, timeouts, cleanupFns }
     */
    function getStats(scope = null) {
        if (scope) {
            const listenerCount = listeners.has(scope) ? listeners.get(scope).length : 0;
            const res = resources.get(scope);
            return {
                scope,
                listeners: listenerCount,
                intervals: res ? res.intervals.size : 0,
                timeouts: res ? res.timeouts.size : 0,
                cleanupFns: res ? res.cleanupFns.length : 0
            };
        }
        
        const stats = { 
            totalListeners: 0, 
            totalIntervals: 0,
            totalTimeouts: 0,
            byScope: {} 
        };
        
        // Collect all unique scopes
        const allScopes = new Set([...listeners.keys(), ...resources.keys()]);
        
        for (const scopeId of allScopes) {
            const listenerCount = listeners.has(scopeId) ? listeners.get(scopeId).length : 0;
            const res = resources.get(scopeId);
            
            stats.byScope[scopeId] = {
                listeners: listenerCount,
                intervals: res ? res.intervals.size : 0,
                timeouts: res ? res.timeouts.size : 0,
                cleanupFns: res ? res.cleanupFns.length : 0
            };
            
            stats.totalListeners += listenerCount;
            stats.totalIntervals += res ? res.intervals.size : 0;
            stats.totalTimeouts += res ? res.timeouts.size : 0;
        }
        
        return stats;
    }

    /**
     * Add event delegation helper
     * Attaches a single listener to a container that handles events on children
     * @param {Element} container - Parent element to attach listener to
     * @param {string} event - Event name
     * @param {string} selector - CSS selector for target elements
     * @param {Function} handler - Handler receives (event, matchedElement)
     * @param {Object} options
     * @returns {Function} Cleanup function
     */
    function delegate(container, event, selector, handler, options = {}) {
        const delegatedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && container.contains(target)) {
                handler(e, target);
            }
        };
        
        return on(container, event, delegatedHandler, options);
    }

    /**
     * Create a scoped event manager for a specific component
     * All listeners added through this will be automatically tracked
     * @param {string} scopeName - Optional name for the scope
     * @returns {Object} Scoped event manager
     */
    function createScopedManager(scopeName = null) {
        const scope = scopeName || createScope();
        
        return {
            scope,
            
            // Event listener methods
            on: (target, event, handler, options = {}) => 
                on(target, event, handler, { ...options, scope }),
            
            once: (target, event, handler, options = {}) => 
                once(target, event, handler, { ...options, scope }),
            
            off: (target, event, handler) => 
                off(target, event, handler, scope),
            
            delegate: (container, event, selector, handler, options = {}) =>
                delegate(container, event, selector, handler, { ...options, scope }),
            
            // Interval/timeout methods
            setInterval: (callback, delay) => 
                setTrackedInterval(callback, delay, scope),
            
            clearInterval: (id) => 
                clearTrackedInterval(id, scope),
            
            setTimeout: (callback, delay) => 
                setTrackedTimeout(callback, delay, scope),
            
            clearTimeout: (id) => 
                clearTrackedTimeout(id, scope),
            
            // Cleanup registration
            onCleanup: (fn) => 
                onCleanup(fn, scope),
            
            // Cleanup method
            clear: () => clearScope(scope),
            
            // Debugging
            getStats: () => getStats(scope)
        };
    }

    // Standard scopes for common use cases
    const SCOPES = {
        GLOBAL: GLOBAL_SCOPE,
        APP: 'app',
        PANEL: 'panel',
        MODAL: 'modal',
        MAP: 'map',
        SEARCH: 'search',
        ONBOARDING: 'onboarding',
        NAVIGATION: 'navigation',
        MESHTASTIC: 'meshtastic',
        APRS: 'aprs',
        NIGHT_MODE: 'nightmode'
    };

    return {
        // Event listeners
        on,
        once,
        off,
        delegate,
        
        // Interval/timeout tracking
        setInterval: setTrackedInterval,
        clearInterval: clearTrackedInterval,
        setTimeout: setTrackedTimeout,
        clearTimeout: clearTrackedTimeout,
        
        // Cleanup
        onCleanup,
        clearScope,
        clearAll,
        
        // Utility
        getStats,
        createScope,
        createScopedManager,
        SCOPES
    };
})();

window.EventManager = EventManager;
