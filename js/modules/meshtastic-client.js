/**
 * GridDown Meshtastic Client - Real Device Communication
 * 
 * This ES module provides real device communication using the official
 * @meshtastic/core and transport libraries via esm.sh CDN.
 * 
 * Features:
 * - Web Bluetooth (BLE) connection
 * - Web Serial connection
 * - Real device configuration read/write
 * - Message sending/receiving
 * - Node database sync
 * 
 * @license GPL-3.0 (Meshtastic libraries are GPL-3.0)
 */

// Use dynamic imports from esm.sh CDN for zero-build integration
const ESM_CDN = 'https://esm.sh';
const MESHTASTIC_VERSION = '2.6.7';

// Global state for the client
const MeshtasticClient = {
    // Connection state
    device: null,
    transport: null,
    isConnected: false,
    connectionType: null, // 'ble' or 'serial'
    
    // Device info
    myNodeNum: null,
    myNodeInfo: null,
    deviceConfig: null,
    channels: [],
    nodes: new Map(),
    
    // Libraries (loaded dynamically)
    core: null,
    bleTransport: null,
    serialTransport: null,
    protobufs: null,
    
    // Event callbacks
    callbacks: {
        onConnect: null,
        onDisconnect: null,
        onConfigReceived: null,
        onNodeUpdate: null,
        onMessage: null,
        onPosition: null,
        onTelemetry: null,
        onChannelUpdate: null
    },
    
    // Loading state
    librariesLoaded: false,
    loadingPromise: null
};

/**
 * Load Meshtastic libraries from esm.sh CDN
 */
async function loadLibraries() {
    if (MeshtasticClient.librariesLoaded) {
        return true;
    }
    
    if (MeshtasticClient.loadingPromise) {
        return MeshtasticClient.loadingPromise;
    }
    
    MeshtasticClient.loadingPromise = (async () => {
        try {
            console.log('[MeshtasticClient] Loading libraries from esm.sh...');
            
            // Load core and transport modules
            const [core, bleTransport, serialTransport, protobufs] = await Promise.all([
                import(`${ESM_CDN}/@meshtastic/core@${MESHTASTIC_VERSION}`),
                import(`${ESM_CDN}/@meshtastic/transport-web-bluetooth@${MESHTASTIC_VERSION}`),
                import(`${ESM_CDN}/@meshtastic/transport-web-serial@${MESHTASTIC_VERSION}`),
                import(`${ESM_CDN}/@meshtastic/protobufs@${MESHTASTIC_VERSION}`)
            ]);
            
            MeshtasticClient.core = core;
            MeshtasticClient.bleTransport = bleTransport;
            MeshtasticClient.serialTransport = serialTransport;
            MeshtasticClient.protobufs = protobufs;
            MeshtasticClient.librariesLoaded = true;
            
            console.log('[MeshtasticClient] Libraries loaded successfully');
            return true;
        } catch (error) {
            console.error('[MeshtasticClient] Failed to load libraries:', error);
            MeshtasticClient.loadingPromise = null;
            throw error;
        }
    })();
    
    return MeshtasticClient.loadingPromise;
}

/**
 * Setup event handlers for the device
 */
