/**
 * GridDown Landmark Module
 * Manages downloadable landmark packs for offline search and rangefinder resection
 * 
 * Data Sources (all US Federal Government - Public Domain):
 * - USGS GNIS: Geographic Names Information System (peaks, summits, features)
 * - FAA DOF: Digital Obstacle File (towers, antennas)
 * - NGS: National Geodetic Survey benchmarks
 * 
 * Legal Status: 
 * US Federal Government works are not eligible for copyright (17 USC § 105)
 * No attribution required, though provided as good practice
 * Commercial use permitted without restriction
 */
const LandmarkModule = (function() {
    'use strict';

    // Landmark types with icons and colors
    const LANDMARK_TYPES = {
        summit: { label: 'Summit/Peak', icon: '🏔️', color: '#8b5cf6' },
        tower: { label: 'Tower', icon: '📡', color: '#f59e0b' },
        benchmark: { label: 'Survey Marker', icon: '📍', color: '#ef4444' },
        lookout: { label: 'Fire Lookout', icon: '🔭', color: '#22c55e' },
        dam: { label: 'Dam', icon: '🌊', color: '#3b82f6' },
        bridge: { label: 'Bridge', icon: '🌉', color: '#6b7280' },
        building: { label: 'Building', icon: '🏛️', color: '#a855f7' },
        tank: { label: 'Water Tank', icon: '🛢️', color: '#06b6d4' },
        mine: { label: 'Mine', icon: '⛏️', color: '#78716c' },
        spring: { label: 'Spring', icon: '💧', color: '#0ea5e9' },
        lake: { label: 'Lake', icon: '🏞️', color: '#0284c7' },
        cliff: { label: 'Cliff', icon: '🪨', color: '#a16207' },
        other: { label: 'Landmark', icon: '📌', color: '#6b7280' }
    };

    // Available landmark packs (metadata)
    const AVAILABLE_PACKS = [
        {
            id: 'us-california-peaks',
            name: 'California Peaks',
            region: 'US-CA',
            description: 'Major peaks and summits in California',
            source: 'USGS GNIS',
            landmarkCount: 847,
            sizeKB: 95,
            version: '2025.01'
        },
        {
            id: 'us-california-towers',
            name: 'California Towers',
            region: 'US-CA', 
            description: 'FAA-registered towers and antennas in California',
            source: 'FAA DOF',
            landmarkCount: 2134,
            sizeKB: 180,
            version: '2025.01'
        },
        {
            id: 'us-nevada-peaks',
            name: 'Nevada Peaks',
            region: 'US-NV',
            description: 'Major peaks and summits in Nevada',
            source: 'USGS GNIS',
            landmarkCount: 412,
            sizeKB: 48,
            version: '2025.01'
        },
        {
            id: 'us-colorado-14ers',
            name: 'Colorado 14ers & Peaks',
            region: 'US-CO',
            description: 'Fourteeners and major peaks in Colorado',
            source: 'USGS GNIS',
            landmarkCount: 634,
            sizeKB: 72,
            version: '2025.01'
        },
        {
            id: 'us-western-lookouts',
            name: 'Western Fire Lookouts',
            region: 'US-West',
            description: 'USFS fire lookout towers in western states',
            source: 'USFS',
            landmarkCount: 523,
            sizeKB: 58,
            version: '2025.01'
        }
    ];

    // Sample landmark data (embedded for demo - normally downloaded)
    // This is a curated subset representing the data structure
    const SAMPLE_LANDMARKS = [
        // California Peaks (USGS GNIS - Public Domain)
        { id: 'gnis_1656071', name: 'Mount Whitney', type: 'summit', lat: 36.5785, lon: -118.2923, elevation: 4421, prominence: 3071, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1652734', name: 'Mount Shasta', type: 'summit', lat: 41.4092, lon: -122.1949, elevation: 4322, prominence: 2977, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1657550', name: 'White Mountain Peak', type: 'summit', lat: 37.6342, lon: -118.2558, elevation: 4344, prominence: 2320, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1652451', name: 'Mount Williamson', type: 'summit', lat: 36.6561, lon: -118.3114, elevation: 4382, prominence: 403, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1654602', name: 'North Palisade', type: 'summit', lat: 37.0944, lon: -118.5153, elevation: 4341, prominence: 343, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1660897', name: 'Mount Langley', type: 'summit', lat: 36.5231, lon: -118.2408, elevation: 4275, prominence: 285, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1656855', name: 'Mount Muir', type: 'summit', lat: 36.5614, lon: -118.2869, elevation: 4271, prominence: 85, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1652108', name: 'Split Mountain', type: 'summit', lat: 37.0250, lon: -118.4208, elevation: 4287, prominence: 329, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1661034', name: 'Mount Tyndall', type: 'summit', lat: 36.6317, lon: -118.3317, elevation: 4275, prominence: 213, source: 'USGS GNIS', region: 'US-CA' },
        { id: 'gnis_1652734b', name: 'Mount Sill', type: 'summit', lat: 37.0939, lon: -118.5028, elevation: 4317, prominence: 189, source: 'USGS GNIS', region: 'US-CA' },
        
        // Nevada Peaks (USGS GNIS - Public Domain)
        { id: 'gnis_nv_boundary', name: 'Boundary Peak', type: 'summit', lat: 37.8461, lon: -118.3511, elevation: 4005, prominence: 466, source: 'USGS GNIS', region: 'US-NV' },
        { id: 'gnis_nv_wheeler', name: 'Wheeler Peak', type: 'summit', lat: 38.9858, lon: -114.3139, elevation: 3982, prominence: 1775, source: 'USGS GNIS', region: 'US-NV' },
        { id: 'gnis_nv_charleston', name: 'Charleston Peak', type: 'summit', lat: 36.2717, lon: -115.6944, elevation: 3633, prominence: 2524, source: 'USGS GNIS', region: 'US-NV' },
        
        // Sample Towers (FAA DOF - Public Domain)
        { id: 'faa_ca_001', name: 'KRLA-AM Tower', type: 'tower', lat: 34.0891, lon: -117.8234, elevation: 280, height: 195, source: 'FAA DOF', region: 'US-CA' },
        { id: 'faa_ca_002', name: 'Mt Wilson Radio Tower', type: 'tower', lat: 34.2261, lon: -118.0558, elevation: 1740, height: 91, source: 'FAA DOF', region: 'US-CA' },
        { id: 'faa_ca_003', name: 'Sutro Tower', type: 'tower', lat: 37.7552, lon: -122.4528, elevation: 282, height: 298, source: 'FAA DOF', region: 'US-CA' },
        
        // Sample Fire Lookouts (USFS - Public Domain)
        { id: 'usfs_lookout_001', name: 'Keller Peak Lookout', type: 'lookout', lat: 34.2117, lon: -117.0825, elevation: 2316, source: 'USFS', region: 'US-CA' },
        { id: 'usfs_lookout_002', name: 'Black Mountain Lookout', type: 'lookout', lat: 33.4917, lon: -116.7881, elevation: 1767, source: 'USFS', region: 'US-CA' },
        
        // Sample Benchmarks (NGS - Public Domain)
        { id: 'ngs_ca_001', name: 'WHITNEY', type: 'benchmark', lat: 36.5785, lon: -118.2922, elevation: 4418, accuracy: 0.01, source: 'NGS', region: 'US-CA' },
        { id: 'ngs_ca_002', name: 'SHASTA', type: 'benchmark', lat: 41.4090, lon: -122.1947, elevation: 4317, accuracy: 0.01, source: 'NGS', region: 'US-CA' }
    ];

    // State
    let installedPacks = [];  // List of installed pack IDs
    let landmarks = [];       // All loaded landmarks
    let landmarkIndex = {};   // Index by ID for fast lookup
    let initialized = false;

    /**
     * Initialize the landmark module
     */
    function init() {
        if (initialized) return;
        
        loadInstalledPacks();
        loadLandmarks();
        
        // Always include sample landmarks for demo
        if (landmarks.length === 0) {
            landmarks = [...SAMPLE_LANDMARKS];
            buildIndex();
        }
        
        initialized = true;
        console.log(`Landmark module initialized with ${landmarks.length} landmarks`);
    }

    /**
     * Build search index
     */
    function buildIndex() {
        landmarkIndex = {};
        landmarks.forEach(lm => {
            landmarkIndex[lm.id] = lm;
        });
    }

    /**
     * Load installed packs from storage
     */
    function loadInstalledPacks() {
        try {
            const saved = localStorage.getItem('griddown_landmark_packs');
            if (saved) {
                installedPacks = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load landmark packs:', e);
            installedPacks = [];
        }
    }

    /**
     * Save installed packs to storage
     */
    function saveInstalledPacks() {
        try {
            localStorage.setItem('griddown_landmark_packs', JSON.stringify(installedPacks));
        } catch (e) {
            console.warn('Failed to save landmark packs:', e);
        }
    }

    /**
     * Load landmarks from storage
     */
    function loadLandmarks() {
        try {
            const saved = localStorage.getItem('griddown_landmarks');
            if (saved) {
                landmarks = JSON.parse(saved);
                buildIndex();
            }
        } catch (e) {
            console.warn('Failed to load landmarks:', e);
            landmarks = [];
        }
    }

    /**
     * Save landmarks to storage
     */
    function saveLandmarks() {
        try {
            localStorage.setItem('griddown_landmarks', JSON.stringify(landmarks));
        } catch (e) {
            console.warn('Failed to save landmarks:', e);
        }
    }

    /**
     * Search landmarks by query
     * @param {string} query - Search query
     * @param {object} options - Search options (limit, region, type)
     * @returns {Array} Matching landmarks with scores
     */
    function search(query, options = {}) {
        const {
            limit = 20,
            region = null,
            type = null,
            nearLat = null,
            nearLon = null,
            radiusKm = null
        } = options;
        
        if (!query || query.length < 2) return [];
        
        const lowerQuery = query.toLowerCase().trim();
        const results = [];
        
        for (const landmark of landmarks) {
            // Apply filters
            if (region && landmark.region !== region) continue;
            if (type && landmark.type !== type) continue;
            
            // Calculate distance filter if specified
            if (nearLat !== null && nearLon !== null && radiusKm !== null) {
                const dist = haversineDistance(nearLat, nearLon, landmark.lat, landmark.lon);
                if (dist > radiusKm * 1000) continue;
            }
            
            // Calculate match score
            const score = calculateLandmarkScore(landmark, lowerQuery);
            
            if (score > 0) {
                results.push({
                    ...landmark,
                    score,
                    typeInfo: LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other
                });
            }
        }
        
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        
        return results.slice(0, limit);
    }

    /**
     * Calculate match score for a landmark
     */
    function calculateLandmarkScore(landmark, query) {
        const name = landmark.name.toLowerCase();
        
        // Exact match
        if (name === query) return 100;
        
        // Starts with
        if (name.startsWith(query)) return 90;
        
        // Word starts with
        const words = name.split(/\s+/);
        if (words.some(w => w.startsWith(query))) return 80;
        
        // Contains
        if (name.includes(query)) return 60;
        
        // Check source/region
        if (landmark.source && landmark.source.toLowerCase().includes(query)) return 30;
        if (landmark.region && landmark.region.toLowerCase().includes(query)) return 20;
        
        return 0;
    }

    /**
     * Haversine distance calculation
     */
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Get landmarks near a location
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} radiusKm - Search radius in kilometers
     * @returns {Array} Nearby landmarks sorted by distance
     */
    function getNearby(lat, lon, radiusKm = 50) {
        const results = [];
        
        for (const landmark of landmarks) {
            const dist = haversineDistance(lat, lon, landmark.lat, landmark.lon);
            if (dist <= radiusKm * 1000) {
                results.push({
                    ...landmark,
                    distance: dist,
                    distanceKm: dist / 1000,
                    distanceMi: dist / 1609.34,
                    bearing: calculateBearing(lat, lon, landmark.lat, landmark.lon),
                    typeInfo: LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other
                });
            }
        }
        
        // Sort by distance
        results.sort((a, b) => a.distance - b.distance);
        
        return results;
    }

    /**
     * Calculate bearing from point A to point B
     */
    function calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360;
        
        return bearing;
    }

    /**
     * Get a landmark by ID
     */
    function getById(id) {
        return landmarkIndex[id] || null;
    }

    /**
     * Get all landmarks
     */
    function getAll() {
        return [...landmarks];
    }

    /**
     * Get landmark count
     */
    function getCount() {
        return landmarks.length;
    }

    /**
     * Get available packs
     */
    function getAvailablePacks() {
        return AVAILABLE_PACKS.map(pack => ({
            ...pack,
            installed: installedPacks.includes(pack.id)
        }));
    }

    /**
     * Get installed packs
     */
    function getInstalledPacks() {
        return AVAILABLE_PACKS.filter(p => installedPacks.includes(p.id));
    }

    /**
     * Install a landmark pack (simulated - would download from server)
     * @param {string} packId - Pack ID to install
     * @returns {Promise} Resolves when installed
     */
    async function installPack(packId) {
        const pack = AVAILABLE_PACKS.find(p => p.id === packId);
        if (!pack) {
            throw new Error(`Pack not found: ${packId}`);
        }
        
        if (installedPacks.includes(packId)) {
            console.log(`Pack already installed: ${packId}`);
            return { success: true, message: 'Already installed' };
        }
        
        // Simulate download delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // In production, this would fetch from a CDN:
        // const response = await fetch(`/landmarks/${packId}.json`);
        // const packData = await response.json();
        
        // For now, use sample data filtered by region
        const packLandmarks = SAMPLE_LANDMARKS.filter(lm => {
            if (packId.includes('california') && lm.region === 'US-CA') return true;
            if (packId.includes('nevada') && lm.region === 'US-NV') return true;
            return false;
        });
        
        // Add to landmarks (avoiding duplicates)
        packLandmarks.forEach(lm => {
            if (!landmarkIndex[lm.id]) {
                landmarks.push(lm);
                landmarkIndex[lm.id] = lm;
            }
        });
        
        // Mark as installed
        installedPacks.push(packId);
        saveInstalledPacks();
        saveLandmarks();
        
        console.log(`Installed pack ${packId} with ${packLandmarks.length} landmarks`);
        
        return { 
            success: true, 
            message: `Installed ${pack.name}`,
            count: packLandmarks.length
        };
    }

    /**
     * Uninstall a landmark pack
     */
    function uninstallPack(packId) {
        const pack = AVAILABLE_PACKS.find(p => p.id === packId);
        if (!pack) return false;
        
        // Remove from installed list
        installedPacks = installedPacks.filter(id => id !== packId);
        saveInstalledPacks();
        
        // Remove landmarks from this pack's region (simplified)
        // In production, landmarks would be tagged with their source pack
        const regionMatch = packId.match(/us-(\w+)/);
        if (regionMatch) {
            const region = `US-${regionMatch[1].toUpperCase()}`;
            landmarks = landmarks.filter(lm => lm.region !== region);
            buildIndex();
            saveLandmarks();
        }
        
        return true;
    }

    /**
     * Import landmarks from GPX file
     * @param {string} gpxContent - GPX file content
     * @returns {object} Import result
     */
    function importFromGPX(gpxContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(gpxContent, 'text/xml');
            
            const waypoints = doc.querySelectorAll('wpt');
            const imported = [];
            
            waypoints.forEach((wpt, index) => {
                const lat = parseFloat(wpt.getAttribute('lat'));
                const lon = parseFloat(wpt.getAttribute('lon'));
                const name = wpt.querySelector('name')?.textContent || `Waypoint ${index + 1}`;
                const ele = wpt.querySelector('ele')?.textContent;
                const desc = wpt.querySelector('desc')?.textContent;
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    const landmark = {
                        id: `gpx_${Date.now()}_${index}`,
                        name: name,
                        type: 'other',
                        lat: lat,
                        lon: lon,
                        elevation: ele ? parseFloat(ele) : null,
                        description: desc,
                        source: 'GPX Import',
                        region: 'custom'
                    };
                    
                    if (!landmarkIndex[landmark.id]) {
                        landmarks.push(landmark);
                        landmarkIndex[landmark.id] = landmark;
                        imported.push(landmark);
                    }
                }
            });
            
            if (imported.length > 0) {
                saveLandmarks();
            }
            
            return {
                success: true,
                count: imported.length,
                landmarks: imported
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    }

    /**
     * Add landmark to rangefinder resection
     */
    function addToResection(landmarkId) {
        const landmark = landmarkIndex[landmarkId];
        if (!landmark) return false;
        
        if (typeof RangefinderModule !== 'undefined') {
            RangefinderModule.addLandmark({
                id: landmark.id,
                name: landmark.name,
                position: { lat: landmark.lat, lon: landmark.lon },
                elevation: landmark.elevation,
                source: 'landmark_pack',
                icon: LANDMARK_TYPES[landmark.type]?.icon || '📌'
            });
            return true;
        }
        
        return false;
    }

    /**
     * Convert landmark to waypoint
     */
    function saveAsWaypoint(landmarkId) {
        const landmark = landmarkIndex[landmarkId];
        if (!landmark) return null;
        
        const typeInfo = LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other;
        
        const waypoint = {
            id: `wp_${Date.now()}`,
            name: landmark.name,
            lat: landmark.lat,
            lon: landmark.lon,
            type: 'custom',
            elevation: landmark.elevation,
            notes: `From ${landmark.source}. ${landmark.description || ''}`.trim(),
            icon: typeInfo.icon,
            visibility: 'private',
            createdAt: new Date().toISOString()
        };
        
        // Add to state
        if (typeof State !== 'undefined' && State.Waypoints) {
            State.Waypoints.add(waypoint);
            return waypoint;
        }
        
        return null;
    }

    /**
     * Get landmark types
     */
    function getTypes() {
        return { ...LANDMARK_TYPES };
    }

    /**
     * Get statistics
     */
    function getStats() {
        const byType = {};
        const byRegion = {};
        const bySource = {};
        
        landmarks.forEach(lm => {
            byType[lm.type] = (byType[lm.type] || 0) + 1;
            byRegion[lm.region] = (byRegion[lm.region] || 0) + 1;
            bySource[lm.source] = (bySource[lm.source] || 0) + 1;
        });
        
        return {
            total: landmarks.length,
            installedPacks: installedPacks.length,
            byType,
            byRegion,
            bySource
        };
    }

    /**
     * Clear all landmarks (reset)
     */
    function clearAll() {
        landmarks = [];
        landmarkIndex = {};
        installedPacks = [];
        saveInstalledPacks();
        saveLandmarks();
    }

    // Public API
    return {
        init,
        search,
        getNearby,
        getById,
        getAll,
        getCount,
        getAvailablePacks,
        getInstalledPacks,
        installPack,
        uninstallPack,
        importFromGPX,
        addToResection,
        saveAsWaypoint,
        getTypes,
        getStats,
        clearAll,
        LANDMARK_TYPES
    };
})();

// Auto-initialize
if (typeof window !== 'undefined') {
    window.LandmarkModule = LandmarkModule;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => LandmarkModule.init());
    } else {
        LandmarkModule.init();
    }
}
