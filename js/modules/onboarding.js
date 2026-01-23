/**
 * GridDown Onboarding Module - First-Run Guided Tour
 * Provides a step-by-step introduction to key features for new users
 */
const OnboardingModule = (function() {
    'use strict';

    // Storage key for tracking completion
    const STORAGE_KEY = 'griddown_onboarding_complete';
    const VERSION_KEY = 'griddown_onboarding_version';
    const CURRENT_VERSION = 1; // Increment to re-show onboarding after major updates

    // Tour steps configuration
    const TOUR_STEPS = [
        {
            id: 'welcome',
            title: 'Welcome to GridDown',
            content: `GridDown is a professional-grade offline navigation and planning tool designed for environments where connectivity can't be assumed.
            
This quick tour will show you the key features. You can skip anytime or restart from Settings.`,
            target: null, // No specific target - centered modal
            position: 'center',
            icon: '🧭'
        },
        {
            id: 'map',
            title: 'Interactive Map',
            content: `Pan and zoom to explore. The map uses OpenStreetMap tiles that can be downloaded for offline use.

<b>Controls:</b>
• Scroll to zoom, drag to pan
• Click anywhere to add a waypoint
• Use +/- buttons or pinch to zoom`,
            target: '#map-canvas',
            position: 'right',
            icon: '🗺️',
            action: () => State.UI.setActivePanel('map')
        },
        {
            id: 'offline',
            title: 'Offline Map Downloads',
            content: `Download entire map regions before you go. GridDown supports 15+ map sources including USGS Topo, USFS trails, and satellite imagery.

Draw a polygon on the map to select your area, choose your layers, and download for offline use.`,
            target: '[data-panel="offline"]',
            position: 'right',
            icon: '📥',
            action: () => State.UI.setActivePanel('offline')
        },
        {
            id: 'waypoints',
            title: 'Structured Waypoints',
            content: `Mark locations with detailed, type-specific information:

• <b>Water sources:</b> Flow rate, treatment needed, reliability
• <b>Fuel caches:</b> Type, quantity, expiration
• <b>Camp sites:</b> Capacity, cover, legality
• <b>Bail-out points:</b> Access to civilization, EMS response time

Each waypoint type has fields designed for operational planning.`,
            target: '[data-panel="waypoints"]',
            position: 'right',
            icon: '📍',
            action: () => State.UI.setActivePanel('waypoints')
        },
        {
            id: 'routes',
            title: 'Route Planning',
            content: `Create routes by clicking points on the map. Link waypoints into your route and set terrain type for each segment.

Routes include:
• Real elevation profiles from terrain data
• Distance and time estimates by terrain
• GPX/KML import and export`,
            target: '[data-panel="routes"]',
            position: 'right',
            icon: '🛤️',
            action: () => State.UI.setActivePanel('routes')
        },
        {
            id: 'logistics',
            title: 'Logistics Calculator',
            content: `Plan resource requirements for your route:

• <b>Fuel:</b> Vehicle-specific consumption by terrain type
• <b>Water:</b> Per-person calculations with heat adjustment
• <b>Food:</b> Calorie requirements by activity level

Run "what-if" scenarios: What happens if a fuel cache is empty?`,
            target: '[data-panel="logistics"]',
            position: 'right',
            icon: '⛽',
            action: () => State.UI.setActivePanel('logistics')
        },
        {
            id: 'contingency',
            title: 'Contingency Planning',
            content: `Prepare for the unexpected:

• <b>Bail-out analysis:</b> Best exit at any point on your route
• <b>Time checkpoints:</b> "If I'm not here by X, search here"
• <b>Itinerary generation:</b> Shareable plans for emergency contacts

Generate printable route cards and quick-reference sheets.`,
            target: '[data-panel="contingency"]',
            position: 'right',
            icon: '🛡️',
            action: () => State.UI.setActivePanel('contingency')
        },
        {
            id: 'sos',
            title: 'Emergency Features',
            content: `The SOS panel is always at the top of the sidebar for quick access.

• Emergency beacon with location broadcast
• Check-in system with overdue alerts
• Formatted distress messages for radio transmission
• Nearest help calculations

Integrates with Meshtastic mesh radios for off-grid communication.`,
            target: '[data-panel="sos"]',
            position: 'right',
            icon: '🆘',
            action: () => State.UI.setActivePanel('sos')
        },
        {
            id: 'complete',
            title: 'You\'re Ready',
            content: `That covers the essentials. A few more things:

• <b>Ctrl+K:</b> Quick search across all data
• <b>Ctrl+Z:</b> Undo any action
• <b>Settings:</b> Night mode, coordinate formats, and more
• <b>Team panel:</b> Meshtastic/APRS integration for position sharing

Explore the other panels when you're ready. Stay safe out there.`,
            target: null,
            position: 'center',
            icon: '✅'
        }
    ];

    // State
    let currentStep = 0;
    let isActive = false;
    let overlay = null;
    let tooltip = null;
    let spotlight = null;

    /**
     * Initialize the module
     */
    async function init() {
        // Check if onboarding should be shown
        const shouldShow = await shouldShowOnboarding();
        
        if (shouldShow) {
            // Wait for app to be fully ready
            Events.once(Events.EVENTS.APP_READY, () => {
                // Small delay to ensure UI is rendered
                setTimeout(() => start(), 800);
            });
        }
        
        console.log('OnboardingModule initialized');
    }

    /**
     * Check if onboarding should be shown
     */
    async function shouldShowOnboarding() {
        try {
            // Check localStorage first (faster)
            const complete = localStorage.getItem(STORAGE_KEY);
            const version = localStorage.getItem(VERSION_KEY);
            
            if (complete === 'true' && parseInt(version) >= CURRENT_VERSION) {
                return false;
            }
            
            // Also check IndexedDB for consistency
            const dbComplete = await Storage.Settings.get('onboardingComplete');
            const dbVersion = await Storage.Settings.get('onboardingVersion');
            
            if (dbComplete === true && dbVersion >= CURRENT_VERSION) {
                // Sync to localStorage
                localStorage.setItem(STORAGE_KEY, 'true');
                localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
                return false;
            }
            
            return true;
        } catch (e) {
            console.warn('Error checking onboarding status:', e);
            return false; // Don't show if we can't check
        }
    }

    /**
     * Mark onboarding as complete
     */
    async function markComplete() {
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
            localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
            await Storage.Settings.set('onboardingComplete', true);
            await Storage.Settings.set('onboardingVersion', CURRENT_VERSION);
        } catch (e) {
            console.warn('Error saving onboarding status:', e);
        }
    }

    /**
     * Reset onboarding (can be called from settings to re-show)
     */
    async function reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(VERSION_KEY);
            await Storage.Settings.set('onboardingComplete', false);
            await Storage.Settings.set('onboardingVersion', 0);
        } catch (e) {
            console.warn('Error resetting onboarding:', e);
        }
    }

    /**
     * Start the onboarding tour
     */
    function start() {
        if (isActive) return;
        
        isActive = true;
        currentStep = 0;
        
        createOverlay();
        showStep(currentStep);
    }

    /**
     * Create the overlay elements
     */
    function createOverlay() {
        // Main overlay (darkens background)
        overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.className = 'onboarding-overlay';
        
        // Spotlight (highlights target element)
        spotlight = document.createElement('div');
        spotlight.id = 'onboarding-spotlight';
        spotlight.className = 'onboarding-spotlight';
        
        // Tooltip container
        tooltip = document.createElement('div');
        tooltip.id = 'onboarding-tooltip';
        tooltip.className = 'onboarding-tooltip';
        
        document.body.appendChild(overlay);
        document.body.appendChild(spotlight);
        document.body.appendChild(tooltip);
        
        // Close on overlay click (optional - can be disabled)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                // Don't close on overlay click - require explicit skip/next
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeydown(e) {
        if (!isActive) return;
        
        if (e.key === 'Escape') {
            skip();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            nextStep();
        } else if (e.key === 'ArrowLeft') {
            prevStep();
        }
    }

    /**
     * Show a specific step
     */
    function showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= TOUR_STEPS.length) return;
        
        const step = TOUR_STEPS[stepIndex];
        currentStep = stepIndex;
        
        // Execute step action if defined (e.g., switch panels)
        if (step.action) {
            step.action();
            // Small delay for panel to render
            setTimeout(() => positionElements(step), 100);
        } else {
            positionElements(step);
        }
    }

    /**
     * Position spotlight and tooltip for current step
     */
    function positionElements(step) {
        const isCenter = step.position === 'center' || !step.target;
        
        if (isCenter) {
            // Center modal style
            spotlight.style.display = 'none';
            tooltip.className = 'onboarding-tooltip onboarding-tooltip--center';
            tooltip.style.left = '50%';
            tooltip.style.top = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
        } else {
            // Spotlight on target element
            const target = document.querySelector(step.target);
            
            if (target) {
                const rect = target.getBoundingClientRect();
                const padding = 8;
                
                spotlight.style.display = 'block';
                spotlight.style.left = (rect.left - padding) + 'px';
                spotlight.style.top = (rect.top - padding) + 'px';
                spotlight.style.width = (rect.width + padding * 2) + 'px';
                spotlight.style.height = (rect.height + padding * 2) + 'px';
                
                // Position tooltip
                positionTooltip(rect, step.position);
            } else {
                // Target not found, center the tooltip
                spotlight.style.display = 'none';
                tooltip.className = 'onboarding-tooltip onboarding-tooltip--center';
                tooltip.style.left = '50%';
                tooltip.style.top = '50%';
                tooltip.style.transform = 'translate(-50%, -50%)';
            }
        }
        
        // Render tooltip content
        renderTooltip(step);
    }

    /**
     * Position tooltip relative to target
     */
    function positionTooltip(targetRect, position) {
        tooltip.className = 'onboarding-tooltip onboarding-tooltip--' + position;
        tooltip.style.transform = '';
        
        const tooltipWidth = 340;
        const tooltipMargin = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        switch (position) {
            case 'right':
                tooltip.style.left = (targetRect.right + tooltipMargin) + 'px';
                tooltip.style.top = targetRect.top + 'px';
                // Check if tooltip would go off screen
                if (targetRect.right + tooltipMargin + tooltipWidth > viewportWidth) {
                    // Position on left instead
                    tooltip.style.left = (targetRect.left - tooltipWidth - tooltipMargin) + 'px';
                    tooltip.className = 'onboarding-tooltip onboarding-tooltip--left';
                }
                break;
            case 'left':
                tooltip.style.left = (targetRect.left - tooltipWidth - tooltipMargin) + 'px';
                tooltip.style.top = targetRect.top + 'px';
                break;
            case 'bottom':
                tooltip.style.left = targetRect.left + 'px';
                tooltip.style.top = (targetRect.bottom + tooltipMargin) + 'px';
                break;
            case 'top':
                tooltip.style.left = targetRect.left + 'px';
                tooltip.style.top = (targetRect.top - tooltipMargin) + 'px';
                tooltip.style.transform = 'translateY(-100%)';
                break;
        }
        
        // Ensure tooltip stays in viewport vertically
        setTimeout(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.bottom > viewportHeight - 20) {
                tooltip.style.top = (viewportHeight - tooltipRect.height - 20) + 'px';
            }
            if (tooltipRect.top < 20) {
                tooltip.style.top = '20px';
            }
        }, 0);
    }

    /**
     * Render tooltip content
     */
    function renderTooltip(step) {
        const stepNum = currentStep + 1;
        const totalSteps = TOUR_STEPS.length;
        const isFirst = currentStep === 0;
        const isLast = currentStep === TOUR_STEPS.length - 1;
        
        // Set ARIA attributes on tooltip
        tooltip.setAttribute('role', 'dialog');
        tooltip.setAttribute('aria-modal', 'true');
        tooltip.setAttribute('aria-labelledby', 'onboarding-title');
        tooltip.setAttribute('aria-describedby', 'onboarding-content');
        
        tooltip.innerHTML = `
            <div class="onboarding-tooltip__header">
                <span class="onboarding-tooltip__icon" aria-hidden="true">${step.icon}</span>
                <span class="onboarding-tooltip__title" id="onboarding-title">${step.title}</span>
                <button class="onboarding-tooltip__close" id="onboarding-close" title="Skip tour (Esc)" aria-label="Skip tour. Press Escape to close.">✕</button>
            </div>
            <div class="onboarding-tooltip__content" id="onboarding-content">
                ${step.content.replace(/\n/g, '<br>')}
            </div>
            <div class="onboarding-tooltip__footer">
                <div class="onboarding-tooltip__progress" role="progressbar" aria-valuenow="${stepNum}" aria-valuemin="1" aria-valuemax="${totalSteps}" aria-label="Step ${stepNum} of ${totalSteps}">
                    ${TOUR_STEPS.map((_, i) => `
                        <span class="onboarding-tooltip__dot ${i === currentStep ? 'onboarding-tooltip__dot--active' : ''} ${i < currentStep ? 'onboarding-tooltip__dot--complete' : ''}" aria-hidden="true"></span>
                    `).join('')}
                </div>
                <div class="onboarding-tooltip__actions" role="group" aria-label="Tour navigation">
                    ${!isFirst ? `<button class="onboarding-btn onboarding-btn--secondary" id="onboarding-prev" aria-label="Go to previous step">← Back</button>` : ''}
                    ${isLast 
                        ? `<button class="onboarding-btn onboarding-btn--primary" id="onboarding-finish" aria-label="Finish tour and get started">Get Started</button>`
                        : `<button class="onboarding-btn onboarding-btn--primary" id="onboarding-next" aria-label="Go to next step">Next →</button>`
                    }
                </div>
            </div>
        `;
        
        // Bind button events
        const closeBtn = tooltip.querySelector('#onboarding-close');
        const prevBtn = tooltip.querySelector('#onboarding-prev');
        const nextBtn = tooltip.querySelector('#onboarding-next');
        const finishBtn = tooltip.querySelector('#onboarding-finish');
        
        if (closeBtn) closeBtn.onclick = skip;
        if (prevBtn) prevBtn.onclick = prevStep;
        if (nextBtn) nextBtn.onclick = nextStep;
        if (finishBtn) finishBtn.onclick = finish;
        
        // Focus management - focus the primary action button
        setTimeout(() => {
            const primaryBtn = finishBtn || nextBtn;
            if (primaryBtn) primaryBtn.focus();
        }, 100);
    }

    /**
     * Go to next step
     */
    function nextStep() {
        if (currentStep < TOUR_STEPS.length - 1) {
            showStep(currentStep + 1);
        } else {
            finish();
        }
    }

    /**
     * Go to previous step
     */
    function prevStep() {
        if (currentStep > 0) {
            showStep(currentStep - 1);
        }
    }

    /**
     * Skip the tour
     */
    function skip() {
        cleanup();
        markComplete();
        ModalsModule.showToast('Tour skipped. Restart anytime from Settings.', 'info');
    }

    /**
     * Finish the tour
     */
    function finish() {
        cleanup();
        markComplete();
        
        // Return to map panel
        State.UI.setActivePanel('map');
        
        ModalsModule.showToast('Welcome to GridDown! 🧭', 'success');
    }

    /**
     * Clean up overlay elements
     */
    function cleanup() {
        isActive = false;
        
        document.removeEventListener('keydown', handleKeydown);
        
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
        if (spotlight) {
            spotlight.remove();
            spotlight = null;
        }
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
    }

    /**
     * Check if tour is currently active
     */
    function isRunning() {
        return isActive;
    }

    // Public API
    return {
        init,
        start,
        skip,
        reset,
        isRunning
    };
})();

window.OnboardingModule = OnboardingModule;
