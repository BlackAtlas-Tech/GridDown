/**
 * GridDown SSTV Module
 * Slow Scan Television encode/decode for amateur radio image transmission
 * Supports Robot36, Martin M1/M2, Scottie S1/S2
 * 
 * Requires: Web Audio API, getUserMedia
 * License: MIT (BlackDot Technology)
 */
const SSTVModule = (function() {
    'use strict';

    // ==========================================
    // CONSTANTS & CONFIGURATION
    // ==========================================

    const SAMPLE_RATE = 48000;
    
    // SSTV frequency constants (Hz)
    const FREQ = {
        SYNC: 1200,
        BLACK: 1500,
        WHITE: 2300,
        VIS_BIT_1: 1100,
        VIS_BIT_0: 1300,
        LEADER: 1900,
        BREAK: 1200
    };

    // VIS codes for mode identification
    const VIS_CODES = {
        0x08: 'Robot36',
        0x0C: 'Robot72',
        0x2C: 'MartinM1',
        0x28: 'MartinM2',
        0x3C: 'ScottieS1',
        0x38: 'ScottieS2',
        0x71: 'ScottieDX',
        0x5D: 'PD50',
        0x63: 'PD90',
        0x5F: 'PD120',
        0x61: 'PD160',
        0xDE: 'PD180',
        0xE2: 'PD240',
        0x55: 'WraaseSC2-180'
    };

    // Mode specifications
    const MODES = {
        Robot36: {
            name: 'Robot 36',
            vis: 0x08,
            width: 320,
            height: 240,
            colorMode: 'YCrCb',
            scanTime: 88.0,      // ms per line (Y)
            syncTime: 9.0,       // ms
            porchTime: 3.0,      // ms
            chromaScanTime: 44.0, // ms per chroma line
            totalTime: 36,       // seconds
            description: 'Fast mode, good for QRM conditions'
        },
        Robot72: {
            name: 'Robot 72',
            vis: 0x0C,
            width: 320,
            height: 240,
            colorMode: 'YCrCb',
            scanTime: 138.0,
            syncTime: 9.0,
            porchTime: 4.5,
            chromaScanTime: 69.0,
            totalTime: 72,
            description: 'Better quality than Robot36'
        },
        MartinM1: {
            name: 'Martin M1',
            vis: 0x2C,
            width: 320,
            height: 256,
            colorMode: 'GBR',
            scanTime: 146.432,  // per color component
            syncTime: 4.862,
            porchTime: 0.572,
            separatorTime: 0.572,
            totalTime: 114,
            description: 'High quality, popular mode'
        },
        MartinM2: {
            name: 'Martin M2',
            vis: 0x28,
            width: 160,
            height: 256,
            colorMode: 'GBR',
            scanTime: 73.216,
            syncTime: 4.862,
            porchTime: 0.572,
            separatorTime: 0.572,
            totalTime: 58,
            description: 'Half resolution Martin'
        },
        ScottieS1: {
            name: 'Scottie S1',
            vis: 0x3C,
            width: 320,
            height: 256,
            colorMode: 'GBR',
            scanTime: 138.240,
            syncTime: 9.0,
            porchTime: 1.5,
            separatorTime: 1.5,
            totalTime: 110,
            description: 'Popular DX mode'
        },
        ScottieS2: {
            name: 'Scottie S2',
            vis: 0x38,
            width: 160,
            height: 256,
            colorMode: 'GBR',
            scanTime: 88.064,
            syncTime: 9.0,
            porchTime: 1.5,
            separatorTime: 1.5,
            totalTime: 71,
            description: 'Half resolution Scottie'
        },
        PD90: {
            name: 'PD-90',
            vis: 0x63,
            width: 320,
            height: 256,
            colorMode: 'YCrCb',
            scanTime: 170.240,
            syncTime: 20.0,
            porchTime: 2.08,
            totalTime: 90,
            description: 'High quality color mode'
        },
        PD120: {
            name: 'PD-120',
            vis: 0x5F,
            width: 640,
            height: 496,
            colorMode: 'YCrCb',
            scanTime: 121.6,
            syncTime: 20.0,
            porchTime: 2.08,
            totalTime: 126,
            description: 'High resolution mode'
        }
    };

    // ==========================================
    // STATE
    // ==========================================

    let initialized = false;
    let audioContext = null;
    let mediaStream = null;
    let analyser = null;
    let sourceNode = null;
    let isReceiving = false;
    let isTransmitting = false;
    
    // Decoder state
    let decoderState = {
        mode: null,
        phase: 'IDLE',  // IDLE, VIS_DETECT, RECEIVING, COMPLETE
        currentLine: 0,
        imageData: null,
        startTime: null,
        lastSyncTime: 0,
        syncCount: 0,
        signalStrength: 0,
        errors: []
    };

    // Settings
    let settings = {
        callsign: '',
        gridSquare: '',
        defaultMode: 'Robot36',
        autoCallsignOverlay: true,
        licenseAcknowledged: false,
        audioInputDevice: 'default',
        audioOutputDevice: 'default',
        gainLevel: 1.0,
        voxEnabled: false,
        voxThreshold: 0.1
    };

    // Received images history
    let receivedImages = [];
    const MAX_HISTORY = 50;

    // ==========================================
    // DSP UTILITIES
    // ==========================================

    /**
     * Goertzel algorithm for efficient single-frequency detection
     * More efficient than FFT when only detecting specific frequencies
     */
    function goertzel(samples, targetFreq, sampleRate) {
        const N = samples.length;
        const k = Math.round(targetFreq * N / sampleRate);
        const w = (2 * Math.PI * k) / N;
        const coeff = 2 * Math.cos(w);
        
        let s0 = 0, s1 = 0, s2 = 0;
        for (let i = 0; i < N; i++) {
            s0 = samples[i] + coeff * s1 - s2;
            s2 = s1;
            s1 = s0;
        }
        
        // Return magnitude squared
        return s1 * s1 + s2 * s2 - coeff * s1 * s2;
    }

    /**
     * Detect dominant frequency in audio samples
     * Uses multiple Goertzel filters across SSTV frequency range
     */
    function detectFrequency(samples, sampleRate) {
        const freqRange = { min: 1100, max: 2400, step: 25 };
        let maxPower = 0;
        let dominantFreq = 0;
        
        for (let freq = freqRange.min; freq <= freqRange.max; freq += freqRange.step) {
            const power = goertzel(samples, freq, sampleRate);
            if (power > maxPower) {
                maxPower = power;
                dominantFreq = freq;
            }
        }
        
        // Refine with smaller steps around dominant frequency
        const refineRange = 30;
        for (let freq = dominantFreq - refineRange; freq <= dominantFreq + refineRange; freq += 5) {
            const power = goertzel(samples, freq, sampleRate);
            if (power > maxPower) {
                maxPower = power;
                dominantFreq = freq;
            }
        }
        
        return { frequency: dominantFreq, power: maxPower };
    }

    /**
     * Convert frequency to luminance (0-255)
     */
    function freqToLuminance(freq) {
        // 1500 Hz = black (0), 2300 Hz = white (255)
        const normalized = (freq - FREQ.BLACK) / (FREQ.WHITE - FREQ.BLACK);
        return Math.max(0, Math.min(255, Math.round(normalized * 255)));
    }

    /**
     * Convert luminance to frequency
     */
    function luminanceToFreq(luminance) {
        // 0 = 1500 Hz, 255 = 2300 Hz
        return FREQ.BLACK + (luminance / 255) * (FREQ.WHITE - FREQ.BLACK);
    }

    /**
     * Low-pass filter for audio smoothing
     */
    function lowPassFilter(samples, cutoffFreq, sampleRate) {
        const rc = 1.0 / (cutoffFreq * 2 * Math.PI);
        const dt = 1.0 / sampleRate;
        const alpha = dt / (rc + dt);
        
        const filtered = new Float32Array(samples.length);
        filtered[0] = samples[0];
        
        for (let i = 1; i < samples.length; i++) {
            filtered[i] = filtered[i - 1] + alpha * (samples[i] - filtered[i - 1]);
        }
        
        return filtered;
    }

    /**
     * Detect sync pulse in audio
     */
    function detectSync(samples, sampleRate) {
        const syncPower = goertzel(samples, FREQ.SYNC, sampleRate);
        const noiseFloor = goertzel(samples, 1800, sampleRate); // Mid-range reference
        return syncPower > noiseFloor * 3;
    }

    // ==========================================
    // VIS CODE DETECTION
    // ==========================================

    /**
     * Decode VIS code from audio samples
     * VIS = Vertical Interval Signaling - identifies the SSTV mode
     * Structure: 300ms leader (1900Hz) + 10ms break (1200Hz) + 30ms leader + 30ms start bit + 8 data bits
     */
    function decodeVIS(samples, sampleRate) {
        const bitDuration = 30; // ms per bit
        const samplesPerBit = Math.round(sampleRate * bitDuration / 1000);
        
        // Look for VIS start (1900Hz leader followed by 1200Hz break)
        let visStartIndex = -1;
        const windowSize = Math.round(sampleRate * 0.01); // 10ms window
        
        for (let i = 0; i < samples.length - windowSize * 50; i += windowSize) {
            const window = samples.slice(i, i + windowSize);
            const { frequency } = detectFrequency(window, sampleRate);
            
            // Look for transition from ~1900 Hz to ~1200 Hz
            if (frequency > 1850 && frequency < 1950) {
                const nextWindow = samples.slice(i + windowSize, i + windowSize * 2);
                const { frequency: nextFreq } = detectFrequency(nextWindow, sampleRate);
                
                if (nextFreq > 1150 && nextFreq < 1250) {
                    visStartIndex = i + windowSize * 2;
                    break;
                }
            }
        }
        
        if (visStartIndex < 0) {
            return null; // No VIS code found
        }
        
        // Skip to start bit position (30ms after break)
        visStartIndex += Math.round(sampleRate * 0.03);
        
        // Decode 8 bits (LSB first) + parity
        let visByte = 0;
        for (let bit = 0; bit < 8; bit++) {
            const bitStart = visStartIndex + bit * samplesPerBit;
            const bitSamples = samples.slice(bitStart, bitStart + samplesPerBit);
            const { frequency } = detectFrequency(bitSamples, sampleRate);
            
            // 1100 Hz = 1, 1300 Hz = 0
            if (frequency < 1200) {
                visByte |= (1 << bit);
            }
        }
        
        // Look up mode
        const modeName = VIS_CODES[visByte];
        if (modeName && MODES[modeName]) {
            return {
                code: visByte,
                mode: modeName,
                config: MODES[modeName]
            };
        }
        
        return null;
    }

    /**
     * Generate VIS code audio
     */
    function generateVIS(mode) {
        const config = MODES[mode];
        if (!config) return null;
        
        const visCode = config.vis;
        const samples = [];
        
        // Leader tone (300ms at 1900 Hz)
        appendTone(samples, FREQ.LEADER, 300, SAMPLE_RATE);
        
        // Break (10ms at 1200 Hz)
        appendTone(samples, FREQ.BREAK, 10, SAMPLE_RATE);
        
        // Leader (300ms at 1900 Hz)
        appendTone(samples, FREQ.LEADER, 300, SAMPLE_RATE);
        
        // Start bit (30ms at 1200 Hz)
        appendTone(samples, FREQ.BREAK, 30, SAMPLE_RATE);
        
        // 8 data bits (LSB first)
        for (let bit = 0; bit < 8; bit++) {
            const freq = (visCode & (1 << bit)) ? FREQ.VIS_BIT_1 : FREQ.VIS_BIT_0;
            appendTone(samples, freq, 30, SAMPLE_RATE);
        }
        
        // Stop bit (30ms at 1200 Hz)
        appendTone(samples, FREQ.BREAK, 30, SAMPLE_RATE);
        
        return new Float32Array(samples);
    }

    /**
     * Append a tone to sample array
     */
    function appendTone(samples, freq, durationMs, sampleRate) {
        const numSamples = Math.round(sampleRate * durationMs / 1000);
        const phase = samples.length > 0 ? 
            Math.asin(samples[samples.length - 1]) : 0;
        
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            samples.push(Math.sin(2 * Math.PI * freq * t + phase));
        }
    }

    // ==========================================
    // DECODER
    // ==========================================

    /**
     * Main decoder class
     */
    class SSTVDecoder {
        constructor() {
            this.reset();
        }
        
        reset() {
            decoderState = {
                mode: null,
                phase: 'IDLE',
                currentLine: 0,
                imageData: null,
                startTime: null,
                lastSyncTime: 0,
                syncCount: 0,
                signalStrength: 0,
                errors: []
            };
        }
        
        /**
         * Process incoming audio chunk
         */
        processAudio(samples) {
            switch (decoderState.phase) {
                case 'IDLE':
                    this.detectVISStart(samples);
                    break;
                case 'VIS_DETECT':
                    this.decodeVISCode(samples);
                    break;
                case 'RECEIVING':
                    this.decodeLine(samples);
                    break;
            }
            
            return {
                phase: decoderState.phase,
                mode: decoderState.mode,
                progress: decoderState.mode ? 
                    (decoderState.currentLine / MODES[decoderState.mode].height) : 0,
                signalStrength: decoderState.signalStrength
            };
        }
        
        detectVISStart(samples) {
            // Look for 1900 Hz leader tone
            const leaderPower = goertzel(samples, FREQ.LEADER, SAMPLE_RATE);
            const noisePower = goertzel(samples, 2000, SAMPLE_RATE);
            
            decoderState.signalStrength = Math.min(1, leaderPower / (noisePower * 10 + 0.001));
            
            if (leaderPower > noisePower * 5) {
                decoderState.phase = 'VIS_DETECT';
                decoderState.startTime = performance.now();
                console.log('[SSTV] VIS leader detected');
            }
        }
        
        decodeVISCode(samples) {
            const vis = decodeVIS(samples, SAMPLE_RATE);
            
            if (vis) {
                decoderState.mode = vis.mode;
                decoderState.phase = 'RECEIVING';
                decoderState.currentLine = 0;
                
                const config = vis.config;
                decoderState.imageData = new ImageData(config.width, config.height);
                
                console.log(`[SSTV] Mode detected: ${vis.mode} (VIS: 0x${vis.code.toString(16)})`);
                
                // Emit event
                if (typeof Events !== 'undefined') {
                    Events.emit('sstv:modeDetected', { mode: vis.mode, config });
                }
            } else {
                // Timeout after 2 seconds without valid VIS
                if (performance.now() - decoderState.startTime > 2000) {
                    console.log('[SSTV] VIS detection timeout');
                    this.reset();
                }
            }
        }
        
        decodeLine(samples) {
            const config = MODES[decoderState.mode];
            if (!config) return;
            
            // Detect sync pulse at start of line
            if (detectSync(samples.slice(0, Math.round(SAMPLE_RATE * 0.01)), SAMPLE_RATE)) {
                decoderState.syncCount++;
                
                // Decode pixels for this line based on mode
                switch (config.colorMode) {
                    case 'YCrCb':
                        this.decodeYCrCbLine(samples, config);
                        break;
                    case 'GBR':
                        this.decodeGBRLine(samples, config);
                        break;
                }
                
                decoderState.currentLine++;
                
                // Emit progress event
                if (typeof Events !== 'undefined') {
                    Events.emit('sstv:progress', {
                        line: decoderState.currentLine,
                        total: config.height,
                        imageData: decoderState.imageData
                    });
                }
                
                // Check if complete
                if (decoderState.currentLine >= config.height) {
                    this.completeImage();
                }
            }
        }
        
        decodeYCrCbLine(samples, config) {
            const line = decoderState.currentLine;
            const width = config.width;
            const samplesPerPixel = Math.round(SAMPLE_RATE * config.scanTime / 1000 / width);
            
            // Skip sync and porch
            const dataStart = Math.round(SAMPLE_RATE * (config.syncTime + config.porchTime) / 1000);
            
            // Decode Y (luminance)
            const yData = new Uint8Array(width);
            for (let x = 0; x < width; x++) {
                const pixelStart = dataStart + x * samplesPerPixel;
                const pixelSamples = samples.slice(pixelStart, pixelStart + samplesPerPixel);
                const { frequency } = detectFrequency(pixelSamples, SAMPLE_RATE);
                yData[x] = freqToLuminance(frequency);
            }
            
            // For Robot modes, Cr and Cb are sent for pairs of lines
            // Simplified: convert Y to grayscale for now
            for (let x = 0; x < width; x++) {
                const idx = (line * width + x) * 4;
                decoderState.imageData.data[idx] = yData[x];     // R
                decoderState.imageData.data[idx + 1] = yData[x]; // G
                decoderState.imageData.data[idx + 2] = yData[x]; // B
                decoderState.imageData.data[idx + 3] = 255;      // A
            }
        }
        
        decodeGBRLine(samples, config) {
            const line = decoderState.currentLine;
            const width = config.width;
            const samplesPerPixel = Math.round(SAMPLE_RATE * config.scanTime / 1000 / width);
            
            // GBR modes send Green, Blue, Red sequentially
            const colorStart = Math.round(SAMPLE_RATE * config.syncTime / 1000);
            const colorDuration = Math.round(SAMPLE_RATE * config.scanTime / 1000);
            const sepDuration = Math.round(SAMPLE_RATE * (config.separatorTime || 0) / 1000);
            
            // Decode each color channel
            const colors = { g: [], b: [], r: [] };
            const channels = ['g', 'b', 'r'];
            
            let offset = colorStart;
            for (const channel of channels) {
                for (let x = 0; x < width; x++) {
                    const pixelStart = offset + x * samplesPerPixel;
                    const pixelSamples = samples.slice(pixelStart, pixelStart + samplesPerPixel);
                    const { frequency } = detectFrequency(pixelSamples, SAMPLE_RATE);
                    colors[channel].push(freqToLuminance(frequency));
                }
                offset += colorDuration + sepDuration;
            }
            
            // Write to image data
            for (let x = 0; x < width; x++) {
                const idx = (line * width + x) * 4;
                decoderState.imageData.data[idx] = colors.r[x];     // R
                decoderState.imageData.data[idx + 1] = colors.g[x]; // G
                decoderState.imageData.data[idx + 2] = colors.b[x]; // B
                decoderState.imageData.data[idx + 3] = 255;         // A
            }
        }
        
        completeImage() {
            decoderState.phase = 'COMPLETE';
            
            const imageEntry = {
                id: Date.now().toString(36),
                timestamp: new Date().toISOString(),
                mode: decoderState.mode,
                imageData: decoderState.imageData,
                width: decoderState.imageData.width,
                height: decoderState.imageData.height,
                syncCount: decoderState.syncCount,
                duration: (performance.now() - decoderState.startTime) / 1000
            };
            
            // Add to history
            receivedImages.unshift(imageEntry);
            if (receivedImages.length > MAX_HISTORY) {
                receivedImages.pop();
            }
            
            // Save to storage
            saveReceivedImages();
            
            console.log(`[SSTV] Image complete: ${decoderState.mode}, ${imageEntry.duration.toFixed(1)}s`);
            
            // Emit event
            if (typeof Events !== 'undefined') {
                Events.emit('sstv:imageComplete', imageEntry);
            }
            
            // Reset for next image
            this.reset();
        }
    }

    // ==========================================
    // ENCODER
    // ==========================================

    /**
     * Encode image to SSTV audio
     */
    class SSTVEncoder {
        constructor() {
            this.samples = [];
        }
        
        /**
         * Encode an image to SSTV audio
         * @param {ImageData} imageData - Image to encode
         * @param {string} mode - SSTV mode name
         * @param {Object} options - Overlay options (callsign, grid)
         */
        encode(imageData, mode = 'Robot36', options = {}) {
            const config = MODES[mode];
            if (!config) {
                throw new Error(`Unknown SSTV mode: ${mode}`);
            }
            
            this.samples = [];
            
            // Resize image if needed
            const resizedImage = this.resizeImage(imageData, config.width, config.height);
            
            // Add callsign overlay if enabled
            if (options.callsign && settings.autoCallsignOverlay) {
                this.addCallsignOverlay(resizedImage, options.callsign, options.gridSquare);
            }
            
            // Generate VIS code
            const visSamples = generateVIS(mode);
            for (let i = 0; i < visSamples.length; i++) {
                this.samples.push(visSamples[i]);
            }
            
            // Encode image data based on mode color format
            switch (config.colorMode) {
                case 'YCrCb':
                    this.encodeYCrCb(resizedImage, config);
                    break;
                case 'GBR':
                    this.encodeGBR(resizedImage, config);
                    break;
            }
            
            return new Float32Array(this.samples);
        }
        
        resizeImage(imageData, targetWidth, targetHeight) {
            // Create canvas for resizing
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            
            // Create temporary canvas with source image
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = imageData.width;
            srcCanvas.height = imageData.height;
            const srcCtx = srcCanvas.getContext('2d');
            srcCtx.putImageData(imageData, 0, 0);
            
            // Draw scaled
            ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);
            
            return ctx.getImageData(0, 0, targetWidth, targetHeight);
        }
        
        addCallsignOverlay(imageData, callsign, gridSquare) {
            const canvas = document.createElement('canvas');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0);
            
            // Semi-transparent background for text
            const padding = 4;
            const fontSize = Math.max(12, Math.floor(imageData.height / 16));
            ctx.font = `bold ${fontSize}px monospace`;
            
            const text = gridSquare ? `${callsign} ${gridSquare}` : callsign;
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = fontSize;
            
            // Position in bottom-left corner
            const x = padding;
            const y = imageData.height - padding - textHeight;
            
            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x - 2, y - 2, textWidth + 4, textHeight + 4);
            
            // Draw text
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, x, y + textHeight - 2);
            
            // Copy back to imageData
            const newData = ctx.getImageData(0, 0, imageData.width, imageData.height);
            for (let i = 0; i < imageData.data.length; i++) {
                imageData.data[i] = newData.data[i];
            }
        }
        
        encodeYCrCb(imageData, config) {
            const width = config.width;
            const height = config.height;
            
            for (let line = 0; line < height; line++) {
                // Sync pulse
                this.appendTone(FREQ.SYNC, config.syncTime);
                
                // Porch
                this.appendTone(FREQ.BLACK, config.porchTime);
                
                // Y (luminance) for this line
                for (let x = 0; x < width; x++) {
                    const idx = (line * width + x) * 4;
                    const r = imageData.data[idx];
                    const g = imageData.data[idx + 1];
                    const b = imageData.data[idx + 2];
                    
                    // Convert RGB to Y
                    const y = 0.299 * r + 0.587 * g + 0.114 * b;
                    const freq = luminanceToFreq(y);
                    
                    const pixelTime = config.scanTime / width;
                    this.appendTone(freq, pixelTime);
                }
                
                // For Robot modes, Cr and Cb are sent for pairs of lines
                if (line % 2 === 1 && config.chromaScanTime) {
                    // Simplified: just send grayscale for now
                    // Full implementation would interleave Cr/Cb
                }
            }
        }
        
        encodeGBR(imageData, config) {
            const width = config.width;
            const height = config.height;
            
            for (let line = 0; line < height; line++) {
                // Sync pulse
                this.appendTone(FREQ.SYNC, config.syncTime);
                
                // Porch
                if (config.porchTime) {
                    this.appendTone(FREQ.BLACK, config.porchTime);
                }
                
                // Green channel
                for (let x = 0; x < width; x++) {
                    const idx = (line * width + x) * 4;
                    const g = imageData.data[idx + 1];
                    const freq = luminanceToFreq(g);
                    const pixelTime = config.scanTime / width;
                    this.appendTone(freq, pixelTime);
                }
                
                // Separator
                if (config.separatorTime) {
                    this.appendTone(FREQ.BLACK, config.separatorTime);
                }
                
                // Blue channel
                for (let x = 0; x < width; x++) {
                    const idx = (line * width + x) * 4;
                    const b = imageData.data[idx + 2];
                    const freq = luminanceToFreq(b);
                    const pixelTime = config.scanTime / width;
                    this.appendTone(freq, pixelTime);
                }
                
                // Separator
                if (config.separatorTime) {
                    this.appendTone(FREQ.BLACK, config.separatorTime);
                }
                
                // Red channel
                for (let x = 0; x < width; x++) {
                    const idx = (line * width + x) * 4;
                    const r = imageData.data[idx];
                    const freq = luminanceToFreq(r);
                    const pixelTime = config.scanTime / width;
                    this.appendTone(freq, pixelTime);
                }
            }
        }
        
        appendTone(freq, durationMs) {
            const numSamples = Math.round(SAMPLE_RATE * durationMs / 1000);
            
            // Maintain phase continuity
            const phase = this.samples.length > 0 ? 
                Math.asin(Math.max(-1, Math.min(1, this.samples[this.samples.length - 1]))) : 0;
            
            for (let i = 0; i < numSamples; i++) {
                const t = i / SAMPLE_RATE;
                this.samples.push(Math.sin(2 * Math.PI * freq * t + phase));
            }
        }
    }

    // Create singleton instances
    const decoder = new SSTVDecoder();
    const encoder = new SSTVEncoder();

    // ==========================================
    // AUDIO I/O
    // ==========================================

    /**
     * Initialize audio context and request microphone access
     */
    async function initAudio() {
        if (audioContext) {
            return true;
        }
        
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: SAMPLE_RATE
            });
            
            console.log('[SSTV] Audio context initialized, sample rate:', audioContext.sampleRate);
            return true;
        } catch (err) {
            console.error('[SSTV] Failed to create audio context:', err);
            return false;
        }
    }

    /**
     * Request microphone access
     */
    async function requestMicrophoneAccess() {
        try {
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1
                }
            };
            
            // If specific device selected
            if (settings.audioInputDevice && settings.audioInputDevice !== 'default') {
                constraints.audio.deviceId = { exact: settings.audioInputDevice };
            }
            
            mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('[SSTV] Microphone access granted');
            
            // Setup audio nodes
            sourceNode = audioContext.createMediaStreamSource(mediaStream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.1;
            
            sourceNode.connect(analyser);
            
            return true;
        } catch (err) {
            console.error('[SSTV] Microphone access denied:', err);
            return false;
        }
    }

    /**
     * Get available audio devices
     */
    async function getAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                inputs: devices.filter(d => d.kind === 'audioinput').map(d => ({
                    id: d.deviceId,
                    label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`
                })),
                outputs: devices.filter(d => d.kind === 'audiooutput').map(d => ({
                    id: d.deviceId,
                    label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`
                }))
            };
        } catch (err) {
            console.error('[SSTV] Failed to enumerate devices:', err);
            return { inputs: [], outputs: [] };
        }
    }

    /**
     * Start receiving SSTV
     */
    async function startReceive() {
        if (isReceiving) return true;
        
        await initAudio();
        
        if (!mediaStream) {
            const hasAccess = await requestMicrophoneAccess();
            if (!hasAccess) {
                if (typeof ModalsModule !== 'undefined') {
                    ModalsModule.showToast('Microphone access required for SSTV receive', 'error');
                }
                return false;
            }
        }
        
        // Resume audio context if suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        isReceiving = true;
        decoder.reset();
        
        // Start processing audio
        processAudioLoop();
        
        console.log('[SSTV] Receive started');
        
        if (typeof Events !== 'undefined') {
            Events.emit('sstv:receiveStarted');
        }
        
        return true;
    }

    /**
     * Stop receiving SSTV
     */
    function stopReceive() {
        isReceiving = false;
        
        if (typeof Events !== 'undefined') {
            Events.emit('sstv:receiveStopped');
        }
        
        console.log('[SSTV] Receive stopped');
    }

    /**
     * Audio processing loop
     */
    function processAudioLoop() {
        if (!isReceiving || !analyser) return;
        
        const bufferLength = analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        
        analyser.getFloatTimeDomainData(dataArray);
        
        // Process audio through decoder
        const status = decoder.processAudio(dataArray);
        
        // Emit status update
        if (typeof Events !== 'undefined') {
            Events.emit('sstv:status', status);
        }
        
        // Continue loop
        requestAnimationFrame(processAudioLoop);
    }

    /**
     * Transmit SSTV image
     * @param {ImageData|HTMLImageElement|HTMLCanvasElement} source - Image source
     * @param {string} mode - SSTV mode
     */
    async function transmit(source, mode = null) {
        // Validate transmission is allowed
        if (!await validateTransmit()) {
            return false;
        }
        
        await initAudio();
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        // Get ImageData from source
        let imageData;
        if (source instanceof ImageData) {
            imageData = source;
        } else {
            const canvas = document.createElement('canvas');
            if (source instanceof HTMLCanvasElement) {
                canvas.width = source.width;
                canvas.height = source.height;
                canvas.getContext('2d').drawImage(source, 0, 0);
            } else if (source instanceof HTMLImageElement) {
                canvas.width = source.naturalWidth || source.width;
                canvas.height = source.naturalHeight || source.height;
                canvas.getContext('2d').drawImage(source, 0, 0);
            }
            imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        }
        
        // Use selected mode or default
        const txMode = mode || settings.defaultMode;
        
        // Encode image
        const audioSamples = encoder.encode(imageData, txMode, {
            callsign: settings.callsign,
            gridSquare: settings.gridSquare
        });
        
        // Create audio buffer
        const audioBuffer = audioContext.createBuffer(1, audioSamples.length, SAMPLE_RATE);
        audioBuffer.getChannelData(0).set(audioSamples);
        
        // Play through speakers/headphone jack
        const source_node = audioContext.createBufferSource();
        source_node.buffer = audioBuffer;
        
        // Apply gain
        const gainNode = audioContext.createGain();
        gainNode.gain.value = settings.gainLevel;
        
        source_node.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        isTransmitting = true;
        
        if (typeof Events !== 'undefined') {
            Events.emit('sstv:transmitStarted', { mode: txMode, duration: audioSamples.length / SAMPLE_RATE });
        }
        
        return new Promise((resolve) => {
            source_node.onended = () => {
                isTransmitting = false;
                
                if (typeof Events !== 'undefined') {
                    Events.emit('sstv:transmitComplete', { mode: txMode });
                }
                
                console.log(`[SSTV] Transmit complete: ${txMode}`);
                resolve(true);
            };
            
            source_node.start();
        });
    }

    /**
     * Validate transmission is allowed (license check)
     */
    async function validateTransmit() {
        if (!settings.callsign) {
            if (typeof ModalsModule !== 'undefined') {
                // Show callsign input modal
                const callsign = await new Promise((resolve) => {
                    ModalsModule.confirm({
                        title: 'Callsign Required',
                        message: 'Enter your amateur radio callsign to transmit SSTV:',
                        input: true,
                        inputPlaceholder: 'e.g., W1ABC',
                        onConfirm: (value) => resolve(value ? value.toUpperCase() : null),
                        onCancel: () => resolve(null)
                    });
                });
                
                if (!callsign) return false;
                
                settings.callsign = callsign;
                await saveSettings();
            } else {
                return false;
            }
        }
        
        if (!settings.licenseAcknowledged) {
            if (typeof ModalsModule !== 'undefined') {
                const acknowledged = await new Promise((resolve) => {
                    ModalsModule.confirm({
                        title: 'License Acknowledgment',
                        message: `SSTV transmission requires a valid amateur radio license.\n\n` +
                                 `By continuing, you confirm:\n` +
                                 `• You hold a valid amateur radio license\n` +
                                 `• You will operate within legal band limits\n` +
                                 `• You will identify with your callsign per regulations\n` +
                                 `• You will comply with Part 97 (FCC) or equivalent rules`,
                        confirmText: 'I Acknowledge',
                        cancelText: 'Cancel',
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false)
                    });
                });
                
                if (!acknowledged) return false;
                
                settings.licenseAcknowledged = true;
                await saveSettings();
            } else {
                return false;
            }
        }
        
        return true;
    }

    // ==========================================
    // STORAGE
    // ==========================================

    async function loadSettings() {
        try {
            const saved = await Storage.Settings.get('sstv_settings');
            if (saved) {
                settings = { ...settings, ...saved };
            }
        } catch (err) {
            console.error('[SSTV] Failed to load settings:', err);
        }
    }

    async function saveSettings() {
        try {
            await Storage.Settings.set('sstv_settings', settings);
        } catch (err) {
            console.error('[SSTV] Failed to save settings:', err);
        }
    }

    async function loadReceivedImages() {
        try {
            const saved = await Storage.get('sstv_history');
            if (saved) {
                // Restore ImageData objects from stored format
                receivedImages = saved.map(entry => {
                    if (entry.imageDataArray) {
                        const data = new Uint8ClampedArray(entry.imageDataArray);
                        entry.imageData = new ImageData(data, entry.width, entry.height);
                        delete entry.imageDataArray;
                    }
                    return entry;
                });
            }
        } catch (err) {
            console.error('[SSTV] Failed to load history:', err);
        }
    }

    async function saveReceivedImages() {
        try {
            // Convert ImageData to storable format
            const storable = receivedImages.map(entry => {
                const stored = { ...entry };
                if (entry.imageData) {
                    stored.imageDataArray = Array.from(entry.imageData.data);
                    delete stored.imageData;
                }
                return stored;
            });
            
            await Storage.set('sstv_history', storable);
        } catch (err) {
            console.error('[SSTV] Failed to save history:', err);
        }
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    /**
     * Convert ImageData to data URL
     */
    function imageDataToDataURL(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        canvas.getContext('2d').putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    }

    /**
     * Create ImageData from current map view
     */
    async function captureMapView() {
        if (typeof MapModule === 'undefined') {
            throw new Error('MapModule not available');
        }
        
        const canvas = document.getElementById('map-canvas');
        if (!canvas) {
            throw new Error('Map canvas not found');
        }
        
        return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    }

    /**
     * Calculate Maidenhead grid square from coordinates
     */
    function calculateGridSquare(lat, lon) {
        const lng = lon + 180;
        const lt = lat + 90;
        
        const field1 = String.fromCharCode(65 + Math.floor(lng / 20));
        const field2 = String.fromCharCode(65 + Math.floor(lt / 10));
        const square1 = Math.floor((lng % 20) / 2);
        const square2 = Math.floor(lt % 10);
        const subsquare1 = String.fromCharCode(97 + Math.floor((lng % 2) * 12));
        const subsquare2 = String.fromCharCode(97 + Math.floor((lt % 1) * 24));
        
        return `${field1}${field2}${square1}${square2}${subsquare1}${subsquare2}`;
    }

    /**
     * Update grid square from GPS
     */
    async function updateGridSquareFromGPS() {
        if (typeof GPSModule !== 'undefined') {
            const position = GPSModule.getLastPosition();
            if (position) {
                settings.gridSquare = calculateGridSquare(position.lat, position.lon);
                await saveSettings();
                return settings.gridSquare;
            }
        }
        return null;
    }

    /**
     * Delete image from history
     */
    async function deleteImage(id) {
        const idx = receivedImages.findIndex(img => img.id === id);
        if (idx >= 0) {
            receivedImages.splice(idx, 1);
            await saveReceivedImages();
            return true;
        }
        return false;
    }

    /**
     * Clear all history
     */
    async function clearHistory() {
        receivedImages = [];
        await saveReceivedImages();
    }

    /**
     * Export image as PNG
     */
    function exportImage(id) {
        const entry = receivedImages.find(img => img.id === id);
        if (!entry || !entry.imageData) return null;
        
        const dataURL = imageDataToDataURL(entry.imageData);
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `sstv_${entry.mode}_${entry.timestamp.replace(/[:.]/g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return true;
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {
        if (initialized) {
            console.debug('SSTVModule already initialized');
            return;
        }
        
        await loadSettings();
        await loadReceivedImages();
        
        // Check for Web Audio API support
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn('[SSTV] Web Audio API not supported');
        }
        
        // Check for getUserMedia support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('[SSTV] getUserMedia not supported');
        }
        
        initialized = true;
        console.log('[SSTV] Module initialized');
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        
        // Audio control
        initAudio,
        getAudioDevices,
        startReceive,
        stopReceive,
        transmit,
        
        // State
        isReceiving: () => isReceiving,
        isTransmitting: () => isTransmitting,
        getDecoderState: () => ({ ...decoderState }),
        
        // Settings
        getSettings: () => ({ ...settings }),
        updateSettings: async (newSettings) => {
            settings = { ...settings, ...newSettings };
            await saveSettings();
        },
        
        // History
        getReceivedImages: () => receivedImages,
        deleteImage,
        clearHistory,
        exportImage,
        
        // Utilities
        imageDataToDataURL,
        captureMapView,
        calculateGridSquare,
        updateGridSquareFromGPS,
        
        // Mode info
        MODES,
        VIS_CODES,
        FREQ,
        
        // For testing
        _decoder: decoder,
        _encoder: encoder
    };
})();

window.SSTVModule = SSTVModule;
