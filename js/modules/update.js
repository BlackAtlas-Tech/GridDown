/**
 * GridDown Update Module
 * 
 * Single source of truth for service worker update detection, UI notification,
 * and activation. Consolidates update logic that was previously split across
 * index.html, app.js, and this module.
 * 
 * Lifecycle:
 *   1. gd-watch (or manual git pull) delivers new files to disk
 *   2. Browser fetches sw.js every 60s (no-cache headers ensure fresh copy)
 *   3. Browser compares new sw.js byte-for-byte against active sw.js
 *   4. If different: install event fires, new SW caches assets
 *   5. New SW enters 'installed' (waiting) state — does NOT auto-activate
 *   6. This module detects the waiting worker via 'updatefound' event
 *   7. Shows persistent toast: "Update Available — Refresh Now / Later"
 *   8. User taps "Refresh Now" → sends SKIP_WAITING to waiting worker
 *   9. Waiting worker calls self.skipWaiting() → activates → old cache purged
 *  10. 'controllerchange' fires → this module reloads the page under new worker
 *  11. User taps "Later" → old worker continues serving old version
 *      Update applies on next "Refresh Now" tap or full app restart
 * 
 * Detection triggers:
 *   - registration.update() every 60 seconds (forced byte check)
 *   - registration.update() on tab visibility change (user returns to app)
 *   - SW_UPDATED message from activate event in sw.js
 *   - Existing waiting worker on init (update arrived while app was closed)
 */
