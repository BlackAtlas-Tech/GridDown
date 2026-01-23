/**
 * GridDown Radio Frequency Reference Module
 * Offline database of useful radio frequencies for emergency communications
 */
const RadioModule = (function() {
    'use strict';

    // ==========================================
    // FREQUENCY DATABASES
    // ==========================================

    /**
     * FRS (Family Radio Service) Channels
     * No license required, limited to 2W on channels 1-7, 22
     * 0.5W on channels 8-14
     */
    const FRS_CHANNELS = [
        { channel: 1, freq: 462.5625, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 1' },
        { channel: 2, freq: 462.5875, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 2' },
        { channel: 3, freq: 462.6125, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 3' },
        { channel: 4, freq: 462.6375, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 4' },
        { channel: 5, freq: 462.6625, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 5' },
        { channel: 6, freq: 462.6875, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 6' },
        { channel: 7, freq: 462.7125, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 7' },
        { channel: 8, freq: 467.5625, power: '0.5W', shared: null, notes: 'FRS only, low power' },
        { channel: 9, freq: 467.5875, power: '0.5W', shared: null, notes: 'FRS only, low power' },
        { channel: 10, freq: 467.6125, power: '0.5W', shared: null, notes: 'FRS only, low power' },
        { channel: 11, freq: 467.6375, power: '0.5W', shared: null, notes: 'FRS only, low power' },
        { channel: 12, freq: 467.6625, power: '0.5W', shared: null, notes: 'FRS only, low power' },
        { channel: 13, freq: 467.6875, power: '0.5W', shared: null, notes: 'FRS only, low power' },
        { channel: 14, freq: 467.7125, power: '0.5W', shared: null, notes: 'FRS only, low power' },
        { channel: 15, freq: 462.5500, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 15' },
        { channel: 16, freq: 462.5750, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 16' },
        { channel: 17, freq: 462.6000, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 17' },
        { channel: 18, freq: 462.6250, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 18' },
        { channel: 19, freq: 462.6500, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 19' },
        { channel: 20, freq: 462.6750, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 20' },
        { channel: 21, freq: 462.7000, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 21' },
        { channel: 22, freq: 462.7250, power: '2W', shared: 'GMRS', notes: 'Shared with GMRS Ch 22' }
    ];

    /**
     * GMRS (General Mobile Radio Service) Channels
     * Requires FCC license ($35, 10 years, covers family)
     * Up to 50W on some channels, repeater capable
     */
    const GMRS_CHANNELS = [
        { channel: 1, freq: 462.5625, power: '5W', repeater: false, notes: 'Shared with FRS' },
        { channel: 2, freq: 462.5875, power: '5W', repeater: false, notes: 'Shared with FRS' },
        { channel: 3, freq: 462.6125, power: '5W', repeater: false, notes: 'Shared with FRS' },
        { channel: 4, freq: 462.6375, power: '5W', repeater: false, notes: 'Shared with FRS' },
        { channel: 5, freq: 462.6625, power: '5W', repeater: false, notes: 'Shared with FRS' },
        { channel: 6, freq: 462.6875, power: '5W', repeater: false, notes: 'Shared with FRS' },
        { channel: 7, freq: 462.7125, power: '5W', repeater: false, notes: 'Shared with FRS' },
        { channel: 15, freq: 462.5500, power: '50W', repeater: true, notes: 'Repeater capable (467.5500 input)' },
        { channel: 16, freq: 462.5750, power: '50W', repeater: true, notes: 'Repeater capable (467.5750 input)' },
        { channel: 17, freq: 462.6000, power: '50W', repeater: true, notes: 'Repeater capable (467.6000 input)' },
        { channel: 18, freq: 462.6250, power: '50W', repeater: true, notes: 'Repeater capable (467.6250 input)' },
        { channel: 19, freq: 462.6500, power: '50W', repeater: true, notes: 'Emergency/calling channel' },
        { channel: 20, freq: 462.6750, power: '50W', repeater: true, notes: 'Repeater capable (467.6750 input)' },
        { channel: 21, freq: 462.7000, power: '50W', repeater: true, notes: 'Repeater capable (467.7000 input)' },
        { channel: 22, freq: 462.7250, power: '50W', repeater: true, notes: 'Repeater capable (467.7250 input)' }
    ];

    /**
     * MURS (Multi-Use Radio Service) Channels
     * No license required, up to 2W
     */
    const MURS_CHANNELS = [
        { channel: 1, freq: 151.820, power: '2W', bandwidth: '11.25 kHz', notes: 'Narrowband, good for voice' },
        { channel: 2, freq: 151.880, power: '2W', bandwidth: '11.25 kHz', notes: 'Narrowband, good for voice' },
        { channel: 3, freq: 151.940, power: '2W', bandwidth: '11.25 kHz', notes: 'Narrowband, good for voice' },
        { channel: 4, freq: 154.570, power: '2W', bandwidth: '20 kHz', notes: 'Wideband, "Blue Dot"' },
        { channel: 5, freq: 154.600, power: '2W', bandwidth: '20 kHz', notes: 'Wideband, "Green Dot"' }
    ];

    /**
     * CB (Citizens Band) Radio Channels
     * No license required, 4W AM / 12W SSB
     */
    const CB_CHANNELS = [
        { channel: 1, freq: 26.965, mode: 'AM', notes: '' },
        { channel: 2, freq: 26.975, mode: 'AM', notes: '' },
        { channel: 3, freq: 26.985, mode: 'AM', notes: 'Often used by truckers' },
        { channel: 4, freq: 27.005, mode: 'AM', notes: '4x4 off-road' },
        { channel: 5, freq: 27.015, mode: 'AM', notes: '' },
        { channel: 6, freq: 27.025, mode: 'AM', notes: 'Unofficial "Super Bowl" channel' },
        { channel: 7, freq: 27.035, mode: 'AM', notes: '' },
        { channel: 8, freq: 27.055, mode: 'AM', notes: '' },
        { channel: 9, freq: 27.065, mode: 'AM', notes: '⚠️ EMERGENCY CHANNEL' },
        { channel: 10, freq: 27.075, mode: 'AM', notes: 'Regional road/travel' },
        { channel: 11, freq: 27.085, mode: 'AM', notes: '' },
        { channel: 12, freq: 27.105, mode: 'AM', notes: '' },
        { channel: 13, freq: 27.115, mode: 'AM', notes: 'Marine/RV' },
        { channel: 14, freq: 27.125, mode: 'AM', notes: 'Walkie-talkies' },
        { channel: 15, freq: 27.135, mode: 'AM', notes: '' },
        { channel: 16, freq: 27.155, mode: 'AM', notes: 'SSB calling' },
        { channel: 17, freq: 27.165, mode: 'AM', notes: 'Truckers (North/South)' },
        { channel: 18, freq: 27.175, mode: 'AM', notes: '' },
        { channel: 19, freq: 27.185, mode: 'AM', notes: '⚠️ TRUCKER HIGHWAY CHANNEL' },
        { channel: 20, freq: 27.205, mode: 'AM', notes: '' },
        { channel: 21, freq: 27.215, mode: 'AM', notes: 'Truckers (East/West)' },
        { channel: 22, freq: 27.225, mode: 'AM', notes: '' },
        { channel: 23, freq: 27.255, mode: 'AM', notes: '' },
        { channel: 24, freq: 27.235, mode: 'AM', notes: '' },
        { channel: 25, freq: 27.245, mode: 'AM', notes: '' },
        { channel: 26, freq: 27.265, mode: 'AM', notes: '' },
        { channel: 27, freq: 27.275, mode: 'AM', notes: '' },
        { channel: 28, freq: 27.285, mode: 'AM', notes: '' },
        { channel: 29, freq: 27.295, mode: 'AM', notes: '' },
        { channel: 30, freq: 27.305, mode: 'AM', notes: '' },
        { channel: 31, freq: 27.315, mode: 'AM', notes: '' },
        { channel: 32, freq: 27.325, mode: 'AM', notes: '' },
        { channel: 33, freq: 27.335, mode: 'AM', notes: '' },
        { channel: 34, freq: 27.345, mode: 'AM', notes: '' },
        { channel: 35, freq: 27.355, mode: 'AM', notes: 'SSB lower' },
        { channel: 36, freq: 27.365, mode: 'AM', notes: 'SSB' },
        { channel: 37, freq: 27.375, mode: 'AM', notes: 'SSB calling' },
        { channel: 38, freq: 27.385, mode: 'AM', notes: 'SSB' },
        { channel: 39, freq: 27.395, mode: 'AM', notes: 'SSB' },
        { channel: 40, freq: 27.405, mode: 'AM', notes: 'SSB upper' }
    ];

    /**
     * Emergency & Distress Frequencies
     */
    const EMERGENCY_FREQUENCIES = [
        // Marine
        { freq: 156.800, name: 'Marine VHF Ch 16', service: 'Marine', notes: 'International distress, safety, calling', priority: 'critical' },
        { freq: 156.450, name: 'Marine VHF Ch 9', service: 'Marine', notes: 'Secondary calling channel', priority: 'high' },
        { freq: 156.300, name: 'Marine VHF Ch 6', service: 'Marine', notes: 'Inter-ship safety', priority: 'medium' },
        { freq: 157.100, name: 'Marine VHF Ch 22A', service: 'Coast Guard', notes: 'Coast Guard liaison', priority: 'high' },
        
        // Aviation
        { freq: 121.500, name: 'Aviation Guard', service: 'Aviation', notes: 'International aeronautical emergency', priority: 'critical' },
        { freq: 243.000, name: 'Military Guard', service: 'Military', notes: 'Military emergency (UHF)', priority: 'critical' },
        { freq: 122.750, name: 'Aviation Multicom', service: 'Aviation', notes: 'Air-to-ground general', priority: 'medium' },
        
        // Land mobile
        { freq: 155.160, name: 'SAR Primary', service: 'SAR', notes: 'Search and Rescue primary', priority: 'critical' },
        { freq: 155.280, name: 'Inter-agency', service: 'Emergency', notes: 'Inter-agency emergency', priority: 'high' },
        { freq: 155.475, name: 'Police Emergency', service: 'Police', notes: 'Police mutual aid', priority: 'high' },
        { freq: 154.280, name: 'Fire Mutual Aid', service: 'Fire', notes: 'Fire department mutual aid', priority: 'high' },
        { freq: 156.000, name: 'EMS Calling', service: 'EMS', notes: 'National EMS calling', priority: 'high' },
        
        // Amateur emergency
        { freq: 146.520, name: '2m National Calling', service: 'Amateur', notes: 'Ham 2m simplex calling', priority: 'medium' },
        { freq: 446.000, name: '70cm National Calling', service: 'Amateur', notes: 'Ham 70cm simplex calling', priority: 'medium' },
        { freq: 7.230, name: '40m Emergency Net', service: 'Amateur', notes: 'Ham HF emergency (LSB)', priority: 'medium' },
        { freq: 14.300, name: '20m Emergency Net', service: 'Amateur', notes: 'Ham HF emergency (USB)', priority: 'medium' },
        
        // CB Emergency
        { freq: 27.065, name: 'CB Channel 9', service: 'CB', notes: 'CB emergency channel', priority: 'high' },
        
        // Satellite
        { freq: 406.025, name: 'COSPAS-SARSAT', service: 'Satellite', notes: 'Emergency beacon frequency', priority: 'critical' }
    ];

    /**
     * NOAA Weather Radio Frequencies
     */
    const WEATHER_FREQUENCIES = [
        { channel: 'WX1', freq: 162.550, notes: 'NOAA Weather' },
        { channel: 'WX2', freq: 162.400, notes: 'NOAA Weather' },
        { channel: 'WX3', freq: 162.475, notes: 'NOAA Weather' },
        { channel: 'WX4', freq: 162.425, notes: 'NOAA Weather' },
        { channel: 'WX5', freq: 162.450, notes: 'NOAA Weather' },
        { channel: 'WX6', freq: 162.500, notes: 'NOAA Weather' },
        { channel: 'WX7', freq: 162.525, notes: 'NOAA Weather' }
    ];

    /**
     * Meshtastic / LoRa Frequencies (US Region)
     */
    const MESHTASTIC_CHANNELS = [
        { name: 'LongFast', freq: 906.875, sf: 11, bw: 250, notes: 'Default channel, good range' },
        { name: 'LongSlow', freq: 906.875, sf: 12, bw: 125, notes: 'Maximum range, slow' },
        { name: 'MediumFast', freq: 906.875, sf: 9, bw: 250, notes: 'Balanced range/speed' },
        { name: 'MediumSlow', freq: 906.875, sf: 10, bw: 250, notes: 'Medium range' },
        { name: 'ShortFast', freq: 906.875, sf: 7, bw: 250, notes: 'Fast, short range' },
        { name: 'ShortSlow', freq: 906.875, sf: 8, bw: 250, notes: 'Short range, reliable' }
    ];

    /**
     * Common Amateur (Ham) Radio Frequencies
     * Requires license to transmit
     */
    const HAM_FREQUENCIES = {
        vhf: [
            { freq: 146.520, name: '2m Calling', mode: 'FM', notes: 'National simplex calling' },
            { freq: 146.550, name: '2m Simplex', mode: 'FM', notes: 'Common simplex' },
            { freq: 146.580, name: '2m Simplex', mode: 'FM', notes: 'Common simplex' },
            { freq: 147.420, name: '2m Simplex', mode: 'FM', notes: 'Simplex' },
            { freq: 147.450, name: '2m Simplex', mode: 'FM', notes: 'Simplex' },
            { freq: 147.570, name: '2m Simplex', mode: 'FM', notes: 'Simplex' }
        ],
        uhf: [
            { freq: 446.000, name: '70cm Calling', mode: 'FM', notes: 'National simplex calling' },
            { freq: 446.500, name: '70cm Simplex', mode: 'FM', notes: 'Common simplex' },
            { freq: 446.100, name: '70cm Simplex', mode: 'FM', notes: 'Common simplex' },
            { freq: 447.000, name: '70cm Simplex', mode: 'FM', notes: 'Simplex' }
        ],
        hf: [
            { freq: 3.860, name: '75m SSB', mode: 'LSB', notes: 'General class and above' },
            { freq: 7.185, name: '40m SSB', mode: 'LSB', notes: 'Popular HF band' },
            { freq: 7.230, name: '40m Emergency', mode: 'LSB', notes: 'Traffic/Emergency net' },
            { freq: 14.300, name: '20m Emergency', mode: 'USB', notes: 'International emergency' },
            { freq: 14.285, name: '20m SSB', mode: 'USB', notes: 'Popular DX frequency' },
            { freq: 21.325, name: '15m SSB', mode: 'USB', notes: 'Daytime propagation' },
            { freq: 28.400, name: '10m SSB', mode: 'USB', notes: 'Solar cycle dependent' }
        ]
    };

    /**
     * CTCSS (PL) Tones for privacy/squelch
     */
    const CTCSS_TONES = [
        67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
        97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8,
        136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2,
        192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3
    ];

    /**
     * DCS (Digital Coded Squelch) Codes
     */
    const DCS_CODES = [
        '023', '025', '026', '031', '032', '036', '043', '047', '051', '053',
        '054', '065', '071', '072', '073', '074', '114', '115', '116', '122',
        '125', '131', '132', '134', '143', '145', '152', '155', '156', '162',
        '165', '172', '174', '205', '212', '223', '225', '226', '243', '244',
        '245', '246', '251', '252', '255', '261', '263', '265', '266', '271',
        '274', '306', '311', '315', '325', '331', '332', '343', '346', '351',
        '356', '364', '365', '371', '411', '412', '413', '423', '431', '432',
        '445', '446', '452', '454', '455', '462', '464', '465', '466', '503',
        '506', '516', '523', '526', '532', '546', '565', '606', '612', '624',
        '627', '631', '632', '654', '662', '664', '703', '712', '723', '731',
        '732', '734', '743', '754'
    ];

    // ==========================================
    // CUSTOM FREQUENCIES & RALLY POINTS
    // ==========================================

    let customFrequencies = [];
    let rallyPoints = [];

    /**
     * Load custom frequencies from storage
     */
    async function loadCustomFrequencies() {
        try {
            const saved = await Storage.Settings.get('radioCustomFreqs');
            if (saved) {
                customFrequencies = saved;
            }
        } catch (e) {
            console.warn('Failed to load custom frequencies:', e);
        }
    }

    /**
     * Save custom frequencies to storage
     */
    async function saveCustomFrequencies() {
        try {
            await Storage.Settings.set('radioCustomFreqs', customFrequencies);
        } catch (e) {
            console.warn('Failed to save custom frequencies:', e);
        }
    }

    /**
     * Load rally point frequencies from storage
     */
    async function loadRallyPoints() {
        try {
            const saved = await Storage.Settings.get('radioRallyPoints');
            if (saved) {
                rallyPoints = saved;
            }
        } catch (e) {
            console.warn('Failed to load rally points:', e);
        }
    }

    /**
     * Save rally point frequencies to storage
     */
    async function saveRallyPoints() {
        try {
            await Storage.Settings.set('radioRallyPoints', rallyPoints);
        } catch (e) {
            console.warn('Failed to save rally points:', e);
        }
    }

    /**
     * Add a custom frequency
     */
    function addCustomFrequency(freq) {
        const id = Helpers.generateId();
        const newFreq = {
            id,
            freq: parseFloat(freq.freq),
            name: freq.name || '',
            mode: freq.mode || 'FM',
            tone: freq.tone || null,
            power: freq.power || '',
            notes: freq.notes || '',
            category: freq.category || 'Custom',
            createdAt: new Date().toISOString()
        };
        customFrequencies.push(newFreq);
        saveCustomFrequencies();
        return newFreq;
    }

    /**
     * Update a custom frequency
     */
    function updateCustomFrequency(id, updates) {
        const idx = customFrequencies.findIndex(f => f.id === id);
        if (idx >= 0) {
            customFrequencies[idx] = { ...customFrequencies[idx], ...updates };
            saveCustomFrequencies();
            return customFrequencies[idx];
        }
        return null;
    }

    /**
     * Delete a custom frequency
     */
    function deleteCustomFrequency(id) {
        customFrequencies = customFrequencies.filter(f => f.id !== id);
        saveCustomFrequencies();
    }

    /**
     * Add a rally point with assigned frequency
     */
    function addRallyPoint(rp) {
        const id = Helpers.generateId();
        const newRp = {
            id,
            name: rp.name,
            codename: rp.codename || '',
            freq: parseFloat(rp.freq),
            tone: rp.tone || null,
            lat: rp.lat || null,
            lon: rp.lon || null,
            waypointId: rp.waypointId || null,
            notes: rp.notes || '',
            checkInSchedule: rp.checkInSchedule || null,
            createdAt: new Date().toISOString()
        };
        rallyPoints.push(newRp);
        saveRallyPoints();
        return newRp;
    }

    /**
     * Update a rally point
     */
    function updateRallyPoint(id, updates) {
        const idx = rallyPoints.findIndex(rp => rp.id === id);
        if (idx >= 0) {
            rallyPoints[idx] = { ...rallyPoints[idx], ...updates };
            saveRallyPoints();
            return rallyPoints[idx];
        }
        return null;
    }

    /**
     * Delete a rally point
     */
    function deleteRallyPoint(id) {
        rallyPoints = rallyPoints.filter(rp => rp.id !== id);
        saveRallyPoints();
    }

    // ==========================================
    // PRE-LOADED REPEATER DATABASE
    // ==========================================

    /**
     * Sample repeater database (would be expanded with real data)
     * In production, this could be loaded from a JSON file or API
     */
    const SAMPLE_REPEATERS = [
        // California - Sierra Nevada region
        { callsign: 'W6CX', freq: 147.060, offset: '+', tone: 100.0, location: 'Mt. Diablo, CA', notes: 'Wide coverage' },
        { callsign: 'WR6ABD', freq: 146.850, offset: '-', tone: 110.9, location: 'Oroville, CA', notes: 'Linked system' },
        { callsign: 'K6ACS', freq: 145.130, offset: '-', tone: 100.0, location: 'Sacramento, CA', notes: 'ARES/RACES' },
        { callsign: 'WA6YCZ', freq: 146.730, offset: '-', tone: 100.0, location: 'Fresno, CA', notes: '' },
        { callsign: 'K6TU', freq: 147.150, offset: '+', tone: 100.0, location: 'Loma Prieta, CA', notes: 'Bay Area coverage' },
        
        // Nevada
        { callsign: 'W7RN', freq: 147.030, offset: '+', tone: 123.0, location: 'Reno, NV', notes: 'Northern Nevada' },
        { callsign: 'K7DAA', freq: 146.940, offset: '-', tone: 123.0, location: 'Las Vegas, NV', notes: '' },
        
        // Arizona  
        { callsign: 'W7MOT', freq: 146.620, offset: '-', tone: 162.2, location: 'Phoenix, AZ', notes: 'Metro Phoenix' },
        { callsign: 'K7UGA', freq: 146.960, offset: '-', tone: 141.3, location: 'Tucson, AZ', notes: '' }
    ];

    let repeaters = [...SAMPLE_REPEATERS];

    /**
     * Search repeaters by location or callsign
     */
    function searchRepeaters(query) {
        const q = query.toLowerCase();
        return repeaters.filter(r => 
            r.callsign.toLowerCase().includes(q) ||
            r.location.toLowerCase().includes(q) ||
            r.notes.toLowerCase().includes(q)
        );
    }

    /**
     * Add a custom repeater
     */
    function addRepeater(rpt) {
        const newRpt = {
            id: Helpers.generateId(),
            callsign: rpt.callsign || '',
            freq: parseFloat(rpt.freq),
            offset: rpt.offset || '-',
            tone: rpt.tone ? parseFloat(rpt.tone) : null,
            location: rpt.location || '',
            notes: rpt.notes || '',
            isCustom: true
        };
        repeaters.push(newRpt);
        saveRepeaters();
        return newRpt;
    }

    /**
     * Save repeaters (custom ones)
     */
    async function saveRepeaters() {
        try {
            const custom = repeaters.filter(r => r.isCustom);
            await Storage.Settings.set('radioRepeaters', custom);
        } catch (e) {
            console.warn('Failed to save repeaters:', e);
        }
    }

    /**
     * Load custom repeaters
     */
    async function loadRepeaters() {
        try {
            const saved = await Storage.Settings.get('radioRepeaters');
            if (saved) {
                repeaters = [...SAMPLE_REPEATERS, ...saved];
            }
        } catch (e) {
            console.warn('Failed to load repeaters:', e);
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {
        await loadCustomFrequencies();
        await loadRallyPoints();
        await loadRepeaters();
        console.log('RadioModule initialized');
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    /**
     * Format frequency for display
     */
    function formatFreq(freq, decimals = 4) {
        return parseFloat(freq).toFixed(decimals);
    }

    /**
     * Calculate repeater input frequency
     */
    function calcRepeaterInput(output, offset) {
        const off = parseFloat(offset) || (offset === '+' ? 0.6 : -0.6);
        return output + off;
    }

    /**
     * Get all frequencies in a category
     */
    function getByCategory(category) {
        switch (category) {
            case 'frs': return FRS_CHANNELS;
            case 'gmrs': return GMRS_CHANNELS;
            case 'murs': return MURS_CHANNELS;
            case 'cb': return CB_CHANNELS;
            case 'emergency': return EMERGENCY_FREQUENCIES;
            case 'weather': return WEATHER_FREQUENCIES;
            case 'meshtastic': return MESHTASTIC_CHANNELS;
            case 'ham-vhf': return HAM_FREQUENCIES.vhf;
            case 'ham-uhf': return HAM_FREQUENCIES.uhf;
            case 'ham-hf': return HAM_FREQUENCIES.hf;
            case 'repeaters': return repeaters;
            case 'custom': return customFrequencies;
            case 'rally': return rallyPoints;
            default: return [];
        }
    }

    /**
     * Search all frequencies
     */
    function searchAll(query) {
        const q = query.toLowerCase();
        const results = [];

        const searchIn = (arr, category) => {
            arr.forEach(item => {
                const searchStr = JSON.stringify(item).toLowerCase();
                if (searchStr.includes(q)) {
                    results.push({ ...item, _category: category });
                }
            });
        };

        searchIn(FRS_CHANNELS, 'FRS');
        searchIn(GMRS_CHANNELS, 'GMRS');
        searchIn(MURS_CHANNELS, 'MURS');
        searchIn(CB_CHANNELS, 'CB');
        searchIn(EMERGENCY_FREQUENCIES, 'Emergency');
        searchIn(WEATHER_FREQUENCIES, 'Weather');
        searchIn(MESHTASTIC_CHANNELS, 'Meshtastic');
        searchIn(HAM_FREQUENCIES.vhf, 'Ham VHF');
        searchIn(HAM_FREQUENCIES.uhf, 'Ham UHF');
        searchIn(HAM_FREQUENCIES.hf, 'Ham HF');
        searchIn(repeaters, 'Repeater');
        searchIn(customFrequencies, 'Custom');
        searchIn(rallyPoints, 'Rally Point');

        return results;
    }

    /**
     * Export all data for backup
     */
    function exportData() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            customFrequencies,
            rallyPoints,
            customRepeaters: repeaters.filter(r => r.isCustom)
        };
    }

    /**
     * Import data from backup
     */
    async function importData(data) {
        if (data.customFrequencies) {
            customFrequencies = data.customFrequencies;
            await saveCustomFrequencies();
        }
        if (data.rallyPoints) {
            rallyPoints = data.rallyPoints;
            await saveRallyPoints();
        }
        if (data.customRepeaters) {
            repeaters = [...SAMPLE_REPEATERS, ...data.customRepeaters];
            await saveRepeaters();
        }
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        
        // Frequency databases (read-only)
        FRS_CHANNELS,
        GMRS_CHANNELS,
        MURS_CHANNELS,
        CB_CHANNELS,
        EMERGENCY_FREQUENCIES,
        WEATHER_FREQUENCIES,
        MESHTASTIC_CHANNELS,
        HAM_FREQUENCIES,
        CTCSS_TONES,
        DCS_CODES,
        
        // Getters
        getByCategory,
        getCustomFrequencies: () => customFrequencies,
        getRallyPoints: () => rallyPoints,
        getRepeaters: () => repeaters,
        
        // Custom frequencies
        addCustomFrequency,
        updateCustomFrequency,
        deleteCustomFrequency,
        
        // Rally points
        addRallyPoint,
        updateRallyPoint,
        deleteRallyPoint,
        
        // Repeaters
        addRepeater,
        searchRepeaters,
        
        // Utilities
        formatFreq,
        calcRepeaterInput,
        searchAll,
        
        // Import/Export
        exportData,
        importData
    };
})();

window.RadioModule = RadioModule;
