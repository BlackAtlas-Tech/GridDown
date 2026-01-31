/**
 * GridDown Situation Wizard Module
 * Decision tree that guides users to relevant features based on their situation
 * 
 * Design Philosophy:
 * - Instant response (no AI inference delays)
 * - 100% reliable guidance (no hallucinations)
 * - Stress-friendly (large buttons, clear language)
 * - Works completely offline
 */
const SituationWizard = (function() {
    'use strict';

    // Decision tree structure
    const DECISION_TREE = {
        root: {
            id: 'root',
            question: "What's your situation?",
            subtitle: "Select what best describes your needs right now",
            options: [
                { id: 'lost', icon: '🧭', label: 'Lost / Need Position', description: "Don't know where I am" },
                { id: 'emergency', icon: '🆘', label: 'Emergency', description: 'Need help or rescue' },
                { id: 'communication', icon: '📡', label: 'Need to Communicate', description: 'Contact team or outside' },
                { id: 'navigation', icon: '🗺️', label: 'Navigation Help', description: 'Getting somewhere' },
                { id: 'planning', icon: '📋', label: 'Trip Planning', description: 'Preparing for a trip' },
                { id: 'environment', icon: '🌤️', label: 'Weather / Environment', description: 'Check conditions' }
            ]
        },

        // ==================== LOST / NEED POSITION ====================
        lost: {
            id: 'lost',
            question: "What resources do you have?",
            subtitle: "Select what's available to help determine your position",
            parent: 'root',
            options: [
                { id: 'lost_gps', icon: '📍', label: 'GPS is Working', description: 'Phone shows location' },
                { id: 'lost_landmarks', icon: '🏔️', label: 'Can See Landmarks', description: 'Peaks, towers, or known features visible' },
                { id: 'lost_sky', icon: '⭐', label: 'Can See Sky', description: 'Stars visible or sun position known' },
                { id: 'lost_nothing', icon: '❓', label: 'None of These', description: 'Limited visibility, no GPS' }
            ]
        },

        lost_gps: {
            id: 'lost_gps',
            type: 'solution',
            title: 'Use GPS Location',
            parent: 'lost',
            icon: '📍',
            steps: [
                'Tap the **locate button** (📍) on the map',
                'Wait for GPS to acquire your position',
                'Your location will appear as a blue dot',
                'Check coordinates at bottom of screen'
            ],
            features: [
                { panel: 'map', action: 'locate', label: 'Show My Location', primary: true },
                { panel: 'waypoints', action: 'addHere', label: 'Save This Position' }
            ],
            tips: [
                'Move to open area for better GPS signal',
                'GPS accuracy shown as circle around your position',
                'Save position as waypoint before battery dies'
            ]
        },

        lost_landmarks: {
            id: 'lost_landmarks',
            type: 'solution',
            title: 'Rangefinder Resection',
            parent: 'lost',
            icon: '📐',
            steps: [
                'Open **Search** (🔍) and find visible landmarks by name',
                'Take compass **bearing** to each landmark',
                'Open **Celestial** panel → **Resection** widget',
                'Enter bearings for 2-3 landmarks',
                'GridDown calculates your position'
            ],
            features: [
                { panel: 'celestial', section: 'resection', label: 'Open Resection Tool', primary: true },
                { action: 'search', query: 'l:', label: 'Search Landmarks' }
            ],
            tips: [
                'Use at least 2 landmarks, 3 is better',
                'Landmarks 60-120° apart give best accuracy',
                'Peaks, towers, and summits work best',
                'Check bearing with phone compass or visual estimate'
            ]
        },

        lost_sky: {
            id: 'lost_sky',
            question: 'Day or night?',
            subtitle: 'Different techniques work for different times',
            parent: 'lost',
            options: [
                { id: 'lost_sky_day', icon: '☀️', label: 'Daytime', description: 'Sun is visible' },
                { id: 'lost_sky_night', icon: '🌙', label: 'Nighttime', description: 'Stars are visible' }
            ]
        },

        lost_sky_day: {
            id: 'lost_sky_day',
            type: 'solution',
            title: 'Noon Sight / Sun Position',
            parent: 'lost_sky',
            icon: '☀️',
            steps: [
                'Open **Celestial** panel',
                'Use **Noon Sight** tool around solar noon',
                'Measure sun angle with camera sextant',
                'GridDown calculates your latitude'
            ],
            features: [
                { panel: 'celestial', section: 'noon', label: 'Open Noon Sight', primary: true },
                { panel: 'celestial', section: 'sunmoon', label: 'Check Solar Noon Time' }
            ],
            tips: [
                'Solar noon is when sun is highest (not always 12:00)',
                'Best accuracy within 15 min of solar noon',
                'Gives latitude only - use landmarks for longitude',
                'Check Sun/Moon panel for exact noon time'
            ]
        },

        lost_sky_night: {
            id: 'lost_sky_night',
            type: 'solution',
            title: 'Celestial Navigation',
            parent: 'lost_sky',
            icon: '⭐',
            steps: [
                'Open **Celestial** panel → **Star Chart**',
                'Identify stars using **Star ID** camera',
                'Measure altitude of Polaris (North Star)',
                'Polaris altitude = your latitude'
            ],
            features: [
                { panel: 'celestial', section: 'starchart', label: 'Open Star Chart', primary: true },
                { panel: 'celestial', section: 'starid', label: 'Identify Stars' },
                { panel: 'celestial', section: 'sextant', label: 'Camera Sextant' }
            ],
            tips: [
                'Polaris altitude equals your latitude (Northern Hemisphere)',
                'Find Polaris using Big Dipper pointer stars',
                'Southern Hemisphere: use Southern Cross',
                'Accuracy improves with multiple star sights'
            ]
        },

        lost_nothing: {
            id: 'lost_nothing',
            type: 'solution',
            title: 'Dead Reckoning',
            parent: 'lost',
            icon: '🧭',
            steps: [
                'Open **Navigation** panel',
                'Start **Track Recording** to log movement',
                'Use compass to maintain consistent heading',
                'Count paces to estimate distance traveled',
                'Backtrack using recorded track if needed'
            ],
            features: [
                { panel: 'navigation', action: 'startTrack', label: 'Start Tracking', primary: true },
                { panel: 'celestial', section: 'compass', label: 'Use Compass' }
            ],
            tips: [
                'Stay calm - panic causes poor decisions',
                'Follow terrain features (ridges, streams) when possible',
                'If truly lost, STOP: Sit, Think, Observe, Plan',
                'Consider signaling for help instead of wandering'
            ]
        },

        // ==================== EMERGENCY ====================
        emergency: {
            id: 'emergency',
            question: 'What type of emergency?',
            subtitle: 'Select the situation that applies',
            parent: 'root',
            options: [
                { id: 'emergency_rescue', icon: '🚁', label: 'Need Rescue', description: 'Stranded, injured, or in danger' },
                { id: 'emergency_medical', icon: '🏥', label: 'Medical Emergency', description: 'Injury or illness' },
                { id: 'emergency_signal', icon: '📢', label: 'Need to Signal', description: 'Attract attention' },
                { id: 'emergency_shelter', icon: '🏕️', label: 'Need Shelter', description: 'Exposure risk' }
            ]
        },

        emergency_rescue: {
            id: 'emergency_rescue',
            type: 'solution',
            title: 'Emergency SOS',
            parent: 'emergency',
            icon: '🆘',
            urgent: true,
            steps: [
                'Open **SOS** panel immediately',
                'Activate **Emergency Mode**',
                'Note your **coordinates** to share',
                'If you have a PLB/satellite device, activate it',
                'Stay in place if safe - rescuers will come to you'
            ],
            features: [
                { panel: 'sos', action: 'activate', label: 'ACTIVATE SOS', primary: true, danger: true },
                { action: 'copyCoords', label: 'Copy My Coordinates' }
            ],
            tips: [
                'SOS mode makes screen flash for visual signal',
                'Share coordinates via any available communication',
                '406 MHz beacons (PLB/ELT) are monitored globally',
                'Stay put unless immediate danger - movement makes rescue harder'
            ]
        },

        emergency_medical: {
            id: 'emergency_medical',
            type: 'solution',
            title: 'Medical Reference',
            parent: 'emergency',
            icon: '🏥',
            urgent: true,
            steps: [
                'Open **Medical** panel for treatment guidance',
                'Assess: Airway, Breathing, Circulation',
                'Control any bleeding with direct pressure',
                'Keep patient warm and calm',
                'Prepare to evacuate or signal for help'
            ],
            features: [
                { panel: 'medical', label: 'Open Medical Guide', primary: true },
                { panel: 'sos', label: 'Signal for Help' }
            ],
            tips: [
                'Stabilize before moving if spinal injury possible',
                'Treat for shock: elevate legs, maintain warmth',
                'Document symptoms, time, and treatments given',
                'Prepare SOAP note for responders'
            ]
        },

        emergency_signal: {
            id: 'emergency_signal',
            type: 'solution',
            title: 'Signaling Methods',
            parent: 'emergency',
            icon: '📢',
            steps: [
                'Open **SOS** panel for signal tools',
                'Use **mirror flash** toward aircraft/searchers',
                'Create ground-to-air signals if possible',
                'Three of anything = distress (3 fires, 3 whistles)',
                'Stay visible in clearings'
            ],
            features: [
                { panel: 'sos', action: 'mirror', label: 'Signal Mirror Mode', primary: true },
                { panel: 'sos', action: 'strobe', label: 'Light Strobe' }
            ],
            tips: [
                'Mirror flash visible 10+ miles in sunlight',
                'Universal distress: X on ground, 3 fires in triangle',
                'Whistle carries further than voice',
                'At night: flashlight in sweeping motion'
            ]
        },

        emergency_shelter: {
            id: 'emergency_shelter',
            type: 'solution',
            title: 'Finding Shelter',
            parent: 'emergency',
            icon: '🏕️',
            steps: [
                'Check **Weather** panel for incoming conditions',
                'Use **Map** to find terrain shelter (lee side of ridge)',
                'Look for natural features: caves, overhangs, dense trees',
                'Prioritize: wind protection > rain > ground insulation',
                'Mark shelter location as waypoint'
            ],
            features: [
                { panel: 'weather', label: 'Check Weather', primary: true },
                { panel: 'map', label: 'Study Terrain' },
                { panel: 'waypoints', action: 'add', label: 'Mark Location' }
            ],
            tips: [
                'Avoid valley bottoms (cold air pools)',
                'Stay away from lone trees (lightning)',
                'Insulate from ground - most heat lost downward',
                'Small space heats faster than large'
            ]
        },

        // ==================== COMMUNICATION ====================
        communication: {
            id: 'communication',
            question: 'What communication method?',
            subtitle: 'Select available equipment',
            parent: 'root',
            options: [
                { id: 'comm_meshtastic', icon: '📶', label: 'Meshtastic / LoRa', description: 'Mesh radio network' },
                { id: 'comm_radio', icon: '📻', label: 'Ham / GMRS Radio', description: 'Voice radio' },
                { id: 'comm_aprs', icon: '📍', label: 'APRS', description: 'Packet radio position' },
                { id: 'comm_none', icon: '❌', label: 'No Radio Equipment', description: 'Phone/satellite only' }
            ]
        },

        comm_meshtastic: {
            id: 'comm_meshtastic',
            type: 'solution',
            title: 'Meshtastic Mesh Network',
            parent: 'communication',
            icon: '📶',
            steps: [
                'Open **Meshtastic** panel',
                'Connect to your Meshtastic device via Bluetooth',
                'Your position auto-shares to mesh network',
                'Send/receive text messages with team',
                'View team member positions on map'
            ],
            features: [
                { panel: 'meshtastic', label: 'Open Meshtastic', primary: true },
                { panel: 'team', label: 'View Team Positions' }
            ],
            tips: [
                'Range: 1-10+ miles depending on terrain',
                'Messages relay through other nodes automatically',
                'Battery lasts days on low power mode',
                'No cell service or license required'
            ]
        },

        comm_radio: {
            id: 'comm_radio',
            type: 'solution',
            title: 'Radio Communication',
            parent: 'communication',
            icon: '📻',
            steps: [
                'Open **Radio** panel for frequency management',
                'Select appropriate frequency for your license/radio',
                'Standard calling frequencies listed by band',
                'For emergencies: 146.52 MHz (Ham), 462.675 MHz (GMRS)',
                'Announce location and situation clearly'
            ],
            features: [
                { panel: 'radio', label: 'Open Radio Panel', primary: true },
                { action: 'search', query: 'emergency frequency', label: 'Find Emergency Frequencies' }
            ],
            tips: [
                'Ham: 146.52 MHz national simplex calling',
                'GMRS: Channel 20 (462.675 MHz) emergency',
                'FRS: Channel 1 for general, 3 for emergency',
                'Repeat your message - first transmission often missed'
            ]
        },

        comm_aprs: {
            id: 'comm_aprs',
            type: 'solution',
            title: 'APRS Position Reporting',
            parent: 'communication',
            icon: '📍',
            steps: [
                'Open **APRS** panel',
                'Connect to your APRS radio/device',
                'Enable position beaconing',
                'Your position visible on APRS network',
                'Can send short status messages'
            ],
            features: [
                { panel: 'aprs', label: 'Open APRS Panel', primary: true }
            ],
            tips: [
                'APRS positions visible at aprs.fi worldwide',
                'Requires amateur radio license',
                'Position updates can trigger email alerts',
                'Works even in remote areas via digipeaters'
            ]
        },

        comm_none: {
            id: 'comm_none',
            type: 'solution',
            title: 'Alternative Communication',
            parent: 'communication',
            icon: '📱',
            steps: [
                'If any cell signal: send SMS (uses less bandwidth)',
                'Try high ground for better signal',
                'Share your coordinates in any message',
                'If satellite messenger available, use check-in feature',
                'Consider visual signals for nearby searchers'
            ],
            features: [
                { action: 'copyCoords', label: 'Copy Coordinates to Share', primary: true },
                { panel: 'sos', label: 'Visual Signaling' }
            ],
            tips: [
                'SMS often works when data/voice fails',
                'Text your coordinates to emergency contact',
                'Satellite messengers (Garmin inReach, SPOT) work globally',
                'Conserve phone battery for communication attempts'
            ]
        },

        // ==================== NAVIGATION ====================
        navigation: {
            id: 'navigation',
            question: 'What navigation help do you need?',
            subtitle: 'Select your navigation challenge',
            parent: 'root',
            options: [
                { id: 'nav_route', icon: '🛣️', label: 'Follow a Route', description: 'Navigate to destination' },
                { id: 'nav_bearing', icon: '🧭', label: 'Bearing to Point', description: 'Direction to specific location' },
                { id: 'nav_offroute', icon: '↩️', label: 'Got Off Route', description: 'Need to get back on track' },
                { id: 'nav_terrain', icon: '⛰️', label: 'Terrain Navigation', description: 'Reading the landscape' }
            ]
        },

        nav_route: {
            id: 'nav_route',
            type: 'solution',
            title: 'Route Navigation',
            parent: 'navigation',
            icon: '🛣️',
            steps: [
                'Open **Routes** panel',
                'Select your route or create new one',
                'Tap **Start Navigation**',
                'Follow turn-by-turn guidance',
                'Voice prompts alert upcoming turns'
            ],
            features: [
                { panel: 'routes', label: 'Open Routes', primary: true },
                { panel: 'navigation', action: 'start', label: 'Start Navigation' }
            ],
            tips: [
                'Download offline maps before losing signal',
                'Check elevation profile for upcoming climbs',
                'Set off-route alerts to catch mistakes early',
                'Save rest stops as waypoints'
            ]
        },

        nav_bearing: {
            id: 'nav_bearing',
            type: 'solution',
            title: 'Compass Bearing',
            parent: 'navigation',
            icon: '🧭',
            steps: [
                'Open **Search** and find your destination',
                'Or tap a waypoint on the map',
                'Note the **bearing** and **distance** shown',
                'Open **Celestial** panel for compass',
                'Walk toward the bearing, checking periodically'
            ],
            features: [
                { action: 'search', label: 'Search Destination', primary: true },
                { panel: 'celestial', section: 'compass', label: 'Open Compass' }
            ],
            tips: [
                'Pick a landmark on your bearing to walk toward',
                'Account for declination (auto-applied in GridDown)',
                'Recheck bearing every 10-15 minutes',
                'Detour around obstacles, then return to bearing'
            ]
        },

        nav_offroute: {
            id: 'nav_offroute',
            type: 'solution',
            title: 'Getting Back on Route',
            parent: 'navigation',
            icon: '↩️',
            steps: [
                'Check **Navigation** panel for off-route distance',
                'View route on map to see closest point',
                'Option 1: Return to route at nearest point',
                'Option 2: Navigate direct to next waypoint',
                'Recalculate if terrain blocks direct return'
            ],
            features: [
                { panel: 'navigation', label: 'Check Navigation Status', primary: true },
                { panel: 'map', label: 'View Route on Map' }
            ],
            tips: [
                'Sometimes continuing forward rejoins route naturally',
                'Check if shortcut exists to later waypoint',
                "Don't fight terrain - go around obstacles",
                'Mark current position before attempting return'
            ]
        },

        nav_terrain: {
            id: 'nav_terrain',
            type: 'solution',
            title: 'Terrain Navigation',
            parent: 'navigation',
            icon: '⛰️',
            steps: [
                'Switch map to **Topo** layer for contour lines',
                'Identify terrain features around you',
                'Match features to map (ridges, valleys, saddles)',
                'Use **Measure** tool to estimate distances',
                'Navigate using terrain association'
            ],
            features: [
                { panel: 'layers', action: 'topo', label: 'Switch to Topo Map', primary: true },
                { action: 'measure', label: 'Measure Distance' }
            ],
            tips: [
                'Contour lines close together = steep terrain',
                'Streams flow downhill (V points upstream)',
                'Ridge tops safer travel than valley bottoms',
                'Attack points: navigate to feature, then to destination'
            ]
        },

        // ==================== PLANNING ====================
        planning: {
            id: 'planning',
            question: 'What are you planning?',
            subtitle: 'Select your planning needs',
            parent: 'root',
            options: [
                { id: 'plan_route', icon: '🗺️', label: 'Build a Route', description: 'Plan path to destination' },
                { id: 'plan_logistics', icon: '⛽', label: 'Logistics / Supplies', description: 'Fuel, water, food needs' },
                { id: 'plan_contingency', icon: '🔄', label: 'Contingency Plans', description: 'Backup options' },
                { id: 'plan_download', icon: '📥', label: 'Download Offline Maps', description: 'Prepare for no signal' }
            ]
        },

        plan_route: {
            id: 'plan_route',
            type: 'solution',
            title: 'Route Building',
            parent: 'planning',
            icon: '🗺️',
            steps: [
                'Open **Routes** panel',
                'Tap **New Route**',
                'Click map to add waypoints',
                'Drag waypoints to reorder',
                'Review elevation profile and distance'
            ],
            features: [
                { panel: 'routes', action: 'new', label: 'Create New Route', primary: true },
                { panel: 'routes', section: 'elevation', label: 'View Elevation Profile' }
            ],
            tips: [
                'Add waypoints at decision points and landmarks',
                'Check terrain difficulty between waypoints',
                'Consider bail-out points for emergencies',
                'Export route as GPX for backup'
            ]
        },

        plan_logistics: {
            id: 'plan_logistics',
            type: 'solution',
            title: 'Logistics Calculator',
            parent: 'planning',
            icon: '⛽',
            steps: [
                'Open **Logistics** panel',
                'Select route to analyze',
                'Set **vehicle type** and **party size**',
                'Review fuel, water, and food requirements',
                'Check resupply points along route'
            ],
            features: [
                { panel: 'logistics', label: 'Open Logistics Calculator', primary: true }
            ],
            tips: [
                'Add 20% safety margin to all estimates',
                'Water needs increase dramatically in heat',
                'Mark cache locations as waypoints',
                'Plan for contingency: "What if this cache is empty?"'
            ]
        },

        plan_contingency: {
            id: 'plan_contingency',
            type: 'solution',
            title: 'Contingency Planning',
            parent: 'planning',
            icon: '🔄',
            steps: [
                'Open **Contingency** panel',
                'Identify **bail-out points** along route',
                'Calculate distances to safety from each point',
                'Set **checkpoints** for progress tracking',
                'Define go/no-go criteria for the trip'
            ],
            features: [
                { panel: 'contingency', label: 'Open Contingency Planner', primary: true },
                { panel: 'waypoints', action: 'addBailout', label: 'Add Bail-out Points' }
            ],
            tips: [
                'Every route should have bail-out options',
                'Share trip plan with emergency contact',
                'Set turnaround times and stick to them',
                'Know nearest road/help at every point'
            ]
        },

        plan_download: {
            id: 'plan_download',
            type: 'solution',
            title: 'Offline Map Download',
            parent: 'planning',
            icon: '📥',
            steps: [
                'Open **Offline** panel',
                'Pan/zoom map to your area of interest',
                'Tap **Draw Region** and select area',
                'Choose zoom levels (higher = more detail, more storage)',
                'Tap **Download** and wait for completion'
            ],
            features: [
                { panel: 'offline', label: 'Open Offline Maps', primary: true }
            ],
            tips: [
                'Download on WiFi to save cellular data',
                'Higher zoom levels need much more storage',
                'Download larger area than you think you need',
                'Verify download works by enabling airplane mode'
            ]
        },

        // ==================== ENVIRONMENT ====================
        environment: {
            id: 'environment',
            question: 'What environmental info do you need?',
            subtitle: 'Select the information type',
            parent: 'root',
            options: [
                { id: 'env_weather', icon: '🌤️', label: 'Weather Forecast', description: 'Current and upcoming' },
                { id: 'env_pressure', icon: '🌡️', label: 'Barometric Pressure', description: 'Pressure trends' },
                { id: 'env_sun', icon: '☀️', label: 'Sun / Moon Times', description: 'Sunrise, sunset, phases' },
                { id: 'env_radiation', icon: '☢️', label: 'Radiation Monitoring', description: 'Radiacode detector' }
            ]
        },

        env_weather: {
            id: 'env_weather',
            type: 'solution',
            title: 'Weather Information',
            parent: 'environment',
            icon: '🌤️',
            steps: [
                'Open **Weather** panel',
                'View current conditions at your location',
                'Check hourly and daily forecast',
                'Review any active weather alerts',
                'Plan activities around weather windows'
            ],
            features: [
                { panel: 'weather', label: 'Open Weather Panel', primary: true },
                { panel: 'satweather', label: 'Satellite Weather Images' }
            ],
            tips: [
                'Weather data requires internet connection',
                'Use barometer for offline weather trends',
                'Satellite images show storm systems approaching',
                'Mountain weather changes faster than forecast'
            ]
        },

        env_pressure: {
            id: 'env_pressure',
            type: 'solution',
            title: 'Barometric Pressure',
            parent: 'environment',
            icon: '🌡️',
            steps: [
                'Open **Barometer** panel',
                'Note current pressure reading',
                'Watch **trend** over 1-3 hours',
                'Falling pressure = weather deteriorating',
                'Rising pressure = weather improving'
            ],
            features: [
                { panel: 'barometer', label: 'Open Barometer', primary: true }
            ],
            tips: [
                'Rapid drop (>3mb/3hr) = storm approaching',
                'Works completely offline',
                'Calibrate when you know your elevation',
                'Also useful for rough altitude estimation'
            ]
        },

        env_sun: {
            id: 'env_sun',
            type: 'solution',
            title: 'Sun & Moon Information',
            parent: 'environment',
            icon: '☀️',
            steps: [
                'Open **Celestial** panel → **Sun/Moon** section',
                'View sunrise and sunset times',
                'Check civil, nautical, astronomical twilight',
                'See current moon phase and rise/set times',
                'Plan activities around available light'
            ],
            features: [
                { panel: 'celestial', section: 'sunmoon', label: 'Open Sun/Moon Panel', primary: true }
            ],
            tips: [
                'Civil twilight: enough light to work outside',
                'Full moon provides significant night visibility',
                'Solar noon is best time for noon sight navigation',
                'Works completely offline'
            ]
        },

        env_radiation: {
            id: 'env_radiation',
            type: 'solution',
            title: 'Radiation Monitoring',
            parent: 'environment',
            icon: '☢️',
            steps: [
                'Connect **Radiacode** detector via Bluetooth',
                'Open **Radiacode** panel',
                'View current dose rate (μSv/h)',
                'Check cumulative dose',
                'Set alerts for elevated readings'
            ],
            features: [
                { panel: 'radiacode', label: 'Open Radiacode Panel', primary: true }
            ],
            tips: [
                'Normal background: 0.05-0.2 μSv/h',
                'Elevated readings may indicate contamination',
                'Spectrum analysis identifies isotopes',
                'Requires Radiacode hardware device'
            ]
        }
    };

    // State
    let isOpen = false;
    let currentNode = null;
    let history = [];
    let wizardContainer = null;

    /**
     * Initialize the wizard
     */
    function init() {
        createWizardUI();
        setupKeyboardShortcuts();
        console.log('Situation Wizard initialized');
    }

    /**
     * Create the wizard UI container
     */
    function createWizardUI() {
        wizardContainer = document.createElement('div');
        wizardContainer.className = 'situation-wizard';
        wizardContainer.id = 'situation-wizard';
        wizardContainer.setAttribute('role', 'dialog');
        wizardContainer.setAttribute('aria-modal', 'true');
        wizardContainer.setAttribute('aria-labelledby', 'wizard-title');
        wizardContainer.setAttribute('aria-hidden', 'true');

        wizardContainer.innerHTML = `
            <div class="situation-wizard__backdrop"></div>
            <div class="situation-wizard__dialog">
                <div class="situation-wizard__header">
                    <button class="situation-wizard__back" id="wizard-back" aria-label="Go back" style="display:none">
                        ← Back
                    </button>
                    <h2 class="situation-wizard__title" id="wizard-title">Situation Wizard</h2>
                    <button class="situation-wizard__close" id="wizard-close" aria-label="Close wizard">
                        ✕
                    </button>
                </div>
                <div class="situation-wizard__content" id="wizard-content">
                    <!-- Dynamic content inserted here -->
                </div>
            </div>
        `;

        document.body.appendChild(wizardContainer);

        // Bind events
        wizardContainer.querySelector('.situation-wizard__backdrop').addEventListener('click', close);
        wizardContainer.querySelector('#wizard-close').addEventListener('click', close);
        wizardContainer.querySelector('#wizard-back').addEventListener('click', goBack);
    }

    /**
     * Set up keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape to close
            if (e.key === 'Escape' && isOpen) {
                close();
            }
            
            // F1 or Ctrl+? to open
            if (e.key === 'F1' || (e.ctrlKey && e.key === '/')) {
                e.preventDefault();
                open();
            }
        });
    }

    /**
     * Open the wizard
     */
    function open() {
        if (isOpen) return;

        isOpen = true;
        history = [];
        currentNode = null;

        wizardContainer.classList.add('situation-wizard--open');
        wizardContainer.setAttribute('aria-hidden', 'false');

        // Start at root
        navigateTo('root');

        // Haptic feedback
        if (typeof MobileModule !== 'undefined') {
            MobileModule.haptic('light');
        }
    }

    /**
     * Close the wizard
     */
    function close() {
        if (!isOpen) return;

        isOpen = false;
        wizardContainer.classList.remove('situation-wizard--open');
        wizardContainer.setAttribute('aria-hidden', 'true');
    }

    /**
     * Navigate to a tree node
     */
    function navigateTo(nodeId) {
        const node = DECISION_TREE[nodeId];
        if (!node) {
            console.warn('Unknown wizard node:', nodeId);
            return;
        }

        // Add to history (except root)
        if (currentNode && currentNode.id !== 'root') {
            history.push(currentNode.id);
        }

        currentNode = node;
        renderNode(node);

        // Update back button visibility
        const backBtn = wizardContainer.querySelector('#wizard-back');
        backBtn.style.display = (nodeId === 'root') ? 'none' : 'block';
    }

    /**
     * Go back in history
     */
    function goBack() {
        if (history.length === 0) {
            navigateTo('root');
        } else {
            const prevId = history.pop();
            currentNode = DECISION_TREE[prevId];
            renderNode(currentNode);

            // Update back button
            const backBtn = wizardContainer.querySelector('#wizard-back');
            backBtn.style.display = (currentNode.id === 'root') ? 'none' : 'block';
        }
    }

    /**
     * Render a decision tree node
     */
    function renderNode(node) {
        const content = wizardContainer.querySelector('#wizard-content');
        const title = wizardContainer.querySelector('#wizard-title');

        if (node.type === 'solution') {
            renderSolution(node, content, title);
        } else {
            renderQuestion(node, content, title);
        }
    }

    /**
     * Render a question node with options
     */
    function renderQuestion(node, content, title) {
        title.textContent = node.question;

        let html = '';
        
        if (node.subtitle) {
            html += `<p class="situation-wizard__subtitle">${node.subtitle}</p>`;
        }

        html += '<div class="situation-wizard__options">';
        
        node.options.forEach(opt => {
            html += `
                <button class="situation-wizard__option" data-target="${opt.id}">
                    <span class="situation-wizard__option-icon">${opt.icon}</span>
                    <div class="situation-wizard__option-text">
                        <div class="situation-wizard__option-label">${opt.label}</div>
                        <div class="situation-wizard__option-desc">${opt.description}</div>
                    </div>
                    <span class="situation-wizard__option-arrow">→</span>
                </button>
            `;
        });

        html += '</div>';

        content.innerHTML = html;

        // Bind option clicks
        content.querySelectorAll('.situation-wizard__option').forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof MobileModule !== 'undefined') {
                    MobileModule.haptic('light');
                }
                navigateTo(btn.dataset.target);
            });
        });
    }

    /**
     * Render a solution node
     */
    function renderSolution(node, content, title) {
        title.textContent = node.title;

        let html = '';

        // Urgent banner
        if (node.urgent) {
            html += `<div class="situation-wizard__urgent">⚠️ Act quickly but stay calm</div>`;
        }

        // Steps
        html += '<div class="situation-wizard__steps">';
        html += '<h3 class="situation-wizard__section-title">Steps to Follow</h3>';
        html += '<ol class="situation-wizard__step-list">';
        node.steps.forEach(step => {
            // Convert **text** to <strong>
            const formatted = step.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            html += `<li class="situation-wizard__step">${formatted}</li>`;
        });
        html += '</ol></div>';

        // Feature buttons
        if (node.features && node.features.length > 0) {
            html += '<div class="situation-wizard__features">';
            html += '<h3 class="situation-wizard__section-title">Quick Actions</h3>';
            html += '<div class="situation-wizard__feature-grid">';
            
            node.features.forEach(feature => {
                const primaryClass = feature.primary ? 'situation-wizard__feature--primary' : '';
                const dangerClass = feature.danger ? 'situation-wizard__feature--danger' : '';
                
                html += `
                    <button class="situation-wizard__feature ${primaryClass} ${dangerClass}" 
                            data-panel="${feature.panel || ''}" 
                            data-section="${feature.section || ''}"
                            data-action="${feature.action || ''}"
                            data-query="${feature.query || ''}">
                        ${feature.label}
                    </button>
                `;
            });
            
            html += '</div></div>';
        }

        // Tips
        if (node.tips && node.tips.length > 0) {
            html += '<div class="situation-wizard__tips">';
            html += '<h3 class="situation-wizard__section-title">💡 Tips</h3>';
            html += '<ul class="situation-wizard__tip-list">';
            node.tips.forEach(tip => {
                html += `<li class="situation-wizard__tip">${tip}</li>`;
            });
            html += '</ul></div>';
        }

        content.innerHTML = html;

        // Bind feature button clicks
        content.querySelectorAll('.situation-wizard__feature').forEach(btn => {
            btn.addEventListener('click', () => {
                executeFeature(btn.dataset);
            });
        });
    }

    /**
     * Execute a feature action
     */
    function executeFeature(data) {
        // Haptic feedback
        if (typeof MobileModule !== 'undefined') {
            MobileModule.haptic('medium');
        }

        // Handle search actions
        if (data.action === 'search') {
            close();
            if (typeof SearchModule !== 'undefined') {
                SearchModule.open();
                if (data.query) {
                    // Pre-fill query
                    setTimeout(() => {
                        const input = document.querySelector('#global-search-input');
                        if (input) {
                            input.value = data.query;
                            input.dispatchEvent(new Event('input'));
                        }
                    }, 100);
                }
            }
            return;
        }

        // Handle coordinate copy
        if (data.action === 'copyCoords') {
            close();
            const gps = State.get('gps');
            if (gps && gps.lat && gps.lon) {
                const coords = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
                navigator.clipboard.writeText(coords);
                if (typeof ModalsModule !== 'undefined') {
                    ModalsModule.showToast('📋 Coordinates copied!', 'success');
                }
            } else {
                if (typeof ModalsModule !== 'undefined') {
                    ModalsModule.showToast('📍 GPS position not available', 'warning');
                }
            }
            return;
        }

        // Handle measure tool
        if (data.action === 'measure') {
            close();
            if (typeof MeasureModule !== 'undefined') {
                MeasureModule.activate();
            }
            return;
        }

        // Handle panel navigation
        if (data.panel) {
            close();
            
            // Open sidebar on mobile
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('open');
            
            // Open panel
            const panel = document.getElementById('panel');
            if (panel) panel.classList.add('panel--open');
            
            // Set active panel
            if (typeof State !== 'undefined') {
                State.UI.setActivePanel(data.panel);
                Events.emit(Events.EVENTS.PANEL_CHANGE, { panel: data.panel });
            }

            // Scroll to section if specified
            if (data.section) {
                setTimeout(() => {
                    const section = document.querySelector(`[data-section="${data.section}"]`) ||
                                  document.getElementById(data.section);
                    if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 300);
            }

            // Execute panel-specific actions
            if (data.action) {
                setTimeout(() => {
                    executePanelAction(data.panel, data.action);
                }, 100);
            }
        }
    }

    /**
     * Execute panel-specific action
     */
    function executePanelAction(panel, action) {
        switch (panel) {
            case 'sos':
                if (action === 'activate' && typeof SOSModule !== 'undefined') {
                    SOSModule.activate();
                }
                break;
            case 'navigation':
                if (action === 'startTrack' && typeof NavigationModule !== 'undefined') {
                    NavigationModule.startTracking();
                }
                break;
            case 'routes':
                if (action === 'new' && typeof RouteBuilderModule !== 'undefined') {
                    RouteBuilderModule.startNewRoute();
                }
                break;
            case 'map':
                if (action === 'locate' && typeof MapModule !== 'undefined') {
                    MapModule.centerOnUser();
                }
                break;
            case 'layers':
                if (action === 'topo' && typeof MapModule !== 'undefined') {
                    MapModule.setBaseLayer('usgs_topo');
                }
                break;
        }
    }

    /**
     * Check if wizard is open
     */
    function isWizardOpen() {
        return isOpen;
    }

    /**
     * Get decision tree for external use
     */
    function getDecisionTree() {
        return DECISION_TREE;
    }

    // Public API
    return {
        init,
        open,
        close,
        isOpen: isWizardOpen,
        navigateTo,
        goBack,
        getDecisionTree,
        DECISION_TREE
    };
})();

// Auto-initialize
if (typeof window !== 'undefined') {
    window.SituationWizard = SituationWizard;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SituationWizard.init());
    } else {
        SituationWizard.init();
    }
}