function setupEventHandlers(device) {
    const { Events } = MeshtasticClient.core;
    
    // Device status changes
    device.events.onDeviceStatus.subscribe((status) => {
        console.log('[MeshtasticClient] Device status:', status);
        
        if (status === 'deviceDisconnected') {
            handleDisconnect();
        } else if (status === 'deviceConfigured') {
            MeshtasticClient.isConnected = true;
            if (MeshtasticClient.callbacks.onConnect) {
                MeshtasticClient.callbacks.onConnect({
                    nodeNum: MeshtasticClient.myNodeNum,
                    nodeInfo: MeshtasticClient.myNodeInfo
                });
            }
        }
    });
    
    // My node info
    device.events.onMyNodeInfo.subscribe((nodeInfo) => {
        console.log('[MeshtasticClient] My node info:', nodeInfo);
        MeshtasticClient.myNodeNum = nodeInfo.myNodeNum;
        MeshtasticClient.myNodeInfo = nodeInfo;
    });
    
    // Device metadata (firmware version, etc.)
    device.events.onDeviceMetadata.subscribe((metadata) => {
        console.log('[MeshtasticClient] Device metadata:', metadata);
        if (MeshtasticClient.deviceConfig) {
            MeshtasticClient.deviceConfig.firmwareVersion = metadata.firmwareVersion;
            MeshtasticClient.deviceConfig.hwModel = metadata.hwModel;
        }
    });
    
    // LoRa config (region, modem preset, tx power, hop limit)
    device.events.onConfigPacket.subscribe((config) => {
        console.log('[MeshtasticClient] Config packet:', config);
        handleConfigPacket(config);
    });
    
    // Channel updates
    device.events.onChannelPacket.subscribe((channel) => {
        console.log('[MeshtasticClient] Channel packet:', channel);
        handleChannelPacket(channel);
    });
    
    // Node info from mesh
    device.events.onNodeInfoPacket.subscribe((nodeInfo) => {
        console.log('[MeshtasticClient] Node info packet:', nodeInfo);
        handleNodeInfoPacket(nodeInfo);
    });
    
    // Position updates
    device.events.onPositionPacket.subscribe((position) => {
        console.log('[MeshtasticClient] Position packet:', position);
        handlePositionPacket(position);
    });
    
    // Text messages
    device.events.onMessagePacket.subscribe((message) => {
        console.log('[MeshtasticClient] Message packet:', message);
        handleMessagePacket(message);
    });
    
    // Telemetry (battery, signal quality, etc.)
    device.events.onTelemetryPacket.subscribe((telemetry) => {
        handleTelemetryPacket(telemetry);
    });
    
    // Mesh packets (for SNR/RSSI)
    device.events.onMeshPacket.subscribe((packet) => {
        handleMeshPacket(packet);
    });
}

/**
 * Handle config packet from device
 */
function handleConfigPacket(config) {
    if (!MeshtasticClient.deviceConfig) {
        MeshtasticClient.deviceConfig = {};
    }
    
    // Extract LoRa config
    if (config.payloadVariant?.case === 'lora') {
        const lora = config.payloadVariant.value;
        MeshtasticClient.deviceConfig.region = lora.region;
        MeshtasticClient.deviceConfig.modemPreset = lora.modemPreset;
        MeshtasticClient.deviceConfig.txPower = lora.txPower;
        MeshtasticClient.deviceConfig.hopLimit = lora.hopLimit;
        MeshtasticClient.deviceConfig.usePreset = lora.usePreset;
        MeshtasticClient.deviceConfig.channelNum = lora.channelNum;
        MeshtasticClient.deviceConfig.bandwidth = lora.bandwidth;
        MeshtasticClient.deviceConfig.spreadFactor = lora.spreadFactor;
        MeshtasticClient.deviceConfig.codingRate = lora.codingRate;
        MeshtasticClient.deviceConfig.txEnabled = lora.txEnabled;
        
        console.log('[MeshtasticClient] LoRa config updated:', MeshtasticClient.deviceConfig);
        
        if (MeshtasticClient.callbacks.onConfigReceived) {
            MeshtasticClient.callbacks.onConfigReceived(MeshtasticClient.deviceConfig);
        }
    }
    
    // Extract device config
    if (config.payloadVariant?.case === 'device') {
        const deviceCfg = config.payloadVariant.value;
        MeshtasticClient.deviceConfig.role = deviceCfg.role;
        MeshtasticClient.deviceConfig.serialEnabled = deviceCfg.serialEnabled;
        MeshtasticClient.deviceConfig.buttonGpio = deviceCfg.buttonGpio;
        MeshtasticClient.deviceConfig.buzzerGpio = deviceCfg.buzzerGpio;
    }
    
    // Extract position config
    if (config.payloadVariant?.case === 'position') {
        const posCfg = config.payloadVariant.value;
        MeshtasticClient.deviceConfig.positionBroadcastSecs = posCfg.positionBroadcastSecs;
        MeshtasticClient.deviceConfig.gpsUpdateInterval = posCfg.gpsUpdateInterval;
        MeshtasticClient.deviceConfig.gpsEnabled = posCfg.gpsEnabled !== false;
    }
}

