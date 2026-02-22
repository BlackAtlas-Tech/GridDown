/**
 * GridDown SSTV DSP Module
 * Advanced signal processing for SSTV: Waterfall Display & Auto-Slant Correction
 * 
 * Features:
 * - Real-time waterfall/spectrogram display (1100-2300 Hz)
 * - Auto-slant detection and correction
 * - Sample rate drift compensation
 * - Sync pulse timing analysis
 * 
 * License: MIT (BlackAtlas LLC)
 */
const SSTVDSPModule = (function() {
    'use strict';

    // ==========================================
    // CONSTANTS
    // ==========================================

    const SAMPLE_RATE = 48000;
    
    // SSTV frequency range
    const FREQ_MIN = 1100;  // Below sync (1200 Hz)
    const FREQ_MAX = 2400;  // Above white (2300 Hz)
    const FREQ_RANGE = FREQ_MAX - FREQ_MIN;
    
    // Waterfall configuration
    const WATERFALL_CONFIG = {
        fftSize: 2048,           // FFT size (power of 2)
        hopSize: 512,            // Samples between FFT frames
        height: 256,             // Display height (time history)
        colormap: 'viridis',     // Color scheme
        minDb: -80,              // Minimum dB for display
        maxDb: -20,              // Maximum dB for display
        scrollSpeed: 1           // Lines per update
    };

    // Slant correction configuration
    const SLANT_CONFIG = {
        syncFreq: 1200,          // Hz
        syncDuration: 9,         // ms (typical)
        minSyncPulses: 10,       // Minimum pulses for analysis
        maxSlantPercent: 5,      // Maximum correction (±5%)
        analysisWindow: 50       // Lines to analyze
    };

    // Frequency drift configuration
    const DRIFT_CONFIG = {
        referenceFreq: 1200,      // Sync frequency as reference (Hz)
        maxDriftHz: 50,           // Maximum drift to track (±Hz)
        analysisWindowMs: 100,    // Window for frequency analysis
        smoothingFactor: 0.1,     // Low-pass filter coefficient
        minConfidence: 0.3,       // Minimum confidence to update drift
        historyLength: 50         // Number of measurements to keep
    };

    // ==========================================
    // STATE
    // ==========================================

    let initialized = false;
    let audioContext = null;
    let analyserNode = null;
    let waterfallCanvas = null;
    let waterfallCtx = null;
    let waterfallImageData = null;
    let waterfallRunning = false;
    let animationFrameId = null;

    // FFT data buffers
    let fftBuffer = null;
    let fftFrequencyData = null;

    // Slant analysis state
    let syncPulseTimes = [];
    let expectedLineTime = 0;
    let measuredLineTime = 0;
    let slantFactor = 1.0;
    let slantCorrectionEnabled = true;

    // Frequency drift compensation state
    let driftCompensation = 0;           // Current drift in Hz
    let driftHistory = [];               // History of drift measurements
    let driftConfidence = 0;             // Confidence in drift estimate (0-1)
    let driftCorrectionEnabled = true;   // Enable/disable drift correction
    let lastSyncFrequency = 1200;        // Last measured sync frequency
    let syncMeasurements = [];           // Recent sync frequency measurements

    // Colormaps for waterfall
    const COLORMAPS = {
        viridis: generateViridisColormap(),
        plasma: generatePlasmaColormap(),
        grayscale: generateGrayscaleColormap(),
        thermal: generateThermalColormap()
    };

    // ==========================================
    // COLORMAP GENERATORS
    // ==========================================

    function generateViridisColormap() {
        const colors = [];
        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            // Viridis-like approximation
            const r = Math.round(255 * Math.max(0, Math.min(1, 0.267 + 0.003 * t + 2.79 * t * t - 3.55 * t * t * t + 1.5 * t * t * t * t)));
            const g = Math.round(255 * Math.max(0, Math.min(1, 0.004 + 1.42 * t - 1.12 * t * t + 0.62 * t * t * t)));
            const b = Math.round(255 * Math.max(0, Math.min(1, 0.329 + 1.42 * t - 2.32 * t * t + 1.56 * t * t * t)));
            colors.push([r, g, b]);
        }
        return colors;
    }

    function generatePlasmaColormap() {
        const colors = [];
        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            const r = Math.round(255 * Math.max(0, Math.min(1, 0.05 + 2.86 * t - 2.13 * t * t)));
            const g = Math.round(255 * Math.max(0, Math.min(1, 0.02 + 0.74 * t + 0.27 * t * t)));
            const b = Math.round(255 * Math.max(0, Math.min(1, 0.53 + 0.87 * t - 1.64 * t * t + 0.74 * t * t * t)));
            colors.push([r, g, b]);
        }
        return colors;
    }

    function generateGrayscaleColormap() {
        const colors = [];
        for (let i = 0; i < 256; i++) {
            colors.push([i, i, i]);
        }
        return colors;
    }

    function generateThermalColormap() {
        const colors = [];
        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            let r, g, b;
            if (t < 0.33) {
                // Black to blue
                r = 0;
                g = 0;
                b = Math.round(255 * (t / 0.33));
            } else if (t < 0.66) {
                // Blue to red
                const u = (t - 0.33) / 0.33;
                r = Math.round(255 * u);
                g = 0;
                b = Math.round(255 * (1 - u));
            } else {
                // Red to yellow/white
                const u = (t - 0.66) / 0.34;
                r = 255;
                g = Math.round(255 * u);
                b = Math.round(255 * u * 0.5);
            }
            colors.push([r, g, b]);
        }
        return colors;
    }

    // ==========================================
    // WATERFALL DISPLAY
    // ==========================================

    /**
     * Initialize waterfall display
     * @param {HTMLCanvasElement} canvas - Canvas element for waterfall
     * @param {AudioContext} ctx - Existing audio context
     * @param {MediaStreamAudioSourceNode} source - Audio source node
     */
    function initWaterfall(canvas, ctx, source) {
        if (!canvas || !ctx || !source) {
            console.error('[SSTV-DSP] Waterfall init requires canvas, context, and source');
            return false;
        }

        waterfallCanvas = canvas;
        waterfallCtx = canvas.getContext('2d');
        audioContext = ctx;

        // Create analyser node
        analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = WATERFALL_CONFIG.fftSize;
        analyserNode.smoothingTimeConstant = 0.5;
        analyserNode.minDecibels = WATERFALL_CONFIG.minDb;
        analyserNode.maxDecibels = WATERFALL_CONFIG.maxDb;

        // Connect source to analyser
        source.connect(analyserNode);

        // Initialize buffers
        fftFrequencyData = new Uint8Array(analyserNode.frequencyBinCount);

        // Initialize canvas
        waterfallCanvas.width = 400;  // Width = frequency bins in range
        waterfallCanvas.height = WATERFALL_CONFIG.height;
        waterfallImageData = waterfallCtx.createImageData(waterfallCanvas.width, waterfallCanvas.height);

        // Clear canvas
        waterfallCtx.fillStyle = '#000';
        waterfallCtx.fillRect(0, 0, waterfallCanvas.width, waterfallCanvas.height);

        initialized = true;
        console.log('[SSTV-DSP] Waterfall initialized');
        
        return true;
    }

    /**
     * Start waterfall display updates
     */
    function startWaterfall() {
        if (!initialized || waterfallRunning) return;
        
        waterfallRunning = true;
        updateWaterfall();
        console.log('[SSTV-DSP] Waterfall started');
    }

    /**
     * Stop waterfall display updates
     */
    function stopWaterfall() {
        waterfallRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        console.log('[SSTV-DSP] Waterfall stopped');
    }

    /**
     * Update waterfall display
     */
    function updateWaterfall() {
        if (!waterfallRunning || !analyserNode) return;

        // Get FFT data
        analyserNode.getByteFrequencyData(fftFrequencyData);

        // Calculate frequency bin range for SSTV (1100-2400 Hz)
        const binWidth = audioContext.sampleRate / analyserNode.fftSize;
        const startBin = Math.floor(FREQ_MIN / binWidth);
        const endBin = Math.ceil(FREQ_MAX / binWidth);
        const numBins = endBin - startBin;

        // Scroll existing data down
        const imageData = waterfallImageData;
        const width = waterfallCanvas.width;
        const height = waterfallCanvas.height;

        // Move rows down (copy from top to bottom)
        for (let y = height - 1; y > 0; y--) {
            const srcOffset = (y - 1) * width * 4;
            const dstOffset = y * width * 4;
            for (let x = 0; x < width * 4; x++) {
                imageData.data[dstOffset + x] = imageData.data[srcOffset + x];
            }
        }

        // Draw new row at top
        const colormap = COLORMAPS[WATERFALL_CONFIG.colormap] || COLORMAPS.viridis;
        
        for (let i = 0; i < width; i++) {
            // Map canvas X to FFT bin
            const binIndex = startBin + Math.floor(i * numBins / width);
            const value = binIndex < fftFrequencyData.length ? fftFrequencyData[binIndex] : 0;
            
            // Get color from colormap
            const color = colormap[value];
            const idx = i * 4;
            
            imageData.data[idx] = color[0];     // R
            imageData.data[idx + 1] = color[1]; // G
            imageData.data[idx + 2] = color[2]; // B
            imageData.data[idx + 3] = 255;      // A
        }

        // Draw to canvas
        waterfallCtx.putImageData(imageData, 0, 0);

        // Draw frequency markers
        drawFrequencyMarkers();

        // Schedule next update
        animationFrameId = requestAnimationFrame(updateWaterfall);
    }

    /**
     * Draw frequency marker lines on waterfall
     */
    function drawFrequencyMarkers() {
        const width = waterfallCanvas.width;
        const binWidth = (FREQ_MAX - FREQ_MIN) / width;

        waterfallCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        waterfallCtx.lineWidth = 1;
        waterfallCtx.setLineDash([2, 2]);

        // Key SSTV frequencies
        const markers = [
            { freq: 1200, label: 'SYNC', color: 'rgba(255, 100, 100, 0.7)' },
            { freq: 1500, label: 'BLACK', color: 'rgba(100, 100, 255, 0.7)' },
            { freq: 1900, label: 'VIS', color: 'rgba(255, 255, 100, 0.7)' },
            { freq: 2300, label: 'WHITE', color: 'rgba(100, 255, 100, 0.7)' }
        ];

        waterfallCtx.font = '10px monospace';
        waterfallCtx.textAlign = 'center';

        for (const marker of markers) {
            const x = (marker.freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN) * width;
            
            waterfallCtx.strokeStyle = marker.color;
            waterfallCtx.beginPath();
            waterfallCtx.moveTo(x, 0);
            waterfallCtx.lineTo(x, 20);
            waterfallCtx.stroke();

            waterfallCtx.fillStyle = marker.color;
            waterfallCtx.fillText(marker.label, x, 30);
        }

        waterfallCtx.setLineDash([]);
    }

    /**
     * Set waterfall colormap
     * @param {string} name - Colormap name (viridis, plasma, grayscale, thermal)
     */
    function setColormap(name) {
        if (COLORMAPS[name]) {
            WATERFALL_CONFIG.colormap = name;
            console.log(`[SSTV-DSP] Colormap set to: ${name}`);
        }
    }

    /**
     * Get current dominant frequency from waterfall
     */
    function getDominantFrequency() {
        if (!analyserNode || !fftFrequencyData) return null;

        analyserNode.getByteFrequencyData(fftFrequencyData);
        
        const binWidth = audioContext.sampleRate / analyserNode.fftSize;
        const startBin = Math.floor(FREQ_MIN / binWidth);
        const endBin = Math.ceil(FREQ_MAX / binWidth);

        let maxValue = 0;
        let maxBin = startBin;

        for (let i = startBin; i < endBin && i < fftFrequencyData.length; i++) {
            if (fftFrequencyData[i] > maxValue) {
                maxValue = fftFrequencyData[i];
                maxBin = i;
            }
        }

        return {
            frequency: maxBin * binWidth,
            amplitude: maxValue / 255,
            bin: maxBin
        };
    }

    // ==========================================
    // AUTO-SLANT CORRECTION
    // ==========================================

    /**
     * Reset slant analysis
     */
    function resetSlantAnalysis() {
        syncPulseTimes = [];
        expectedLineTime = 0;
        measuredLineTime = 0;
        slantFactor = 1.0;
    }

    /**
     * Record a sync pulse detection
     * @param {number} timestamp - Time of sync pulse in ms
     */
    function recordSyncPulse(timestamp) {
        syncPulseTimes.push(timestamp);
        
        // Keep only recent pulses
        const maxPulses = SLANT_CONFIG.analysisWindow * 2;
        if (syncPulseTimes.length > maxPulses) {
            syncPulseTimes.shift();
        }

        // Analyze if we have enough samples
        if (syncPulseTimes.length >= SLANT_CONFIG.minSyncPulses) {
            analyzeSlant();
        }
    }

    /**
     * Set expected line time based on SSTV mode
     * @param {string} mode - SSTV mode name
     */
    function setExpectedLineTime(mode) {
        if (!SSTVModule || !SSTVModule.MODES) {
            console.warn('[SSTV-DSP] SSTVModule not available for mode lookup');
            return;
        }

        const modeConfig = SSTVModule.MODES[mode];
        if (modeConfig) {
            // Total line time = sync + porch + scan time(s)
            expectedLineTime = modeConfig.syncTime + 
                              (modeConfig.porchTime || 0) + 
                              modeConfig.scanTime;
            
            if (modeConfig.colorMode === 'GBR') {
                // GBR modes have 3 color scans per line
                expectedLineTime += modeConfig.scanTime * 2 + 
                                   (modeConfig.separatorTime || 0) * 2;
            } else if (modeConfig.colorMode === 'YCrCb' && modeConfig.chromaScanTime) {
                // YCrCb modes have chroma scans
                expectedLineTime += modeConfig.chromaScanTime;
            }
            
            console.log(`[SSTV-DSP] Expected line time for ${mode}: ${expectedLineTime.toFixed(2)}ms`);
        }
    }

    /**
     * Analyze sync pulse timing to detect slant
     */
    function analyzeSlant() {
        if (syncPulseTimes.length < SLANT_CONFIG.minSyncPulses || expectedLineTime === 0) {
            return;
        }

        // Calculate intervals between sync pulses
        const intervals = [];
        for (let i = 1; i < syncPulseTimes.length; i++) {
            intervals.push(syncPulseTimes[i] - syncPulseTimes[i - 1]);
        }

        // Remove outliers (use median-based filtering)
        intervals.sort((a, b) => a - b);
        const median = intervals[Math.floor(intervals.length / 2)];
        const filteredIntervals = intervals.filter(
            i => Math.abs(i - median) < median * 0.2
        );

        if (filteredIntervals.length < SLANT_CONFIG.minSyncPulses - 1) {
            return;
        }

        // Calculate average measured line time
        measuredLineTime = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;

        // Calculate slant factor (ratio of expected to measured)
        const newSlantFactor = expectedLineTime / measuredLineTime;

        // Limit correction range
        const maxCorrection = 1 + SLANT_CONFIG.maxSlantPercent / 100;
        const minCorrection = 1 - SLANT_CONFIG.maxSlantPercent / 100;
        
        slantFactor = Math.max(minCorrection, Math.min(maxCorrection, newSlantFactor));

        const slantPercent = ((slantFactor - 1) * 100).toFixed(2);
        console.log(`[SSTV-DSP] Slant analysis: expected=${expectedLineTime.toFixed(2)}ms, ` +
                    `measured=${measuredLineTime.toFixed(2)}ms, correction=${slantPercent}%`);

        // Emit event for UI update
        if (typeof Events !== 'undefined') {
            Events.emit('sstv:slantAnalysis', {
                expectedLineTime,
                measuredLineTime,
                slantFactor,
                slantPercent: parseFloat(slantPercent),
                sampleCount: filteredIntervals.length
            });
        }
    }

    /**
     * Get current slant correction factor
     */
    function getSlantFactor() {
        return slantCorrectionEnabled ? slantFactor : 1.0;
    }

    /**
     * Apply slant correction to decoded image
     * @param {ImageData} imageData - Original decoded image
     * @returns {ImageData} Corrected image
     */
    function correctSlant(imageData) {
        if (!slantCorrectionEnabled || Math.abs(slantFactor - 1.0) < 0.001) {
            return imageData; // No correction needed
        }

        const width = imageData.width;
        const height = imageData.height;
        
        // Create output image
        const corrected = new ImageData(width, height);
        
        // Calculate pixel shift per line
        // Positive slant = image skews right going down
        // Negative slant = image skews left going down
        const totalShift = width * (1 - slantFactor) * height / width;
        const shiftPerLine = totalShift / height;

        for (let y = 0; y < height; y++) {
            const lineShift = Math.round(shiftPerLine * y);
            
            for (let x = 0; x < width; x++) {
                // Source position with shift
                let srcX = x + lineShift;
                
                // Wrap around if needed
                while (srcX < 0) srcX += width;
                while (srcX >= width) srcX -= width;
                
                // Copy pixel
                const srcIdx = (y * width + srcX) * 4;
                const dstIdx = (y * width + x) * 4;
                
                corrected.data[dstIdx] = imageData.data[srcIdx];
                corrected.data[dstIdx + 1] = imageData.data[srcIdx + 1];
                corrected.data[dstIdx + 2] = imageData.data[srcIdx + 2];
                corrected.data[dstIdx + 3] = imageData.data[srcIdx + 3];
            }
        }

        console.log(`[SSTV-DSP] Slant correction applied: ${((slantFactor - 1) * 100).toFixed(2)}%`);
        
        return corrected;
    }

    /**
     * Manual slant correction with specified factor
     * @param {ImageData} imageData - Original image
     * @param {number} factor - Correction factor (0.95-1.05 typical)
     * @returns {ImageData} Corrected image
     */
    function manualSlantCorrection(imageData, factor) {
        const prevFactor = slantFactor;
        slantFactor = factor;
        const corrected = correctSlant(imageData);
        slantFactor = prevFactor;
        return corrected;
    }

    /**
     * Detect slant by analyzing vertical edges in image
     * Uses Hough transform-like approach
     * @param {ImageData} imageData - Decoded image
     * @returns {number} Estimated slant factor
     */
    function detectSlantFromImage(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // Convert to grayscale and find vertical edges
        const edges = new Float32Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const idxLeft = (y * width + x - 1) * 4;
                const idxRight = (y * width + x + 1) * 4;
                
                // Simple horizontal gradient (Sobel-like)
                const grayLeft = (data[idxLeft] + data[idxLeft + 1] + data[idxLeft + 2]) / 3;
                const grayRight = (data[idxRight] + data[idxRight + 1] + data[idxRight + 2]) / 3;
                
                edges[y * width + x] = Math.abs(grayRight - grayLeft);
            }
        }

        // Find strong vertical edges and track their positions across lines
        const edgeThreshold = 30;
        const edgePositions = [];
        
        for (let y = 0; y < height; y++) {
            const lineEdges = [];
            for (let x = 10; x < width - 10; x++) {
                if (edges[y * width + x] > edgeThreshold) {
                    lineEdges.push(x);
                }
            }
            edgePositions.push(lineEdges);
        }

        // Track edge drift across lines
        const drifts = [];
        const windowSize = 20;
        
        for (let startY = 0; startY < height - windowSize; startY += windowSize) {
            const startEdges = edgePositions[startY];
            const endEdges = edgePositions[startY + windowSize];
            
            if (startEdges.length > 0 && endEdges.length > 0) {
                // Match edges between start and end
                for (const startX of startEdges) {
                    // Find closest edge in end line
                    let minDist = Infinity;
                    let matchX = startX;
                    
                    for (const endX of endEdges) {
                        const dist = Math.abs(endX - startX);
                        if (dist < minDist && dist < 20) {
                            minDist = dist;
                            matchX = endX;
                        }
                    }
                    
                    if (minDist < 20) {
                        const drift = (matchX - startX) / windowSize; // pixels per line
                        drifts.push(drift);
                    }
                }
            }
        }

        if (drifts.length < 5) {
            return 1.0; // Not enough data
        }

        // Calculate median drift
        drifts.sort((a, b) => a - b);
        const medianDrift = drifts[Math.floor(drifts.length / 2)];

        // Convert drift to slant factor
        // drift = pixels per line of horizontal shift
        // slant factor corrects this
        const detectedFactor = 1 - (medianDrift / width);

        console.log(`[SSTV-DSP] Image-based slant detection: drift=${medianDrift.toFixed(3)} px/line, ` +
                    `factor=${detectedFactor.toFixed(4)}`);

        return detectedFactor;
    }

    /**
     * Auto-correct slant by analyzing the image itself
     * @param {ImageData} imageData - Original image
     * @returns {ImageData} Corrected image
     */
    function autoCorrectSlant(imageData) {
        const detectedFactor = detectSlantFromImage(imageData);
        
        // Only correct if significant slant detected
        if (Math.abs(detectedFactor - 1.0) < 0.002) {
            console.log('[SSTV-DSP] No significant slant detected');
            return imageData;
        }

        return manualSlantCorrection(imageData, detectedFactor);
    }

    /**
     * Enable/disable automatic slant correction
     * @param {boolean} enabled
     */
    function setSlantCorrectionEnabled(enabled) {
        slantCorrectionEnabled = enabled;
        console.log(`[SSTV-DSP] Slant correction ${enabled ? 'enabled' : 'disabled'}`);
    }

    // ==========================================
    // FREQUENCY DRIFT COMPENSATION
    // ==========================================

    /**
     * Reset frequency drift analysis
     */
    function resetDriftAnalysis() {
        driftCompensation = 0;
        driftHistory = [];
        driftConfidence = 0;
        lastSyncFrequency = DRIFT_CONFIG.referenceFreq;
        syncMeasurements = [];
        console.log('[SSTV-DSP] Drift analysis reset');
    }

    /**
     * Record a sync pulse frequency measurement
     * Called during decoding when a sync pulse is detected
     * @param {number} measuredFreq - Measured sync frequency in Hz
     */
    function recordSyncFrequency(measuredFreq) {
        if (!driftCorrectionEnabled) return;
        
        // Validate measurement is in reasonable range
        const expectedSync = DRIFT_CONFIG.referenceFreq;
        const maxDrift = DRIFT_CONFIG.maxDriftHz;
        
        if (Math.abs(measuredFreq - expectedSync) > maxDrift * 2) {
            // Measurement too far off, likely noise
            return;
        }
        
        // Add to measurements
        syncMeasurements.push({
            frequency: measuredFreq,
            timestamp: performance.now()
        });
        
        // Keep only recent measurements
        const maxAge = 5000; // 5 seconds
        const now = performance.now();
        syncMeasurements = syncMeasurements.filter(m => now - m.timestamp < maxAge);
        
        // Update drift estimate if we have enough measurements
        if (syncMeasurements.length >= 5) {
            updateDriftEstimate();
        }
    }

    /**
     * Update the drift estimate based on sync measurements
     */
    function updateDriftEstimate() {
        if (syncMeasurements.length < 3) return;
        
        // Calculate median of recent measurements
        const frequencies = syncMeasurements.map(m => m.frequency).sort((a, b) => a - b);
        const medianFreq = frequencies[Math.floor(frequencies.length / 2)];
        
        // Calculate the drift from expected sync frequency
        const measuredDrift = medianFreq - DRIFT_CONFIG.referenceFreq;
        
        // Calculate confidence based on measurement consistency
        const variance = frequencies.reduce((sum, f) => sum + Math.pow(f - medianFreq, 2), 0) / frequencies.length;
        const stdDev = Math.sqrt(variance);
        const newConfidence = Math.max(0, 1 - (stdDev / 20)); // Higher confidence with lower variance
        
        // Apply low-pass filter to drift estimate
        const alpha = DRIFT_CONFIG.smoothingFactor;
        driftCompensation = driftCompensation * (1 - alpha) + measuredDrift * alpha;
        
        // Update confidence (also smoothed)
        driftConfidence = driftConfidence * (1 - alpha) + newConfidence * alpha;
        
        // Clamp drift to max range
        driftCompensation = Math.max(-DRIFT_CONFIG.maxDriftHz, 
                                      Math.min(DRIFT_CONFIG.maxDriftHz, driftCompensation));
        
        // Store in history
        driftHistory.push({
            drift: driftCompensation,
            confidence: driftConfidence,
            timestamp: performance.now()
        });
        
        // Trim history
        if (driftHistory.length > DRIFT_CONFIG.historyLength) {
            driftHistory.shift();
        }
        
        lastSyncFrequency = medianFreq;
        
        // Emit event for UI update
        if (typeof Events !== 'undefined') {
            Events.emit('sstv:driftAnalysis', {
                driftHz: driftCompensation,
                confidence: driftConfidence,
                measuredSyncFreq: medianFreq,
                expectedSyncFreq: DRIFT_CONFIG.referenceFreq,
                measurementCount: syncMeasurements.length
            });
        }
        
        if (Math.abs(driftCompensation) > 5) {
            console.log(`[SSTV-DSP] Frequency drift: ${driftCompensation.toFixed(1)} Hz ` +
                        `(confidence: ${(driftConfidence * 100).toFixed(0)}%)`);
        }
    }

    /**
     * Get current frequency drift compensation value
     * @returns {number} Drift compensation in Hz
     */
    function getFrequencyDriftCompensation() {
        if (!driftCorrectionEnabled || driftConfidence < DRIFT_CONFIG.minConfidence) {
            return 0;
        }
        return driftCompensation;
    }

    /**
     * Get drift analysis status
     * @returns {Object} Drift analysis state
     */
    function getDriftAnalysisStatus() {
        return {
            enabled: driftCorrectionEnabled,
            driftHz: driftCompensation,
            confidence: driftConfidence,
            lastSyncFreq: lastSyncFrequency,
            expectedSyncFreq: DRIFT_CONFIG.referenceFreq,
            measurementCount: syncMeasurements.length,
            history: driftHistory.slice(-10) // Last 10 measurements
        };
    }

    /**
     * Enable/disable frequency drift correction
     * @param {boolean} enabled
     */
    function setDriftCorrectionEnabled(enabled) {
        driftCorrectionEnabled = enabled;
        if (!enabled) {
            resetDriftAnalysis();
        }
        console.log(`[SSTV-DSP] Drift correction ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Manually set drift compensation (for testing or manual adjustment)
     * @param {number} driftHz - Drift in Hz
     */
    function setManualDriftCompensation(driftHz) {
        driftCompensation = Math.max(-DRIFT_CONFIG.maxDriftHz,
                                     Math.min(DRIFT_CONFIG.maxDriftHz, driftHz));
        driftConfidence = 1.0; // Manual setting = full confidence
        console.log(`[SSTV-DSP] Manual drift set: ${driftCompensation.toFixed(1)} Hz`);
    }

    /**
     * Measure sync frequency from audio samples
     * Uses peak detection around 1200 Hz
     * @param {Float32Array} samples - Audio samples
     * @param {number} sampleRate - Sample rate
     * @returns {number|null} Measured frequency or null if not found
     */
    function measureSyncFrequency(samples, sampleRate) {
        if (!samples || samples.length < 256) return null;
        
        // Use Goertzel algorithm to find peak around sync frequency
        const searchRange = { min: 1150, max: 1250, step: 2 };
        let maxPower = 0;
        let peakFreq = DRIFT_CONFIG.referenceFreq;
        
        for (let freq = searchRange.min; freq <= searchRange.max; freq += searchRange.step) {
            const power = goertzelPower(samples, freq, sampleRate);
            if (power > maxPower) {
                maxPower = power;
                peakFreq = freq;
            }
        }
        
        // Refine with smaller steps
        for (let freq = peakFreq - 5; freq <= peakFreq + 5; freq += 0.5) {
            const power = goertzelPower(samples, freq, sampleRate);
            if (power > maxPower) {
                maxPower = power;
                peakFreq = freq;
            }
        }
        
        // Check if signal is strong enough
        const noiseLevel = goertzelPower(samples, 1800, sampleRate); // Reference noise
        if (maxPower < noiseLevel * 3) {
            return null; // Signal too weak
        }
        
        return peakFreq;
    }

    /**
     * Goertzel algorithm for single-frequency power detection
     */
    function goertzelPower(samples, targetFreq, sampleRate) {
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
        
        return s1 * s1 + s2 * s2 - coeff * s1 * s2;
    }

    // ==========================================
    // SIGNAL ANALYSIS
    // ==========================================

    /**
     * Analyze audio quality and provide tuning guidance
     */
    function analyzeSignalQuality() {
        if (!analyserNode || !fftFrequencyData) {
            return null;
        }

        analyserNode.getByteFrequencyData(fftFrequencyData);
        
        const binWidth = audioContext.sampleRate / analyserNode.fftSize;
        
        // Check for SSTV signal characteristics
        const syncBin = Math.floor(1200 / binWidth);
        const blackBin = Math.floor(1500 / binWidth);
        const whiteBin = Math.floor(2300 / binWidth);
        const visBin = Math.floor(1900 / binWidth);
        
        const syncLevel = fftFrequencyData[syncBin] / 255;
        const blackLevel = fftFrequencyData[blackBin] / 255;
        const whiteLevel = fftFrequencyData[whiteBin] / 255;
        const visLevel = fftFrequencyData[visBin] / 255;

        // Calculate overall signal level in SSTV range
        const startBin = Math.floor(FREQ_MIN / binWidth);
        const endBin = Math.ceil(FREQ_MAX / binWidth);
        let totalLevel = 0;
        let peakLevel = 0;
        
        for (let i = startBin; i < endBin && i < fftFrequencyData.length; i++) {
            const level = fftFrequencyData[i] / 255;
            totalLevel += level;
            if (level > peakLevel) peakLevel = level;
        }
        
        const avgLevel = totalLevel / (endBin - startBin);

        // Determine signal status
        let status = 'none';
        let guidance = '';

        if (peakLevel < 0.1) {
            status = 'none';
            guidance = 'No signal detected. Check audio connection and radio volume.';
        } else if (peakLevel > 0.95) {
            status = 'overload';
            guidance = 'Signal too strong! Reduce radio volume to prevent distortion.';
        } else if (avgLevel < 0.15) {
            status = 'weak';
            guidance = 'Weak signal. Try increasing radio volume.';
        } else if (syncLevel > 0.3 || visLevel > 0.3) {
            status = 'sstv';
            guidance = 'SSTV signal detected!';
        } else if (peakLevel > 0.3) {
            status = 'signal';
            guidance = 'Audio signal present. Tune to SSTV frequency.';
        } else {
            status = 'noise';
            guidance = 'Noise only. Check frequency and antenna.';
        }

        return {
            status,
            guidance,
            levels: {
                peak: peakLevel,
                average: avgLevel,
                sync: syncLevel,
                black: blackLevel,
                white: whiteLevel,
                vis: visLevel
            }
        };
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        if (initialized) {
            console.debug('[SSTV-DSP] Already initialized');
            return;
        }

        // Listen for SSTV mode detection to set expected timing
        if (typeof Events !== 'undefined') {
            Events.on('sstv:modeDetected', (data) => {
                if (data.mode) {
                    setExpectedLineTime(data.mode);
                    resetSlantAnalysis();
                }
            });
        }

        initialized = true;
        console.log('[SSTV-DSP] Module initialized');
    }

    /**
     * Cleanup resources
     */
    function cleanup() {
        stopWaterfall();
        
        if (analyserNode) {
            analyserNode.disconnect();
            analyserNode = null;
        }
        
        waterfallCanvas = null;
        waterfallCtx = null;
        waterfallImageData = null;
        fftFrequencyData = null;
        
        resetSlantAnalysis();
        resetDriftAnalysis();
        initialized = false;
        
        console.log('[SSTV-DSP] Cleanup complete');
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        cleanup,

        // Waterfall display
        initWaterfall,
        startWaterfall,
        stopWaterfall,
        setColormap,
        getDominantFrequency,
        isWaterfallRunning: () => waterfallRunning,

        // Slant correction
        resetSlantAnalysis,
        recordSyncPulse,
        setExpectedLineTime,
        getSlantFactor,
        correctSlant,
        manualSlantCorrection,
        autoCorrectSlant,
        detectSlantFromImage,
        setSlantCorrectionEnabled,
        isSlantCorrectionEnabled: () => slantCorrectionEnabled,

        // Signal analysis
        analyzeSignalQuality,

        // Frequency drift compensation
        resetDriftAnalysis,
        recordSyncFrequency,
        getFrequencyDriftCompensation,
        getDriftAnalysisStatus,
        setDriftCorrectionEnabled,
        setManualDriftCompensation,
        measureSyncFrequency,
        isDriftCorrectionEnabled: () => driftCorrectionEnabled,

        // Configuration
        getConfig: () => ({
            waterfall: { ...WATERFALL_CONFIG },
            slant: { ...SLANT_CONFIG },
            drift: { ...DRIFT_CONFIG }
        }),
        
        // Available colormaps
        COLORMAPS: Object.keys(COLORMAPS)
    };
})();

window.SSTVDSPModule = SSTVDSPModule;
