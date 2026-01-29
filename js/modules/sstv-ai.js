/**
 * GridDown SSTV AI Enhancement Module
 * Provides upscaling, denoising, and OCR for SSTV images
 * 
 * Models are NOT bundled - users download them separately to keep GridDown lightweight.
 * Models are cached in IndexedDB for offline use.
 * 
 * Supported Models:
 * - Real-CUGAN 2× (~2MB) - Fast 2× upscaling
 * - Real-CUGAN 4× (~17MB) - High quality 4× upscaling  
 * - Tesseract.js - OCR for callsign/coordinate extraction (loaded from CDN)
 * 
 * License: MIT (BlackDot Technology)
 */
const SSTVEnhanceModule = (function() {
    'use strict';

    // ==========================================
    // CONSTANTS & CONFIGURATION
    // ==========================================

    const DB_NAME = 'griddown-sstv-enhance';
    const DB_VERSION = 1;
    const MODELS_STORE = 'models';
    const SETTINGS_STORE = 'settings';

    // Model definitions with download URLs
    // Users download these manually - not bundled with GridDown
    const MODEL_REGISTRY = {
        'realcugan-2x': {
            name: 'Real-CUGAN 2×',
            description: 'Fast 2× upscaling with noise reduction',
            size: '2.1 MB',
            sizeBytes: 2200000,
            scale: 2,
            // Primary source - Real-CUGAN ncnn models converted to ONNX
            downloadUrl: 'https://github.com/AaronFeng753/Waifu2x-Extension-GUI/releases/download/v3.113.01/models-cugan-ncnn-vulkan.zip',
            // Alternative sources
            alternativeUrls: [
                'https://github.com/bilibili/ailab/tree/main/Real-CUGAN',
                'https://github.com/xinntao/Real-ESRGAN'
            ],
            // Manual download instructions
            instructions: `
1. Download from: https://github.com/nihui/realcugan-ncnn-vulkan/releases
2. Extract the 'models-se' folder
3. Upload 'up2x-latest-denoise3x.param' and 'up2x-latest-denoise3x.bin' files
4. Or use the direct ONNX model from the link above`,
            format: 'onnx',
            inputShape: [1, 3, -1, -1], // Dynamic height/width
            outputScale: 2
        },
        'realcugan-4x': {
            name: 'Real-CUGAN 4×',
            description: 'High quality 4× upscaling',
            size: '17 MB',
            sizeBytes: 17800000,
            scale: 4,
            downloadUrl: 'https://github.com/AaronFeng753/Waifu2x-Extension-GUI/releases/download/v3.113.01/models-cugan-ncnn-vulkan.zip',
            alternativeUrls: [
                'https://github.com/bilibili/ailab/tree/main/Real-CUGAN'
            ],
            instructions: `
1. Download from: https://github.com/nihui/realcugan-ncnn-vulkan/releases
2. Extract the 'models-se' folder  
3. Upload 'up4x-latest-denoise3x.param' and 'up4x-latest-denoise3x.bin' files`,
            format: 'onnx',
            inputShape: [1, 3, -1, -1],
            outputScale: 4
        }
    };

    // Tesseract.js CDN - loaded on demand, not cached locally
    const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    const TESSERACT_WORKER_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js';
    const TESSERACT_CORE_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5';

    // ==========================================
    // STATE
    // ==========================================

    let initialized = false;
    let db = null;
    let processing = false;
    let currentOperation = null;
    
    // Loaded models (in memory during session)
    const loadedModels = new Map();
    
    // Tesseract worker
    let tesseractWorker = null;
    let tesseractLoaded = false;

    // Settings
    let settings = {
        preferWebGPU: true,
        tileSize: 256, // Process in tiles to manage memory
        denoiseSigma: 25 // Default denoise strength
    };

    // ==========================================
    // DATABASE
    // ==========================================

    async function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                
                // Store for cached models
                if (!database.objectStoreNames.contains(MODELS_STORE)) {
                    database.createObjectStore(MODELS_STORE, { keyPath: 'id' });
                }
                
                // Store for settings
                if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                    database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
                }
            };
        });
    }

    async function saveModelToCache(modelId, modelData) {
        if (!db) await openDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(MODELS_STORE, 'readwrite');
            const store = tx.objectStore(MODELS_STORE);
            
            store.put({
                id: modelId,
                data: modelData,
                cachedAt: new Date().toISOString(),
                size: modelData.byteLength || modelData.length
            });
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getModelFromCache(modelId) {
        if (!db) await openDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(MODELS_STORE, 'readonly');
            const store = tx.objectStore(MODELS_STORE);
            const request = store.get(modelId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function deleteModelFromCache(modelId) {
        if (!db) await openDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(MODELS_STORE, 'readwrite');
            const store = tx.objectStore(MODELS_STORE);
            store.delete(modelId);
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getCachedModels() {
        if (!db) await openDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(MODELS_STORE, 'readonly');
            const store = tx.objectStore(MODELS_STORE);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const models = request.result.map(m => ({
                    id: m.id,
                    name: MODEL_REGISTRY[m.id]?.name || m.id,
                    size: m.size,
                    cachedAt: m.cachedAt
                }));
                resolve(models);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async function clearModelCache() {
        if (!db) await openDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(MODELS_STORE, 'readwrite');
            const store = tx.objectStore(MODELS_STORE);
            store.clear();
            
            tx.oncomplete = () => {
                loadedModels.clear();
                resolve(true);
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    // ==========================================
    // EVENT EMITTER
    // ==========================================

    function emitProgress(phase, progress, message) {
        if (typeof Events !== 'undefined') {
            Events.emit('sstvEnhance:progress', { phase, progress, message });
        }
        
        // Also log for debugging
        console.debug(`[SSTVEnhance] ${phase}: ${message} (${Math.round(progress * 100)}%)`);
    }

    // ==========================================
    // MODEL MANAGEMENT
    // ==========================================

    /**
     * Get list of available models with their status
     */
    async function getAvailableModels() {
        const cached = await getCachedModels();
        const cachedIds = new Set(cached.map(m => m.id));
        
        const models = [];
        for (const [id, info] of Object.entries(MODEL_REGISTRY)) {
            models.push({
                id,
                ...info,
                cached: cachedIds.has(id),
                cachedAt: cached.find(m => m.id === id)?.cachedAt
            });
        }
        
        return models;
    }

    /**
     * Get download instructions for a model
     */
    function getModelDownloadInfo(modelId) {
        const model = MODEL_REGISTRY[modelId];
        if (!model) return null;
        
        return {
            name: model.name,
            size: model.size,
            downloadUrl: model.downloadUrl,
            alternativeUrls: model.alternativeUrls,
            instructions: model.instructions
        };
    }

    /**
     * Import a model from user-uploaded file
     */
    async function importModel(modelId, file) {
        const model = MODEL_REGISTRY[modelId];
        if (!model) {
            throw new Error(`Unknown model: ${modelId}`);
        }
        
        emitProgress('import', 0, `Reading ${model.name}...`);
        
        // Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        
        emitProgress('import', 0.5, 'Validating model...');
        
        // Basic validation - check file size is reasonable
        if (buffer.byteLength < 100000) { // Less than 100KB is too small
            throw new Error('File too small - invalid model file');
        }
        
        if (buffer.byteLength > 100000000) { // More than 100MB is too large
            throw new Error('File too large - invalid model file');
        }
        
        emitProgress('import', 0.8, 'Caching model...');
        
        // Save to IndexedDB
        await saveModelToCache(modelId, buffer);
        
        emitProgress('import', 1, 'Model imported successfully');
        
        return true;
    }

    /**
     * Check if ONNX Runtime is available
     */
    function checkONNXRuntime() {
        return typeof ort !== 'undefined';
    }

    /**
     * Load ONNX Runtime from CDN if not available
     */
    async function loadONNXRuntime() {
        if (checkONNXRuntime()) return true;
        
        emitProgress('loading', 0.1, 'Loading ONNX Runtime...');
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js';
            script.onload = () => {
                emitProgress('loading', 0.3, 'ONNX Runtime loaded');
                resolve(true);
            };
            script.onerror = () => reject(new Error('Failed to load ONNX Runtime'));
            document.head.appendChild(script);
        });
    }

    /**
     * Load a model for inference
     */
    async function loadModel(modelId) {
        // Check if already loaded in memory
        if (loadedModels.has(modelId)) {
            return loadedModels.get(modelId);
        }
        
        // Check if cached
        const cached = await getModelFromCache(modelId);
        if (!cached) {
            throw new Error(`Model ${modelId} not cached. Please download and import it first.`);
        }
        
        // Ensure ONNX Runtime is loaded
        await loadONNXRuntime();
        
        emitProgress('loading', 0.4, `Loading ${MODEL_REGISTRY[modelId]?.name || modelId}...`);
        
        try {
            // Create ONNX session
            const sessionOptions = {
                executionProviders: settings.preferWebGPU ? 
                    ['webgpu', 'wasm'] : ['wasm']
            };
            
            const session = await ort.InferenceSession.create(
                cached.data,
                sessionOptions
            );
            
            loadedModels.set(modelId, session);
            emitProgress('loading', 0.5, 'Model loaded');
            
            return session;
        } catch (err) {
            console.error('[SSTVEnhance] Failed to load model:', err);
            throw new Error(`Failed to load model: ${err.message}`);
        }
    }

    // ==========================================
    // IMAGE PROCESSING
    // ==========================================

    /**
     * Convert ImageData to tensor format for ONNX
     */
    function imageDataToTensor(imageData) {
        const { width, height, data } = imageData;
        const float32Data = new Float32Array(3 * width * height);
        
        // Convert RGBA to RGB and normalize to 0-1
        for (let i = 0; i < width * height; i++) {
            float32Data[i] = data[i * 4] / 255.0;                    // R
            float32Data[width * height + i] = data[i * 4 + 1] / 255.0; // G
            float32Data[2 * width * height + i] = data[i * 4 + 2] / 255.0; // B
        }
        
        return new ort.Tensor('float32', float32Data, [1, 3, height, width]);
    }

    /**
     * Convert tensor output back to ImageData
     */
    function tensorToImageData(tensor, width, height) {
        const data = tensor.data;
        const imageData = new ImageData(width, height);
        
        for (let i = 0; i < width * height; i++) {
            imageData.data[i * 4] = Math.max(0, Math.min(255, data[i] * 255));                         // R
            imageData.data[i * 4 + 1] = Math.max(0, Math.min(255, data[width * height + i] * 255));    // G
            imageData.data[i * 4 + 2] = Math.max(0, Math.min(255, data[2 * width * height + i] * 255)); // B
            imageData.data[i * 4 + 3] = 255;                                                           // A
        }
        
        return imageData;
    }

    /**
     * Simple denoise using box blur with edge preservation
     * No external model needed
     */
    function denoiseImage(imageData, strength = 0.3) {
        const { width, height, data } = imageData;
        const result = new ImageData(width, height);
        const resultData = result.data;
        
        // Copy original
        resultData.set(data);
        
        if (strength <= 0) return result;
        
        // Kernel size based on strength (1-5)
        const kernelRadius = Math.max(1, Math.min(5, Math.round(strength * 5)));
        const kernelSize = kernelRadius * 2 + 1;
        const kernelArea = kernelSize * kernelSize;
        
        // Edge-preserving denoise (bilateral-like filter)
        const sigmaColor = 30; // Color similarity threshold
        
        for (let y = kernelRadius; y < height - kernelRadius; y++) {
            for (let x = kernelRadius; x < width - kernelRadius; x++) {
                const idx = (y * width + x) * 4;
                const centerR = data[idx];
                const centerG = data[idx + 1];
                const centerB = data[idx + 2];
                
                let sumR = 0, sumG = 0, sumB = 0, weightSum = 0;
                
                for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
                    for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
                        const nIdx = ((y + ky) * width + (x + kx)) * 4;
                        const nR = data[nIdx];
                        const nG = data[nIdx + 1];
                        const nB = data[nIdx + 2];
                        
                        // Color distance
                        const colorDist = Math.sqrt(
                            (nR - centerR) ** 2 +
                            (nG - centerG) ** 2 +
                            (nB - centerB) ** 2
                        );
                        
                        // Weight based on color similarity
                        const weight = Math.exp(-(colorDist ** 2) / (2 * sigmaColor ** 2));
                        
                        sumR += nR * weight;
                        sumG += nG * weight;
                        sumB += nB * weight;
                        weightSum += weight;
                    }
                }
                
                // Blend based on strength
                const blendFactor = strength;
                resultData[idx] = Math.round(centerR * (1 - blendFactor) + (sumR / weightSum) * blendFactor);
                resultData[idx + 1] = Math.round(centerG * (1 - blendFactor) + (sumG / weightSum) * blendFactor);
                resultData[idx + 2] = Math.round(centerB * (1 - blendFactor) + (sumB / weightSum) * blendFactor);
            }
        }
        
        return result;
    }

    /**
     * Simple bilinear upscale (fallback when no model available)
     */
    function bilinearUpscale(imageData, scale) {
        const { width, height, data } = imageData;
        const newWidth = width * scale;
        const newHeight = height * scale;
        const result = new ImageData(newWidth, newHeight);
        
        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                const srcX = x / scale;
                const srcY = y / scale;
                
                const x0 = Math.floor(srcX);
                const y0 = Math.floor(srcY);
                const x1 = Math.min(x0 + 1, width - 1);
                const y1 = Math.min(y0 + 1, height - 1);
                
                const xFrac = srcX - x0;
                const yFrac = srcY - y0;
                
                const idx00 = (y0 * width + x0) * 4;
                const idx01 = (y0 * width + x1) * 4;
                const idx10 = (y1 * width + x0) * 4;
                const idx11 = (y1 * width + x1) * 4;
                
                const dstIdx = (y * newWidth + x) * 4;
                
                for (let c = 0; c < 4; c++) {
                    const top = data[idx00 + c] * (1 - xFrac) + data[idx01 + c] * xFrac;
                    const bottom = data[idx10 + c] * (1 - xFrac) + data[idx11 + c] * xFrac;
                    result.data[dstIdx + c] = Math.round(top * (1 - yFrac) + bottom * yFrac);
                }
            }
        }
        
        return result;
    }

    /**
     * AI upscale using loaded model
     */
    async function aiUpscale(imageData, modelId) {
        const model = MODEL_REGISTRY[modelId];
        if (!model) {
            throw new Error(`Unknown model: ${modelId}`);
        }
        
        // Check if model is cached
        const cached = await getModelFromCache(modelId);
        if (!cached) {
            // Fall back to bilinear upscale
            console.warn(`[SSTVEnhance] Model ${modelId} not available, using bilinear upscale`);
            emitProgress('upscale', 0.5, 'Model not available - using basic upscale');
            return bilinearUpscale(imageData, model.scale);
        }
        
        // Load and run model
        const session = await loadModel(modelId);
        
        emitProgress('upscale', 0.6, 'Running AI upscale...');
        
        const { width, height } = imageData;
        const scale = model.scale;
        
        // For large images, process in tiles
        if (width > settings.tileSize || height > settings.tileSize) {
            return await upscaleWithTiles(imageData, session, scale, settings.tileSize);
        }
        
        // Process whole image
        const inputTensor = imageDataToTensor(imageData);
        
        const feeds = {};
        feeds[session.inputNames[0]] = inputTensor;
        
        const results = await session.run(feeds);
        const outputTensor = results[session.outputNames[0]];
        
        const resultImageData = tensorToImageData(
            outputTensor,
            width * scale,
            height * scale
        );
        
        emitProgress('upscale', 1, 'Upscale complete');
        
        return resultImageData;
    }

    /**
     * Tile-based processing for large images
     */
    async function upscaleWithTiles(imageData, session, scale, tileSize) {
        const { width, height } = imageData;
        const overlap = 16; // Overlap tiles to avoid seams
        
        const numTilesX = Math.ceil(width / (tileSize - overlap));
        const numTilesY = Math.ceil(height / (tileSize - overlap));
        const totalTiles = numTilesX * numTilesY;
        
        // Create output canvas
        const outputWidth = width * scale;
        const outputHeight = height * scale;
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const ctx = outputCanvas.getContext('2d');
        
        // Create input canvas for extracting tiles
        const inputCanvas = document.createElement('canvas');
        inputCanvas.width = width;
        inputCanvas.height = height;
        const inputCtx = inputCanvas.getContext('2d');
        inputCtx.putImageData(imageData, 0, 0);
        
        let tileCount = 0;
        
        for (let ty = 0; ty < numTilesY; ty++) {
            for (let tx = 0; tx < numTilesX; tx++) {
                const srcX = tx * (tileSize - overlap);
                const srcY = ty * (tileSize - overlap);
                const tileW = Math.min(tileSize, width - srcX);
                const tileH = Math.min(tileSize, height - srcY);
                
                // Extract tile
                const tileData = inputCtx.getImageData(srcX, srcY, tileW, tileH);
                
                // Process tile
                const inputTensor = imageDataToTensor(tileData);
                const feeds = {};
                feeds[session.inputNames[0]] = inputTensor;
                
                const results = await session.run(feeds);
                const outputTensor = results[session.outputNames[0]];
                
                const tileDstW = tileW * scale;
                const tileDstH = tileH * scale;
                const tileResult = tensorToImageData(outputTensor, tileDstW, tileDstH);
                
                // Draw tile to output (with overlap blending would be better but simplified here)
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = tileDstW;
                tempCanvas.height = tileDstH;
                tempCanvas.getContext('2d').putImageData(tileResult, 0, 0);
                
                ctx.drawImage(tempCanvas, srcX * scale, srcY * scale);
                
                tileCount++;
                emitProgress('upscale', 0.6 + (tileCount / totalTiles) * 0.4,
                    `Processing tile ${tileCount}/${totalTiles}`);
            }
        }
        
        return ctx.getImageData(0, 0, outputWidth, outputHeight);
    }

    // ==========================================
    // OCR (TESSERACT.JS)
    // ==========================================

    /**
     * Load Tesseract.js from CDN
     */
    async function loadTesseract() {
        if (tesseractLoaded && tesseractWorker) return tesseractWorker;
        
        emitProgress('ocr', 0.1, 'Loading OCR engine...');
        
        // Load Tesseract.js script if not present
        if (typeof Tesseract === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = TESSERACT_CDN;
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
                document.head.appendChild(script);
            });
        }
        
        emitProgress('ocr', 0.3, 'Initializing OCR worker...');
        
        // Create worker
        tesseractWorker = await Tesseract.createWorker('eng', 1, {
            workerPath: TESSERACT_WORKER_CDN,
            corePath: TESSERACT_CORE_CDN,
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    emitProgress('ocr', 0.3 + m.progress * 0.6, `OCR: ${Math.round(m.progress * 100)}%`);
                }
            }
        });
        
        tesseractLoaded = true;
        emitProgress('ocr', 0.5, 'OCR ready');
        
        return tesseractWorker;
    }

    /**
     * Run OCR on image
     */
    async function runOCR(imageData) {
        const worker = await loadTesseract();
        
        // Convert ImageData to canvas data URL
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        canvas.getContext('2d').putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        
        emitProgress('ocr', 0.5, 'Running OCR...');
        
        const { data } = await worker.recognize(dataUrl);
        
        emitProgress('ocr', 1, 'OCR complete');
        
        // Extract useful patterns
        const extracted = extractPatterns(data.text);
        
        return {
            raw: data.text,
            confidence: data.confidence,
            extracted
        };
    }

    /**
     * Extract callsigns, grid squares, coordinates from OCR text
     */
    function extractPatterns(text) {
        const results = {
            callsigns: [],
            gridSquares: [],
            coordinates: [],
            frequencies: []
        };
        
        // Callsign pattern (amateur radio): 1-2 letters + digit + 1-4 letters
        const callsignRegex = /\b[A-Z]{1,2}\d[A-Z]{1,4}\b/gi;
        const callsigns = text.match(callsignRegex);
        if (callsigns) {
            results.callsigns = [...new Set(callsigns.map(c => c.toUpperCase()))];
        }
        
        // Maidenhead grid square: 2 letters + 2 digits + optional 2 letters
        const gridRegex = /\b[A-R]{2}\d{2}([A-X]{2})?\b/gi;
        const grids = text.match(gridRegex);
        if (grids) {
            results.gridSquares = [...new Set(grids.map(g => g.toUpperCase()))];
        }
        
        // Coordinates: decimal degrees or DMS
        const coordRegex = /-?\d{1,3}\.\d+[°]?\s*[NS]?\s*[,\s]\s*-?\d{1,3}\.\d+[°]?\s*[EW]?/gi;
        const coords = text.match(coordRegex);
        if (coords) {
            results.coordinates = coords;
        }
        
        // Frequencies: MHz
        const freqRegex = /\d{1,3}\.\d{2,4}\s*(?:MHz|mhz|MHZ)/gi;
        const freqs = text.match(freqRegex);
        if (freqs) {
            results.frequencies = freqs;
        }
        
        return results;
    }

    // ==========================================
    // MAIN ENHANCEMENT FUNCTION
    // ==========================================

    /**
     * Enhance an SSTV image
     * @param {ImageData} imageData - Source image
     * @param {Object} options - Enhancement options
     * @returns {Object} Enhanced image and metadata
     */
    async function enhance(imageData, options = {}) {
        if (processing) {
            throw new Error('Enhancement already in progress');
        }
        
        processing = true;
        currentOperation = {
            startTime: Date.now(),
            options
        };
        
        const {
            upscaleMethod = 'none', // 'none', 'local-2x', 'local-4x'
            denoiseStrength = 0.3,
            runOcr = false
        } = options;
        
        try {
            let result = imageData;
            const metadata = {
                originalWidth: imageData.width,
                originalHeight: imageData.height,
                operations: []
            };
            
            // Step 1: Denoise
            if (denoiseStrength > 0) {
                emitProgress('denoise', 0.1, 'Denoising image...');
                result = denoiseImage(result, denoiseStrength);
                metadata.operations.push({ type: 'denoise', strength: denoiseStrength });
                emitProgress('denoise', 0.2, 'Denoise complete');
            }
            
            // Step 2: Upscale
            if (upscaleMethod !== 'none') {
                const modelId = upscaleMethod === 'local-2x' ? 'realcugan-2x' : 
                               upscaleMethod === 'local-4x' ? 'realcugan-4x' : null;
                
                if (modelId) {
                    emitProgress('upscale', 0.3, 'Starting upscale...');
                    result = await aiUpscale(result, modelId);
                    metadata.operations.push({ 
                        type: 'upscale', 
                        method: upscaleMethod,
                        scale: MODEL_REGISTRY[modelId]?.scale || 2
                    });
                }
            }
            
            // Step 3: OCR (optional)
            if (runOcr) {
                emitProgress('ocr', 0.8, 'Running OCR...');
                metadata.ocr = await runOCR(result);
                metadata.operations.push({ type: 'ocr' });
            }
            
            metadata.finalWidth = result.width;
            metadata.finalHeight = result.height;
            metadata.processingTime = Date.now() - currentOperation.startTime;
            
            emitProgress('complete', 1, 'Enhancement complete');
            
            return {
                imageData: result,
                metadata
            };
            
        } catch (err) {
            emitProgress('error', 0, `Error: ${err.message}`);
            throw err;
            
        } finally {
            processing = false;
            currentOperation = null;
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {
        if (initialized) {
            console.debug('[SSTVEnhance] Already initialized');
            return;
        }
        
        try {
            await openDatabase();
            
            // Check WebGPU availability
            if (navigator.gpu) {
                settings.preferWebGPU = true;
                console.log('[SSTVEnhance] WebGPU available');
            } else {
                settings.preferWebGPU = false;
                console.log('[SSTVEnhance] WebGPU not available, using WASM');
            }
            
            initialized = true;
            console.log('[SSTVEnhance] Module initialized');
            
        } catch (err) {
            console.error('[SSTVEnhance] Initialization failed:', err);
            throw err;
        }
    }

    /**
     * Cleanup resources
     */
    async function cleanup() {
        // Terminate Tesseract worker
        if (tesseractWorker) {
            await tesseractWorker.terminate();
            tesseractWorker = null;
            tesseractLoaded = false;
        }
        
        // Clear loaded models from memory
        loadedModels.clear();
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        cleanup,
        
        // Enhancement
        enhance,
        isProcessing: () => processing,
        getCurrentOperation: () => currentOperation ? { ...currentOperation } : null,
        
        // Model management
        getAvailableModels,
        getModelDownloadInfo,
        importModel,
        getCachedModels,
        clearModelCache,
        deleteModel: deleteModelFromCache,
        
        // Individual operations (for advanced use)
        denoiseImage,
        bilinearUpscale,
        runOCR,
        
        // Configuration
        getSettings: () => ({ ...settings }),
        updateSettings: (newSettings) => {
            settings = { ...settings, ...newSettings };
        },
        
        // Constants
        MODEL_REGISTRY
    };
})();

window.SSTVEnhanceModule = SSTVEnhanceModule;