/**
 * Handle channel packet from device
 */
function handleChannelPacket(channel) {
    const index = channel.index || 0;
    
    // Ensure array is large enough
    while (MeshtasticClient.channels.length <= index) {
        MeshtasticClient.channels.push(null);
    }
    
    MeshtasticClient.channels[index] = {
        index: index,
        role: channel.role,
        name: channel.settings?.name || `Channel ${index}`,
        psk: channel.settings?.psk,
        moduleSettings: channel.settings?.moduleSettings
    };
    
    if (MeshtasticClient.callbacks.onChannelUpdate) {
        MeshtasticClient.callbacks.onChannelUpdate(MeshtasticClient.channels);
    }
}

/**
 * Handle node info packet from mesh
 */
function handleNodeInfoPacket(nodeInfo) {
    const nodeNum = nodeInfo.num;
    
    let node = MeshtasticClient.nodes.get(nodeNum) || {};
    
    node.num = nodeNum;
    node.id = nodeInfo.user?.id || `!${nodeNum.toString(16)}`;
    node.longName = nodeInfo.user?.longName || `Node ${nodeNum}`;
    node.shortName = nodeInfo.user?.shortName || '????';
    node.hwModel = nodeInfo.user?.hwModel;
    node.macaddr = nodeInfo.user?.macaddr;
    node.isLicensed = nodeInfo.user?.isLicensed;
    node.lastHeard = nodeInfo.lastHeard ? new Date(nodeInfo.lastHeard * 1000) : null;
    node.snr = nodeInfo.snr;
    node.hopsAway = nodeInfo.hopsAway;
    
    // Device metrics
    if (nodeInfo.deviceMetrics) {
        node.batteryLevel = nodeInfo.deviceMetrics.batteryLevel;
        node.voltage = nodeInfo.deviceMetrics.voltage;
        node.channelUtilization = nodeInfo.deviceMetrics.channelUtilization;
        node.airUtilTx = nodeInfo.deviceMetrics.airUtilTx;
    }
    
    MeshtasticClient.nodes.set(nodeNum, node);
    
    if (MeshtasticClient.callbacks.onNodeUpdate) {
        MeshtasticClient.callbacks.onNodeUpdate(node);
    }
}

/**
 * Handle position packet from mesh
 */
function handlePositionPacket(position) {
    const fromNode = position.from;
    let node = MeshtasticClient.nodes.get(fromNode);
    
    if (!node) {
        node = { num: fromNode, id: `!${fromNode.toString(16)}` };
        MeshtasticClient.nodes.set(fromNode, node);
    }
    
    // Position is in integer format (lat/lon * 1e7)
    if (position.data) {
        node.latitude = position.data.latitudeI / 1e7;
        node.longitude = position.data.longitudeI / 1e7;
        node.altitude = position.data.altitude;
        node.time = position.data.time ? new Date(position.data.time * 1000) : new Date();
        node.groundSpeed = position.data.groundSpeed;
        node.groundTrack = position.data.groundTrack;
        node.satsInView = position.data.satsInView;
        node.precisionBits = position.data.precisionBits;
    }
    
    node.lastPositionUpdate = Date.now();
    
    if (MeshtasticClient.callbacks.onPosition) {
        MeshtasticClient.callbacks.onPosition({
            from: fromNode,
            lat: node.latitude,
            lon: node.longitude,
            alt: node.altitude,
            time: node.time,
            node: node
        });
    }
}

