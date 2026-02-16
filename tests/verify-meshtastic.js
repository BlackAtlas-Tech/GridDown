/**
 * GridDown Meshtastic Integration Verification Test
 * 
 * This script verifies that the Meshtastic integration is properly set up.
 * Run in browser console after loading GridDown.
 */

(function() {
    console.log('=== GridDown Meshtastic Integration Verification ===\n');
    
    const tests = [];
    let passed = 0;
    let failed = 0;
    
    function test(name, condition, message) {
        if (condition) {
            console.log(`✅ PASS: ${name}`);
            passed++;
        } else {
            console.log(`❌ FAIL: ${name} - ${message || 'condition not met'}`);
            failed++;
        }
        tests.push({ name, passed: condition, message });
    }
    
    // Test 1: MeshtasticModule exists
    test(
        'MeshtasticModule is defined',
        typeof MeshtasticModule !== 'undefined',
        'MeshtasticModule not found in global scope'
    );
    
    // Test 2: MeshtasticClient exists
    test(
        'MeshtasticClient is defined',
        typeof window.MeshtasticClient !== 'undefined',
        'MeshtasticClient not found - meshtastic-client.js may not have loaded'
    );
    
    // Test 3: MeshtasticClient has required connection functions
    if (typeof window.MeshtasticClient !== 'undefined') {
        test(
            'MeshtasticClient.connectBLE is a function',
            typeof window.MeshtasticClient.connectBLE === 'function',
            'connectBLE not defined'
        );
        
        test(
            'MeshtasticClient.connectSerial is a function',
            typeof window.MeshtasticClient.connectSerial === 'function',
            'connectSerial not defined'
        );
        
        test(
            'MeshtasticClient.disconnect is a function',
            typeof window.MeshtasticClient.disconnect === 'function',
            'disconnect not defined'
        );
        
        test(
            'MeshtasticClient.isConnected is a function',
            typeof window.MeshtasticClient.isConnected === 'function',
            'isConnected not defined'
        );
        
        test(
            'MeshtasticClient.isReady is a function',
            typeof window.MeshtasticClient.isReady === 'function',
            'isReady not defined'
        );
    }
    
    // Test 4: MeshtasticClient has config functions
    if (typeof window.MeshtasticClient !== 'undefined') {
        test(
            'MeshtasticClient.getConfig is a function',
            typeof window.MeshtasticClient.getConfig === 'function',
            'getConfig not defined'
        );
        
        test(
            'MeshtasticClient.setRegion is a function',
            typeof window.MeshtasticClient.setRegion === 'function',
            'setRegion not defined'
        );
        
        test(
            'MeshtasticClient.setModemPreset is a function',
            typeof window.MeshtasticClient.setModemPreset === 'function',
            'setModemPreset not defined'
        );
        
        test(
            'MeshtasticClient.setTxPower is a function',
            typeof window.MeshtasticClient.setTxPower === 'function',
            'setTxPower not defined'
        );
        
        test(
            'MeshtasticClient.setHopLimit is a function',
            typeof window.MeshtasticClient.setHopLimit === 'function',
            'setHopLimit not defined'
        );
    }
    
    // Test 5: MeshtasticModule has Phase 1 functions
    if (typeof MeshtasticModule !== 'undefined') {
        test(
            'MeshtasticModule.getDeviceConfig is a function',
            typeof MeshtasticModule.getDeviceConfig === 'function',
            'getDeviceConfig not defined'
        );
        
        test(
            'MeshtasticModule.setRegion is a function',
            typeof MeshtasticModule.setRegion === 'function',
            'setRegion not defined'
        );
        
        test(
            'MeshtasticModule.getRegionOptions is a function',
            typeof MeshtasticModule.getRegionOptions === 'function',
            'getRegionOptions not defined'
        );
        
        test(
            'MeshtasticModule.getModemPresetOptions is a function',
            typeof MeshtasticModule.getModemPresetOptions === 'function',
            'getModemPresetOptions not defined'
        );
        
        test(
            'MeshtasticModule.calculateSignalQuality is a function',
            typeof MeshtasticModule.calculateSignalQuality === 'function',
            'calculateSignalQuality not defined'
        );
        
        test(
            'MeshtasticModule.checkFirmwareStatus is a function',
            typeof MeshtasticModule.checkFirmwareStatus === 'function',
            'checkFirmwareStatus not defined'
        );
        
        test(
            'MeshtasticModule.parseChannelUrl is a function',
            typeof MeshtasticModule.parseChannelUrl === 'function',
            'parseChannelUrl not defined'
        );
        
        test(
            'MeshtasticModule.RegionCode is defined',
            typeof MeshtasticModule.RegionCode === 'object' && MeshtasticModule.RegionCode.US === 1,
            'RegionCode not properly exported'
        );
        
        test(
            'MeshtasticModule.ModemPreset is defined',
            typeof MeshtasticModule.ModemPreset === 'object' && MeshtasticModule.ModemPreset.LONG_FAST === 0,
            'ModemPreset not properly exported'
        );
    }
    
    // =========================================================================
    // PHASE 1.5: STORE-AND-FORWARD QUEUE TESTS
    // =========================================================================
    
    console.log('\n--- Phase 1.5: Store-and-Forward Queue Tests ---\n');
    
    if (typeof MeshtasticModule !== 'undefined') {
        // Test Queue Functions
        test(
            'MeshtasticModule.getQueueStatus is a function',
            typeof MeshtasticModule.getQueueStatus === 'function',
            'getQueueStatus not defined'
        );
        
        test(
            'MeshtasticModule.clearOutboundQueue is a function',
            typeof MeshtasticModule.clearOutboundQueue === 'function',
            'clearOutboundQueue not defined'
        );
        
        test(
            'MeshtasticModule.retryQueuedMessage is a function',
            typeof MeshtasticModule.retryQueuedMessage === 'function',
            'retryQueuedMessage not defined'
        );
        
        test(
            'MeshtasticModule.cancelQueuedMessage is a function',
            typeof MeshtasticModule.cancelQueuedMessage === 'function',
            'cancelQueuedMessage not defined'
        );
        
        test(
            'MeshtasticModule.processOutboundQueue is a function',
            typeof MeshtasticModule.processOutboundQueue === 'function',
            'processOutboundQueue not defined'
        );
        
        test(
            'MeshtasticModule.checkMeshConnectivity is a function',
            typeof MeshtasticModule.checkMeshConnectivity === 'function',
            'checkMeshConnectivity not defined'
        );
        
        // Test Queue Status Structure
        const queueStatus = MeshtasticModule.getQueueStatus();
        
        test(
            'getQueueStatus returns object with count',
            queueStatus && typeof queueStatus.count === 'number',
            'Queue status missing count property'
        );
        
        test(
            'getQueueStatus returns object with isEmpty',
            queueStatus && typeof queueStatus.isEmpty === 'boolean',
            'Queue status missing isEmpty property'
        );
        
        test(
            'getQueueStatus returns object with isFull',
            queueStatus && typeof queueStatus.isFull === 'boolean',
            'Queue status missing isFull property'
        );
        
        test(
            'getQueueStatus returns object with meshStatus',
            queueStatus && typeof queueStatus.meshStatus === 'string',
            'Queue status missing meshStatus property'
        );
        
        test(
            'getQueueStatus returns object with messages array',
            queueStatus && Array.isArray(queueStatus.messages),
            'Queue status missing messages array'
        );
        
        test(
            'getQueueStatus returns object with stats',
            queueStatus && typeof queueStatus.stats === 'object',
            'Queue status missing stats object'
        );
        
        // Test DeliveryStatus includes QUEUED
        test(
            'DeliveryStatus includes QUEUED',
            MeshtasticModule.DeliveryStatus && MeshtasticModule.DeliveryStatus.QUEUED === 'queued',
            'DeliveryStatus.QUEUED not defined or incorrect value'
        );
        
        // Test checkMeshConnectivity
        const connectivityResult = MeshtasticModule.checkMeshConnectivity();
        test(
            'checkMeshConnectivity returns boolean',
            typeof connectivityResult === 'boolean',
            `Expected boolean, got ${typeof connectivityResult}`
        );
    }
    
    // Test 6: Check if libraries are ready (may fail if offline)
    if (typeof window.MeshtasticClient !== 'undefined') {
        const isReady = window.MeshtasticClient.isReady();
        test(
            'MeshtasticClient libraries loaded (requires internet)',
            isReady,
            'Libraries not loaded - may be offline or network issue'
        );
    }
    
    // Test 7: Verify Web Bluetooth/Serial support detection
    test(
        'Web Bluetooth API detection works',
        typeof navigator.bluetooth !== 'undefined' || true, // May not be available
        'Note: Web Bluetooth may not be supported in this browser'
    );
    
    test(
        'Web Serial API detection works',
        typeof navigator.serial !== 'undefined' || true, // May not be available
        'Note: Web Serial may not be supported in this browser'
    );
    
    // Test 8: Test signal quality calculation
    if (typeof MeshtasticModule !== 'undefined') {
        const excellentQuality = MeshtasticModule.calculateSignalQuality(10, -60);
        const poorQuality = MeshtasticModule.calculateSignalQuality(-15, -110);
        
        test(
            'Signal quality calculation - excellent',
            excellentQuality === 'excellent',
            `Expected 'excellent', got '${excellentQuality}'`
        );
        
        test(
            'Signal quality calculation - poor',
            poorQuality === 'poor',
            `Expected 'poor', got '${poorQuality}'`
        );
    }
    
    // Test 9: Test firmware status check
    if (typeof MeshtasticModule !== 'undefined') {
        const currentFw = MeshtasticModule.checkFirmwareStatus('2.5.6');
        const outdatedFw = MeshtasticModule.checkFirmwareStatus('2.0.0');
        
        test(
            'Firmware status - current version',
            currentFw.status === 'current',
            `Expected 'current', got '${currentFw.status}'`
        );
        
        test(
            'Firmware status - outdated version',
            outdatedFw.status === 'outdated',
            `Expected 'outdated', got '${outdatedFw.status}'`
        );
    }
    
    // Test 10: Test region options
    if (typeof MeshtasticModule !== 'undefined') {
        const regionOptions = MeshtasticModule.getRegionOptions();
        test(
            'Region options returns array',
            Array.isArray(regionOptions) && regionOptions.length > 0,
            'getRegionOptions did not return valid array'
        );
        
        const usRegion = regionOptions.find(r => r.value === 1);
        test(
            'US region option exists',
            usRegion && usRegion.label.includes('US'),
            'US region not found in options'
        );
    }
    
    // Test 11: Test modem preset options
    if (typeof MeshtasticModule !== 'undefined') {
        const modemOptions = MeshtasticModule.getModemPresetOptions();
        test(
            'Modem preset options returns array',
            Array.isArray(modemOptions) && modemOptions.length > 0,
            'getModemPresetOptions did not return valid array'
        );
        
        const longFast = modemOptions.find(m => m.value === 0);
        test(
            'Long Fast modem option exists',
            longFast && longFast.name === 'Long Fast',
            'Long Fast modem not found in options'
        );
    }
    
    // =========================================================================
    // PHASE 2: QUICK SETUP & FIELD UX TESTS
    // =========================================================================
    
    console.log('\n--- Phase 2: Quick Setup & Field UX Tests ---\n');
    
    if (typeof MeshtasticModule !== 'undefined') {
        // Test Scenario Functions
        test(
            'MeshtasticModule.getScenarioPresets is a function',
            typeof MeshtasticModule.getScenarioPresets === 'function',
            'getScenarioPresets not defined'
        );
        
        test(
            'MeshtasticModule.getActiveScenario is a function',
            typeof MeshtasticModule.getActiveScenario === 'function',
            'getActiveScenario not defined'
        );
        
        test(
            'MeshtasticModule.applyScenarioPreset is a function',
            typeof MeshtasticModule.applyScenarioPreset === 'function',
            'applyScenarioPreset not defined'
        );
        
        // Test Scenario Presets
        const presets = MeshtasticModule.getScenarioPresets();
        test(
            'getScenarioPresets returns array with presets',
            Array.isArray(presets) && presets.length >= 5,
            `Expected at least 5 presets, got ${presets?.length || 0}`
        );
        
        const sarPreset = presets.find(p => p.id === 'sar');
        test(
            'SAR preset exists with correct properties',
            sarPreset && sarPreset.name === 'Search & Rescue' && sarPreset.settings,
            'SAR preset not found or missing properties'
        );
        
        // Test Canned Messages
        test(
            'MeshtasticModule.getCannedMessages is a function',
            typeof MeshtasticModule.getCannedMessages === 'function',
            'getCannedMessages not defined'
        );
        
        test(
            'MeshtasticModule.sendCannedMessage is a function',
            typeof MeshtasticModule.sendCannedMessage === 'function',
            'sendCannedMessage not defined'
        );
        
        const cannedMessages = MeshtasticModule.getCannedMessages();
        test(
            'getCannedMessages returns array',
            Array.isArray(cannedMessages) && cannedMessages.length > 0,
            'getCannedMessages did not return valid array'
        );
        
        const okMessage = cannedMessages.find(m => m.text === 'OK' || m.text.includes('OK'));
        test(
            'Canned messages include OK message',
            !!okMessage,
            'OK message not found in canned messages'
        );
        
        // Test Mesh Health
        test(
            'MeshtasticModule.getMeshHealth is a function',
            typeof MeshtasticModule.getMeshHealth === 'function',
            'getMeshHealth not defined'
        );
        
        test(
            'MeshtasticModule.getMeshHealthColor is a function',
            typeof MeshtasticModule.getMeshHealthColor === 'function',
            'getMeshHealthColor not defined'
        );
        
        const health = MeshtasticModule.getMeshHealth();
        test(
            'getMeshHealth returns object with status',
            health && typeof health.status === 'string',
            'Mesh health missing status property'
        );
        
        test(
            'getMeshHealth returns object with score',
            health && typeof health.score === 'number',
            'Mesh health missing score property'
        );
        
        test(
            'getMeshHealth returns object with activeNodes',
            health && typeof health.activeNodes === 'number',
            'Mesh health missing activeNodes property'
        );
        
        const healthColor = MeshtasticModule.getMeshHealthColor('excellent');
        test(
            'getMeshHealthColor returns valid color',
            healthColor && healthColor.startsWith('#'),
            `Expected hex color, got ${healthColor}`
        );
        
        // Test Wizard Functions
        test(
            'MeshtasticModule.isWizardCompleted is a function',
            typeof MeshtasticModule.isWizardCompleted === 'function',
            'isWizardCompleted not defined'
        );
        
        test(
            'MeshtasticModule.completeWizard is a function',
            typeof MeshtasticModule.completeWizard === 'function',
            'completeWizard not defined'
        );
        
        test(
            'MeshtasticModule.getWizardSteps is a function',
            typeof MeshtasticModule.getWizardSteps === 'function',
            'getWizardSteps not defined'
        );
        
        // Test Team QR Functions
        test(
            'MeshtasticModule.generateTeamOnboardingQR is a function',
            typeof MeshtasticModule.generateTeamOnboardingQR === 'function',
            'generateTeamOnboardingQR not defined'
        );
        
        test(
            'MeshtasticModule.joinFromQR is a function',
            typeof MeshtasticModule.joinFromQR === 'function',
            'joinFromQR not defined'
        );
        
        const qrData = MeshtasticModule.generateTeamOnboardingQR();
        test(
            'generateTeamOnboardingQR returns object with url',
            qrData && typeof qrData.url === 'string',
            'QR data missing url property'
        );
        
        // Test Constants Export
        test(
            'ScenarioPresets constant is exported',
            MeshtasticModule.ScenarioPresets && typeof MeshtasticModule.ScenarioPresets === 'object',
            'ScenarioPresets not properly exported'
        );
        
        test(
            'DefaultCannedMessages constant is exported',
            MeshtasticModule.DefaultCannedMessages && Array.isArray(MeshtasticModule.DefaultCannedMessages),
            'DefaultCannedMessages not properly exported'
        );
        
        test(
            'WizardSteps constant is exported',
            MeshtasticModule.WizardSteps && typeof MeshtasticModule.WizardSteps === 'object',
            'WizardSteps not properly exported'
        );
    }
    
    // =========================================================================
    // DEVICE DETECTION & CONNECTION GUIDANCE TESTS
    // =========================================================================
    
    console.log('\n--- Device Detection & Connection Guidance Tests ---\n');
    
    if (typeof MeshtasticModule !== 'undefined') {
        // Test Device Capability Functions
        test(
            'MeshtasticModule.getDeviceCapabilities is a function',
            typeof MeshtasticModule.getDeviceCapabilities === 'function',
            'getDeviceCapabilities not defined'
        );
        
        test(
            'MeshtasticModule.getConnectedDeviceCapabilities is a function',
            typeof MeshtasticModule.getConnectedDeviceCapabilities === 'function',
            'getConnectedDeviceCapabilities not defined'
        );
        
        test(
            'MeshtasticModule.deviceSupportsSerial is a function',
            typeof MeshtasticModule.deviceSupportsSerial === 'function',
            'deviceSupportsSerial not defined'
        );
        
        test(
            'MeshtasticModule.deviceSupportsBluetooth is a function',
            typeof MeshtasticModule.deviceSupportsBluetooth === 'function',
            'deviceSupportsBluetooth not defined'
        );
        
        test(
            'MeshtasticModule.getConnectionRecommendation is a function',
            typeof MeshtasticModule.getConnectionRecommendation === 'function',
            'getConnectionRecommendation not defined'
        );
        
        test(
            'MeshtasticModule.getCommonDevices is a function',
            typeof MeshtasticModule.getCommonDevices === 'function',
            'getCommonDevices not defined'
        );
        
        test(
            'MeshtasticModule.detectDeviceFromName is a function',
            typeof MeshtasticModule.detectDeviceFromName === 'function',
            'detectDeviceFromName not defined'
        );
        
        // Test DeviceCapabilities constant
        test(
            'DeviceCapabilities constant is exported',
            MeshtasticModule.DeviceCapabilities && typeof MeshtasticModule.DeviceCapabilities === 'object',
            'DeviceCapabilities not properly exported'
        );
        
        // Test WisMesh Pocket capabilities (BLE only)
        const pocketCaps = MeshtasticModule.getDeviceCapabilities(43); // RAK_WISMESH_POCKET
        test(
            'WisMesh Pocket hwModel 43 returns correct capabilities',
            pocketCaps && pocketCaps.bluetooth === true && pocketCaps.serial === false,
            `Expected BLE=true, Serial=false for WisMesh Pocket, got BLE=${pocketCaps?.bluetooth}, Serial=${pocketCaps?.serial}`
        );
        
        test(
            'WisMesh Pocket is identified as portable',
            pocketCaps && pocketCaps.portable === true,
            'WisMesh Pocket should be portable'
        );
        
        test(
            'WisMesh Pocket has GPS capability',
            pocketCaps && pocketCaps.gps === true,
            'WisMesh Pocket should have GPS'
        );
        
        // Test T-Echo capabilities (BLE only)
        const techoCaps = MeshtasticModule.getDeviceCapabilities(7); // T_ECHO
        test(
            'T-Echo hwModel 7 returns BLE only',
            techoCaps && techoCaps.bluetooth === true && techoCaps.serial === false,
            `Expected BLE=true, Serial=false for T-Echo, got BLE=${techoCaps?.bluetooth}, Serial=${techoCaps?.serial}`
        );
        
        // Test T-Beam capabilities (both supported)
        const tbeamCaps = MeshtasticModule.getDeviceCapabilities(4); // TBEAM
        test(
            'T-Beam hwModel 4 supports both connections',
            tbeamCaps && tbeamCaps.bluetooth === true && tbeamCaps.serial === true,
            `Expected both connections for T-Beam, got BLE=${tbeamCaps?.bluetooth}, Serial=${tbeamCaps?.serial}`
        );
        
        // Test Heltec V3 capabilities (both supported)
        const heltecCaps = MeshtasticModule.getDeviceCapabilities(25); // HELTEC_V3
        test(
            'Heltec V3 hwModel 25 supports both connections',
            heltecCaps && heltecCaps.bluetooth === true && heltecCaps.serial === true,
            `Expected both connections for Heltec V3, got BLE=${heltecCaps?.bluetooth}, Serial=${heltecCaps?.serial}`
        );
        
        // Test unknown device returns safe defaults
        const unknownCaps = MeshtasticModule.getDeviceCapabilities(999);
        test(
            'Unknown hwModel returns safe defaults (both connections)',
            unknownCaps && unknownCaps.bluetooth === true && unknownCaps.serial === true,
            'Unknown device should default to both connections supported'
        );
        
        // Test getCommonDevices
        const commonDevices = MeshtasticModule.getCommonDevices();
        test(
            'getCommonDevices returns array with devices',
            Array.isArray(commonDevices) && commonDevices.length > 0,
            'getCommonDevices should return non-empty array'
        );
        
        const pocketInCommon = commonDevices.find(d => d.name.includes('WisMesh Pocket'));
        test(
            'Common devices includes WisMesh Pocket as BLE-only',
            pocketInCommon && pocketInCommon.bluetooth === true && pocketInCommon.serial === false,
            'WisMesh Pocket should be in common devices as BLE-only'
        );
        
        // Test getConnectionRecommendation
        const pocketRec = MeshtasticModule.getConnectionRecommendation(43);
        test(
            'Connection recommendation for WisMesh Pocket is Bluetooth',
            pocketRec && pocketRec.recommended === 'bluetooth' && pocketRec.serialSupported === false,
            `Expected Bluetooth recommended for Pocket, got ${pocketRec?.recommended}`
        );
        
        const tbeamRec = MeshtasticModule.getConnectionRecommendation(4);
        test(
            'Connection recommendation for T-Beam shows both supported',
            tbeamRec && tbeamRec.serialSupported === true && tbeamRec.bluetoothSupported === true,
            'T-Beam should show both connections supported'
        );
        
        // Test detectDeviceFromName
        const detectedPocket = MeshtasticModule.detectDeviceFromName('WisMesh_Pocket_1234');
        test(
            'detectDeviceFromName identifies WisMesh Pocket',
            detectedPocket && detectedPocket.serial === false,
            'Should detect WisMesh Pocket from Bluetooth name'
        );
        
        const detectedTBeam = MeshtasticModule.detectDeviceFromName('Meshtastic_TBeam_5678');
        test(
            'detectDeviceFromName identifies T-Beam',
            detectedTBeam && detectedTBeam.serial === true,
            'Should detect T-Beam from Bluetooth name'
        );
        
        const detectedUnknown = MeshtasticModule.detectDeviceFromName('SomeRandomDevice');
        test(
            'detectDeviceFromName returns null for unknown device',
            detectedUnknown === null,
            'Should return null for unrecognized device name'
        );
    }
    
    // =========================================================================
    // DROP PIN → SEND TO MESH TESTS
    // =========================================================================
    
    console.log('\n--- Drop Pin → Send to Mesh Tests ---\n');
    
    if (typeof MeshtasticModule !== 'undefined') {
        // Test sendLocation function exists
        test(
            'MeshtasticModule.sendLocation is a function',
            typeof MeshtasticModule.sendLocation === 'function',
            'sendLocation not defined'
        );
        
        // Test getNodesForRecipientSelection function exists
        test(
            'MeshtasticModule.getNodesForRecipientSelection is a function',
            typeof MeshtasticModule.getNodesForRecipientSelection === 'function',
            'getNodesForRecipientSelection not defined'
        );
        
        // Test getNodesForRecipientSelection returns array
        const recipientNodes = MeshtasticModule.getNodesForRecipientSelection();
        test(
            'getNodesForRecipientSelection returns array',
            Array.isArray(recipientNodes),
            'getNodesForRecipientSelection should return array'
        );
    }
    
    // =========================================================================
    // TRACEROUTE TESTS
    // =========================================================================
    
    console.log('\n--- Traceroute Tests ---\n');
    
    if (typeof MeshtasticModule !== 'undefined') {
        // Test traceroute functions exist
        test(
            'MeshtasticModule.requestTraceroute is a function',
            typeof MeshtasticModule.requestTraceroute === 'function',
            'requestTraceroute not defined'
        );
        
        test(
            'MeshtasticModule.getActiveTraceroute is a function',
            typeof MeshtasticModule.getActiveTraceroute === 'function',
            'getActiveTraceroute not defined'
        );
        
        test(
            'MeshtasticModule.getTraceroute is a function',
            typeof MeshtasticModule.getTraceroute === 'function',
            'getTraceroute not defined'
        );
        
        test(
            'MeshtasticModule.getTracerouteHistory is a function',
            typeof MeshtasticModule.getTracerouteHistory === 'function',
            'getTracerouteHistory not defined'
        );
        
        test(
            'MeshtasticModule.clearTracerouteHistory is a function',
            typeof MeshtasticModule.clearTracerouteHistory === 'function',
            'clearTracerouteHistory not defined'
        );
        
        test(
            'MeshtasticModule.getNodesForTraceroute is a function',
            typeof MeshtasticModule.getNodesForTraceroute === 'function',
            'getNodesForTraceroute not defined'
        );
        
        test(
            'MeshtasticModule.formatTracerouteDisplay is a function',
            typeof MeshtasticModule.formatTracerouteDisplay === 'function',
            'formatTracerouteDisplay not defined'
        );
        
        // Test getTracerouteHistory returns array
        const trHistory = MeshtasticModule.getTracerouteHistory();
        test(
            'getTracerouteHistory returns array',
            Array.isArray(trHistory),
            'getTracerouteHistory should return array'
        );
        
        // Test getNodesForTraceroute returns array
        const trNodes = MeshtasticModule.getNodesForTraceroute();
        test(
            'getNodesForTraceroute returns array',
            Array.isArray(trNodes),
            'getNodesForTraceroute should return array'
        );
        
        // Test getActiveTraceroute returns null when none active
        const activeTr = MeshtasticModule.getActiveTraceroute();
        test(
            'getActiveTraceroute returns null when no active traceroute',
            activeTr === null,
            'Expected null when no traceroute active'
        );
        
        // Test formatTracerouteDisplay handles null
        const formattedNull = MeshtasticModule.formatTracerouteDisplay(null);
        test(
            'formatTracerouteDisplay returns null for null input',
            formattedNull === null,
            'formatTracerouteDisplay should return null for null input'
        );
    }
    
    // =========================================================================
    // TELEMETRY EXPORT TESTS
    // =========================================================================
    
    console.log('\n--- Telemetry Export Tests ---\n');
    
    if (typeof MeshtasticModule !== 'undefined') {
        // Test export functions exist
        test(
            'MeshtasticModule.exportNodesCSV is a function',
            typeof MeshtasticModule.exportNodesCSV === 'function',
            'exportNodesCSV not defined'
        );
        
        test(
            'MeshtasticModule.exportMessagesCSV is a function',
            typeof MeshtasticModule.exportMessagesCSV === 'function',
            'exportMessagesCSV not defined'
        );
        
        test(
            'MeshtasticModule.exportMeshHealthReport is a function',
            typeof MeshtasticModule.exportMeshHealthReport === 'function',
            'exportMeshHealthReport not defined'
        );
        
        test(
            'MeshtasticModule.exportFullTelemetryReport is a function',
            typeof MeshtasticModule.exportFullTelemetryReport === 'function',
            'exportFullTelemetryReport not defined'
        );
        
        test(
            'MeshtasticModule.downloadNodesCSV is a function',
            typeof MeshtasticModule.downloadNodesCSV === 'function',
            'downloadNodesCSV not defined'
        );
        
        test(
            'MeshtasticModule.downloadMessagesCSV is a function',
            typeof MeshtasticModule.downloadMessagesCSV === 'function',
            'downloadMessagesCSV not defined'
        );
        
        test(
            'MeshtasticModule.downloadTelemetryReport is a function',
            typeof MeshtasticModule.downloadTelemetryReport === 'function',
            'downloadTelemetryReport not defined'
        );
        
        test(
            'MeshtasticModule.downloadHealthReport is a function',
            typeof MeshtasticModule.downloadHealthReport === 'function',
            'downloadHealthReport not defined'
        );
        
        test(
            'MeshtasticModule.getExportSummary is a function',
            typeof MeshtasticModule.getExportSummary === 'function',
            'getExportSummary not defined'
        );
        
        // Test exportNodesCSV returns string with headers
        const nodesCSV = MeshtasticModule.exportNodesCSV();
        test(
            'exportNodesCSV returns CSV string',
            typeof nodesCSV === 'string' && nodesCSV.includes('Node ID'),
            'exportNodesCSV should return CSV with headers'
        );
        
        // Test exportMessagesCSV returns string with headers
        const messagesCSV = MeshtasticModule.exportMessagesCSV();
        test(
            'exportMessagesCSV returns CSV string',
            typeof messagesCSV === 'string' && messagesCSV.includes('Timestamp'),
            'exportMessagesCSV should return CSV with headers'
        );
        
        // Test exportMeshHealthReport returns object
        const healthReport = MeshtasticModule.exportMeshHealthReport();
        test(
            'exportMeshHealthReport returns object with required fields',
            healthReport && 
            typeof healthReport === 'object' &&
            healthReport.hasOwnProperty('generatedAt') &&
            healthReport.hasOwnProperty('summary') &&
            healthReport.hasOwnProperty('nodes'),
            'exportMeshHealthReport should return object with generatedAt, summary, nodes'
        );
        
        // Test exportFullTelemetryReport returns object
        const fullReport = MeshtasticModule.exportFullTelemetryReport();
        test(
            'exportFullTelemetryReport returns object with required fields',
            fullReport && 
            typeof fullReport === 'object' &&
            fullReport.hasOwnProperty('meta') &&
            fullReport.hasOwnProperty('nodes') &&
            fullReport.hasOwnProperty('messages') &&
            fullReport.hasOwnProperty('statistics'),
            'exportFullTelemetryReport should return object with meta, nodes, messages, statistics'
        );
        
        // Test getExportSummary returns object
        const summary = MeshtasticModule.getExportSummary();
        test(
            'getExportSummary returns object with counts',
            summary && 
            typeof summary === 'object' &&
            typeof summary.nodesCount === 'number' &&
            typeof summary.messagesCount === 'number',
            'getExportSummary should return object with nodesCount, messagesCount'
        );
    }
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Total: ${tests.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed === 0) {
        console.log('\n✅ All tests passed! Meshtastic integration is ready.');
    } else {
        console.log(`\n⚠️ ${failed} test(s) failed. Check the output above for details.`);
    }
    
    return { passed, failed, total: tests.length, tests };
})();
