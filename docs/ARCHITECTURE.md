# GridDown Architecture

## Overview

GridDown follows a modular vanilla JavaScript architecture optimized for PWA deployment and offline-first operation.

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│                    (App Shell / Entry)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                         app.js                              │
│                  (Initialization & Bootstrap)               │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│    CORE     │   │   MODULES   │   │    UTILS    │
├─────────────┤   ├─────────────┤   ├─────────────┤
│ state.js    │◄──│ map.js      │──►│ helpers.js  │
│ events.js   │◄──│ sidebar.js  │──►│ storage.js  │
│ constants.js│◄──│ panels.js   │──►│ icons.js    │
└─────────────┘   │ modals.js   │   └─────────────┘
                  └─────────────┘
```

## Core Layer

### State (`js/core/state.js`)
Single source of truth for application state.

**Responsibilities:**
- Store all application data
- Notify subscribers on changes
- Provide action methods for common operations

**Pattern:** Centralized store with reactive subscriptions

```javascript
// State structure
{
    activePanel: 'map',
    isOffline: false,
    zoom: 12,
    mapLayers: { terrain: true, satellite: false, ... },
    waypoints: [...],
    routes: [...],
    selectedWaypoint: null,
    ...
}
```

### Events (`js/core/events.js`)
Decoupled communication between modules.

**Responsibilities:**
- Pub/sub event system
- Cross-module communication
- Async operation coordination

**Pattern:** Observer/Pub-Sub

### Constants (`js/core/constants.js`)
Static configuration and type definitions.

**Contains:**
- Waypoint types and colors
- Vehicle profiles
- Navigation items
- Default data

## Module Layer

Each module is a self-contained IIFE with:
- `init()` - Setup and subscribe to state
- `render()` - Update DOM
- Public API for external access

### Map Module (`js/modules/map.js`)
Canvas-based map rendering.

**Features:**
- Procedural terrain generation
- Waypoint rendering
- Route visualization
- Mouse/touch interaction

### Sidebar Module (`js/modules/sidebar.js`)
Navigation and status display.

### Panels Module (`js/modules/panels.js`)
All panel content rendering.

**Panels:**
- Map Layers
- Waypoints
- Routes
- Logistics
- Offline Maps
- Team

### Modals Module (`js/modules/modals.js`)
Modal dialog management.

## Utility Layer

### Helpers (`js/utils/helpers.js`)
Pure utility functions.

### Storage (`js/utils/storage.js`)
Data persistence abstraction.

**Strategy:**
1. Try IndexedDB (preferred)
2. Fallback to localStorage
3. In-memory as last resort

### Icons (`js/utils/icons.js`)
SVG icon library.

## Data Flow

```
User Action
    │
    ▼
Event Emitted ──────────────────────┐
    │                               │
    ▼                               ▼
State Updated ◄─────────────── Module Handler
    │
    ▼
Subscribers Notified
    │
    ▼
UI Re-rendered
```

## Offline Strategy

### Service Worker (`sw.js`)
- Cache-first for static assets
- Network-first for API calls
- Background sync for data

### Storage Strategy
- IndexedDB for structured data
- Cache API for assets
- localStorage for settings

## Adding Features

1. **New Panel**: Add to `panels.js` switch statement
2. **New Waypoint Type**: Add to `constants.js` WAYPOINT_TYPES
3. **New Module**: Create file, add to index.html, init in app.js
4. **New State**: Add to state.js initial state and actions

## Performance Considerations

- Canvas rendering for smooth map interaction
- Debounced event handlers
- Lazy panel rendering
- Minimal DOM operations
- CSS transforms for animations