/**
 * Handle text message packet
 */
function handleMessagePacket(message) {
    if (MeshtasticClient.callbacks.onMessage) {
        MeshtasticClient.callbacks.onMessage({
            from: message.from,
            to: message.to,
            channel: message.channel,
            text: message.data,
            timestamp: Date.now(),
            id: message.id
        });
    }
}

/**
 * Handle telemetry packet
 */
function handleTelemetryPacket(telemetry) {
    const fromNode = telemetry.from;
    let node = MeshtasticClient.nodes.get(fromNode);
    
    if (!node) {
        node = { num: fromNode };
        MeshtasticClient.nodes.set(fromNode, node);
    }
    
    if (telemetry.data?.deviceMetrics) {
        node.batteryLevel = telemetry.data.deviceMetrics.batteryLevel;
        node.voltage = telemetry.data.deviceMetrics.voltage;
        node.channelUtilization = telemetry.data.deviceMetrics.channelUtilization;
        node.airUtilTx = telemetry.data.deviceMetrics.airUtilTx;
    }
    
    if (telemetry.data?.environmentMetrics) {
        node.temperature = telemetry.data.environmentMetrics.temperature;
        node.relativeHumidity = telemetry.data.environmentMetrics.relativeHumidity;
        node.barometricPressure = telemetry.data.environmentMetrics.barometricPressure;
    }
    
    if (MeshtasticClient.callbacks.onTelemetry) {
        MeshtasticClient.callbacks.onTelemetry({ from: fromNode, telemetry: telemetry.data, node });
    }
}

/**
 * Handle mesh packet (for SNR/RSSI extraction)
 */
function handleMeshPacket(packet) {
    if (!packet.from) return;
    
    let node = MeshtasticClient.nodes.get(packet.from);
    if (!node) {
        node = { num: packet.from };
        MeshtasticClient.nodes.set(packet.from, node);
    }
    
    // Extract signal quality from the packet
    if (packet.rxSnr !== undefined) {
        node.snr = packet.rxSnr;
        node.lastSnr = packet.rxSnr;
    }
    if (packet.rxRssi !== undefined) {
        node.rssi = packet.rxRssi;
        node.lastRssi = packet.rxRssi;
    }
    if (packet.hopStart !== undefined) {
        node.hopStart = packet.hopStart;
    }
    if (packet.hopLimit !== undefined) {
        node.hopLimit = packet.hopLimit;
    }
    
    node.lastPacketTime = Date.now();
}

/**
 * Handle disconnect
 */
function handleDisconnect() {
    MeshtasticClient.isConnected = false;
    MeshtasticClient.device = null;
    MeshtasticClient.transport = null;
    MeshtasticClient.connectionType = null;
    
    if (MeshtasticClient.callbacks.onDisconnect) {
        MeshtasticClient.callbacks.onDisconnect();
    }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Connect via Web Bluetooth
 */
async function connectBLE() {
    await loadLibraries();
    
    const { MeshDevice } = MeshtasticClient.core;
    const { WebBluetoothTransport } = MeshtasticClient.bleTransport;
    
    // Create transport and device
    const transport = new WebBluetoothTransport();
    const device = new MeshDevice(transport);
    
    // Setup event handlers
    setupEventHandlers(device);
    
    // Request device (opens browser dialog)
    await transport.connect();
    
    // Configure device
    await device.configure();
    
    MeshtasticClient.device = device;
    MeshtasticClient.transport = transport;
    MeshtasticClient.connectionType = 'ble';
    
    // Wait for configuration to complete
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout - device did not respond'));
        }, 30000);
        
        const checkConfigured = setInterval(() => {
            if (MeshtasticClient.isConnected) {
                clearTimeout(timeout);
                clearInterval(checkConfigured);
                resolve({
                    nodeNum: MeshtasticClient.myNodeNum,
                    nodeInfo: MeshtasticClient.myNodeInfo,
                    config: MeshtasticClient.deviceConfig
                });
            }
        }, 100);
    });
}

