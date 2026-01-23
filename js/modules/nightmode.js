/**
 * GridDown Night Mode Module
 * Provides night vision (red light) and stealth (ultra-dim) modes
 * for tactical operations in low-light conditions
 */
const NightModeModule = (function() {
    'use strict';

    // Mode definitions
    const MODES = {
        normal: {
            id: 'normal',
            name: 'Normal',
            icon: '☀️',
            description: 'Standard display'
        },
        night: {
            id: 'night',
            name: 'Night Vision',
            icon: '🔴',
            description: 'Red light - preserves night vision'
        },
        stealth: {
            id: 'stealth',
            name: 'Stealth',
            icon: '👁️',
            description: 'Ultra-dim - minimal light signature'
        },
        blackout: {
            id: 'blackout',
            name: 'Blackout',
            icon: '⬛',
            description: 'Screen off - tap to wake'
        }
    };

    // Current state
    let currentMode = 'normal';
    let brightnessLevel = 100; // 0-100
    let isScreenOff = false;
    let wakeTapCount = 0;
    let wakeTapTimeout = null;
    let subscribers = [];
    
    // Track initialization
    let initialized = false;
    let keyboardHandler = null;

    /**
     * Initialize the night mode module
     */
    async function init() {
        // Prevent double initialization
        if (initialized) {
            console.debug('[NightMode] Already initialized');
            return;
        }
        
        // Load saved preferences
        await loadPreferences();
        
        // Apply current mode
        applyMode(currentMode);
        
        // Setup keyboard shortcuts
        setupKeyboardShortcuts();
        
        // Setup wake gesture for blackout mode
        setupWakeGesture();
        
        // Inject CSS if not already present
        injectStyles();
        
        // Add quick toggle to map controls
        addQuickToggle();
        
        initialized = true;
        console.log('[NightMode] Initialized, current mode:', currentMode);
    }

    /**
     * Inject night mode CSS styles
     */
    function injectStyles() {
        if (document.getElementById('nightmode-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'nightmode-styles';
        style.textContent = `
            /* ==========================================
               NIGHT VISION MODE (Red Light)
               Preserves scotopic (night) vision
               ========================================== */
            
            body.night-mode {
                --color-primary: #ff2200;
                --color-primary-dark: #cc1a00;
                --color-bg-base: #0a0000;
                --color-bg-primary: #120000;
                --color-bg-secondary: #1a0000;
                --color-bg-elevated: rgba(255,0,0,0.03);
                --color-bg-hover: rgba(255,0,0,0.08);
                --color-text-primary: #ff4444;
                --color-text-secondary: rgba(255,68,68,0.7);
                --color-text-muted: rgba(255,68,68,0.4);
                --color-border: rgba(255,0,0,0.15);
                --color-success: #ff3333;
                --color-warning: #ff4400;
                --color-error: #ff0000;
                --color-info: #ff2222;
            }
            
            body.night-mode #map-canvas {
                filter: saturate(0) sepia(1) hue-rotate(-30deg) brightness(0.6);
            }
            
            body.night-mode .sidebar__logo {
                background: linear-gradient(135deg, #ff2200, #cc1a00);
                box-shadow: 0 4px 12px rgba(255,34,0,0.4);
            }
            
            body.night-mode .btn--primary {
                background: linear-gradient(135deg, #ff2200, #cc1a00);
                box-shadow: 0 4px 12px rgba(255,34,0,0.3);
            }
            
            body.night-mode .storage-bar {
                background: linear-gradient(135deg, rgba(255,34,0,0.1), rgba(204,26,0,0.05));
                border-color: rgba(255,34,0,0.2);
            }
            
            body.night-mode .card--selected {
                background: rgba(255,34,0,0.1);
                border-color: rgba(255,34,0,0.3);
            }
            
            body.night-mode .status-card--success {
                background: rgba(255,51,51,0.1);
                border-color: rgba(255,51,51,0.2);
            }
            
            body.night-mode .status-card--success .status-card__icon,
            body.night-mode .status-card--success .status-card__title {
                color: #ff3333;
            }
            
            body.night-mode .chip--active {
                background: rgba(255,34,0,0.2);
                color: #ff2200;
            }
            
            body.night-mode .loading-screen__logo {
                background: linear-gradient(135deg, #ff2200, #cc1a00);
                box-shadow: 0 4px 12px rgba(255,34,0,0.3);
            }
            
            body.night-mode .toast {
                background: #1a0000;
                border-color: rgba(255,0,0,0.2);
            }
            
            body.night-mode .modal {
                background: linear-gradient(180deg, #1a0000, #120000);
            }
            
            body.night-mode input,
            body.night-mode textarea,
            body.night-mode select {
                background: rgba(255,0,0,0.05);
                border-color: rgba(255,0,0,0.15);
                color: #ff4444;
            }
            
            body.night-mode input::placeholder {
                color: rgba(255,68,68,0.4);
            }
            
            body.night-mode .sidebar__status-dot--online {
                background: #ff3333;
                box-shadow: 0 0 8px #ff3333;
            }
            
            body.night-mode .avatar__status--active {
                background: #ff3333;
            }
            
            /* Night mode indicator */
            body.night-mode::after {
                content: '';
                position: fixed;
                top: 10px;
                right: 10px;
                width: 8px;
                height: 8px;
                background: #ff0000;
                border-radius: 50%;
                z-index: 9999;
                animation: nightPulse 2s ease-in-out infinite;
                pointer-events: none;
            }
            
            @keyframes nightPulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
            }
            
            /* ==========================================
               STEALTH MODE (Ultra-Dim)
               Minimal light output for covert operations
               ========================================== */
            
            body.stealth-mode {
                --color-primary: #1a1a1a;
                --color-primary-dark: #111111;
                --color-bg-base: #000000;
                --color-bg-primary: #050505;
                --color-bg-secondary: #080808;
                --color-bg-elevated: rgba(255,255,255,0.01);
                --color-bg-hover: rgba(255,255,255,0.02);
                --color-text-primary: #1a1a1a;
                --color-text-secondary: rgba(26,26,26,0.7);
                --color-text-muted: rgba(26,26,26,0.4);
                --color-border: rgba(255,255,255,0.03);
                --color-success: #1a1a1a;
                --color-warning: #1a1a1a;
                --color-error: #1a1a1a;
                --color-info: #1a1a1a;
            }
            
            body.stealth-mode #map-canvas {
                filter: brightness(0.15) contrast(0.8);
            }
            
            body.stealth-mode .sidebar__logo {
                background: #111111;
                box-shadow: none;
            }
            
            body.stealth-mode .btn--primary {
                background: #111111;
                box-shadow: none;
            }
            
            body.stealth-mode * {
                text-shadow: none !important;
                box-shadow: none !important;
            }
            
            body.stealth-mode .toast,
            body.stealth-mode .modal-backdrop {
                display: none !important;
            }
            
            /* Stealth indicator - barely visible */
            body.stealth-mode::after {
                content: '';
                position: fixed;
                top: 10px;
                right: 10px;
                width: 6px;
                height: 6px;
                background: #1a1a1a;
                border-radius: 50%;
                z-index: 9999;
                pointer-events: none;
            }
            
            /* ==========================================
               BLACKOUT MODE (Screen Off)
               Complete darkness - tap pattern to wake
               ========================================== */
            
            body.blackout-mode {
                background: #000000 !important;
            }
            
            body.blackout-mode > * {
                visibility: hidden !important;
            }
            
            body.blackout-mode #blackout-overlay {
                visibility: visible !important;
            }
            
            #blackout-overlay {
                position: fixed;
                inset: 0;
                background: #000000;
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            
            #blackout-overlay.active {
                display: flex;
            }
            
            #blackout-hint {
                color: #111111;
                font-size: 12px;
                text-align: center;
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            #blackout-overlay:active #blackout-hint {
                opacity: 1;
            }
            
            /* ==========================================
               BRIGHTNESS CONTROL
               ========================================== */
            
            body[data-brightness="90"] { filter: brightness(0.9); }
            body[data-brightness="80"] { filter: brightness(0.8); }
            body[data-brightness="70"] { filter: brightness(0.7); }
            body[data-brightness="60"] { filter: brightness(0.6); }
            body[data-brightness="50"] { filter: brightness(0.5); }
            body[data-brightness="40"] { filter: brightness(0.4); }
            body[data-brightness="30"] { filter: brightness(0.3); }
            body[data-brightness="20"] { filter: brightness(0.2); }
            body[data-brightness="10"] { filter: brightness(0.1); }
            
            /* ==========================================
               NIGHT MODE QUICK TOGGLE
               ========================================== */
            
            #night-mode-toggle {
                position: fixed;
                top: 380px;
                right: 20px;
                width: 44px;
                height: 44px;
                background: rgba(15,20,25,0.9);
                border: 1px solid var(--color-border);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 60;
                backdrop-filter: blur(8px);
                transition: all 0.2s;
                font-size: 18px;
            }
            
            #night-mode-toggle:hover {
                background: rgba(15,20,25,1);
                transform: scale(1.05);
            }
            
            body.night-mode #night-mode-toggle {
                background: rgba(26,0,0,0.9);
                border-color: rgba(255,0,0,0.2);
            }
            
            body.stealth-mode #night-mode-toggle {
                background: #050505;
                border-color: rgba(255,255,255,0.03);
                font-size: 14px;
            }
            
            /* Mobile adjustments */
            @media (max-width: 768px) {
                #night-mode-toggle {
                    top: auto;
                    bottom: 140px;
                    right: 16px;
                }
                
                body.night-mode::after,
                body.stealth-mode::after {
                    top: auto;
                    bottom: 190px;
                    right: 24px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Add quick toggle button to map area
     */
    function addQuickToggle() {
        if (document.getElementById('night-mode-toggle')) return;
        
        const toggle = document.createElement('button');
        toggle.id = 'night-mode-toggle';
        toggle.title = 'Night Mode (Press N)';
        toggle.innerHTML = MODES[currentMode].icon;
        toggle.onclick = cycleMode;
        
        // Add to main area
        const main = document.getElementById('main');
        if (main) {
            main.appendChild(toggle);
        }
        
        // Add blackout overlay
        const blackout = document.createElement('div');
        blackout.id = 'blackout-overlay';
        blackout.innerHTML = '<div id="blackout-hint">Triple-tap to wake</div>';
        blackout.onclick = handleBlackoutTap;
        document.body.appendChild(blackout);
    }

    /**
     * Setup keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        // Remove previous handler if exists
        if (keyboardHandler) {
            document.removeEventListener('keydown', keyboardHandler);
        }
        
        keyboardHandler = (e) => {
            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key.toLowerCase()) {
                case 'n':
                    // N - Cycle through modes
                    cycleMode();
                    break;
                case '1':
                    if (e.altKey) setMode('normal');
                    break;
                case '2':
                    if (e.altKey) setMode('night');
                    break;
                case '3':
                    if (e.altKey) setMode('stealth');
                    break;
                case '0':
                    if (e.altKey) setMode('blackout');
                    break;
                case 'escape':
                    if (currentMode === 'blackout') {
                        setMode('normal');
                    }
                    break;
            }
            
            // Brightness control: [ and ] keys
            if (e.key === '[') {
                adjustBrightness(-10);
            } else if (e.key === ']') {
                adjustBrightness(10);
            }
        };
        
        document.addEventListener('keydown', keyboardHandler);
    }

    /**
     * Setup wake gesture for blackout mode
     */
    function setupWakeGesture() {
        // Already handled by blackout overlay onclick
    }

    /**
     * Handle tap on blackout overlay
     */
    function handleBlackoutTap() {
        wakeTapCount++;
        
        if (wakeTapTimeout) {
            clearTimeout(wakeTapTimeout);
        }
        
        wakeTapTimeout = setTimeout(() => {
            wakeTapCount = 0;
        }, 500);
        
        // Triple tap to wake
        if (wakeTapCount >= 3) {
            wakeTapCount = 0;
            setMode('night'); // Wake to night mode, not normal
            if (typeof ModalsModule !== 'undefined') {
                ModalsModule.showToast('Screen active - Night mode', 'info');
            }
        }
    }

    /**
     * Cycle through display modes
     */
    function cycleMode() {
        const modeOrder = ['normal', 'night', 'stealth', 'blackout'];
        const currentIndex = modeOrder.indexOf(currentMode);
        const nextIndex = (currentIndex + 1) % modeOrder.length;
        setMode(modeOrder[nextIndex]);
    }

    /**
     * Set display mode
     */
    function setMode(mode) {
        if (!MODES[mode]) {
            console.error('[NightMode] Invalid mode:', mode);
            return;
        }
        
        const previousMode = currentMode;
        currentMode = mode;
        
        applyMode(mode);
        savePreferences();
        notifySubscribers({ mode, previousMode });
        
        // Update toggle button
        const toggle = document.getElementById('night-mode-toggle');
        if (toggle) {
            toggle.innerHTML = MODES[mode].icon;
            toggle.title = `${MODES[mode].name} (Press N to cycle)`;
        }
        
        // Show toast (except in stealth/blackout)
        if (mode !== 'stealth' && mode !== 'blackout' && typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast(`${MODES[mode].icon} ${MODES[mode].name}`, 'info');
        }
        
        console.log('[NightMode] Mode changed:', previousMode, '->', mode);
    }

    /**
     * Apply mode to DOM
     */
    function applyMode(mode) {
        const body = document.body;
        
        // Remove all mode classes
        body.classList.remove('night-mode', 'stealth-mode', 'blackout-mode');
        
        // Apply new mode class
        switch(mode) {
            case 'night':
                body.classList.add('night-mode');
                break;
            case 'stealth':
                body.classList.add('stealth-mode');
                break;
            case 'blackout':
                body.classList.add('blackout-mode');
                break;
        }
        
        // Handle blackout overlay
        const blackout = document.getElementById('blackout-overlay');
        if (blackout) {
            blackout.classList.toggle('active', mode === 'blackout');
        }
        
        // Apply brightness
        applyBrightness();
    }

    /**
     * Adjust brightness level
     */
    function adjustBrightness(delta) {
        brightnessLevel = Math.max(10, Math.min(100, brightnessLevel + delta));
        applyBrightness();
        savePreferences();
        
        if (typeof ModalsModule !== 'undefined' && currentMode !== 'stealth' && currentMode !== 'blackout') {
            ModalsModule.showToast(`Brightness: ${brightnessLevel}%`, 'info');
        }
    }

    /**
     * Set brightness level directly
     */
    function setBrightness(level) {
        brightnessLevel = Math.max(10, Math.min(100, level));
        applyBrightness();
        savePreferences();
    }

    /**
     * Apply brightness to DOM
     */
    function applyBrightness() {
        const body = document.body;
        
        // Remove existing brightness
        body.removeAttribute('data-brightness');
        
        // Apply if not 100%
        if (brightnessLevel < 100) {
            const rounded = Math.round(brightnessLevel / 10) * 10;
            body.setAttribute('data-brightness', rounded);
        }
    }

    /**
     * Load saved preferences
     */
    async function loadPreferences() {
        try {
            if (typeof Storage !== 'undefined') {
                const saved = await Storage.Settings.get('nightMode');
                if (saved) {
                    currentMode = saved.mode || 'normal';
                    brightnessLevel = saved.brightness || 100;
                }
            }
        } catch (e) {
            console.error('[NightMode] Failed to load preferences:', e);
        }
    }

    /**
     * Save preferences
     */
    async function savePreferences() {
        try {
            if (typeof Storage !== 'undefined') {
                await Storage.Settings.set('nightMode', {
                    mode: currentMode,
                    brightness: brightnessLevel
                });
            }
        } catch (e) {
            console.error('[NightMode] Failed to save preferences:', e);
        }
    }

    /**
     * Subscribe to mode changes
     */
    function subscribe(callback) {
        subscribers.push(callback);
        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) subscribers.splice(index, 1);
        };
    }

    /**
     * Notify subscribers of changes
     */
    function notifySubscribers(data) {
        subscribers.forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error('[NightMode] Subscriber error:', e);
            }
        });
    }

    /**
     * Get current state
     */
    function getState() {
        return {
            mode: currentMode,
            modeName: MODES[currentMode].name,
            modeIcon: MODES[currentMode].icon,
            brightness: brightnessLevel,
            isNightMode: currentMode === 'night',
            isStealthMode: currentMode === 'stealth',
            isBlackoutMode: currentMode === 'blackout'
        };
    }

    /**
     * Get all available modes
     */
    function getModes() {
        return { ...MODES };
    }

    /**
     * Quick toggle between normal and night mode
     */
    function toggleNightMode() {
        setMode(currentMode === 'night' ? 'normal' : 'night');
    }

    /**
     * Render settings panel content
     */
    function renderSettingsPanel() {
        const state = getState();
        
        return `
            <div class="section-label">Display Mode</div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">
                ${Object.entries(MODES).map(([key, mode]) => `
                    <button class="btn ${state.mode === key ? 'btn--primary' : 'btn--secondary'}" 
                            data-night-mode="${key}"
                            style="flex-direction:column;padding:16px;gap:4px">
                        <span style="font-size:24px">${mode.icon}</span>
                        <span style="font-size:12px">${mode.name}</span>
                    </button>
                `).join('')}
            </div>
            
            <div class="section-label">Brightness (${state.brightness}%)</div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
                <button class="btn btn--secondary" data-brightness-adjust="-10" style="padding:8px 12px">−</button>
                <input type="range" id="brightness-slider" min="10" max="100" step="10" value="${state.brightness}"
                    style="flex:1;accent-color:var(--color-primary)">
                <button class="btn btn--secondary" data-brightness-adjust="10" style="padding:8px 12px">+</button>
            </div>
            
            <div style="padding:12px;background:var(--color-bg-elevated);border-radius:8px;margin-bottom:16px">
                <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px">Keyboard Shortcuts</div>
                <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:11px">
                    <kbd style="background:var(--color-bg-hover);padding:2px 6px;border-radius:4px">N</kbd>
                    <span>Cycle modes</span>
                    <kbd style="background:var(--color-bg-hover);padding:2px 6px;border-radius:4px">[</kbd>
                    <span>Decrease brightness</span>
                    <kbd style="background:var(--color-bg-hover);padding:2px 6px;border-radius:4px">]</kbd>
                    <span>Increase brightness</span>
                    <kbd style="background:var(--color-bg-hover);padding:2px 6px;border-radius:4px">Alt+1-3</kbd>
                    <span>Quick mode select</span>
                </div>
            </div>
            
            <div style="padding:12px;background:rgba(255,34,0,0.1);border:1px solid rgba(255,34,0,0.2);border-radius:8px">
                <div style="font-size:13px;font-weight:500;color:#ff4444;margin-bottom:4px">🔴 Night Vision Tips</div>
                <div style="font-size:11px;color:var(--color-text-muted);line-height:1.5">
                    Red light preserves scotopic (rod) vision. Allow 20-30 minutes in darkness for full adaptation.
                    Even brief exposure to white light resets adaptation.
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to rendered settings panel
     */
    function attachSettingsListeners(container) {
        // Mode buttons
        container.querySelectorAll('[data-night-mode]').forEach(btn => {
            btn.onclick = () => setMode(btn.dataset.nightMode);
        });
        
        // Brightness slider
        const slider = container.querySelector('#brightness-slider');
        if (slider) {
            slider.oninput = (e) => setBrightness(parseInt(e.target.value));
        }
        
        // Brightness adjust buttons
        container.querySelectorAll('[data-brightness-adjust]').forEach(btn => {
            btn.onclick = () => adjustBrightness(parseInt(btn.dataset.brightnessAdjust));
        });
    }

    // Public API
    return {
        init,
        setMode,
        getState,
        getModes,
        cycleMode,
        toggleNightMode,
        setBrightness,
        adjustBrightness,
        subscribe,
        renderSettingsPanel,
        attachSettingsListeners,
        MODES
    };
})();

window.NightModeModule = NightModeModule;
