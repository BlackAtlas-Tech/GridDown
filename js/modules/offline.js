/**
 * GridDown Offline Module - Map Tile Download & Management
 * Downloads map tiles for offline use with progress tracking
 * Supports background sync for downloads that continue when app is backgrounded
 */
const OfflineModule = (function() {
    'use strict';

    // Constants
    const TILE_SIZE = 256;
    const TILE_CACHE_NAME = 'griddown-tiles-v1';
    const REGIONS_STORE = 'offlineRegions';
    const SYNC_QUEUE_STORE = 'syncQueue';
    const MAX_CONCURRENT_DOWNLOADS = 6;
    const SYNC_TAG = 'griddown-tile-sync';
    const PERIODIC_SYNC_TAG = 'griddown-periodic-sync';
    
    // Tile server URLs (matching map.js)
    // NOTE: Esri basemaps removed for commercial licensing compliance
    const TILE_SERVERS = {
        // General (global coverage)
        standard: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        terrain: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
        // USGS (US coverage only - public domain)
        usgs_topo: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
        usgs_imagery: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
        usgs_imagery_topo: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
        usgs_hydro: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}',
        // BLM (US coverage only - public domain)
        blm_surface: 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_with_PriUnk/MapServer/tile/{z}/{y}/{x}'
    };
    
    // Layer metadata for UI
    const LAYER_INFO = {
        standard: { name: 'OpenStreetMap', size: 15, category: 'general' },
        terrain: { name: 'OpenTopoMap', size: 25, category: 'general' },
        usgs_topo: { name: 'USGS Topo', size: 30, category: 'usgs' },
        usgs_imagery: { name: 'USGS Imagery', size: 45, category: 'usgs' },
        usgs_imagery_topo: { name: 'USGS Imagery+Topo', size: 50, category: 'usgs' },
        usgs_hydro: { name: 'USGS Hydro', size: 10, category: 'usgs' },
        blm_surface: { name: 'BLM Surface Mgmt', size: 15, category: 'blm' }
    };

    // State
    let isDownloading = false;
    let currentDownload = null;
    let downloadQueue = [];
    let downloadedCount = 0;
    let totalTiles = 0;
    let downloadErrors = 0;
    let abortController = null;
    let backgroundSyncSupported = false;
    let periodicSyncSupported = false;

    // Region drawing state
    let isDrawing = false;
    let drawStart = null;
    let drawEnd = null;
    let drawCallback = null;

    /**
     * Initialize the module
     */
    async function init() {
        // Load saved regions from storage
        await loadRegions();
        
        // Check for background sync support
        await checkSyncSupport();
        
        // Check for pending sync queue and resume if needed
        await checkPendingSync();
        
        // Listen for sync complete messages from service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleSWMessage);
        }
        
        console.log('OfflineModule initialized', {
            backgroundSync: backgroundSyncSupported,
            periodicSync: periodicSyncSupported
        });
    }
    
    /**
     * Check if background sync APIs are supported
     */
    async function checkSyncSupport() {
        try {
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
                const registration = await navigator.serviceWorker.ready;
                backgroundSyncSupported = 'sync' in registration;
            }
        } catch (e) {
            backgroundSyncSupported = false;
        }
        
        try {
            if ('serviceWorker' in navigator && 'PeriodicSyncManager' in window) {
                const registration = await navigator.serviceWorker.ready;
                periodicSyncSupported = 'periodicSync' in registration;
                
                // Check permission
                const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                periodicSyncSupported = periodicSyncSupported && status.state === 'granted';
            }
        } catch (e) {
            periodicSyncSupported = false;
        }
    }
    
    /**
     * Handle messages from service worker
     */
    function handleSWMessage(event) {
        const { type, data } = event.data || {};
        
        switch (type) {
            case 'SYNC_PROGRESS':
                Events.emit('offline:syncProgress', data);
                break;
            case 'SYNC_COMPLETE':
                Events.emit('offline:syncComplete', data);
                loadRegions(); // Refresh regions
                break;
            case 'SYNC_ERROR':
                Events.emit('offline:syncError', data);
                break;
        }
    }
    
    /**
     * Check for pending downloads in queue and offer to resume
     */
    async function checkPendingSync() {
        try {
            const queue = await Storage.Settings.get(SYNC_QUEUE_STORE, null);
            if (queue && queue.tiles && queue.tiles.length > 0) {
                Events.emit('offline:pendingSync', {
                    regionName: queue.regionName,
                    remaining: queue.tiles.length,
                    total: queue.totalTiles
                });
            }
        } catch (e) {
            console.warn('Error checking pending sync:', e);
        }
    }

    /**
     * Calculate tiles needed for a bounding box at given zoom levels
     */
    function calculateTiles(bounds, minZoom, maxZoom) {
        const tiles = [];
        
        for (let z = minZoom; z <= maxZoom; z++) {
            const minTile = latLonToTile(bounds.north, bounds.west, z);
            const maxTile = latLonToTile(bounds.south, bounds.east, z);
            
            for (let x = minTile.x; x <= maxTile.x; x++) {
                for (let y = minTile.y; y <= maxTile.y; y++) {
                    tiles.push({ x, y, z });
                }
            }
        }
        
        return tiles;
    }

    /**
     * Convert lat/lon to tile coordinates
     */
    function latLonToTile(lat, lon, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lon + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
    }

    /**
     * Convert tile coordinates to lat/lon bounds
     */
    function tileToBounds(x, y, z) {
        const n = Math.pow(2, z);
        const lonLeft = x / n * 360 - 180;
        const lonRight = (x + 1) / n * 360 - 180;
        const latTop = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
        const latBottom = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
        return { north: latTop, south: latBottom, east: lonRight, west: lonLeft };
    }

    /**
     * Estimate download size for tiles
     * Average tile size varies by layer type
     */
    function estimateSize(tileCount, layers) {
        let totalKB = 0;
        layers.forEach(layer => {
            const info = LAYER_INFO[layer];
            totalKB += tileCount * (info ? info.size : 20);
        });
        return totalKB;
    }
    
    /**
     * Get layers grouped by category
     */
    function getLayersByCategory() {
        const categories = {
            general: { name: 'General Maps', layers: [] },
            usgs: { name: 'USGS (US Geological Survey)', layers: [] },
            usfs: { name: 'USFS (Forest Service)', layers: [] },
            blm: { name: 'BLM (Bureau of Land Management)', layers: [] },
            overlay: { name: 'Overlays', layers: [] }
        };
        
        Object.entries(LAYER_INFO).forEach(([key, info]) => {
            if (categories[info.category]) {
                categories[info.category].layers.push({
                    key,
                    name: info.name,
                    size: info.size
                });
            }
        });
        
        return categories;
    }
    
    /**
     * Get layer info
     */
    function getLayerInfo(layerKey) {
        return LAYER_INFO[layerKey] || null;
    }

    /**
     * Format bytes to human readable
     */
    function formatSize(kb) {
        if (kb < 1024) return `${Math.round(kb)} KB`;
        if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
        return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
    }

    /**
     * Get download preview for a region
     */
    function getDownloadPreview(bounds, minZoom, maxZoom, layers) {
        const tiles = calculateTiles(bounds, minZoom, maxZoom);
        const totalTiles = tiles.length * layers.length;
        const estimatedSize = estimateSize(tiles.length, layers);
        
        // Break down by zoom level
        const byZoom = {};
        for (let z = minZoom; z <= maxZoom; z++) {
            const zoomTiles = calculateTiles(bounds, z, z);
            byZoom[z] = zoomTiles.length * layers.length;
        }
        
        return {
            totalTiles,
            estimatedSize: formatSize(estimatedSize),
            estimatedSizeKB: estimatedSize,
            byZoom,
            layers,
            bounds
        };
    }

    /**
     * Download a region
     */
    async function downloadRegion(regionConfig, progressCallback) {
        if (isDownloading) {
            throw new Error('Download already in progress');
        }

        const { name, bounds, minZoom, maxZoom, layers } = regionConfig;
        
        // Validate
        if (!name || !bounds || !layers || layers.length === 0) {
            throw new Error('Invalid region configuration');
        }

        isDownloading = true;
        downloadedCount = 0;
        downloadErrors = 0;
        abortController = new AbortController();

        // Calculate all tiles needed
        const baseTiles = calculateTiles(bounds, minZoom, maxZoom);
        
        // Build download queue with all layers
        downloadQueue = [];
        layers.forEach(layer => {
            baseTiles.forEach(tile => {
                downloadQueue.push({
                    ...tile,
                    layer,
                    url: TILE_SERVERS[layer]
                        .replace('{z}', tile.z)
                        .replace('{x}', tile.x)
                        .replace('{y}', tile.y)
                });
            });
        });

        totalTiles = downloadQueue.length;

        // Create region record
        const region = {
            id: Helpers.generateId(),
            name,
            bounds,
            minZoom,
            maxZoom,
            layers,
            tileCount: totalTiles,
            estimatedSize: estimateSize(baseTiles.length, layers),
            status: 'downloading',
            progress: 0,
            createdAt: new Date().toISOString(),
            lastSync: null
        };

        currentDownload = region;

        try {
            // Open cache
            const cache = await caches.open(TILE_CACHE_NAME);

            // Download tiles in parallel batches
            const results = await downloadTilesWithProgress(cache, progressCallback);

            // Update region status
            region.status = downloadErrors > 0 ? 'partial' : 'downloaded';
            region.progress = 100;
            region.downloadedTiles = downloadedCount;
            region.failedTiles = downloadErrors;
            region.lastSync = new Date().toISOString();

            // Save region
            await saveRegion(region);

            if (progressCallback) {
                progressCallback({
                    phase: 'complete',
                    downloaded: downloadedCount,
                    total: totalTiles,
                    errors: downloadErrors,
                    region
                });
            }

            return region;

        } catch (err) {
            if (err.name === 'AbortError') {
                region.status = 'cancelled';
                if (progressCallback) {
                    progressCallback({ phase: 'cancelled', downloaded: downloadedCount, total: totalTiles });
                }
            } else {
                region.status = 'error';
                region.error = err.message;
                throw err;
            }
        } finally {
            isDownloading = false;
            currentDownload = null;
            abortController = null;
        }
    }

    /**
     * Download tiles with progress reporting
     */
    async function downloadTilesWithProgress(cache, progressCallback) {
        const queue = [...downloadQueue];
        const activeDownloads = new Set();
        
        return new Promise((resolve, reject) => {
            const processNext = async () => {
                // Check for abort
                if (abortController?.signal.aborted) {
                    reject(new DOMException('Download cancelled', 'AbortError'));
                    return;
                }

                // Get next tile from queue
                if (queue.length === 0) {
                    // Wait for remaining downloads
                    if (activeDownloads.size === 0) {
                        resolve({ downloaded: downloadedCount, errors: downloadErrors });
                    }
                    return;
                }

                // Limit concurrent downloads
                if (activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) {
                    return;
                }

                const tile = queue.shift();
                const downloadId = Symbol();
                activeDownloads.add(downloadId);

                try {
                    const response = await fetch(tile.url, {
                        signal: abortController?.signal,
                        mode: 'cors'
                    });

                    if (response.ok) {
                        await cache.put(tile.url, response.clone());
                        downloadedCount++;
                    } else {
                        downloadErrors++;
                    }
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        downloadErrors++;
                    } else {
                        throw err;
                    }
                } finally {
                    activeDownloads.delete(downloadId);

                    // Report progress
                    if (progressCallback) {
                        const progress = Math.round(((downloadedCount + downloadErrors) / totalTiles) * 100);
                        progressCallback({
                            phase: 'downloading',
                            downloaded: downloadedCount,
                            errors: downloadErrors,
                            total: totalTiles,
                            progress,
                            currentTile: tile
                        });
                    }

                    // Process next
                    processNext();
                }
            };

            // Start initial batch
            for (let i = 0; i < MAX_CONCURRENT_DOWNLOADS && i < queue.length; i++) {
                processNext();
            }
        });
    }

    /**
     * Cancel current download
     */
    function cancelDownload() {
        if (abortController) {
            abortController.abort();
        }
    }

    /**
     * Load saved regions from storage
     */
    async function loadRegions() {
        try {
            const regions = await Storage.Settings.get(REGIONS_STORE, []);
            State.set('mapRegions', regions);
            return regions;
        } catch (err) {
            console.error('Failed to load regions:', err);
            return [];
        }
    }

    /**
     * Save a region to storage
     */
    async function saveRegion(region) {
        const regions = await Storage.Settings.get(REGIONS_STORE, []);
        const existingIndex = regions.findIndex(r => r.id === region.id);
        
        if (existingIndex >= 0) {
            regions[existingIndex] = region;
        } else {
            regions.push(region);
        }
        
        await Storage.Settings.set(REGIONS_STORE, regions);
        State.set('mapRegions', regions);
        return regions;
    }

    /**
     * Delete a region and its cached tiles
     */
    async function deleteRegion(regionId) {
        const regions = await Storage.Settings.get(REGIONS_STORE, []);
        const region = regions.find(r => r.id === regionId);
        
        if (!region) {
            throw new Error('Region not found');
        }

        // Delete tiles from cache
        try {
            const cache = await caches.open(TILE_CACHE_NAME);
            const baseTiles = calculateTiles(region.bounds, region.minZoom, region.maxZoom);
            
            for (const layer of region.layers) {
                for (const tile of baseTiles) {
                    const url = TILE_SERVERS[layer]
                        .replace('{z}', tile.z)
                        .replace('{x}', tile.x)
                        .replace('{y}', tile.y);
                    await cache.delete(url);
                }
            }
        } catch (err) {
            console.warn('Error deleting cached tiles:', err);
        }

        // Remove from storage
        const updatedRegions = regions.filter(r => r.id !== regionId);
        await Storage.Settings.set(REGIONS_STORE, updatedRegions);
        State.set('mapRegions', updatedRegions);
        
        return updatedRegions;
    }

    /**
     * Get storage usage statistics
     */
    async function getStorageStats() {
        try {
            // Try Storage API first
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                return {
                    used: estimate.usage || 0,
                    quota: estimate.quota || 0,
                    usedFormatted: formatSize((estimate.usage || 0) / 1024),
                    quotaFormatted: formatSize((estimate.quota || 0) / 1024),
                    percentUsed: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
                };
            }
            
            // Fallback: estimate from regions
            const regions = State.get('mapRegions') || [];
            const usedKB = regions.reduce((sum, r) => sum + (r.estimatedSize || 0), 0);
            
            return {
                used: usedKB * 1024,
                quota: 0,
                usedFormatted: formatSize(usedKB),
                quotaFormatted: 'Unknown',
                percentUsed: 0
            };
        } catch (err) {
            console.error('Storage estimate failed:', err);
            return { used: 0, quota: 0, usedFormatted: '0 KB', quotaFormatted: 'Unknown', percentUsed: 0 };
        }
    }

    /**
     * Start drawing a region on the map
     */
    function startDrawing(callback) {
        isDrawing = true;
        drawStart = null;
        drawEnd = null;
        drawCallback = callback;
        
        // Update cursor
        const canvas = document.getElementById('map-canvas');
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
        
        // Emit event for map module
        Events.emit('offline:drawStart');
    }

    /**
     * Cancel drawing
     */
    function cancelDrawing() {
        isDrawing = false;
        drawStart = null;
        drawEnd = null;
        drawCallback = null;
        
        const canvas = document.getElementById('map-canvas');
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
        
        Events.emit('offline:drawCancel');
    }

    /**
     * Handle mouse down during drawing
     */
    function handleDrawStart(latLon) {
        if (!isDrawing) return false;
        drawStart = latLon;
        return true;
    }

    /**
     * Handle mouse move during drawing
     */
    function handleDrawMove(latLon) {
        if (!isDrawing || !drawStart) return null;
        drawEnd = latLon;
        
        return {
            north: Math.max(drawStart.lat, drawEnd.lat),
            south: Math.min(drawStart.lat, drawEnd.lat),
            east: Math.max(drawStart.lon, drawEnd.lon),
            west: Math.min(drawStart.lon, drawEnd.lon)
        };
    }

    /**
     * Handle mouse up to complete drawing
     */
    function handleDrawEnd(latLon) {
        if (!isDrawing || !drawStart) return null;
        
        drawEnd = latLon;
        isDrawing = false;
        
        const bounds = {
            north: Math.max(drawStart.lat, drawEnd.lat),
            south: Math.min(drawStart.lat, drawEnd.lat),
            east: Math.max(drawStart.lon, drawEnd.lon),
            west: Math.min(drawStart.lon, drawEnd.lon)
        };
        
        // Validate bounds (minimum size)
        const latDiff = bounds.north - bounds.south;
        const lonDiff = bounds.east - bounds.west;
        
        if (latDiff < 0.001 || lonDiff < 0.001) {
            cancelDrawing();
            return null;
        }
        
        const canvas = document.getElementById('map-canvas');
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
        
        if (drawCallback) {
            drawCallback(bounds);
        }
        
        drawStart = null;
        drawEnd = null;
        drawCallback = null;
        
        Events.emit('offline:drawEnd', { bounds });
        
        return bounds;
    }

    /**
     * Get drawing state
     */
    function getDrawingState() {
        return {
            isDrawing,
            drawStart,
            drawEnd,
            bounds: drawStart && drawEnd ? {
                north: Math.max(drawStart.lat, drawEnd.lat),
                south: Math.min(drawStart.lat, drawEnd.lat),
                east: Math.max(drawStart.lon, drawEnd.lon),
                west: Math.min(drawStart.lon, drawEnd.lon)
            } : null
        };
    }

    /**
     * Check if download is in progress
     */
    function isDownloadInProgress() {
        return isDownloading;
    }

    /**
     * Get current download progress
     */
    function getDownloadProgress() {
        if (!isDownloading) return null;
        return {
            region: currentDownload,
            downloaded: downloadedCount,
            total: totalTiles,
            errors: downloadErrors,
            progress: totalTiles > 0 ? Math.round((downloadedCount / totalTiles) * 100) : 0
        };
    }

    // ========== BACKGROUND SYNC FUNCTIONS ==========

    /**
     * Queue a region for background download
     * Tiles will download even when app is backgrounded or closed
     */
    async function queueBackgroundDownload(regionConfig) {
        if (!backgroundSyncSupported) {
            console.warn('Background sync not supported, falling back to foreground download');
            return { supported: false };
        }

        const { name, bounds, minZoom, maxZoom, layers } = regionConfig;
        
        // Calculate all tiles
        const baseTiles = calculateTiles(bounds, minZoom, maxZoom);
        const allTiles = [];
        
        layers.forEach(layer => {
            baseTiles.forEach(tile => {
                allTiles.push({
                    ...tile,
                    layer,
                    url: TILE_SERVERS[layer]
                        .replace('{z}', tile.z)
                        .replace('{x}', tile.x)
                        .replace('{y}', tile.y)
                });
            });
        });

        // Create region record
        const region = {
            id: Helpers.generateId(),
            name,
            bounds,
            minZoom,
            maxZoom,
            layers,
            tileCount: allTiles.length,
            estimatedSize: estimateSize(baseTiles.length, layers),
            status: 'queued',
            progress: 0,
            downloadedTiles: 0,
            createdAt: new Date().toISOString(),
            lastSync: null
        };

        // Save region
        await saveRegion(region);

        // Save queue to IndexedDB for service worker access
        const queueData = {
            regionId: region.id,
            regionName: name,
            tiles: allTiles,
            totalTiles: allTiles.length,
            downloadedCount: 0,
            errorCount: 0,
            createdAt: new Date().toISOString()
        };
        
        await Storage.Settings.set(SYNC_QUEUE_STORE, queueData);

        // Register sync event
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register(SYNC_TAG);
            
            console.log('Background sync registered for:', name);
            
            Events.emit('offline:syncQueued', { region, tileCount: allTiles.length });
            
            return { 
                supported: true, 
                region, 
                tileCount: allTiles.length,
                message: 'Download will continue in background'
            };
        } catch (err) {
            console.error('Failed to register sync:', err);
            // Fall back to foreground download
            return { supported: false, error: err.message };
        }
    }

    /**
     * Resume a paused/interrupted background download
     */
    async function resumeBackgroundDownload() {
        const queue = await Storage.Settings.get(SYNC_QUEUE_STORE, null);
        
        if (!queue || !queue.tiles || queue.tiles.length === 0) {
            return { success: false, reason: 'No pending download' };
        }

        if (backgroundSyncSupported) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register(SYNC_TAG);
                
                return { 
                    success: true, 
                    remaining: queue.tiles.length,
                    message: 'Background download resumed'
                };
            } catch (err) {
                console.error('Failed to resume sync:', err);
            }
        }

        // Fall back to foreground
        return { success: false, reason: 'Background sync not available' };
    }

    /**
     * Cancel background download and clear queue
     */
    async function cancelBackgroundDownload() {
        try {
            // Clear the queue
            await Storage.Settings.set(SYNC_QUEUE_STORE, null);
            
            // Update region status if exists
            const regions = await Storage.Settings.get(REGIONS_STORE, []);
            const queue = await Storage.Settings.get(SYNC_QUEUE_STORE, null);
            
            if (queue && queue.regionId) {
                const region = regions.find(r => r.id === queue.regionId);
                if (region) {
                    region.status = 'cancelled';
                    await saveRegion(region);
                }
            }
            
            Events.emit('offline:syncCancelled');
            
            return { success: true };
        } catch (err) {
            console.error('Failed to cancel background download:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Get background sync status
     */
    async function getBackgroundSyncStatus() {
        const queue = await Storage.Settings.get(SYNC_QUEUE_STORE, null);
        
        return {
            supported: backgroundSyncSupported,
            periodicSupported: periodicSyncSupported,
            hasPendingSync: !!(queue && queue.tiles && queue.tiles.length > 0),
            pendingTiles: queue?.tiles?.length || 0,
            totalTiles: queue?.totalTiles || 0,
            downloadedCount: queue?.downloadedCount || 0,
            regionName: queue?.regionName || null,
            progress: queue?.totalTiles ? 
                Math.round(((queue.downloadedCount || 0) / queue.totalTiles) * 100) : 0
        };
    }

    /**
     * Register periodic sync for tile freshness checks
     * This will periodically check and update tiles that may have changed
     */
    async function registerPeriodicSync(intervalMinutes = 1440) { // Default: daily
        if (!periodicSyncSupported) {
            console.warn('Periodic background sync not supported');
            return { supported: false };
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.periodicSync.register(PERIODIC_SYNC_TAG, {
                minInterval: intervalMinutes * 60 * 1000
            });
            
            console.log('Periodic sync registered:', intervalMinutes, 'minutes');
            return { supported: true, interval: intervalMinutes };
        } catch (err) {
            console.error('Failed to register periodic sync:', err);
            return { supported: false, error: err.message };
        }
    }

    /**
     * Unregister periodic sync
     */
    async function unregisterPeriodicSync() {
        if (!periodicSyncSupported) return { success: false };
        
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.periodicSync.unregister(PERIODIC_SYNC_TAG);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Check if background sync is supported
     */
    function isBackgroundSyncSupported() {
        return backgroundSyncSupported;
    }

    /**
     * Check if periodic sync is supported
     */
    function isPeriodicSyncSupported() {
        return periodicSyncSupported;
    }

    // Public API
    return {
        init,
        calculateTiles,
        getDownloadPreview,
        downloadRegion,
        cancelDownload,
        deleteRegion,
        loadRegions,
        getStorageStats,
        startDrawing,
        cancelDrawing,
        handleDrawStart,
        handleDrawMove,
        handleDrawEnd,
        getDrawingState,
        isDownloadInProgress,
        getDownloadProgress,
        formatSize,
        // Layer management
        getLayersByCategory,
        getLayerInfo,
        // Background sync
        queueBackgroundDownload,
        resumeBackgroundDownload,
        cancelBackgroundDownload,
        getBackgroundSyncStatus,
        registerPeriodicSync,
        unregisterPeriodicSync,
        isBackgroundSyncSupported,
        isPeriodicSyncSupported,
        // Constants
        SYNC_TAG,
        TILE_CACHE_NAME,
        TILE_SERVERS,
        LAYER_INFO
    };
})();

window.OfflineModule = OfflineModule;
