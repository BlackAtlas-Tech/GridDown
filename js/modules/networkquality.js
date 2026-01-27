/**
 * GridDown Network Quality Module
 * Monitors network quality and displays connection speed/type indicators
 * 
 * Uses: Network Information API, latency measurements
 * Shows: Connection type, effective speed, latency estimate
 */
const NetworkQualityModule = (function() {
    'use strict';

    // ==================== CONSTANTS ====================
    
    const TEST_INTERVAL_MS = 60 * 1000; // 60 seconds
    const LATENCY_SAMPLES = 3;
    
    const QUALITY_LEVELS = {
        EXCELLENT: { minSpeed: 10, maxLatency: 50, label: 'Excellent', color: '#22c55e', bars: 4 },
        GOOD: { minSpeed: 4, maxLatency: 100, label: 'Good', color: '#84cc16', bars: 3 },
        FAIR: { minSpeed: 1, maxLatency: 300, label: 'Fair', color: '#fbbf24', bars: 2 },
        POOR: { minSpeed: 0, maxLatency: 1000, label: 'Poor', color: '#ef4444', bars: 1 }
    };

    // ==================== STATE ====================
    
    let isOnline = navigator.onLine;
    let hasNetworkInfoAPI = false;
    let connectionType = null;      // wifi, cellular, ethernet, etc.
    let effectiveType = null;       // slow-2g, 2g, 3g, 4g
    let downlink = null;            // Mbps (from API)
    let rtt = null;                 // ms (from API)
    let measuredLatency = null;     // ms (measured)
    let quality = 'unknown';
    let lastMeasurement = null;
    let testInterval = null;
    let subscribers = [];

    // ==================== CORE ====================
    
    function init() {
        isOnline = navigator.onLine;
        hasNetworkInfoAPI = 'connection' in navigator;
        
        // Setup event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Network Information API
        if (hasNetworkInfoAPI) {
            const conn = navigator.connection;
            updateFromAPI(conn);
            conn.addEventListener('change', () => {
                updateFromAPI(conn);
                notifySubscribers('change', getState());
            });
        }
        
        // Initial measurement if online
        if (isOnline) {
            measureLatency();
        }
        
        console.log('NetworkQualityModule initialized, online:', isOnline, 'API:', hasNetworkInfoAPI);
        return true;
    }
    
    function updateFromAPI(conn) {
        connectionType = conn.type || null;
        effectiveType = conn.effectiveType || null;
        downlink = conn.downlink || null;
        rtt = conn.rtt || null;
        
        updateQuality();
    }
    
    function handleOnline() {
        isOnline = true;
        quality = 'unknown';
        measureLatency();
        notifySubscribers('online', getState());
    }
    
    function handleOffline() {
        isOnline = false;
        quality = 'offline';
        measuredLatency = null;
        stopPeriodicMeasurement();
        notifySubscribers('offline', getState());
    }
    
    async function measureLatency() {
        if (!isOnline) return null;
        
        const samples = [];
        
        for (let i = 0; i < LATENCY_SAMPLES; i++) {
            try {
                const start = performance.now();
                await fetch('manifest.json', { method: 'HEAD', cache: 'no-store' });
                const end = performance.now();
                samples.push(end - start);
            } catch (e) {
                // Request failed
            }
        }
        
        if (samples.length > 0) {
            samples.sort((a, b) => a - b);
            measuredLatency = samples[Math.floor(samples.length / 2)]; // median
            lastMeasurement = Date.now();
            updateQuality();
            notifySubscribers('measured', getState());
        }
        
        return measuredLatency;
    }
    
    function updateQuality() {
        if (!isOnline) {
            quality = 'offline';
            return;
        }
        
        // Use effective type if available
        if (effectiveType) {
            const mapping = { 'slow-2g': 'poor', '2g': 'poor', '3g': 'fair', '4g': 'good' };
            quality = mapping[effectiveType] || 'unknown';
            
            // Upgrade to excellent for 4g with low latency
            if (effectiveType === '4g' && (rtt || measuredLatency) < 50) {
                quality = 'excellent';
            }
            return;
        }
        
        // Use downlink speed
        if (downlink !== null) {
            if (downlink >= 10) quality = 'excellent';
            else if (downlink >= 4) quality = 'good';
            else if (downlink >= 1) quality = 'fair';
            else quality = 'poor';
            return;
        }
        
        // Use measured latency
        if (measuredLatency !== null) {
            if (measuredLatency < 50) quality = 'excellent';
            else if (measuredLatency < 100) quality = 'good';
            else if (measuredLatency < 300) quality = 'fair';
            else quality = 'poor';
            return;
        }
        
        quality = 'unknown';
    }
    
    function startPeriodicMeasurement() {
        if (testInterval) return;
        testInterval = setInterval(() => {
            if (isOnline) measureLatency();
        }, TEST_INTERVAL_MS);
    }
    
    function stopPeriodicMeasurement() {
        if (testInterval) {
            clearInterval(testInterval);
            testInterval = null;
        }
    }
    
    function getState() {
        return {
            isOnline,
            quality,
            connectionType,
            effectiveType,
            downlink,
            rtt,
            measuredLatency,
            lastMeasurement,
            hasNetworkInfoAPI
        };
    }

    // ==================== UI ====================
    
    function getQualityConfig() {
        if (quality === 'offline') {
            return { label: 'Offline', color: '#6b7280', bars: 0, icon: '📴' };
        }
        if (quality === 'unknown') {
            return { label: 'Unknown', color: '#6b7280', bars: 0, icon: '❓' };
        }
        
        const configs = {
            excellent: { label: 'Excellent', color: '#22c55e', bars: 4, icon: '📶' },
            good: { label: 'Good', color: '#84cc16', bars: 3, icon: '📶' },
            fair: { label: 'Fair', color: '#fbbf24', bars: 2, icon: '📶' },
            poor: { label: 'Poor', color: '#ef4444', bars: 1, icon: '📶' }
        };
        
        return configs[quality] || configs.poor;
    }
    
    function renderSignalBars(bars, color) {
        const heights = [5, 8, 11, 14];
        let svg = '<svg width="16" height="14" viewBox="0 0 16 14">';
        
        for (let i = 0; i < 4; i++) {
            const x = i * 4;
            const h = heights[i];
            const y = 14 - h;
            const fill = i < bars ? color : 'rgba(255,255,255,0.2)';
            svg += `<rect x="${x}" y="${y}" width="3" height="${h}" rx="1" fill="${fill}"/>`;
        }
        
        svg += '</svg>';
        return svg;
    }
    
    function renderCompact() {
        const cfg = getQualityConfig();
        const latency = rtt || measuredLatency;
        const latencyStr = latency ? `${Math.round(latency)}ms` : '';
        
        let speedStr = '';
        if (downlink) {
            speedStr = downlink >= 1 ? `${downlink.toFixed(1)}Mbps` : `${Math.round(downlink * 1000)}Kbps`;
        }
        
        let typeStr = '';
        if (effectiveType && effectiveType !== 'unknown') {
            typeStr = effectiveType.toUpperCase();
        } else if (connectionType) {
            typeStr = connectionType.charAt(0).toUpperCase() + connectionType.slice(1);
        }
        
        const details = [typeStr, speedStr, latencyStr].filter(Boolean).join(' • ');
        
        return `
            <div style="display:flex;align-items:center;gap:8px;font-size:11px">
                <div style="display:flex;align-items:center;gap:4px">
                    ${renderSignalBars(cfg.bars, cfg.color)}
                    <span style="color:${cfg.color};font-weight:500">${cfg.label}</span>
                </div>
                ${details ? `<span style="color:rgba(255,255,255,0.5)">${details}</span>` : ''}
            </div>
        `;
    }
    
    function renderDetailed() {
        const cfg = getQualityConfig();
        const state = getState();
        
        return `
            <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:12px;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                    ${renderSignalBars(cfg.bars, cfg.color)}
                    <span style="font-size:14px;font-weight:600;color:${cfg.color}">${cfg.label}</span>
                    <button id="nq-refresh" style="margin-left:auto;padding:4px 8px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:11px">
                        🔄 Test
                    </button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:11px">
                    <div style="padding:6px;background:rgba(0,0,0,0.2);border-radius:4px">
                        <div style="color:rgba(255,255,255,0.5)">Type</div>
                        <div>${state.effectiveType?.toUpperCase() || state.connectionType || '--'}</div>
                    </div>
                    <div style="padding:6px;background:rgba(0,0,0,0.2);border-radius:4px">
                        <div style="color:rgba(255,255,255,0.5)">Speed</div>
                        <div>${state.downlink ? state.downlink.toFixed(1) + ' Mbps' : '--'}</div>
                    </div>
                    <div style="padding:6px;background:rgba(0,0,0,0.2);border-radius:4px">
                        <div style="color:rgba(255,255,255,0.5)">Latency</div>
                        <div>${state.rtt || state.measuredLatency ? Math.round(state.rtt || state.measuredLatency) + ' ms' : '--'}</div>
                    </div>
                    <div style="padding:6px;background:rgba(0,0,0,0.2);border-radius:4px">
                        <div style="color:rgba(255,255,255,0.5)">Status</div>
                        <div style="color:${state.isOnline ? '#22c55e' : '#ef4444'}">${state.isOnline ? 'Online' : 'Offline'}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function attachHandlers(container) {
        const btn = container.querySelector('#nq-refresh');
        if (btn) {
            btn.onclick = async () => {
                btn.disabled = true;
                btn.textContent = '⏳...';
                await measureLatency();
                btn.disabled = false;
                btn.textContent = '🔄 Test';
            };
        }
    }
    
    function renderBadge() {
        const cfg = getQualityConfig();
        return `
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:rgba(0,0,0,0.3);border-radius:10px;font-size:10px">
                ${renderSignalBars(cfg.bars, cfg.color)}
            </span>
        `;
    }

    // ==================== UTILITIES ====================
    
    function estimateTileLoadTime(sizeKB = 50) {
        if (!isOnline) return null;
        
        if (downlink) {
            const bps = downlink * 1000000;
            const bytes = sizeKB * 1024;
            return Math.round((bytes * 8 / bps) * 1000);
        }
        
        // Estimates based on quality
        const estimates = { excellent: 100, good: 300, fair: 800, poor: 2000, unknown: 500 };
        return estimates[quality] || 500;
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
        measureLatency,
        getState,
        getQualityConfig,
        
        // State
        isOnline: () => isOnline,
        getQuality: () => quality,
        getConnectionType: () => connectionType,
        getEffectiveType: () => effectiveType,
        getDownlink: () => downlink,
        getLatency: () => rtt || measuredLatency,
        
        // UI
        renderCompact,
        renderDetailed,
        renderBadge,
        renderSignalBars,
        attachHandlers,
        
        // Utilities
        estimateTileLoadTime,
        startPeriodicMeasurement,
        stopPeriodicMeasurement,
        subscribe
    };
})();

if (typeof window !== 'undefined') {
    window.NetworkQualityModule = NetworkQualityModule;
}