/**
 * Connect via Web Serial
 */
async function connectSerial() {
    await loadLibraries();
    
    const { MeshDevice } = MeshtasticClient.core;
    const { WebSerialTransport } = MeshtasticClient.serialTransport;
    
    // Create transport and device
    const transport = new WebSerialTransport();
    const device = new MeshDevice(transport);
    
    // Setup event handlers
    setupEventHandlers(device);
    
    // Request port (opens browser dialog)
    await transport.connect();
    
    // Configure device
    await device.configure();
    
    MeshtasticClient.device = device;
    MeshtasticClient.transport = transport;
    MeshtasticClient.connectionType = 'serial';
    
    // Wait for configuration to complete
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout - device did not respond'));
        }, 30000);
        
        const checkConfigured = setInterval(() => {
            if (MeshtasticClient.isConnected) {
                clearTimeout(timeout);
                clearInterval(checkConfigured);
                resolve({
                    nodeNum: MeshtasticClient.myNodeNum,
                    nodeInfo: MeshtasticClient.myNodeInfo,
                    config: MeshtasticClient.deviceConfig
                });
            }
        }, 100);
    });
}

/**
 * Disconnect from device
 */
async function disconnect() {
    if (MeshtasticClient.transport) {
        try {
            await MeshtasticClient.transport.disconnect();
        } catch (e) {
            console.warn('[MeshtasticClient] Disconnect error:', e);
        }
    }
    handleDisconnect();
}

/**
 * Get current device configuration
 */
function getConfig() {
    return MeshtasticClient.deviceConfig ? { ...MeshtasticClient.deviceConfig } : null;
}

/**
 * Set LoRa region
 */
async function setRegion(region) {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    const { Protobuf } = MeshtasticClient.protobufs;
    
    await MeshtasticClient.device.setConfig({
        payloadVariant: {
            case: 'lora',
            value: {
                ...MeshtasticClient.deviceConfig,
                region: region
            }
        }
    });
    
    MeshtasticClient.deviceConfig.region = region;
    return MeshtasticClient.deviceConfig;
}

/**
 * Set modem preset
 */
async function setModemPreset(modemPreset) {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    await MeshtasticClient.device.setConfig({
        payloadVariant: {
            case: 'lora',
            value: {
                ...MeshtasticClient.deviceConfig,
                modemPreset: modemPreset,
                usePreset: true
            }
        }
    });
    
    MeshtasticClient.deviceConfig.modemPreset = modemPreset;
    MeshtasticClient.deviceConfig.usePreset = true;
    return MeshtasticClient.deviceConfig;
}

/**
 * Set TX power
 */
async function setTxPower(txPower) {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    await MeshtasticClient.device.setConfig({
        payloadVariant: {
            case: 'lora',
            value: {
                ...MeshtasticClient.deviceConfig,
                txPower: txPower
            }
        }
    });
    
    MeshtasticClient.deviceConfig.txPower = txPower;
    return MeshtasticClient.deviceConfig;
}

/**
 * Set hop limit
 */
async function setHopLimit(hopLimit) {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    await MeshtasticClient.device.setConfig({
        payloadVariant: {
            case: 'lora',
            value: {
                ...MeshtasticClient.deviceConfig,
                hopLimit: hopLimit
            }
        }
    });
    
    MeshtasticClient.deviceConfig.hopLimit = hopLimit;
    return MeshtasticClient.deviceConfig;
}

/**
 * Send text message
 */
async function sendMessage(text, destination = 0xffffffff, channel = 0) {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    await MeshtasticClient.device.sendText(text, destination, true, channel);
    
    return {
        text,
        destination,
        channel,
        timestamp: Date.now()
    };
}

/**
 * Send position
 */
