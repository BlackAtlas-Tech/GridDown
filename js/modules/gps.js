/**
 * GridDown GPS Module
 * Supports internal (browser Geolocation) and external (USB/Serial NMEA) GPS devices
 */
const GPSModule = (function() {
    'use strict';

    // GPS State
    let state = {
        source: null,           // 'internal', 'serial', or null
        isTracking: false,
        isRecording: false,
        currentPosition: null,
        lastUpdate: null,
        accuracy: null,
        speed: null,
        heading: null,
        altitude: null,
        satellites: null,
        hdop: null,
        fix: null,              // 'none', '2D', '3D'
        error: null
    };

    // Internal GPS (Geolocation API)
    let watchId = null;
    let geolocationOptions = {
        enableHighAccuracy: true,
        timeout: 30000,         // Increased to 30 seconds for cold starts
        maximumAge: 5000        // Accept positions up to 5 seconds old
    };
    
    // Retry configuration
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    // Serial GPS (Web Serial API)
    let serialPort = null;
    let serialReader = null;
    let serialReadLoop = null;
    let nmeaBuffer = '';

    // Track recording
    let recordedTrack = [];
    let trackStartTime = null;
    let minTrackInterval = 5000;  // Minimum ms between track points
    let lastTrackPoint = 0;

    // Subscribers for position updates
    const subscribers = new Set();

    /**
     * Initialize GPS module
     */
    async function init() {
        // Load saved preferences
        await loadPreferences();
        
        // Check for available APIs
        state.hasGeolocation = 'geolocation' in navigator;
        state.hasSerial = 'serial' in navigator;
        
        console.log('GPSModule initialized', {
            geolocation: state.hasGeolocation,
            serial: state.hasSerial
        });
        
        return state;
    }

    /**
     * Load saved GPS preferences
     */
    async function loadPreferences() {
        try {
            const prefs = await Storage.Settings.get('gpsPreferences');
            if (prefs) {
                minTrackInterval = prefs.trackInterval || 5000;
                geolocationOptions.enableHighAccuracy = prefs.highAccuracy !== false;
            }
        } catch (e) {
            console.warn('Failed to load GPS preferences:', e);
        }
    }

    /**
     * Save GPS preferences
     */
    async function savePreferences(prefs) {
        try {
            await Storage.Settings.set('gpsPreferences', prefs);
            if (prefs.trackInterval) minTrackInterval = prefs.trackInterval;
            if (prefs.highAccuracy !== undefined) {
                geolocationOptions.enableHighAccuracy = prefs.highAccuracy;
            }
        } catch (e) {
            console.warn('Failed to save GPS preferences:', e);
        }
    }

    // ==========================================
    // Internal GPS (Browser Geolocation API)
    // ==========================================

    /**
     * Start tracking with internal GPS
     */
    function startInternalGPS() {
        if (!state.hasGeolocation) {
            state.error = 'Geolocation not supported';
            notifySubscribers();
            return false;
        }

        if (watchId !== null) {
            stopInternalGPS();
        }

        // Reset retry counter
        retryCount = 0;
        
        state.source = 'internal';
        state.isTracking = true;
        state.error = null;

        watchId = navigator.geolocation.watchPosition(
            handleGeolocationSuccess,
            handleGeolocationError,
            geolocationOptions
        );

        notifySubscribers();
        return true;
    }

    /**
     * Stop internal GPS tracking
     */
    function stopInternalGPS() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        
        if (state.source === 'internal') {
            state.source = null;
            state.isTracking = false;
        }
        
        notifySubscribers();
    }

    /**
     * Handle successful geolocation update
     */
    function handleGeolocationSuccess(position) {
        const coords = position.coords;
        
        // Reset retry count on success
        retryCount = 0;
        
        state.currentPosition = {
            lat: coords.latitude,
            lon: coords.longitude
        };
        state.accuracy = coords.accuracy;
        state.altitude = coords.altitude;
        state.speed = coords.speed; // m/s
        state.heading = coords.heading;
        state.lastUpdate = new Date();
        state.error = null;
        state.fix = coords.altitude !== null ? '3D' : '2D';

        // Record track point if recording
        if (state.isRecording) {
            recordTrackPoint();
        }

        notifySubscribers();
    }

    /**
     * Handle geolocation error
     */
    function handleGeolocationError(error) {
        const errorMessages = {
            1: 'Location permission denied',
            2: 'Position unavailable',
            3: 'Location request timed out'
        };
        
        // If timeout and we can retry, try with lower accuracy first
        if (error.code === 3 && retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`GPS timeout, retry ${retryCount}/${MAX_RETRIES}...`);
            
            // On first retry, try with lower accuracy (uses network location as fallback)
            if (retryCount === 1 && geolocationOptions.enableHighAccuracy) {
                console.log('Trying low-accuracy mode (network location)...');
                state.error = 'Searching... (trying network location)';
                notifySubscribers();
                
                // Try a single low-accuracy request first
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        // Got a network position, use it while waiting for GPS
                        handleGeolocationSuccess(position);
                        console.log('Network location acquired, continuing GPS search...');
                    },
                    () => {
                        // Network location also failed, keep waiting for GPS
                        console.log('Network location unavailable');
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            }
            
            state.error = `Searching for GPS... (attempt ${retryCount + 1})`;
            notifySubscribers();
            return;
        }
        
        // Reset retry count on permission denied (no point retrying)
        if (error.code === 1) {
            retryCount = 0;
        }
        
        state.error = errorMessages[error.code] || 'Unknown GPS error';
        state.fix = 'none';
        
        // Add helpful hints based on error type
        if (error.code === 3) {
            state.error += ' - Try moving outdoors or near a window';
        } else if (error.code === 2) {
            state.error += ' - GPS hardware may be disabled';
        }
        
        notifySubscribers();
    }

    /**
     * Get single position from internal GPS
     */
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!state.hasGeolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const result = {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        speed: position.coords.speed,
                        heading: position.coords.heading,
                        timestamp: new Date(position.timestamp)
                    };
                    resolve(result);
                },
                (error) => {
                    reject(new Error(error.message || 'Failed to get position'));
                },
                geolocationOptions
            );
        });
    }

    // ==========================================
    // External GPS (Web Serial API + NMEA)
    // ==========================================

    /**
     * Check if Web Serial is available
     */
    function isSerialAvailable() {
        return 'serial' in navigator;
    }

    /**
     * List available serial ports (requires user gesture)
     */
    async function requestSerialPort() {
        if (!isSerialAvailable()) {
            throw new Error('Web Serial API not supported. Use Chrome or Edge.');
        }

        try {
            // Request port with common GPS device filters
            const port = await navigator.serial.requestPort({
                filters: [
                    // Common USB GPS chipsets
                    { usbVendorId: 0x1546 }, // U-Blox
                    { usbVendorId: 0x067B }, // Prolific (USB-Serial adapters)
                    { usbVendorId: 0x0403 }, // FTDI
                    { usbVendorId: 0x10C4 }, // Silicon Labs
                    { usbVendorId: 0x1A86 }, // CH340
                ]
            });
            
            return port;
        } catch (e) {
            if (e.name === 'NotFoundError') {
                throw new Error('No GPS device selected');
            }
            throw e;
        }
    }

    /**
     * Connect to serial GPS device
     */
    async function connectSerialGPS(baudRate = 9600) {
        if (serialPort) {
            await disconnectSerialGPS();
        }

        try {
            serialPort = await requestSerialPort();
            
            await serialPort.open({ 
                baudRate: baudRate,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });

            state.source = 'serial';
            state.isTracking = true;
            state.error = null;
            nmeaBuffer = '';

            // Start reading
            startSerialReading();
            
            notifySubscribers();
            return true;

        } catch (e) {
            state.error = e.message;
            notifySubscribers();
            throw e;
        }
    }

    /**
     * Start reading from serial port
     */
    async function startSerialReading() {
        if (!serialPort || !serialPort.readable) return;

        const decoder = new TextDecoderStream();
        const inputDone = serialPort.readable.pipeTo(decoder.writable);
        serialReader = decoder.readable.getReader();

        serialReadLoop = (async () => {
            try {
                while (true) {
                    const { value, done } = await serialReader.read();
                    if (done) break;
                    if (value) {
                        processNMEAData(value);
                    }
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('Serial read error:', e);
                    state.error = 'Serial read error: ' + e.message;
                    notifySubscribers();
                }
            }
        })();
    }

    /**
     * Disconnect from serial GPS
     */
    async function disconnectSerialGPS() {
        if (serialReader) {
            try {
                await serialReader.cancel();
            } catch (e) {
                // Ignore cancel errors
            }
            serialReader = null;
        }

        if (serialPort) {
            try {
                await serialPort.close();
            } catch (e) {
                // Ignore close errors
            }
            serialPort = null;
        }

        if (state.source === 'serial') {
            state.source = null;
            state.isTracking = false;
        }

        nmeaBuffer = '';
        notifySubscribers();
    }

    /**
     * Process incoming NMEA data
     */
    function processNMEAData(data) {
        nmeaBuffer += data;
        
        // Process complete sentences
        const lines = nmeaBuffer.split('\n');
        nmeaBuffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            const sentence = line.trim();
            if (sentence.startsWith('$')) {
                parseNMEASentence(sentence);
            }
        }
    }

    /**
     * Parse NMEA sentence
     */
    function parseNMEASentence(sentence) {
        // Validate checksum
        if (!validateNMEAChecksum(sentence)) {
            return;
        }

        // Remove checksum
        const data = sentence.split('*')[0];
        const parts = data.split(',');
        const type = parts[0];

        try {
            switch (type) {
                case '$GPGGA':
                case '$GNGGA':
                    parseGGA(parts);
                    break;
                case '$GPRMC':
                case '$GNRMC':
                    parseRMC(parts);
                    break;
                case '$GPGSA':
                case '$GNGSA':
                    parseGSA(parts);
                    break;
                case '$GPGSV':
                case '$GNGSV':
                    parseGSV(parts);
                    break;
                case '$GPVTG':
                case '$GNVTG':
                    parseVTG(parts);
                    break;
            }
        } catch (e) {
            console.warn('NMEA parse error:', type, e);
        }
    }

    /**
     * Validate NMEA checksum
     */
    function validateNMEAChecksum(sentence) {
        const asterisk = sentence.indexOf('*');
        if (asterisk === -1) return false;

        const checksum = sentence.substring(asterisk + 1, asterisk + 3);
        const data = sentence.substring(1, asterisk);

        let calculated = 0;
        for (let i = 0; i < data.length; i++) {
            calculated ^= data.charCodeAt(i);
        }

        return calculated.toString(16).toUpperCase().padStart(2, '0') === checksum.toUpperCase();
    }

    /**
     * Parse GGA sentence (position and fix quality)
     */
    function parseGGA(parts) {
        // $GPGGA,time,lat,N/S,lon,E/W,quality,satellites,hdop,altitude,M,geoid,M,age,station*checksum
        const quality = parseInt(parts[6]) || 0;
        
        if (quality === 0) {
            state.fix = 'none';
            return;
        }

        const lat = parseNMEACoordinate(parts[2], parts[3]);
        const lon = parseNMEACoordinate(parts[4], parts[5]);

        if (lat !== null && lon !== null) {
            state.currentPosition = { lat, lon };
            state.lastUpdate = new Date();
        }

        state.satellites = parseInt(parts[7]) || null;
        state.hdop = parseFloat(parts[8]) || null;
        state.altitude = parseFloat(parts[9]) || null;
        state.fix = quality >= 1 ? (state.altitude !== null ? '3D' : '2D') : 'none';

        // Calculate approximate accuracy from HDOP
        if (state.hdop) {
            state.accuracy = state.hdop * 5; // Rough estimate: HDOP * 5 meters
        }

        // Record track point if recording
        if (state.isRecording && state.currentPosition) {
            recordTrackPoint();
        }

        notifySubscribers();
    }

    /**
     * Parse RMC sentence (recommended minimum data)
     */
    function parseRMC(parts) {
        // $GPRMC,time,status,lat,N/S,lon,E/W,speed,course,date,magvar,E/W*checksum
        const status = parts[2];
        
        if (status !== 'A') {
            // Data not valid
            return;
        }

        const lat = parseNMEACoordinate(parts[3], parts[4]);
        const lon = parseNMEACoordinate(parts[5], parts[6]);

        if (lat !== null && lon !== null) {
            state.currentPosition = { lat, lon };
            state.lastUpdate = new Date();
        }

        // Speed in knots, convert to m/s
        const speedKnots = parseFloat(parts[7]);
        if (!isNaN(speedKnots)) {
            state.speed = speedKnots * 0.514444;
        }

        // Course/heading
        const course = parseFloat(parts[8]);
        if (!isNaN(course)) {
            state.heading = course;
        }

        notifySubscribers();
    }

    /**
     * Parse GSA sentence (satellite status and DOP)
     */
    function parseGSA(parts) {
        // $GPGSA,mode,fix,sat1,sat2,...,sat12,pdop,hdop,vdop*checksum
        const fixType = parseInt(parts[2]) || 1;
        
        switch (fixType) {
            case 1: state.fix = 'none'; break;
            case 2: state.fix = '2D'; break;
            case 3: state.fix = '3D'; break;
        }

        state.hdop = parseFloat(parts[16]) || state.hdop;
    }

    /**
     * Parse GSV sentence (satellites in view)
     */
    function parseGSV(parts) {
        // $GPGSV,totalMsgs,msgNum,satsInView,sat1prn,elev,azim,snr,...*checksum
        // We just extract total satellites in view
        const satsInView = parseInt(parts[3]);
        if (!isNaN(satsInView)) {
            state.satellitesInView = satsInView;
        }
    }

    /**
     * Parse VTG sentence (velocity and track)
     */
    function parseVTG(parts) {
        // $GPVTG,trackTrue,T,trackMag,M,speedKnots,N,speedKmh,K*checksum
        const trackTrue = parseFloat(parts[1]);
        if (!isNaN(trackTrue)) {
            state.heading = trackTrue;
        }

        const speedKmh = parseFloat(parts[7]);
        if (!isNaN(speedKmh)) {
            state.speed = speedKmh / 3.6; // Convert to m/s
        }
    }

    /**
     * Parse NMEA coordinate (DDMM.MMMM format)
     */
    function parseNMEACoordinate(value, direction) {
        if (!value || !direction) return null;

        const num = parseFloat(value);
        if (isNaN(num)) return null;

        // Extract degrees and minutes
        const degrees = Math.floor(num / 100);
        const minutes = num - (degrees * 100);
        
        let decimal = degrees + (minutes / 60);

        // Apply direction
        if (direction === 'S' || direction === 'W') {
            decimal = -decimal;
        }

        return decimal;
    }

    // ==========================================
    // Track Recording
    // ==========================================

    /**
     * Start recording a track
     */
    function startRecording() {
        if (!state.isTracking) {
            return false;
        }

        recordedTrack = [];
        trackStartTime = new Date();
        lastTrackPoint = 0;
        state.isRecording = true;

        // Add first point immediately if we have position
        if (state.currentPosition) {
            recordTrackPoint(true);
        }

        notifySubscribers();
        return true;
    }

    /**
     * Stop recording and return track
     */
    function stopRecording() {
        state.isRecording = false;
        
        const track = {
            points: [...recordedTrack],
            startTime: trackStartTime,
            endTime: new Date(),
            pointCount: recordedTrack.length
        };

        // Calculate track statistics
        if (track.points.length >= 2) {
            track.distance = calculateTrackDistance(track.points);
            track.duration = (track.endTime - track.startTime) / 1000; // seconds
            track.avgSpeed = track.distance / (track.duration / 3600); // mph
        }

        notifySubscribers();
        return track;
    }

    /**
     * Record a track point
     */
    function recordTrackPoint(force = false) {
        const now = Date.now();
        
        // Throttle recording
        if (!force && (now - lastTrackPoint) < minTrackInterval) {
            return;
        }

        if (!state.currentPosition) return;

        const point = {
            lat: state.currentPosition.lat,
            lon: state.currentPosition.lon,
            altitude: state.altitude,
            speed: state.speed,
            heading: state.heading,
            accuracy: state.accuracy,
            timestamp: new Date()
        };

        recordedTrack.push(point);
        lastTrackPoint = now;
    }

    /**
     * Calculate track distance in miles
     */
    function calculateTrackDistance(points) {
        let distance = 0;
        for (let i = 1; i < points.length; i++) {
            distance += haversineDistance(
                points[i-1].lat, points[i-1].lon,
                points[i].lat, points[i].lon
            );
        }
        return distance;
    }

    /**
     * Get current recorded track
     */
    function getRecordedTrack() {
        return [...recordedTrack];
    }

    /**
     * Clear recorded track
     */
    function clearRecordedTrack() {
        recordedTrack = [];
        trackStartTime = null;
    }

    /**
     * Convert recorded track to route format
     */
    function trackToRoute(name = 'Recorded Track') {
        if (recordedTrack.length < 2) return null;

        const points = recordedTrack.map(pt => ({
            lat: pt.lat,
            lon: pt.lon,
            x: lonToX(pt.lon),
            y: latToY(pt.lat),
            elevation: pt.altitude ? pt.altitude * 3.28084 : null, // m to ft
            timestamp: pt.timestamp
        }));

        const distance = calculateTrackDistance(recordedTrack);
        const duration = (recordedTrack[recordedTrack.length - 1].timestamp - recordedTrack[0].timestamp) / 1000;

        return {
            id: Helpers.generateId(),
            name: name,
            points: points,
            distance: distance.toFixed(1),
            duration: formatDuration(duration / 3600),
            elevation: '0', // Would need elevation data to calculate
            source: 'gps-track',
            recordedAt: trackStartTime?.toISOString()
        };
    }

    // ==========================================
    // Navigation Helpers
    // ==========================================

    /**
     * Calculate distance and bearing to a point
     */
    function getNavigationTo(targetLat, targetLon) {
        if (!state.currentPosition) return null;

        const distance = haversineDistance(
            state.currentPosition.lat,
            state.currentPosition.lon,
            targetLat,
            targetLon
        );

        const bearing = calculateBearing(
            state.currentPosition.lat,
            state.currentPosition.lon,
            targetLat,
            targetLon
        );

        // Calculate relative bearing if we have heading
        let relativeBearing = null;
        if (state.heading !== null) {
            relativeBearing = (bearing - state.heading + 360) % 360;
            if (relativeBearing > 180) relativeBearing -= 360;
        }

        // ETA if we have speed
        let eta = null;
        if (state.speed && state.speed > 0.5) { // > ~1 mph
            const speedMph = state.speed * 2.237; // m/s to mph
            eta = distance / speedMph; // hours
        }

        return {
            distance,
            distanceFormatted: formatDistance(distance),
            bearing,
            bearingFormatted: formatBearing(bearing),
            relativeBearing,
            eta,
            etaFormatted: eta ? formatDuration(eta) : null
        };
    }

    /**
     * Calculate bearing between two points
     */
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

    /**
     * Haversine distance in miles
     */
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // ==========================================
    // Utility Functions
    // ==========================================

    function lonToX(lon) {
        return 50 + (lon + 119.1892) / 0.004;
    }

    function latToY(lat) {
        return 50 + (lat - 37.4215) / 0.002;
    }

    function formatDistance(miles) {
        if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
        if (miles < 10) return `${miles.toFixed(2)} mi`;
        return `${miles.toFixed(1)} mi`;
    }

    function formatBearing(degrees) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                           'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return `${Math.round(degrees)}° ${directions[index]}`;
    }

    function formatDuration(hours) {
        if (hours < 1/60) return `${Math.round(hours * 3600)}s`;
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    }

    function formatSpeed(mps) {
        if (mps === null || mps === undefined) return '--';
        const mph = mps * 2.237;
        return `${mph.toFixed(1)} mph`;
    }

    function formatAccuracy(meters) {
        if (meters === null || meters === undefined) return '--';
        if (meters < 10) return `±${meters.toFixed(1)}m`;
        return `±${Math.round(meters)}m`;
    }

    // ==========================================
    // Subscription System
    // ==========================================

    /**
     * Subscribe to GPS updates
     */
    function subscribe(callback) {
        subscribers.add(callback);
        // Immediately send current state
        callback({ ...state });
        return () => subscribers.delete(callback);
    }

    /**
     * Notify all subscribers
     */
    function notifySubscribers() {
        const stateCopy = { ...state };
        subscribers.forEach(cb => {
            try {
                cb(stateCopy);
            } catch (e) {
                console.error('GPS subscriber error:', e);
            }
        });
    }

    // ==========================================
    // Public State Access
    // ==========================================

    /**
     * Get current GPS state
     */
    function getState() {
        return { ...state };
    }

    /**
     * Check if GPS is currently active
     */
    function isActive() {
        return state.isTracking;
    }

    /**
     * Get current position (if available)
     */
    function getPosition() {
        return state.currentPosition ? { ...state.currentPosition } : null;
    }

    /**
     * Stop all GPS tracking
     */
    function stop() {
        stopInternalGPS();
        disconnectSerialGPS();
        stopSimulation();  // Also stop any running simulation
        if (state.isRecording) {
            stopRecording();
        }
    }

    // ==========================================
    // Coordinate Simulation (for testing)
    // ==========================================

    let simulationInterval = null;
    let simulatedPath = [];
    let simulatedIndex = 0;

    /**
     * Start GPS simulation (for testing without real GPS)
     */
    function startSimulation(path = null) {
        if (simulationInterval) stopSimulation();

        // Default path if none provided
        if (!path || path.length === 0) {
            const baseLat = 37.4215;
            const baseLon = -119.1892;
            simulatedPath = [];
            for (let i = 0; i < 100; i++) {
                simulatedPath.push({
                    lat: baseLat + (i * 0.001) + (Math.random() - 0.5) * 0.0005,
                    lon: baseLon + (i * 0.002) + (Math.random() - 0.5) * 0.001
                });
            }
        } else {
            simulatedPath = path;
        }

        simulatedIndex = 0;
        state.source = 'simulation';
        state.isTracking = true;
        state.error = null;
        state.fix = '3D';

        simulationInterval = setInterval(() => {
            if (simulatedIndex >= simulatedPath.length) {
                simulatedIndex = 0; // Loop
            }

            const pt = simulatedPath[simulatedIndex];
            const prevPt = simulatedPath[Math.max(0, simulatedIndex - 1)];

            state.currentPosition = { lat: pt.lat, lon: pt.lon };
            state.lastUpdate = new Date();
            state.accuracy = 5 + Math.random() * 10;
            state.altitude = 1500 + Math.random() * 100;
            state.satellites = 8 + Math.floor(Math.random() * 4);
            state.hdop = 1.0 + Math.random() * 0.5;

            // Calculate speed and heading from movement
            const dist = haversineDistance(prevPt.lat, prevPt.lon, pt.lat, pt.lon);
            state.speed = (dist * 1609.34) / 1; // Assuming 1 second interval, convert to m/s
            state.heading = calculateBearing(prevPt.lat, prevPt.lon, pt.lat, pt.lon);

            if (state.isRecording) {
                recordTrackPoint();
            }

            simulatedIndex++;
            notifySubscribers();
        }, 1000);

        notifySubscribers();
        return true;
    }

    /**
     * Stop GPS simulation
     */
    function stopSimulation() {
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
        }
        if (state.source === 'simulation') {
            state.source = null;
            state.isTracking = false;
        }
        notifySubscribers();
    }

    // Public API
    return {
        init,
        
        // Internal GPS
        startInternalGPS,
        stopInternalGPS,
        getCurrentPosition,
        
        // Serial GPS
        isSerialAvailable,
        connectSerialGPS,
        disconnectSerialGPS,
        
        // Track recording
        startRecording,
        stopRecording,
        getRecordedTrack,
        clearRecordedTrack,
        trackToRoute,
        
        // Navigation
        getNavigationTo,
        calculateBearing,
        haversineDistance,
        
        // State
        getState,
        isActive,
        getPosition,
        subscribe,
        stop,
        
        // Preferences
        savePreferences,
        
        // Formatting
        formatDistance,
        formatBearing,
        formatSpeed,
        formatAccuracy,
        formatDuration,
        
        // Testing
        startSimulation,
        stopSimulation
    };
})();

window.GPSModule = GPSModule;