const UpdateModule = (function() {
    'use strict';

    // ==================== CONSTANTS ====================
    
    const STORAGE_KEY = 'griddown_last_version';
    const UPDATE_CHECK_INTERVAL = 60 * 1000;     // 60 seconds
    const CONTROLLER_CHANGE_TIMEOUT = 3000;       // 3s fallback if controllerchange doesn't fire
    
    // ==================== STATE ====================
    
    let currentVersion = null;
    let newVersion = null;
    let updateAvailable = false;
    let toastElement = null;
    let registration = null;
    let refreshing = false;   // Guard against double-reload

    // ==================== CORE FUNCTIONS ====================
    
    /**
     * Initialize the update module. Called once during app startup.
     */
    function init() {
        currentVersion = localStorage.getItem(STORAGE_KEY);
        
        if (!('serviceWorker' in navigator)) {
            console.log('[Update] Service workers not supported');
            return true;
        }

        // ── Message listener (SW_UPDATED, SW_VERSION from sw.js) ──
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        
        // ── Controller change listener ──
        // Fires when a new SW takes over via skipWaiting(). Reload under the
        // new worker to ensure all assets are consistent with the new cache.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;  // Prevent double reload
            refreshing = true;
            console.log('[Update] New service worker activated — reloading');
            window.location.reload();
        });
        
        // ── Attach to registration for update polling ──
        setupUpdateDetection();
        
        console.log('[Update] Initialized, current version:', currentVersion || 'first run');
        return true;
    }
    
    /**
     * Set up update detection on the SW registration.
     */
    async function setupUpdateDetection() {
        try {
            registration = await navigator.serviceWorker.ready;
            
            // Ask the active SW for its version on first load
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' });
            }
            
            // If a worker is already waiting (update arrived while app was closed)
            if (registration.waiting) {
                handleWaitingWorker(registration.waiting);
            }
            
            // Detect future updates
            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if (!installingWorker) return;
                
                console.log('[Update] New service worker installing...');
                
                installingWorker.addEventListener('statechange', () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // There's already an active worker, so this is an update
                            handleWaitingWorker(installingWorker);
                        } else {
                            // First install — app is now cached for offline use
                            console.log('[Update] App cached for offline use');
                        }
                    }
                });
            });
            
            // ── Periodic update checks ──
            // Force the browser to re-fetch sw.js and compare byte-for-byte.
            // With Prong 2 (no-cache headers on sw.js), this always hits disk.
            setInterval(() => {
                registration.update().catch(() => {});  // Silent fail if offline
            }, UPDATE_CHECK_INTERVAL);
            
            // Check immediately when user returns to the tab
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && registration) {
                    registration.update().catch(() => {});
                }
            });
            
        } catch (e) {
            console.warn('[Update] Setup failed:', e);
        }
    }
    
    /**
     * Handle a service worker that is installed and waiting to activate.
     */
    function handleWaitingWorker(worker) {
        if (updateAvailable) return;  // Already showing toast
        
        // Try to get the version from the waiting worker
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
            if (event.data && event.data.type === 'SW_VERSION') {
                showUpdateAvailable(event.data.version);
            }
        };
        
        try {
            worker.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
        } catch (e) {
            // Worker might not support MessageChannel yet, show generic toast
            showUpdateAvailable('new version');
        }
        
        // Fallback: if no version reply in 500ms, show generic toast
        setTimeout(() => {
            if (!updateAvailable) {
                showUpdateAvailable('new version');
            }
        }, 500);
    }
    
    /**
     * Handle messages from the active service worker.
     */
    function handleSWMessage(event) {
        const { type, version } = event.data || {};
        
        if (type === 'SW_UPDATED') {
            // The new SW just activated and sent this message.
            // The controllerchange listener will reload the page.
            console.log('[Update] SW activated, version:', version);
            if (version) {
                localStorage.setItem(STORAGE_KEY, version);
                currentVersion = version;
            }
        } else if (type === 'SW_VERSION') {
            if (version && !currentVersion) {
                // First time — store version
                currentVersion = version;
                localStorage.setItem(STORAGE_KEY, version);
            } else if (version && version !== currentVersion) {
                // Version mismatch — update happened externally
                showUpdateAvailable(version);
            }
        }
    }
    
    /**
     * Show the update toast.
     */
    function showUpdateAvailable(version) {
        if (updateAvailable) return;
        
        newVersion = version;
        updateAvailable = true;
        
        console.log('[Update] Update available:', version);
        showUpdateToast(version);
    }

    // ==================== UI ====================
    
    /**
     * Show update available toast notification.
     */
    function showUpdateToast(version) {
        hideUpdateToast();
        
        // Extract readable version (e.g., "griddown-v6.57.72" → "6.57.72")
        const versionDisplay = version.replace('griddown-', '').replace(/^v/, '');
        
        toastElement = document.createElement('div');
        toastElement.id = 'update-toast';
        toastElement.innerHTML = `
            <style>
                #update-toast {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    right: 20px;
                    max-width: 400px;
                    margin: 0 auto;
                    background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
                    color: white;
                    padding: 16px;
                    border-radius: 12px;
                    font-family: system-ui, -apple-system, sans-serif;
                    z-index: 10003;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    animation: updateToastIn 0.4s ease-out;
                }
                
                @keyframes updateToastIn {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                @keyframes updateToastOut {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(100px); opacity: 0; }
                }
                
                #update-toast .toast-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 12px;
                }
                
                #update-toast .toast-icon { font-size: 24px; }
                #update-toast .toast-title { font-size: 15px; font-weight: 600; }
                
                #update-toast .toast-version {
                    margin-left: auto;
                    font-size: 11px;
                    opacity: 0.8;
                    background: rgba(255,255,255,0.15);
                    padding: 3px 8px;
                    border-radius: 4px;
                }
                
                #update-toast .toast-message {
                    font-size: 13px;
                    opacity: 0.9;
                    margin-bottom: 14px;
                    line-height: 1.4;
                }
                
                #update-toast .toast-actions {
                    display: flex;
                    gap: 10px;
                }
                
                #update-toast .toast-btn {
                    flex: 1;
                    padding: 10px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                #update-toast .toast-btn-primary {
                    background: white;
                    color: #1e40af;
                }
                
                #update-toast .toast-btn-primary:hover {
                    background: #f0f0f0;
                }
                
                #update-toast .toast-btn-secondary {
                    background: rgba(255,255,255,0.15);
                    color: white;
                }
                
                #update-toast .toast-btn-secondary:hover {
                    background: rgba(255,255,255,0.25);
                }
            </style>
            
            <div class="toast-header">
                <span class="toast-icon">\u{1F504}</span>
                <span class="toast-title">Update Available</span>
                <span class="toast-version">${versionDisplay}</span>
            </div>
            
            <div class="toast-message">
                A new version of GridDown is ready. Refresh to get the latest features and improvements.
            </div>
            
            <div class="toast-actions">
                <button class="toast-btn toast-btn-secondary" id="update-later">
                    Later
                </button>
                <button class="toast-btn toast-btn-primary" id="update-refresh">
                    Refresh Now
                </button>
            </div>
        `;
        
        document.body.appendChild(toastElement);
        
        document.getElementById('update-refresh').onclick = () => {
            applyUpdate();
        };
        
        document.getElementById('update-later').onclick = () => {
            hideUpdateToast();
        };
    }
    
    /**
     * Hide the update toast with animation.
     */
    function hideUpdateToast() {
        if (toastElement) {
            toastElement.style.animation = 'updateToastOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (toastElement && toastElement.parentNode) {
                    toastElement.parentNode.removeChild(toastElement);
                }
                toastElement = null;
            }, 300);
        }
    }
    
    /**
     * Apply the update: tell the waiting worker to activate, then reload.
     * 
     * The controllerchange listener (set up in init) handles the reload.
     * A fallback timeout ensures reload happens even if controllerchange
     * doesn't fire (e.g., the worker activated before we sent the message).
     */
    function applyUpdate() {
        // Store the new version so we don't re-prompt after reload
        if (newVersion) {
            localStorage.setItem(STORAGE_KEY, newVersion);
        }
        
        // Tell the waiting worker to take over
        if (registration && registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // The controllerchange listener will reload the page.
            // Set a fallback in case it doesn't fire (worker already activated,
            // or the message was lost).
            setTimeout(() => {
                if (!refreshing) {
                    console.log('[Update] controllerchange timeout — forcing reload');
                    refreshing = true;
                    window.location.reload();
                }
            }, CONTROLLER_CHANGE_TIMEOUT);
        } else {
            // No waiting worker (update already activated), just reload
            refreshing = true;
            window.location.reload();
        }
    }
    
    /**
     * Manually trigger an update check.
     * Exposed for a "Check for Updates" button in settings.
     */
    async function checkForUpdates() {
        if (!registration) {
            try {
                registration = await navigator.serviceWorker.ready;
            } catch (e) {
                console.warn('[Update] Cannot check for updates:', e);
                return;
            }
        }
        
        try {
            await registration.update();
            
            // Check if a worker is now waiting
            if (registration.waiting) {
                handleWaitingWorker(registration.waiting);
            }
        } catch (e) {
            console.warn('[Update] Update check failed:', e);
        }
    }

    // ==================== PUBLIC API ====================
    
    return {
        init,
        checkForUpdates,
        applyUpdate,
        hideUpdateToast,
        getCurrentVersion: () => currentVersion,
        isUpdateAvailable: () => updateAvailable,
        getNewVersion: () => newVersion
    };
})();

if (typeof window !== 'undefined') {
    window.UpdateModule = UpdateModule;
}
