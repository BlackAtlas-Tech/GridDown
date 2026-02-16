# Screenshots for PWA Manifest

The `manifest.json` references these screenshots for richer PWA install prompts:

- `map-wide.png` (1280×720) — Desktop/tablet landscape view of the tactical map
- `map-narrow.png` (750×1334) — Mobile portrait view with FAB and GPS tracking

## How to capture

1. Open GridDown in Chrome DevTools (F12 → Device toolbar)
2. For wide: Set viewport to 1280×720, capture full map view with waypoints
3. For narrow: Set viewport to 375×667 (2x = 750×1334), capture mobile view
4. Save as PNG in this directory

Chrome and Edge will use these screenshots in the PWA install dialog.
