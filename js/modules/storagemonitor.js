/**
 * GridDown Storage Monitor Module
 * Monitors storage usage and warns users when approaching quota limits
 * 
 * Tracks: IndexedDB, Cache Storage
 * Warns at thresholds: 80% (warning), 90% (critical), 95% (danger)
 */
const StorageMonitorModule = (function() {
    'use strict';

    // ==================== CONSTANTS ====================
    
    const STORAGE_KEY = 'griddown_storage_dismissed';
    const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    
    const THRESHOLDS = {
        WARNING: 0.80,
        CRITICAL: 0.90,
        DANGER: 0.95
    };

    // ==================== STATE ====================
    
    let isSupported = false;
    let currentUsage = 0;
    let currentQuota = 0;
    let usagePercent = 0;
    let warningLevel = null;
    let lastCheck = null;
    let checkInterval = null;
    let bannerElement = null;
    let dismissedLevel = null;
    let subscribers = [];

    // ==================== CORE ====================
    
    function init() {
        isSupported = 'storage' in navigator && 'estimate' in navigator.storage;
        
        if (!isSupported) {
            console.warn('StorageMonitor: Storage API not supported');
            return false;
        }
        
        try {
            dismissedLevel = localStorage.getItem(STORAGE_KEY);
        } catch (e) {}
        
        checkStorage();
        startPeriodicCheck();
        
        console.log('StorageMonitorModule initialized');
        return true;
    }
    
    async function checkStorage() {
        if (!isSupported) return null;
        
        try {
            const estimate = await navigator.storage.estimate();
            
            currentUsage = estimate.usage || 0;
            currentQuota = estimate.quota || 0;
            usagePercent = currentQuota > 0 ? currentUsage / currentQuota : 0;
            lastCheck = Date.now();
            
            // Determine level
            if (usagePercent >= THRESHOLDS.DANGER) {
                warningLevel = 'danger';
            } else if (usagePercent >= THRESHOLDS.CRITICAL) {
                warningLevel = 'critical';
            } else if (usagePercent >= THRESHOLDS.WARNING) {
                warningLevel = 'warning';
            } else {
                warningLevel = null;
            }
            
            // Show banner if needed
            if (warningLevel && shouldShowBanner()) {
                showBanner();
            } else if (!warningLevel) {
                hideBanner();
                resetDismissed();
            }
            
            notifySubscribers('update', getStatus());
            return getStatus();
            
        } catch (e) {
            console.error('Storage check error:', e);
            return null;
        }
    }
    
    function shouldShowBanner() {
        if (!dismissedLevel) return true;
        
        const levels = ['warning', 'critical', 'danger'];
        return levels.indexOf(warningLevel) > levels.indexOf(dismissedLevel);
    }
    
    function startPeriodicCheck() {
        if (checkInterval) return;
        checkInterval = setInterval(checkStorage, CHECK_INTERVAL_MS);
    }
    
    function stopPeriodicCheck() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }
    
    function getStatus() {
        return {
            supported: isSupported,
            usage: currentUsage,
            quota: currentQuota,
            percent: usagePercent,
            percentStr: (usagePercent * 100).toFixed(1) + '%',
            usageStr: formatBytes(currentUsage),
            quotaStr: formatBytes(currentQuota),
            availableStr: formatBytes(currentQuota - currentUsage),
            level: warningLevel,
            lastCheck
        };
    }

    // ==================== UI ====================
    
    function showBanner() {
        hideBanner();
        
        const colors = {
            warning: { bg: '#fbbf24', icon: '⚠️' },
            critical: { bg: '#fb923c', icon: '🔶' },
            danger: { bg: '#f87171', icon: '🔴' }
        };
        const c = colors[warningLevel];
        const pct = (usagePercent * 100).toFixed(0);
        
        bannerElement = document.createElement('div');
        bannerElement.id = 'storage-banner';
        bannerElement.innerHTML = `
            <style>
                #storage-banner {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border: 1px solid ${c.bg};
                    border-radius: 12px;
                    padding: 14px 16px;
                    max-width: 300px;
                    z-index: 10002;
                    font-family: system-ui, -apple-system, sans-serif;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    animation: storageFadeIn 0.3s ease-out;
                }
                @keyframes storageFadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes storageFadeOut {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(20px); }
                }
                #storage-banner .sb-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                #storage-banner .sb-icon { font-size: 18px; }
                #storage-banner .sb-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: ${c.bg};
                    flex: 1;
                }
                #storage-banner .sb-close {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0;
                }
                #storage-banner .sb-bar {
                    height: 6px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                #storage-banner .sb-fill {
                    height: 100%;
                    background: ${c.bg};
                    width: ${Math.min(100, pct)}%;
                    border-radius: 3px;
                }
                #storage-banner .sb-stats {
                    font-size: 11px;
                    color: rgba(255,255,255,0.7);
                    margin-bottom: 10px;
                }
                #storage-banner .sb-actions {
                    display: flex;
                    gap: 8px;
                }
                #storage-banner .sb-btn {
                    flex: 1;
                    padding: 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 500;
                    border: none;
                    cursor: pointer;
                }
                #storage-banner .sb-btn-manage {
                    background: ${c.bg};
                    color: #000;
                }
                #storage-banner .sb-btn-dismiss {
                    background: rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.8);
                }
            </style>
            <div class="sb-header">
                <span class="sb-icon">${c.icon}</span>
                <span class="sb-title">Storage ${pct}% Full</span>
                <button class="sb-close" id="storage-close">&times;</button>
            </div>
            <div class="sb-bar"><div class="sb-fill"></div></div>
            <div class="sb-stats">${formatBytes(currentUsage)} of ${formatBytes(currentQuota)} used</div>
            <div class="sb-actions">
                <button class="sb-btn sb-btn-dismiss" id="storage-dismiss">Dismiss</button>
                <button class="sb-btn sb-btn-manage" id="storage-manage">Manage</button>
            </div>
        `;
        
        document.body.appendChild(bannerElement);
        
        document.getElementById('storage-close').onclick = () => dismiss();
        document.getElementById('storage-dismiss').onclick = () => dismiss();
        document.getElementById('storage-manage').onclick = () => {
            hideBanner();
            if (typeof PanelsModule !== 'undefined') {
                PanelsModule.show('offline');
            }
        };
    }
    
    function hideBanner() {
        if (bannerElement) {
            bannerElement.style.animation = 'storageFadeOut 0.3s ease-out forwards';
            const el = bannerElement;
            setTimeout(() => el.parentNode?.removeChild(el), 300);
            bannerElement = null;
        }
    }
    
    function dismiss() {
        dismissedLevel = warningLevel;
        try {
            localStorage.setItem(STORAGE_KEY, warningLevel);
        } catch (e) {}
        hideBanner();
    }
    
    function resetDismissed() {
        dismissedLevel = null;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    }
    
    function renderCompact() {
        if (!isSupported || !currentQuota) return '';
        
        const pct = (usagePercent * 100).toFixed(0);
        const color = warningLevel === 'danger' ? '#ef4444' : 
                     warningLevel === 'critical' ? '#f97316' : 
                     warningLevel === 'warning' ? '#fbbf24' : '#22c55e';
        
        return `
            <div style="display:flex;align-items:center;gap:8px;font-size:11px">
                <span style="color:rgba(255,255,255,0.5)">Storage:</span>
                <div style="width:50px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px">
                    <div style="width:${Math.min(100, pct)}%;height:100%;background:${color};border-radius:2px"></div>
                </div>
                <span style="color:${color}">${pct}%</span>
            </div>
        `;
    }

    // ==================== UTILITIES ====================
    
    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    function subscribe(callback) {
        subscribers.push(callback);
        return () => { subscribers = subscribers.filter(fn => fn !== callback); };
    }
    
    function notifySubscribers(event, data) {
        subscribers.forEach(fn => { try { fn(event, data); } catch (e) {} });
    }

    // ==================== PUBLIC API ====================
    
    return {
        init,
        checkStorage,
        getStatus,
        showBanner,
        hideBanner,
        dismiss,
        resetDismissed,
        renderCompact,
        isSupported: () => isSupported,
        getUsage: () => currentUsage,
        getQuota: () => currentQuota,
        getPercent: () => usagePercent,
        getLevel: () => warningLevel,
        formatBytes,
        subscribe
    };
})();

if (typeof window !== 'undefined') {
    window.StorageMonitorModule = StorageMonitorModule;
}
