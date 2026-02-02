/**
 * GridDown CoT Integration Module
 * 
 * Connects to GridDown CoT Bridge to receive Cursor on Target (CoT) data
 * and display team positions, markers, and chat messages from CoT-compatible
 * applications.
 * 
 * LEGAL NOTICE:
 * This is an independent implementation not affiliated with or endorsed by
 * the TAK Product Center, US Government, Department of Defense, MITRE, or
 * any government contractor. References to "TAK", "ATAK", "WinTAK" are for
 * compatibility description only.
 * 
 * This software implements the publicly available Cursor on Target (CoT)
 * XML protocol for interoperability purposes.
 * 
 * Features:
 * - WebSocket connection to CoT Bridge
 * - Display CoT PLI (positions) as team members
 * - Display CoT markers as waypoints
 * - Display CoT GeoChat messages
 * - Auto-reconnect on disconnect
 * - Connection status indicator
 * 
 * @license GPL-3.0
 * @copyright 2025 BlackDot Technology
 */

const TAKModule = (function() {
    'use strict';
    
    // ==========================================================================
    // STATE
    // ==========================================================================
    
    const state = {
        // Connection
        websocket: null,
        bridgeUrl: '',
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: 0,
        reconnectTimer: null,
        
        // Data
        positions: new Map(),      // uid -> position data
        markers: new Map(),        // uid -> marker data
        messages: [],              // Chat messages
        
        // Settings
        enabled: false,
        showOnMap: true,
        showInTeam: true,
        
        // Bidirectional sharing
        sharingEnabled: false,
        sharingConsented: false,   // User has acknowledged privacy warning
        sharingInterval: null,     // Timer for continuous sharing
        sharingIntervalMs: 30000,  // 30 seconds default
        myCallsign: 'GridDown',
        myTeam: 'Cyan',
        myUid: null,
        
        // Stats
        stats: {
            positionsReceived: 0,
            markersReceived: 0,
            messagesReceived: 0,
            positionsSent: 0,
            lastUpdate: null,
            lastTransmit: null
        },
        
        // Callbacks
        onPositionUpdate: null,
        onMarkerUpdate: null,
        onMessageReceived: null,
        onConnectionChange: null
    };
    
    // ==========================================================================
    // CONSTANTS
    // ==========================================================================
    
    const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // ms
    const MAX_MESSAGES = 100;
    const POSITION_STALE_MS = 5 * 60 * 1000; // 5 minutes
    
    // TAK Team colors
    const TEAM_COLORS = {
        'Cyan': '#06b6d4',
        'Green': '#22c55e',
        'Yellow': '#eab308',
        'Red': '#ef4444',
        'Blue': '#3b82f6',
        'Orange': '#f97316',
        'Magenta': '#d946ef',
        'Maroon': '#7f1d1d',
        'Purple': '#9333ea',
        'Teal': '#14b8a6',
        'White': '#ffffff',
        'Dark Blue': '#1e3a8a',
        'Dark Green': '#14532d'
    };
    
    // CoT type to icon mapping
    const COT_ICONS = {
        'a-f-G': '👤',           // Friendly ground
        'a-f-G-U': '👤',         // Friendly ground unit
        'a-f-G-E-V': '🚗',       // Friendly vehicle
        'a-f-A': '✈️',           // Friendly air
        'a-h-G': '⚠️',           // Hostile ground
        'a-n-G': '❓',           // Neutral ground
        'a-u-G': '❔',           // Unknown ground
        'b-m-p-w': '📍',         // Waypoint
        'b-m-p-s-p-i': '📍',     // Point of interest
        'b-m-r': '🔀',           // Route
    };
    
    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================
    
    function init() {
        console.log('TAKModule initializing...');
        
        // Load saved settings
        loadSettings();
        
        // Auto-connect if enabled and URL saved
        if (state.enabled && state.bridgeUrl) {
            connect(state.bridgeUrl);
        }
        
        // Set up periodic cleanup
        setInterval(cleanupStalePositions, 60000);
        
        console.log('TAKModule initialized');
    }
    
    function loadSettings() {
        try {
            const saved = localStorage.getItem('griddown_cot_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                state.bridgeUrl = settings.bridgeUrl || '';
                state.enabled = settings.enabled || false;
                state.showOnMap = settings.showOnMap !== false;
                state.showInTeam = settings.showInTeam !== false;
                state.sharingConsented = settings.sharingConsented || false;
                state.myCallsign = settings.myCallsign || 'GridDown';
                state.myTeam = settings.myTeam || 'Cyan';
                state.sharingIntervalMs = settings.sharingIntervalMs || 30000;
            }
            
            // Generate unique UID if not set
            if (!state.myUid) {
                state.myUid = 'GridDown-' + Math.random().toString(36).substring(2, 10);
            }
        } catch (e) {
            console.warn('Failed to load CoT settings:', e);
        }
    }
    
    function saveSettings() {
        try {
            localStorage.setItem('griddown_cot_settings', JSON.stringify({
                bridgeUrl: state.bridgeUrl,
                enabled: state.enabled,
                showOnMap: state.showOnMap,
                showInTeam: state.showInTeam,
                sharingConsented: state.sharingConsented,
                myCallsign: state.myCallsign,
                myTeam: state.myTeam,
                sharingIntervalMs: state.sharingIntervalMs
            }));
        } catch (e) {
            console.warn('Failed to save CoT settings:', e);
        }
    }
    
    // ==========================================================================
    // WEBSOCKET CONNECTION
    // ==========================================================================
    
    /**
     * Connect to CoT Bridge
     * @param {string} url - WebSocket URL (e.g., ws://192.168.1.100:8765)
     */
    function connect(url) {
        if (state.isConnecting || state.isConnected) {
            console.log('CoT: Already connected or connecting');
            return;
        }
        
        if (!url) {
            console.error('CoT: No bridge URL provided');
            return;
        }
        
        state.bridgeUrl = url;
        state.isConnecting = true;
        state.enabled = true;
        saveSettings();
        
        console.log(`CoT: Connecting to ${url}...`);
        
        try {
            state.websocket = new WebSocket(url);
            
            state.websocket.onopen = handleOpen;
            state.websocket.onclose = handleClose;
            state.websocket.onerror = handleError;
            state.websocket.onmessage = handleMessage;
            
        } catch (e) {
            console.error('CoT: WebSocket creation failed:', e);
            state.isConnecting = false;
            scheduleReconnect();
        }
    }
    
    /**
     * Disconnect from CoT Bridge
     */
    function disconnect() {
        state.enabled = false;
        state.reconnectAttempts = 0;
        
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }
        
        if (state.websocket) {
            state.websocket.close();
            state.websocket = null;
        }
        
        state.isConnected = false;
        state.isConnecting = false;
        
        saveSettings();
        notifyConnectionChange();
        
        console.log('CoT: Disconnected');
    }
    
    function handleOpen() {
        console.log('CoT: Connected to bridge');
        state.isConnected = true;
        state.isConnecting = false;
        state.reconnectAttempts = 0;
        
        notifyConnectionChange();
        
        // Show toast
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast('📡 CoT Bridge connected', 'success');
        }
    }
    
    function handleClose(event) {
        console.log('CoT: Connection closed', event.code, event.reason);
        state.isConnected = false;
        state.isConnecting = false;
        state.websocket = null;
        
        notifyConnectionChange();
        
        // Auto-reconnect if still enabled
        if (state.enabled) {
            scheduleReconnect();
        }
    }
    
    function handleError(error) {
        console.error('CoT: WebSocket error:', error);
        state.isConnecting = false;
    }
    
    function handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'snapshot':
                    handleSnapshot(message);
                    break;
                    
                case 'update':
                    handleUpdate(message.payload);
                    break;
                    
                case 'pong':
                    // Heartbeat response
                    break;
                    
                default:
                    console.log('CoT: Unknown message type:', message.type);
            }
            
        } catch (e) {
            console.error('CoT: Failed to parse message:', e);
        }
    }
    
    function scheduleReconnect() {
        if (state.reconnectTimer) return;
        
        const delay = RECONNECT_DELAYS[Math.min(state.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
        state.reconnectAttempts++;
        
        console.log(`CoT: Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts})`);
        
        state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            if (state.enabled && !state.isConnected && !state.isConnecting) {
                connect(state.bridgeUrl);
            }
        }, delay);
    }
    
    // ==========================================================================
    // MESSAGE HANDLERS
    // ==========================================================================
    
    function handleSnapshot(message) {
        console.log('CoT: Received snapshot', {
            positions: message.positions?.length || 0,
            markers: message.markers?.length || 0,
            messages: message.messages?.length || 0
        });
        
        // Load positions
        if (message.positions) {
            message.positions.forEach(pos => {
                state.positions.set(pos.id, {
                    ...pos,
                    receivedAt: Date.now()
                });
            });
        }
        
        // Load markers
        if (message.markers) {
            message.markers.forEach(marker => {
                state.markers.set(marker.id, {
                    ...marker,
                    receivedAt: Date.now()
                });
            });
        }
        
        // Load messages
        if (message.messages) {
            state.messages = message.messages.map(msg => ({
                ...msg,
                receivedAt: Date.now()
            }));
        }
        
        // Update stats
        if (message.stats) {
            state.stats = { ...state.stats, ...message.stats };
        }
        
        state.stats.lastUpdate = Date.now();
        
        // Notify listeners
        notifyPositionUpdate();
        notifyMarkerUpdate();
        
        // Trigger map render
        if (typeof MapModule !== 'undefined') {
            MapModule.render();
        }
    }
    
    function handleUpdate(payload) {
        if (!payload) return;
        
        const { type, griddown } = payload;
        
        switch (type) {
            case 'position':
                state.positions.set(griddown.id, {
                    ...griddown,
                    receivedAt: Date.now()
                });
                state.stats.positionsReceived++;
                state.stats.lastUpdate = Date.now();
                notifyPositionUpdate();
                break;
                
            case 'marker':
                state.markers.set(griddown.id, {
                    ...griddown,
                    receivedAt: Date.now()
                });
                state.stats.markersReceived++;
                state.stats.lastUpdate = Date.now();
                notifyMarkerUpdate();
                break;
                
            case 'chat':
                state.messages.push({
                    ...griddown,
                    receivedAt: Date.now()
                });
                if (state.messages.length > MAX_MESSAGES) {
                    state.messages = state.messages.slice(-MAX_MESSAGES);
                }
                state.stats.messagesReceived++;
                state.stats.lastUpdate = Date.now();
                notifyMessageReceived(griddown);
                break;
        }
        
        // Trigger map render for position/marker updates
        if ((type === 'position' || type === 'marker') && typeof MapModule !== 'undefined') {
            MapModule.render();
        }
    }
    
    // ==========================================================================
    // DATA ACCESS
    // ==========================================================================
    
    /**
     * Get all TAK positions for map rendering
     */
    function getPositions() {
        const now = Date.now();
        const positions = [];
        
        state.positions.forEach((pos, uid) => {
            // Skip stale positions
            if (now - pos.receivedAt > POSITION_STALE_MS) return;
            
            positions.push({
                id: pos.id,
                name: pos.name,
                lat: pos.lat,
                lon: pos.lon,
                alt: pos.alt,
                speed: pos.speed,
                course: pos.course,
                team: pos.team,
                role: pos.role,
                battery: pos.battery,
                type: pos.type,
                source: 'tak',
                lastUpdate: pos.lastUpdate,
                icon: getIconForType(pos.type),
                color: getTeamColor(pos.team)
            });
        });
        
        return positions;
    }
    
    /**
     * Get TAK positions for team panel
     */
    function getTeamMembers() {
        if (!state.showInTeam) return [];
        return getPositions();
    }
    
    /**
     * Get all TAK markers for map rendering
     */
    function getMarkers() {
        const markers = [];
        
        state.markers.forEach((marker, uid) => {
            markers.push({
                id: marker.id,
                name: marker.name,
                lat: marker.lat,
                lon: marker.lon,
                alt: marker.alt,
                type: marker.type,
                remarks: marker.remarks,
                color: marker.color,
                source: 'tak',
                icon: getIconForType(marker.type)
            });
        });
        
        return markers;
    }
    
    /**
     * Get chat messages
     */
    function getMessages() {
        return [...state.messages];
    }
    
    /**
     * Get connection status
     */
    function getStatus() {
        return {
            isConnected: state.isConnected,
            isConnecting: state.isConnecting,
            bridgeUrl: state.bridgeUrl,
            enabled: state.enabled,
            positionCount: state.positions.size,
            markerCount: state.markers.size,
            messageCount: state.messages.length,
            stats: { ...state.stats }
        };
    }
    
    // ==========================================================================
    // HELPERS
    // ==========================================================================
    
    function getTeamColor(team) {
        if (!team) return '#3b82f6';
        
        // Check exact match
        if (TEAM_COLORS[team]) return TEAM_COLORS[team];
        
        // Check partial match
        for (const [name, color] of Object.entries(TEAM_COLORS)) {
            if (team.toLowerCase().includes(name.toLowerCase())) {
                return color;
            }
        }
        
        return '#3b82f6'; // Default blue
    }
    
    function getIconForType(cotType) {
        if (!cotType) return '👤';
        
        // Check exact match
        if (COT_ICONS[cotType]) return COT_ICONS[cotType];
        
        // Check prefix match
        for (const [prefix, icon] of Object.entries(COT_ICONS)) {
            if (cotType.startsWith(prefix)) {
                return icon;
            }
        }
        
        // Fallback based on affiliation
        if (cotType.startsWith('a-f')) return '👤';  // Friendly
        if (cotType.startsWith('a-h')) return '⚠️';  // Hostile
        if (cotType.startsWith('a-n')) return '❓';  // Neutral
        if (cotType.startsWith('b-m-p')) return '📍'; // Marker
        
        return '👤';
    }
    
    function cleanupStalePositions() {
        const now = Date.now();
        let removed = 0;
        
        state.positions.forEach((pos, uid) => {
            if (now - pos.receivedAt > POSITION_STALE_MS) {
                state.positions.delete(uid);
                removed++;
            }
        });
        
        if (removed > 0) {
            console.log(`CoT: Removed ${removed} stale positions`);
            notifyPositionUpdate();
        }
    }
    
    // ==========================================================================
    // CALLBACKS
    // ==========================================================================
    
    function notifyConnectionChange() {
        if (state.onConnectionChange) {
            state.onConnectionChange(state.isConnected);
        }
        
        if (typeof Events !== 'undefined') {
            Events.emit('tak:connection_changed', {
                connected: state.isConnected,
                url: state.bridgeUrl
            });
        }
    }
    
    function notifyPositionUpdate() {
        if (state.onPositionUpdate) {
            state.onPositionUpdate(getPositions());
        }
        
        if (typeof Events !== 'undefined') {
            Events.emit('tak:positions_updated', {
                positions: getPositions()
            });
        }
    }
    
    function notifyMarkerUpdate() {
        if (state.onMarkerUpdate) {
            state.onMarkerUpdate(getMarkers());
        }
        
        if (typeof Events !== 'undefined') {
            Events.emit('tak:markers_updated', {
                markers: getMarkers()
            });
        }
    }
    
    function notifyMessageReceived(message) {
        if (state.onMessageReceived) {
            state.onMessageReceived(message);
        }
        
        if (typeof Events !== 'undefined') {
            Events.emit('tak:message_received', { message });
        }
        
        // Show toast for new message
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast(`💬 CoT: ${message.from}: ${message.text.substring(0, 50)}`, 'info');
        }
    }
    
    // ==========================================================================
    // MAP INTEGRATION
    // ==========================================================================
    
    /**
     * Render TAK positions on map canvas
     * Called by MapModule during render
     */
    function renderOnMap(ctx, latLonToPixel, zoom) {
        if (!state.showOnMap || !state.isConnected) return;
        
        const positions = getPositions();
        const markers = getMarkers();
        
        // Render markers first (below positions)
        markers.forEach(marker => {
            const pixel = latLonToPixel(marker.lat, marker.lon);
            if (!pixel) return;
            
            // Marker dot
            ctx.beginPath();
            ctx.arc(pixel.x, pixel.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = marker.color || '#f97316';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Label
            if (zoom >= 10) {
                ctx.font = '10px system-ui';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText(marker.name, pixel.x, pixel.y + 20);
            }
        });
        
        // Render positions
        positions.forEach(pos => {
            const pixel = latLonToPixel(pos.lat, pos.lon);
            if (!pixel) return;
            
            const color = pos.color || '#3b82f6';
            
            // Direction indicator (if moving)
            if (pos.speed > 0.5 && pos.course !== undefined) {
                ctx.save();
                ctx.translate(pixel.x, pixel.y);
                ctx.rotate((pos.course * Math.PI) / 180);
                
                ctx.beginPath();
                ctx.moveTo(0, -16);
                ctx.lineTo(-5, -8);
                ctx.lineTo(5, -8);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                
                ctx.restore();
            }
            
            // Position dot with TAK styling
            ctx.beginPath();
            ctx.arc(pixel.x, pixel.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            
            // White border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Inner icon/indicator
            ctx.font = '10px system-ui';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('T', pixel.x, pixel.y); // 'T' for TAK
            
            // Name label
            if (zoom >= 10) {
                ctx.font = 'bold 11px system-ui';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                
                // Background for readability
                const textWidth = ctx.measureText(pos.name).width;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(pixel.x - textWidth/2 - 3, pixel.y + 12, textWidth + 6, 14);
                
                ctx.fillStyle = '#fff';
                ctx.fillText(pos.name, pixel.x, pixel.y + 14);
            }
        });
    }
    
    // ==========================================================================
    // BIDIRECTIONAL - SEND POSITION TO COT NETWORK
    // ==========================================================================
    
    /**
     * Send current position to CoT network via bridge
     * Requires user consent and active connection
     */
    async function sendPosition() {
        if (!state.isConnected) {
            console.warn('CoT: Not connected, cannot send position');
            return false;
        }
        
        if (!state.sharingConsented) {
            console.warn('CoT: User has not consented to position sharing');
            return false;
        }
        
        // Get current GPS position
        const gpsState = typeof GPSModule !== 'undefined' ? GPSModule.getState() : null;
        
        if (!gpsState || !gpsState.lat || !gpsState.lon) {
            console.warn('CoT: No GPS position available');
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast('📍 No GPS position available', 'error');
            }
            return false;
        }
        
        const payload = {
            uid: state.myUid,
            callsign: state.myCallsign,
            lat: gpsState.lat,
            lon: gpsState.lon,
            alt: gpsState.altitude || 0,
            speed: gpsState.speed || 0,
            course: gpsState.heading || 0,
            team: state.myTeam,
            role: ''
        };
        
        try {
            state.websocket.send(JSON.stringify({
                type: 'position',
                payload: payload
            }));
            
            state.stats.positionsSent++;
            state.stats.lastTransmit = Date.now();
            
            console.log(`CoT: Position sent (${gpsState.lat.toFixed(5)}, ${gpsState.lon.toFixed(5)})`);
            return true;
            
        } catch (e) {
            console.error('CoT: Failed to send position:', e);
            return false;
        }
    }
    
    /**
     * Enable continuous position sharing
     * Broadcasts position at configured interval
     */
    function startSharing() {
        if (!state.sharingConsented) {
            console.warn('CoT: Cannot start sharing without consent');
            return false;
        }
        
        if (state.sharingInterval) {
            console.log('CoT: Sharing already active');
            return true;
        }
        
        state.sharingEnabled = true;
        
        // Send immediately
        sendPosition();
        
        // Then send at interval
        state.sharingInterval = setInterval(() => {
            if (state.isConnected && state.sharingEnabled) {
                sendPosition();
            }
        }, state.sharingIntervalMs);
        
        console.log(`CoT: Position sharing started (every ${state.sharingIntervalMs / 1000}s)`);
        
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast('📡 Position sharing enabled', 'success');
        }
        
        if (typeof Events !== 'undefined') {
            Events.emit('cot:sharing_started');
        }
        
        return true;
    }
    
    /**
     * Stop continuous position sharing
     */
    function stopSharing() {
        state.sharingEnabled = false;
        
        if (state.sharingInterval) {
            clearInterval(state.sharingInterval);
            state.sharingInterval = null;
        }
        
        console.log('CoT: Position sharing stopped');
        
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast('📡 Position sharing disabled', 'info');
        }
        
        if (typeof Events !== 'undefined') {
            Events.emit('cot:sharing_stopped');
        }
    }
    
    /**
     * Set user consent for position sharing
     * Must be called before sharing can be enabled
     */
    function setShareConsent(consented) {
        state.sharingConsented = consented;
        saveSettings();
        
        if (!consented && state.sharingEnabled) {
            stopSharing();
        }
    }
    
    /**
     * Configure sharing settings
     */
    function configureSharing(options = {}) {
        if (options.callsign) {
            state.myCallsign = options.callsign;
        }
        if (options.team) {
            state.myTeam = options.team;
        }
        if (options.intervalMs && options.intervalMs >= 5000) {
            state.sharingIntervalMs = options.intervalMs;
            
            // Restart interval if currently sharing
            if (state.sharingEnabled && state.sharingInterval) {
                clearInterval(state.sharingInterval);
                state.sharingInterval = setInterval(() => {
                    if (state.isConnected && state.sharingEnabled) {
                        sendPosition();
                    }
                }, state.sharingIntervalMs);
            }
        }
        
        saveSettings();
    }
    
    /**
     * Get sharing status
     */
    function getSharingStatus() {
        return {
            consented: state.sharingConsented,
            enabled: state.sharingEnabled,
            callsign: state.myCallsign,
            team: state.myTeam,
            intervalMs: state.sharingIntervalMs,
            positionsSent: state.stats.positionsSent,
            lastTransmit: state.stats.lastTransmit
        };
    }
    
    // ==========================================================================
    // SETTINGS
    // ==========================================================================
    
    function setShowOnMap(show) {
        state.showOnMap = show;
        saveSettings();
        if (typeof MapModule !== 'undefined') {
            MapModule.render();
        }
    }
    
    function setShowInTeam(show) {
        state.showInTeam = show;
        saveSettings();
    }
    
    function setBridgeUrl(url) {
        state.bridgeUrl = url;
        saveSettings();
    }
    
    // ==========================================================================
    // SETUP WIZARD
    // ==========================================================================
    
    /**
     * Setup wizard state
     */
    const wizardState = {
        isOpen: false,
        step: 1,
        testResult: null,
        detectedBridges: []
    };
    
    /**
     * Open the CoT Bridge setup wizard
     */
    function openSetupWizard() {
        wizardState.isOpen = true;
        wizardState.step = 1;
        wizardState.testResult = null;
        wizardState.detectedBridges = [];
        
        renderWizard();
    }
    
    /**
     * Close the setup wizard
     */
    function closeSetupWizard() {
        wizardState.isOpen = false;
        
        const container = document.getElementById('cot-wizard-container');
        if (container) {
            container.remove();
        }
    }
    
    /**
     * Render the current wizard step
     */
    function renderWizard() {
        let container = document.getElementById('cot-wizard-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'cot-wizard-container';
            document.body.appendChild(container);
        }
        
        const steps = {
            1: renderWizardStep1,
            2: renderWizardStep2,
            3: renderWizardStep3,
            4: renderWizardStep4,
            5: renderWizardStep5
        };
        
        const stepContent = steps[wizardState.step] ? steps[wizardState.step]() : '';
        
        container.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px" id="cot-wizard-backdrop">
                <div style="background:#1a1f2e;border-radius:16px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.5)">
                    <!-- Header -->
                    <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between">
                        <div>
                            <div style="font-size:18px;font-weight:600">📡 CoT Bridge Setup</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.5)">Step ${wizardState.step} of 5</div>
                        </div>
                        <button id="cot-wizard-close" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:24px;cursor:pointer;padding:4px">&times;</button>
                    </div>
                    
                    <!-- Progress bar -->
                    <div style="height:4px;background:rgba(255,255,255,0.1)">
                        <div style="height:100%;background:#06b6d4;width:${wizardState.step * 20}%;transition:width 0.3s"></div>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding:24px">
                        ${stepContent}
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        document.getElementById('cot-wizard-close').onclick = closeSetupWizard;
        document.getElementById('cot-wizard-backdrop').onclick = (e) => {
            if (e.target.id === 'cot-wizard-backdrop') closeSetupWizard();
        };
        
        // Step-specific handlers
        setupWizardStepHandlers();
    }
    
    /**
     * Step 1: Introduction
     */
    function renderWizardStep1() {
        return `
            <div style="text-align:center;margin-bottom:24px">
                <div style="font-size:48px;margin-bottom:16px">🌐</div>
                <h3 style="font-size:20px;margin-bottom:8px">Welcome to CoT Bridge Setup</h3>
                <p style="color:rgba(255,255,255,0.6);font-size:14px">
                    Connect GridDown to tactical situational awareness networks
                </p>
            </div>
            
            <div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-weight:500;margin-bottom:12px">What is CoT Bridge?</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6">
                    The CoT Bridge connects GridDown to CoT-compatible applications like ATAK and WinTAK. 
                    This allows mixed teams to see each other's positions on the map.
                </div>
            </div>
            
            <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-weight:500;margin-bottom:12px">You'll need:</div>
                <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
                    <div style="display:flex;align-items:center;gap:10px">
                        <span style="width:24px;height:24px;background:rgba(6,182,212,0.2);border-radius:6px;display:flex;align-items:center;justify-content:center">1</span>
                        <span>A Raspberry Pi running griddown-cot-bridge</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px">
                        <span style="width:24px;height:24px;background:rgba(6,182,212,0.2);border-radius:6px;display:flex;align-items:center;justify-content:center">2</span>
                        <span>All devices on the same WiFi network</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px">
                        <span style="width:24px;height:24px;background:rgba(6,182,212,0.2);border-radius:6px;display:flex;align-items:center;justify-content:center">3</span>
                        <span>The bridge's IP address (shown during install)</span>
                    </div>
                </div>
            </div>
            
            <div style="display:flex;gap:12px;justify-content:flex-end">
                <button id="cot-wizard-cancel" class="btn btn--secondary" style="padding:10px 20px">Cancel</button>
                <button id="cot-wizard-next" class="btn btn--primary" style="padding:10px 20px">Get Started →</button>
            </div>
        `;
    }
    
    /**
     * Step 2: Network Check
     */
    function renderWizardStep2() {
        const isOnline = navigator.onLine;
        const connectionType = navigator.connection ? navigator.connection.type : 'unknown';
        const isWifi = connectionType === 'wifi' || connectionType === 'unknown';
        
        return `
            <div style="text-align:center;margin-bottom:24px">
                <div style="font-size:48px;margin-bottom:16px">${isOnline ? '📶' : '📵'}</div>
                <h3 style="font-size:20px;margin-bottom:8px">Network Check</h3>
                <p style="color:rgba(255,255,255,0.6);font-size:14px">
                    Let's verify your network connection
                </p>
            </div>
            
            <div style="background:${isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${isOnline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="font-size:24px">${isOnline ? '✅' : '❌'}</div>
                    <div>
                        <div style="font-weight:500">${isOnline ? 'Connected to Network' : 'No Network Connection'}</div>
                        <div style="font-size:12px;color:rgba(255,255,255,0.5)">
                            ${isOnline ? 'Ready to connect to bridge' : 'Please connect to WiFi first'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-size:13px;color:rgba(255,255,255,0.8)">
                    <strong>⚠️ Important:</strong> Your device must be on the <strong>same WiFi network</strong> as the Raspberry Pi running the CoT Bridge.
                </div>
            </div>
            
            <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-weight:500;margin-bottom:12px">Common network setups:</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.8">
                    • <strong>Vehicle WiFi:</strong> Router in vehicle, all devices connected<br>
                    • <strong>Mobile Hotspot:</strong> Phone/tablet sharing connection<br>
                    • <strong>Pi Hotspot:</strong> Bridge creates its own WiFi network
                </div>
            </div>
            
            <div style="display:flex;gap:12px;justify-content:space-between">
                <button id="cot-wizard-back" class="btn btn--secondary" style="padding:10px 20px">← Back</button>
                <button id="cot-wizard-next" class="btn btn--primary" style="padding:10px 20px" ${!isOnline ? 'disabled' : ''}>
                    ${isOnline ? 'Continue →' : 'Connect to WiFi First'}
                </button>
            </div>
        `;
    }
    
    /**
     * Step 3: Enter Bridge URL
     */
    function renderWizardStep3() {
        return `
            <div style="text-align:center;margin-bottom:24px">
                <div style="font-size:48px;margin-bottom:16px">🔗</div>
                <h3 style="font-size:20px;margin-bottom:8px">Enter Bridge Address</h3>
                <p style="color:rgba(255,255,255,0.6);font-size:14px">
                    Enter the IP address of your CoT Bridge
                </p>
            </div>
            
            <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px">BRIDGE IP ADDRESS</div>
                <div style="display:flex;gap:8px;align-items:center">
                    <span style="color:rgba(255,255,255,0.5);font-family:monospace">ws://</span>
                    <input type="text" id="cot-wizard-ip" 
                           placeholder="192.168.1.100" 
                           value="${state.bridgeUrl ? state.bridgeUrl.replace('ws://', '').replace(':8765', '') : ''}"
                           style="flex:1;padding:12px;font-size:16px;font-family:monospace;background:#0d1117;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff">
                    <span style="color:rgba(255,255,255,0.5);font-family:monospace">:8765</span>
                </div>
            </div>
            
            <div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-weight:500;margin-bottom:8px">💡 Finding your bridge IP:</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6">
                    On your Raspberry Pi, the IP address is shown when you run the installer. 
                    You can also find it by running: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px">hostname -I</code>
                </div>
            </div>
            
            <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px">QUICK REFERENCE</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.8">
                    Common bridge addresses:<br>
                    • <code style="cursor:pointer;color:#06b6d4" onclick="document.getElementById('cot-wizard-ip').value='192.168.1.100'">192.168.1.100</code> (typical router)<br>
                    • <code style="cursor:pointer;color:#06b6d4" onclick="document.getElementById('cot-wizard-ip').value='10.42.0.1'">10.42.0.1</code> (Pi hotspot mode)<br>
                    • <code style="cursor:pointer;color:#06b6d4" onclick="document.getElementById('cot-wizard-ip').value='192.168.4.1'">192.168.4.1</code> (mobile hotspot)
                </div>
            </div>
            
            <div style="display:flex;gap:12px;justify-content:space-between">
                <button id="cot-wizard-back" class="btn btn--secondary" style="padding:10px 20px">← Back</button>
                <button id="cot-wizard-test" class="btn btn--primary" style="padding:10px 20px">Test Connection →</button>
            </div>
        `;
    }
    
    /**
     * Step 4: Test Connection
     */
    function renderWizardStep4() {
        const isConnected = state.isConnected;
        const isTesting = wizardState.testResult === 'testing';
        const testFailed = wizardState.testResult === 'failed';
        const testSuccess = wizardState.testResult === 'success';
        
        let statusIcon = '⏳';
        let statusText = 'Testing connection...';
        let statusBg = 'rgba(251,191,36,0.1)';
        let statusBorder = 'rgba(251,191,36,0.3)';
        
        if (testSuccess || isConnected) {
            statusIcon = '✅';
            statusText = 'Connected successfully!';
            statusBg = 'rgba(34,197,94,0.1)';
            statusBorder = 'rgba(34,197,94,0.3)';
        } else if (testFailed) {
            statusIcon = '❌';
            statusText = 'Connection failed';
            statusBg = 'rgba(239,68,68,0.1)';
            statusBorder = 'rgba(239,68,68,0.3)';
        }
        
        return `
            <div style="text-align:center;margin-bottom:24px">
                <div style="font-size:48px;margin-bottom:16px">${statusIcon}</div>
                <h3 style="font-size:20px;margin-bottom:8px">${statusText}</h3>
                <p style="color:rgba(255,255,255,0.6);font-size:14px">
                    ${isTesting ? 'Please wait...' : testSuccess || isConnected ? 'Your bridge is ready' : 'Check settings and try again'}
                </p>
            </div>
            
            <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-family:monospace;font-size:14px;text-align:center">
                    ${state.bridgeUrl || 'ws://[not set]:8765'}
                </div>
            </div>
            
            ${testFailed ? `
                <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
                    <div style="font-weight:500;margin-bottom:8px">Troubleshooting:</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.8">
                        • Verify the IP address is correct<br>
                        • Make sure you're on the same WiFi network<br>
                        • Check that the bridge service is running<br>
                        • Try the bridge dashboard: <a href="http://${state.bridgeUrl ? state.bridgeUrl.replace('ws://', '').replace(':8765', '') : ''}:8080" target="_blank" style="color:#06b6d4">http://${state.bridgeUrl ? state.bridgeUrl.replace('ws://', '').replace(':8765', '') : '[ip]'}:8080</a>
                    </div>
                </div>
            ` : ''}
            
            ${testSuccess || isConnected ? `
                <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin-bottom:20px">
                    <div style="display:flex;justify-content:space-between;font-size:13px">
                        <span style="color:rgba(255,255,255,0.5)">Positions:</span>
                        <span>${state.positions.size}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px">
                        <span style="color:rgba(255,255,255,0.5)">Markers:</span>
                        <span>${state.markers.size}</span>
                    </div>
                </div>
            ` : ''}
            
            <div style="display:flex;gap:12px;justify-content:space-between">
                <button id="cot-wizard-back" class="btn btn--secondary" style="padding:10px 20px">← Back</button>
                ${testSuccess || isConnected ? `
                    <button id="cot-wizard-next" class="btn btn--primary" style="padding:10px 20px">Continue →</button>
                ` : `
                    <button id="cot-wizard-retry" class="btn btn--primary" style="padding:10px 20px">Retry Connection</button>
                `}
            </div>
        `;
    }
    
    /**
     * Step 5: Sharing Setup (Optional)
     */
    function renderWizardStep5() {
        return `
            <div style="text-align:center;margin-bottom:24px">
                <div style="font-size:48px;margin-bottom:16px">🎉</div>
                <h3 style="font-size:20px;margin-bottom:8px">Setup Complete!</h3>
                <p style="color:rgba(255,255,255,0.6);font-size:14px">
                    Your CoT Bridge is connected and ready
                </p>
            </div>
            
            <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="font-size:24px">✅</div>
                    <div>
                        <div style="font-weight:500">Bridge Connected</div>
                        <div style="font-size:12px;color:rgba(255,255,255,0.5)">
                            You can now see CoT positions on your map
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="font-weight:500;margin-bottom:12px">Optional: Share Your Position</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:16px">
                    You can also share your position so ATAK/WinTAK users can see you on their maps.
                </div>
                
                <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:12px;margin-bottom:16px">
                    <div style="font-size:12px;color:#fbbf24">
                        ⚠️ Position sharing broadcasts your GPS location to all devices on the network.
                    </div>
                </div>
                
                <div style="display:flex;gap:8px;margin-bottom:12px">
                    <input type="text" id="cot-wizard-callsign" placeholder="Your Callsign" 
                           value="${state.myCallsign || 'GridDown'}"
                           style="flex:1;padding:10px;font-size:14px;background:#0d1117;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff">
                    <select id="cot-wizard-team" style="padding:10px;font-size:14px;background:#0d1117;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff">
                        <option value="Cyan" ${state.myTeam === 'Cyan' ? 'selected' : ''}>Cyan</option>
                        <option value="Green" ${state.myTeam === 'Green' ? 'selected' : ''}>Green</option>
                        <option value="Blue" ${state.myTeam === 'Blue' ? 'selected' : ''}>Blue</option>
                        <option value="Yellow" ${state.myTeam === 'Yellow' ? 'selected' : ''}>Yellow</option>
                        <option value="Red" ${state.myTeam === 'Red' ? 'selected' : ''}>Red</option>
                    </select>
                </div>
                
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                    <input type="checkbox" id="cot-wizard-enable-sharing" style="width:18px;height:18px">
                    <span style="font-size:14px">Enable position sharing</span>
                </label>
            </div>
            
            <div style="display:flex;gap:12px;justify-content:flex-end">
                <button id="cot-wizard-finish" class="btn btn--primary" style="padding:10px 24px">Done</button>
            </div>
        `;
    }
    
    /**
     * Setup event handlers for current wizard step
     */
    function setupWizardStepHandlers() {
        const cancelBtn = document.getElementById('cot-wizard-cancel');
        const backBtn = document.getElementById('cot-wizard-back');
        const nextBtn = document.getElementById('cot-wizard-next');
        const testBtn = document.getElementById('cot-wizard-test');
        const retryBtn = document.getElementById('cot-wizard-retry');
        const finishBtn = document.getElementById('cot-wizard-finish');
        
        if (cancelBtn) {
            cancelBtn.onclick = closeSetupWizard;
        }
        
        if (backBtn) {
            backBtn.onclick = () => {
                wizardState.step--;
                renderWizard();
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => {
                wizardState.step++;
                renderWizard();
            };
        }
        
        if (testBtn) {
            testBtn.onclick = async () => {
                const ipInput = document.getElementById('cot-wizard-ip');
                const ip = ipInput ? ipInput.value.trim() : '';
                
                if (!ip) {
                    if (typeof ModalsModule !== 'undefined') {
                        ModalsModule.showToast('Please enter an IP address', 'error');
                    }
                    return;
                }
                
                const url = `ws://${ip}:8765`;
                state.bridgeUrl = url;
                saveSettings();
                
                wizardState.step = 4;
                wizardState.testResult = 'testing';
                renderWizard();
                
                // Attempt connection
                try {
                    await connect(url);
                    
                    // Wait a moment for connection to establish
                    setTimeout(() => {
                        if (state.isConnected) {
                            wizardState.testResult = 'success';
                        } else {
                            wizardState.testResult = 'failed';
                        }
                        renderWizard();
                    }, 2000);
                } catch (e) {
                    wizardState.testResult = 'failed';
                    renderWizard();
                }
            };
        }
        
        if (retryBtn) {
            retryBtn.onclick = () => {
                wizardState.step = 3;
                wizardState.testResult = null;
                renderWizard();
            };
        }
        
        if (finishBtn) {
            finishBtn.onclick = () => {
                // Save sharing settings if enabled
                const callsignInput = document.getElementById('cot-wizard-callsign');
                const teamSelect = document.getElementById('cot-wizard-team');
                const enableSharing = document.getElementById('cot-wizard-enable-sharing');
                
                if (callsignInput && teamSelect) {
                    configureSharing({
                        callsign: callsignInput.value.trim() || 'GridDown',
                        team: teamSelect.value
                    });
                }
                
                if (enableSharing && enableSharing.checked) {
                    setShareConsent(true);
                    startSharing();
                }
                
                closeSetupWizard();
                
                // Refresh team panel
                if (typeof renderTeam === 'function') {
                    renderTeam();
                } else if (typeof PanelsModule !== 'undefined' && PanelsModule.renderTeam) {
                    PanelsModule.renderTeam();
                }
                
                if (typeof ModalsModule !== 'undefined') {
                    ModalsModule.showToast('📡 CoT Bridge setup complete!', 'success');
                }
            };
        }
        
        // Handle Enter key in IP input
        const ipInput = document.getElementById('cot-wizard-ip');
        if (ipInput && testBtn) {
            ipInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    testBtn.click();
                }
            };
        }
    }
    
    // ==========================================================================
    // PUBLIC API
    // ==========================================================================
    
    return {
        init,
        connect,
        disconnect,
        getPositions,
        getTeamMembers,
        getMarkers,
        getMessages,
        getStatus,
        renderOnMap,
        setShowOnMap,
        setShowInTeam,
        setBridgeUrl,
        
        // Bidirectional sharing
        sendPosition,
        startSharing,
        stopSharing,
        setShareConsent,
        configureSharing,
        getSharingStatus,
        
        // Setup wizard
        openSetupWizard,
        closeSetupWizard,
        
        // Callbacks
        set onPositionUpdate(fn) { state.onPositionUpdate = fn; },
        set onMarkerUpdate(fn) { state.onMarkerUpdate = fn; },
        set onMessageReceived(fn) { state.onMessageReceived = fn; },
        set onConnectionChange(fn) { state.onConnectionChange = fn; }
    };
})();

// Export to window
window.TAKModule = TAKModule;
