# GridDown

**Professional-Grade Offline Tactical Navigation & Planning**

GridDown is a feature-rich Progressive Web App (PWA) designed for operational planning in challenging environments where connectivity cannot be assumed. Built for preppers, survivalists, emergency responders, SAR teams, and tactical users who need reliable offline-first functionality.

![GridDown Screenshot](docs/screenshot.png)

## Key Features

### 🗺️ Interactive Mapping
- **Real map tiles** from OpenStreetMap, USGS Topo, USFS, Satellite imagery, and more
- **15+ map sources** with easy layer switching
- Pan, zoom, and rotation with touch gesture support
- Real-time coordinate display (DD, DMS, DDM, UTM, MGRS formats)
- Grid overlay and distance scale

### 📍 Waypoint System
- **7 structured waypoint types**: Water, Fuel, Camp, Resupply, Hazard, Bail-out, Custom
- Type-specific fields (flow rate for water, hours for resupply, etc.)
- Photo attachments, notes, and verification timestamps
- Filter and search waypoints
- Bulk import/export

### 🛣️ Route Planning
- Click-to-create route builder with drag reordering
- Terrain-aware segment classification (highway/road/trail/technical)
- Auto-calculated distance, duration, and elevation
- Visual elevation profiles with grade analysis
- Turn-by-turn navigation with voice guidance
- Off-route alerts and breadcrumb tracking

### 📥 Offline Maps
- **Download entire regions** by drawing polygons on the map
- Multiple zoom level selection
- Storage management dashboard
- Background tile caching
- Works completely offline after download

### ⛽ Logistics Calculator
- **4 vehicle profiles**: 4x4 Truck, Jeep/SUV, ATV/UTV, Motorcycle
- **4 personnel profiles**: Fit Adult, Average Adult, Child, Elderly
- Terrain-aware fuel consumption calculations
- Water and calorie requirements with hot weather adjustment
- Critical resupply point identification
- What-if scenario analysis ("What if this cache is empty?")

### 🚨 Contingency Planning
- Bail-out point analysis with distance calculations
- Checkpoint generation along routes
- Alternative route comparison
- Risk assessment and mitigation planning

### 📻 Communication Tools
- **Radio frequency database**: FRS, GMRS, MURS, Marine, Amateur bands
- Communication plan generator
- Channel/frequency quick reference
- APRS integration for position reporting
- Meshtastic mesh networking support

### 🆘 SOS & Emergency
- Emergency contact management
- Quick-access emergency information
- Signal mirror sun angle calculator
- Distress signal reference

### 🌤️ Environmental Data
- **Weather integration** with forecasts and alerts
- **Sun/Moon calculator**: Rise/set times, moon phase, golden hour
- **Magnetic declination** with auto-calculation by location
- **Terrain analysis**: Slope, aspect, viewshed, flood risk, solar exposure

### 📄 Print & Export
- **GPX import/export** for compatibility with other apps
- **KML/KMZ support** for Google Earth
- **Print-optimized documents**: Route cards, waypoint lists, comm plans
- Encrypted plan sharing (.gdplan format)

### ⚙️ Additional Features
- **Night mode** with red-light and blackout options
- **Measurement tool** for distance and area
- **Location search** with geocoding
- **Undo/Redo** support for all operations
- **Onboarding tour** for new users
- **Keyboard shortcuts** for power users

## Installation

### Option 1: Run Locally
```bash
git clone https://github.com/Ret-tree/GridDown.git
cd GridDown/griddown

# Serve with any static server
npx serve .
# or
python -m http.server 8000
```

Open `http://localhost:8000` in your browser.

### Option 2: Install as PWA
1. Visit the hosted app URL
2. Click "Install" when prompted (or browser menu → "Install App")
3. App will be available offline from your home screen

### Option 3: Deploy to Hosting
Upload the contents to any static hosting:
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
- Any web server

## Project Structure

```
griddown/
├── index.html           # App entry point
├── manifest.json        # PWA manifest
├── sw.js               # Service worker (offline caching)
├── favicon.ico
├── css/
│   └── app.css         # All styles
├── icons/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
├── js/
│   ├── app.js          # Application bootstrap
│   ├── core/
│   │   ├── constants.js    # Configuration & type definitions
│   │   ├── state.js        # Centralized state management
│   │   ├── events.js       # Pub/sub event system
│   │   └── history.js      # Undo/redo support
│   ├── utils/
│   │   ├── helpers.js      # Utility functions
│   │   ├── storage.js      # IndexedDB persistence
│   │   ├── icons.js        # SVG icon library
│   │   ├── coordinates.js  # Coordinate parsing/formatting
│   │   └── events-manager.js
│   └── modules/
│       ├── map.js          # Map rendering & interaction
│       ├── panels.js       # UI panel content
│       ├── modals.js       # Modal dialogs & toasts
│       ├── sidebar.js      # Navigation sidebar
│       ├── routebuilder.js # Route creation
│       ├── logistics.js    # Resource calculations
│       ├── contingency.js  # Bail-out planning
│       ├── offline.js      # Tile downloading
│       ├── gpx.js          # GPX import/export
│       ├── kml.js          # KML/KMZ support
│       ├── gps.js          # GPS tracking
│       ├── navigation.js   # Turn-by-turn guidance
│       ├── elevation.js    # Elevation profiles
│       ├── terrain.js      # Terrain analysis
│       ├── weather.js      # Weather integration
│       ├── sunmoon.js      # Astronomical calculations
│       ├── declination.js  # Magnetic declination
│       ├── radio.js        # Frequency database
│       ├── commplan.js     # Communication planning
│       ├── aprs.js         # APRS integration
│       ├── meshtastic.js   # Mesh networking
│       ├── sos.js          # Emergency features
│       ├── measure.js      # Distance/area tool
│       ├── search.js       # Location search
│       ├── print.js        # Print/PDF export
│       ├── plansharing.js  # Encrypted sharing
│       ├── nightmode.js    # Night vision modes
│       ├── onboarding.js   # First-run tour
│       └── undo.js         # Undo/redo
└── docs/
    ├── ARCHITECTURE.md
    └── AUDIT_REPORT.md
```

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13.1+
- Mobile Safari (iOS 13+)
- Chrome for Android

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Escape` | Close modal/panel |
| `+` / `-` | Zoom in/out |
| `N` | Reset map to north |

## Data Formats

### Waypoint
```javascript
{
    id: "abc123xyz",
    name: "Basecamp Alpha",
    type: "camp",           // water|fuel|camp|resupply|hazard|bailout|custom
    lat: 37.4215,
    lon: -119.1892,
    elevation: 2450,
    notes: "Good cover, near creek",
    verified: true,
    lastVerified: "2025-01-15T10:30:00Z"
}
```

### Route
```javascript
{
    id: "route123",
    name: "Sierra Traverse",
    points: [
        { lat: 37.42, lon: -119.19, terrain: "road" },
        { lat: 37.45, lon: -119.15, terrain: "trail" }
    ],
    distance: "45.2",
    duration: "6h 30m",
    elevation: "3200"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## License

MIT License - See [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with vanilla JavaScript for maximum portability
- Map tiles from OpenStreetMap, USGS, USFS, and Esri
- Weather data from Open-Meteo
- Elevation data from Open-Meteo
- Icons inspired by Lucide/Feather icon sets

---

**Version 6.2.2** | [Changelog](CHANGELOG.md)
