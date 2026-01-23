/**
 * GridDown Global Search Module
 * Quick search across waypoints, routes, team members, frequencies, and more
 * Keyboard-driven with fuzzy matching support
 */
const SearchModule = (function() {
    'use strict';

    // Search configuration
    const CONFIG = {
        minQueryLength: 1,
        maxResults: 20,
        debounceMs: 150,
        recentSearchesMax: 10
    };

    // Search categories with icons and colors
    const CATEGORIES = {
        waypoint: {
            id: 'waypoint',
            name: 'Waypoints',
            icon: '📍',
            color: '#f97316',
            shortcut: 'w'
        },
        route: {
            id: 'route',
            name: 'Routes',
            icon: '🛣️',
            color: '#3b82f6',
            shortcut: 'r'
        },
        team: {
            id: 'team',
            name: 'Team Members',
            icon: '👥',
            color: '#22c55e',
            shortcut: 't'
        },
        frequency: {
            id: 'frequency',
            name: 'Radio Frequencies',
            icon: '📻',
            color: '#8b5cf6',
            shortcut: 'f'
        },
        location: {
            id: 'location',
            name: 'Coordinates',
            icon: '🎯',
            color: '#ec4899',
            shortcut: 'c'
        }
    };

    // State
    let isOpen = false;
    let query = '';
    let results = [];
    let selectedIndex = 0;
    let activeCategory = null; // null = all categories
    let recentSearches = [];
    let searchContainer = null;
    let debounceTimer = null;
    let initialized = false;
    let searchEvents = null; // EventManager scoped manager

    /**
     * Initialize the search module
     */
    function init() {
        // Prevent double initialization
        if (initialized) {
            console.debug('SearchModule already initialized');
            return;
        }
        
        // Create scoped event manager
        searchEvents = EventManager.createScopedManager(EventManager.SCOPES.SEARCH);
        
        createSearchUI();
        loadRecentSearches();
        setupKeyboardShortcuts();
        
        initialized = true;
        console.log('Search module initialized (Ctrl+K to open)');
    }

    /**
     * Create the search UI elements
     */
    function createSearchUI() {
        // Create search overlay container
        searchContainer = document.createElement('div');
        searchContainer.id = 'global-search';
        searchContainer.className = 'global-search';
        searchContainer.setAttribute('role', 'dialog');
        searchContainer.setAttribute('aria-modal', 'true');
        searchContainer.setAttribute('aria-label', 'Global search');
        searchContainer.setAttribute('aria-hidden', 'true');
        searchContainer.innerHTML = `
            <div class="global-search__backdrop" role="presentation"></div>
            <div class="global-search__dialog" role="search">
                <div class="global-search__header">
                    <div class="global-search__input-wrapper">
                        <span class="global-search__icon" aria-hidden="true">🔍</span>
                        <input type="text" 
                               id="global-search-input" 
                               class="global-search__input" 
                               placeholder="Search waypoints, routes, frequencies..."
                               autocomplete="off"
                               spellcheck="false"
                               role="combobox"
                               aria-expanded="false"
                               aria-autocomplete="list"
                               aria-controls="search-results-list"
                               aria-activedescendant=""
                               aria-label="Search query">
                        <div class="global-search__category-badge" id="search-category-badge" style="display:none" aria-live="polite"></div>
                        <kbd class="global-search__kbd" aria-hidden="true">ESC</kbd>
                    </div>
                    <div class="global-search__filters" id="search-filters" role="tablist" aria-label="Search category filters">
                        <button class="global-search__filter global-search__filter--active" data-category="" role="tab" aria-selected="true" aria-controls="search-results-list">
                            All
                        </button>
                        ${Object.values(CATEGORIES).map(cat => `
                            <button class="global-search__filter" data-category="${cat.id}" title="Press ${cat.shortcut} to filter" role="tab" aria-selected="false" aria-controls="search-results-list">
                                <span aria-hidden="true">${cat.icon}</span> ${cat.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="global-search__body" id="search-results" role="tabpanel">
                    <div class="global-search__empty" id="search-empty">
                        <div class="global-search__recent" id="search-recent" role="group" aria-label="Recent searches"></div>
                        <div class="global-search__tips" role="group" aria-label="Keyboard shortcuts">
                            <div class="global-search__tip">
                                <kbd aria-hidden="true">↑</kbd><kbd aria-hidden="true">↓</kbd> <span class="sr-only">Arrow keys to</span>Navigate
                            </div>
                            <div class="global-search__tip">
                                <kbd aria-hidden="true">Enter</kbd> Select
                            </div>
                            <div class="global-search__tip">
                                <kbd aria-hidden="true">Tab</kbd> Next category
                            </div>
                        </div>
                    </div>
                    <div class="global-search__results" id="search-results-list" role="listbox" aria-label="Search results"></div>
                </div>
                <div class="global-search__footer">
                    <span class="global-search__hint" aria-hidden="true">
                        <kbd>Ctrl</kbd>+<kbd>K</kbd> to search anywhere
                    </span>
                    <span class="global-search__count" id="search-count" role="status" aria-live="polite"></span>
                </div>
            </div>
        `;
        
        document.body.appendChild(searchContainer);
        
        // Bind events
        const backdrop = searchContainer.querySelector('.global-search__backdrop');
        const input = searchContainer.querySelector('#global-search-input');
        const filters = searchContainer.querySelectorAll('.global-search__filter');
        
        backdrop.addEventListener('click', close);
        
        input.addEventListener('input', (e) => {
            query = e.target.value;
            debouncedSearch();
        });
        
        input.addEventListener('keydown', handleInputKeydown);
        
        filters.forEach(btn => {
            btn.addEventListener('click', () => {
                setCategory(btn.dataset.category || null);
            });
        });
    }

    /**
     * Setup global keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        const keydownHandler = (e) => {
            // Ctrl+K or Cmd+K to open search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                toggle();
                return;
            }
            
            // Forward slash to open search (when not in input)
            if (e.key === '/' && !isInputFocused()) {
                e.preventDefault();
                open();
                return;
            }
            
            // Escape to close
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                close();
                return;
            }
        };
        
        searchEvents.on(document, 'keydown', keydownHandler);
    }

    /**
     * Handle keydown in search input
     */
    function handleInputKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectNext();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectPrevious();
                break;
                
            case 'Enter':
                e.preventDefault();
                activateSelected();
                break;
                
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) {
                    cycleCategoryBackward();
                } else {
                    cycleCategoryForward();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                if (query) {
                    clearQuery();
                } else {
                    close();
                }
                break;
                
            default:
                // Category shortcuts (when query is empty and key matches)
                if (!query && e.key.length === 1) {
                    const cat = Object.values(CATEGORIES).find(c => c.shortcut === e.key.toLowerCase());
                    if (cat && activeCategory !== cat.id) {
                        e.preventDefault();
                        setCategory(cat.id);
                    }
                }
        }
    }

    /**
     * Open the search dialog
     */
    function open() {
        if (isOpen) return;
        
        isOpen = true;
        searchContainer.classList.add('global-search--open');
        searchContainer.setAttribute('aria-hidden', 'false');
        
        // Focus input
        const input = searchContainer.querySelector('#global-search-input');
        input.value = query;
        input.focus();
        input.select();
        
        // Show recent searches if no query
        if (!query) {
            renderRecentSearches();
        }
        
        // Trap focus inside dialog
        document.body.style.overflow = 'hidden';
        
        // Emit event
        Events.emit('search:open');
    }

    /**
     * Close the search dialog
     */
    function close() {
        if (!isOpen) return;
        
        isOpen = false;
        searchContainer.classList.remove('global-search--open');
        searchContainer.setAttribute('aria-hidden', 'true');
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Reset aria-expanded
        const input = searchContainer.querySelector('#global-search-input');
        if (input) {
            input.setAttribute('aria-expanded', 'false');
        }
        
        // Emit event
        Events.emit('search:close');
    }

    /**
     * Toggle search dialog
     */
    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    /**
     * Clear the search query
     */
    function clearQuery() {
        query = '';
        const input = searchContainer.querySelector('#global-search-input');
        input.value = '';
        results = [];
        selectedIndex = 0;
        renderResults();
        renderRecentSearches();
    }

    /**
     * Set active category filter
     */
    function setCategory(categoryId) {
        activeCategory = categoryId;
        
        // Update filter buttons with ARIA states
        const filters = searchContainer.querySelectorAll('.global-search__filter');
        filters.forEach(btn => {
            const isActive = (btn.dataset.category || null) === categoryId;
            btn.classList.toggle('global-search__filter--active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        
        // Update category badge
        const badge = searchContainer.querySelector('#search-category-badge');
        if (categoryId && CATEGORIES[categoryId]) {
            const cat = CATEGORIES[categoryId];
            badge.innerHTML = `${cat.icon} ${cat.name}`;
            badge.style.display = 'flex';
            badge.style.background = cat.color + '22';
            badge.style.color = cat.color;
        } else {
            badge.style.display = 'none';
        }
        
        // Re-search with new filter
        performSearch();
    }

    /**
     * Cycle to next category
     */
    function cycleCategoryForward() {
        const categories = [null, ...Object.keys(CATEGORIES)];
        const currentIndex = categories.indexOf(activeCategory);
        const nextIndex = (currentIndex + 1) % categories.length;
        setCategory(categories[nextIndex]);
    }

    /**
     * Cycle to previous category
     */
    function cycleCategoryBackward() {
        const categories = [null, ...Object.keys(CATEGORIES)];
        const currentIndex = categories.indexOf(activeCategory);
        const prevIndex = (currentIndex - 1 + categories.length) % categories.length;
        setCategory(categories[prevIndex]);
    }

    /**
     * Debounced search
     */
    function debouncedSearch() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(performSearch, CONFIG.debounceMs);
    }

    /**
     * Perform the search
     */
    function performSearch() {
        if (query.length < CONFIG.minQueryLength) {
            results = [];
            renderResults();
            renderRecentSearches();
            return;
        }
        
        const searchResults = [];
        const lowerQuery = query.toLowerCase().trim();
        
        // Check if query looks like coordinates
        const coordMatch = parseCoordinateQuery(lowerQuery);
        if (coordMatch) {
            searchResults.push({
                id: 'coord-' + Date.now(),
                category: 'location',
                title: `Go to ${coordMatch.display}`,
                subtitle: 'Navigate to coordinates',
                icon: '🎯',
                data: coordMatch,
                score: 100
            });
        }
        
        // Search waypoints
        if (!activeCategory || activeCategory === 'waypoint') {
            const waypoints = State.get('waypoints') || [];
            waypoints.forEach(wp => {
                const score = calculateMatchScore(wp, lowerQuery, ['name', 'notes', 'type']);
                if (score > 0) {
                    const typeInfo = Constants.WAYPOINT_TYPES[wp.type] || Constants.WAYPOINT_TYPES.custom;
                    searchResults.push({
                        id: 'wp-' + wp.id,
                        category: 'waypoint',
                        title: wp.name,
                        subtitle: `${typeInfo.label}${wp.notes ? ' • ' + truncate(wp.notes, 40) : ''}`,
                        icon: typeInfo.icon,
                        color: typeInfo.color,
                        data: wp,
                        score: score
                    });
                }
            });
        }
        
        // Search routes
        if (!activeCategory || activeCategory === 'route') {
            const routes = State.get('routes') || [];
            routes.filter(r => !r.isBuilding).forEach(route => {
                const score = calculateMatchScore(route, lowerQuery, ['name', 'notes']);
                if (score > 0) {
                    searchResults.push({
                        id: 'route-' + route.id,
                        category: 'route',
                        title: route.name,
                        subtitle: `${route.distance || '?'} mi • ${route.duration || '?'} • ${route.points?.length || 0} points`,
                        icon: '🛣️',
                        color: '#3b82f6',
                        data: route,
                        score: score
                    });
                }
            });
        }
        
        // Search team members
        if (!activeCategory || activeCategory === 'team') {
            const team = State.get('teamMembers') || [];
            team.forEach(member => {
                const score = calculateMatchScore(member, lowerQuery, ['name', 'callsign']);
                if (score > 0) {
                    searchResults.push({
                        id: 'team-' + member.id,
                        category: 'team',
                        title: member.name || member.callsign || 'Unknown',
                        subtitle: `${member.status || 'Unknown'} • Last: ${member.lastUpdate || 'N/A'}`,
                        icon: '👤',
                        color: member.status === 'active' ? '#22c55e' : '#f59e0b',
                        data: member,
                        score: score
                    });
                }
            });
        }
        
        // Search radio frequencies
        if ((!activeCategory || activeCategory === 'frequency') && typeof RadioModule !== 'undefined') {
            try {
                const freqResults = RadioModule.searchAll ? RadioModule.searchAll(lowerQuery) : [];
                freqResults.slice(0, 10).forEach(freq => {
                    searchResults.push({
                        id: 'freq-' + freq.frequency,
                        category: 'frequency',
                        title: freq.name || freq.frequency,
                        subtitle: `${freq.frequency} MHz • ${freq.category || freq.type || 'Radio'}`,
                        icon: '📻',
                        color: '#8b5cf6',
                        data: freq,
                        score: 50
                    });
                });
            } catch (e) {
                console.warn('Radio search failed:', e);
            }
        }
        
        // Sort by score and limit results
        results = searchResults
            .sort((a, b) => b.score - a.score)
            .slice(0, CONFIG.maxResults);
        
        selectedIndex = 0;
        renderResults();
    }

    /**
     * Calculate match score for an item
     */
    function calculateMatchScore(item, query, fields) {
        let maxScore = 0;
        
        for (const field of fields) {
            const value = item[field];
            if (!value) continue;
            
            const lowerValue = String(value).toLowerCase();
            
            // Exact match
            if (lowerValue === query) {
                maxScore = Math.max(maxScore, 100);
            }
            // Starts with
            else if (lowerValue.startsWith(query)) {
                maxScore = Math.max(maxScore, 80);
            }
            // Word starts with
            else if (lowerValue.split(/\s+/).some(word => word.startsWith(query))) {
                maxScore = Math.max(maxScore, 60);
            }
            // Contains
            else if (lowerValue.includes(query)) {
                maxScore = Math.max(maxScore, 40);
            }
            // Fuzzy match (characters in order)
            else if (fuzzyMatch(lowerValue, query)) {
                maxScore = Math.max(maxScore, 20);
            }
        }
        
        return maxScore;
    }

    /**
     * Simple fuzzy matching (characters appear in order)
     */
    function fuzzyMatch(str, pattern) {
        let patternIdx = 0;
        for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
            if (str[i] === pattern[patternIdx]) {
                patternIdx++;
            }
        }
        return patternIdx === pattern.length;
    }

    /**
     * Parse coordinate query (various formats)
     */
    function parseCoordinateQuery(query) {
        // Decimal degrees: 37.4215, -119.1892 or 37.4215 -119.1892
        const ddMatch = query.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
        if (ddMatch) {
            const lat = parseFloat(ddMatch[1]);
            const lon = parseFloat(ddMatch[2]);
            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                return {
                    lat,
                    lon,
                    display: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
                };
            }
        }
        
        // DMS format: 37°25'17.4"N 119°11'21.1"W
        const dmsMatch = query.match(/(\d+)[°](\d+)['](\d+\.?\d*)["]?\s*([NSns])\s*(\d+)[°](\d+)['](\d+\.?\d*)["]?\s*([EWew])/);
        if (dmsMatch) {
            let lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
            let lon = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
            if (dmsMatch[4].toLowerCase() === 's') lat = -lat;
            if (dmsMatch[8].toLowerCase() === 'w') lon = -lon;
            return {
                lat,
                lon,
                display: `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`
            };
        }
        
        return null;
    }

    /**
     * Render search results
     */
    function renderResults() {
        const emptyEl = searchContainer.querySelector('#search-empty');
        const resultsEl = searchContainer.querySelector('#search-results-list');
        const countEl = searchContainer.querySelector('#search-count');
        
        if (results.length === 0) {
            emptyEl.style.display = 'block';
            resultsEl.style.display = 'none';
            countEl.textContent = query ? 'No results' : '';
            return;
        }
        
        emptyEl.style.display = 'none';
        resultsEl.style.display = 'block';
        countEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
        
        // Group results by category
        const grouped = {};
        results.forEach((result, index) => {
            if (!grouped[result.category]) {
                grouped[result.category] = [];
            }
            grouped[result.category].push({ ...result, index });
        });
        
        let html = '';
        
        for (const [categoryId, items] of Object.entries(grouped)) {
            const category = CATEGORIES[categoryId];
            html += `
                <div class="global-search__group">
                    <div class="global-search__group-header">
                        ${category?.icon || '📋'} ${category?.name || categoryId}
                    </div>
                    ${items.map(item => `
                        <div class="global-search__item ${item.index === selectedIndex ? 'global-search__item--selected' : ''}"
                             data-index="${item.index}">
                            <span class="global-search__item-icon" style="color:${item.color || '#fff'}">${item.icon}</span>
                            <div class="global-search__item-content">
                                <div class="global-search__item-title">${highlightMatch(item.title, query)}</div>
                                <div class="global-search__item-subtitle">${item.subtitle}</div>
                            </div>
                            <kbd class="global-search__item-action">↵</kbd>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        resultsEl.innerHTML = html;
        
        // Bind click events
        resultsEl.querySelectorAll('.global-search__item').forEach(el => {
            el.addEventListener('click', () => {
                selectedIndex = parseInt(el.dataset.index);
                activateSelected();
            });
            
            el.addEventListener('mouseenter', () => {
                selectedIndex = parseInt(el.dataset.index);
                updateSelection();
            });
        });
        
        // Scroll selected into view
        scrollSelectedIntoView();
    }

    /**
     * Render recent searches
     */
    function renderRecentSearches() {
        const recentEl = searchContainer.querySelector('#search-recent');
        
        if (query || recentSearches.length === 0) {
            recentEl.innerHTML = '';
            return;
        }
        
        recentEl.innerHTML = `
            <div class="global-search__recent-header">
                Recent Searches
                <button class="global-search__recent-clear" id="clear-recent">Clear</button>
            </div>
            <div class="global-search__recent-list">
                ${recentSearches.map(search => `
                    <button class="global-search__recent-item" data-query="${escapeHtml(search)}">
                        🕐 ${escapeHtml(search)}
                    </button>
                `).join('')}
            </div>
        `;
        
        // Bind events
        recentEl.querySelector('#clear-recent')?.addEventListener('click', clearRecentSearches);
        
        recentEl.querySelectorAll('.global-search__recent-item').forEach(btn => {
            btn.addEventListener('click', () => {
                query = btn.dataset.query;
                searchContainer.querySelector('#global-search-input').value = query;
                performSearch();
            });
        });
    }

    /**
     * Highlight matching text
     */
    function highlightMatch(text, query) {
        if (!query || !text) return escapeHtml(text || '');
        
        const escaped = escapeHtml(text);
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        
        if (index === -1) return escaped;
        
        const before = escapeHtml(text.substring(0, index));
        const match = escapeHtml(text.substring(index, index + query.length));
        const after = escapeHtml(text.substring(index + query.length));
        
        return `${before}<mark class="global-search__highlight">${match}</mark>${after}`;
    }

    /**
     * Select next result
     */
    function selectNext() {
        if (results.length === 0) return;
        selectedIndex = (selectedIndex + 1) % results.length;
        updateSelection();
    }

    /**
     * Select previous result
     */
    function selectPrevious() {
        if (results.length === 0) return;
        selectedIndex = (selectedIndex - 1 + results.length) % results.length;
        updateSelection();
    }

    /**
     * Update selection highlighting
     */
    function updateSelection() {
        const items = searchContainer.querySelectorAll('.global-search__item');
        items.forEach((item, i) => {
            item.classList.toggle('global-search__item--selected', parseInt(item.dataset.index) === selectedIndex);
        });
        scrollSelectedIntoView();
    }

    /**
     * Scroll selected item into view
     */
    function scrollSelectedIntoView() {
        const selected = searchContainer.querySelector('.global-search__item--selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /**
     * Activate the selected result
     */
    function activateSelected() {
        if (results.length === 0 || selectedIndex >= results.length) return;
        
        const result = results[selectedIndex];
        
        // Save to recent searches
        addRecentSearch(query);
        
        // Handle based on category
        switch (result.category) {
            case 'waypoint':
                navigateToWaypoint(result.data);
                break;
                
            case 'route':
                navigateToRoute(result.data);
                break;
                
            case 'team':
                navigateToTeamMember(result.data);
                break;
                
            case 'frequency':
                showFrequencyDetails(result.data);
                break;
                
            case 'location':
                navigateToCoordinates(result.data);
                break;
        }
        
        close();
    }

    /**
     * Navigate to a waypoint
     */
    function navigateToWaypoint(waypoint) {
        // Select the waypoint
        State.Waypoints.select(waypoint);
        
        // Center map on waypoint
        const lat = waypoint.lat || (37.4215 + (waypoint.y - 50) * 0.002);
        const lon = waypoint.lon || (-119.1892 + (waypoint.x - 50) * 0.004);
        
        if (typeof MapModule !== 'undefined' && MapModule.setCenter) {
            MapModule.setCenter(lat, lon, 15);
        }
        
        // Switch to waypoints panel
        State.UI.setActivePanel('waypoints');
        Events.emit(Events.EVENTS.PANEL_CHANGE, { panel: 'waypoints' });
        
        // Show toast
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast(`Showing: ${waypoint.name}`, 'success');
        }
        
        // Emit event
        Events.emit('search:navigate', { type: 'waypoint', data: waypoint });
    }

    /**
     * Navigate to a route
     */
    function navigateToRoute(route) {
        // Select the route
        State.Routes.select(route);
        
        // Center map on route midpoint
        if (route.points && route.points.length > 0) {
            const midIndex = Math.floor(route.points.length / 2);
            const midPoint = route.points[midIndex];
            const lat = midPoint.lat || (37.4215 + ((midPoint.y || 50) - 50) * 0.002);
            const lon = midPoint.lon || (-119.1892 + ((midPoint.x || 50) - 50) * 0.004);
            
            if (typeof MapModule !== 'undefined' && MapModule.setCenter) {
                MapModule.setCenter(lat, lon, 12);
            }
        }
        
        // Switch to routes panel
        State.UI.setActivePanel('routes');
        Events.emit(Events.EVENTS.PANEL_CHANGE, { panel: 'routes' });
        
        // Show toast
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast(`Showing: ${route.name}`, 'success');
        }
        
        // Emit event
        Events.emit('search:navigate', { type: 'route', data: route });
    }

    /**
     * Navigate to a team member
     */
    function navigateToTeamMember(member) {
        // Center map on team member
        if (member.lat && member.lon) {
            if (typeof MapModule !== 'undefined' && MapModule.setCenter) {
                MapModule.setCenter(member.lat, member.lon, 15);
            }
        }
        
        // Switch to team panel
        State.UI.setActivePanel('team');
        Events.emit(Events.EVENTS.PANEL_CHANGE, { panel: 'team' });
        
        // Show toast
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast(`Showing: ${member.name || member.callsign}`, 'success');
        }
        
        // Emit event
        Events.emit('search:navigate', { type: 'team', data: member });
    }

    /**
     * Show frequency details
     */
    function showFrequencyDetails(freq) {
        // Switch to radio panel
        State.UI.setActivePanel('radio');
        Events.emit(Events.EVENTS.PANEL_CHANGE, { panel: 'radio' });
        
        // Show toast with frequency info
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast(`${freq.name || 'Frequency'}: ${freq.frequency} MHz`, 'info');
        }
        
        // Emit event
        Events.emit('search:navigate', { type: 'frequency', data: freq });
    }

    /**
     * Navigate to coordinates
     */
    function navigateToCoordinates(coords) {
        if (typeof MapModule !== 'undefined' && MapModule.setCenter) {
            MapModule.setCenter(coords.lat, coords.lon, 15);
        }
        
        // Switch to map panel
        State.UI.setActivePanel('map');
        Events.emit(Events.EVENTS.PANEL_CHANGE, { panel: 'map' });
        
        // Show toast
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showToast(`Navigated to ${coords.display}`, 'success');
        }
        
        // Emit event
        Events.emit('search:navigate', { type: 'location', data: coords });
    }

    /**
     * Add to recent searches
     */
    function addRecentSearch(searchQuery) {
        if (!searchQuery || searchQuery.length < 2) return;
        
        // Remove if already exists
        recentSearches = recentSearches.filter(s => s.toLowerCase() !== searchQuery.toLowerCase());
        
        // Add to beginning
        recentSearches.unshift(searchQuery);
        
        // Limit
        recentSearches = recentSearches.slice(0, CONFIG.recentSearchesMax);
        
        // Save
        saveRecentSearches();
    }

    /**
     * Load recent searches from storage
     */
    async function loadRecentSearches() {
        try {
            const saved = await Storage.Settings.get('recentSearches');
            if (Array.isArray(saved)) {
                recentSearches = saved;
            }
        } catch (e) {
            console.warn('Could not load recent searches:', e);
        }
    }

    /**
     * Save recent searches to storage
     */
    function saveRecentSearches() {
        try {
            Storage.Settings.set('recentSearches', recentSearches);
        } catch (e) {
            console.warn('Could not save recent searches:', e);
        }
    }

    /**
     * Clear recent searches
     */
    function clearRecentSearches() {
        recentSearches = [];
        saveRecentSearches();
        renderRecentSearches();
    }

    // Utility functions
    function isInputFocused() {
        const active = document.activeElement;
        return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '...' : str;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    
    /**
     * Cleanup all event listeners
     */
    function destroy() {
        // Clear all search-scoped event listeners
        if (searchEvents) {
            searchEvents.clear();
            searchEvents = null;
        }
        
        // Remove search container from DOM
        if (searchContainer && searchContainer.parentNode) {
            searchContainer.parentNode.removeChild(searchContainer);
        }
        searchContainer = null;
        initialized = false;
    }

    // Public API
    return {
        init,
        open,
        close,
        toggle,
        isOpen: () => isOpen,
        setCategory,
        destroy,
        search: (q) => {
            query = q;
            if (isOpen) {
                searchContainer.querySelector('#global-search-input').value = q;
            }
            performSearch();
        }
    };
})();

window.SearchModule = SearchModule;