async function sendPosition(latitude, longitude, altitude = 0) {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    await MeshtasticClient.device.sendPosition({
        latitudeI: Math.round(latitude * 1e7),
        longitudeI: Math.round(longitude * 1e7),
        altitude: altitude,
        time: Math.floor(Date.now() / 1000)
    });
    
    return { latitude, longitude, altitude };
}

/**
 * Get all nodes from the mesh
 */
function getNodes() {
    return Array.from(MeshtasticClient.nodes.values());
}

/**
 * Get channels
 */
function getChannels() {
    return [...MeshtasticClient.channels];
}

/**
 * Set a channel
 */
async function setChannel(index, settings) {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    await MeshtasticClient.device.setChannel({
        index: index,
        role: settings.role || 1, // 1 = PRIMARY
        settings: {
            name: settings.name,
            psk: settings.psk
        }
    });
    
    return true;
}

/**
 * Request device config refresh
 */
async function requestConfig() {
    if (!MeshtasticClient.device || !MeshtasticClient.isConnected) {
        throw new Error('Not connected to device');
    }
    
    // Triggers the device to re-send all config
    await MeshtasticClient.device.getConfig();
    return true;
}

/**
 * Set event callback
 */
function setCallback(event, callback) {
    if (event in MeshtasticClient.callbacks) {
        MeshtasticClient.callbacks[event] = callback;
    }
}

/**
 * Check if connected
 */
function isConnected() {
    return MeshtasticClient.isConnected;
}

/**
 * Get connection type
 */
function getConnectionType() {
    return MeshtasticClient.connectionType;
}

/**
 * Check if libraries are loaded
 */
function isReady() {
    return MeshtasticClient.librariesLoaded;
}

/**
 * Get my node number
 */
function getMyNodeNum() {
    return MeshtasticClient.myNodeNum;
}

/**
 * Get my node info
 */
function getMyNodeInfo() {
    return MeshtasticClient.myNodeInfo;
}

// =============================================================================
// EXPORT TO GLOBAL SCOPE
// =============================================================================

// Export to window for use by existing vanilla JS code
window.MeshtasticClient = {
    // Connection
    connectBLE,
    connectSerial,
    disconnect,
    isConnected,
    isReady,
    getConnectionType,
    
    // Configuration
    getConfig,
    setRegion,
    setModemPreset,
    setTxPower,
    setHopLimit,
    requestConfig,
    
    // Messaging
    sendMessage,
    sendPosition,
    
    // Data access
    getNodes,
    getChannels,
    setChannel,
    getMyNodeNum,
    getMyNodeInfo,
    
    // Events
    setCallback,
    
    // Library loading
    loadLibraries,
    
    // Constants (will be populated after libraries load)
    RegionCode: {},
    ModemPreset: {}
};

// Load libraries and populate constants
loadLibraries().then(() => {
    if (MeshtasticClient.protobufs) {
        const { Protobuf } = MeshtasticClient.protobufs;
        if (Protobuf?.Config?.Config_LoRaConfig_RegionCode) {
            window.MeshtasticClient.RegionCode = Protobuf.Config.Config_LoRaConfig_RegionCode;
        }
        if (Protobuf?.Config?.Config_LoRaConfig_ModemPreset) {
            window.MeshtasticClient.ModemPreset = Protobuf.Config.Config_LoRaConfig_ModemPreset;
        }
    }
    console.log('[MeshtasticClient] Ready for connections');
    
    // Notify that client is ready
    window.dispatchEvent(new CustomEvent('meshtastic-client-ready'));
}).catch((err) => {
    console.warn('[MeshtasticClient] Libraries not loaded (offline?):', err.message);
});

export {
    connectBLE,
    connectSerial,
    disconnect,
    getConfig,
    setRegion,
    setModemPreset,
    setTxPower,
    setHopLimit,
    sendMessage,
    sendPosition,
    getNodes,
    getChannels,
    setChannel,
    getMyNodeNum,
    getMyNodeInfo,
    setCallback,
    isConnected,
    isReady,
    loadLibraries
};
