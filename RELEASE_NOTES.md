# GridDown v6.2.2 Release Notes

## 🎯 What's New

This release focuses on UI polish and fixes a minor but noticeable toast notification issue.

### Bug Fixes

- **Fixed toast notification stacking** - Rapidly clicking buttons (like "Cycle Map Layer") no longer creates a pile of toast notifications. New toasts now replace existing ones instantly.
- **Smoother toast animations** - Toast notifications now have a polished fade-out animation instead of abruptly disappearing.
- **Version consistency** - Version number is now correctly displayed as 6.2.2 across all locations (manifest, service worker, and settings panel).

### Documentation

- Completely rewritten README with comprehensive feature documentation
- Added CHANGELOG.md with full version history

---

## 📦 Installation

### Download & Run
1. Download `griddown-6.2.2.zip` below
2. Extract to a folder
3. Serve with any static server:
   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```
4. Open http://localhost:8000

### Install as PWA
After opening in browser, click the install button or use your browser's "Install App" option.

---

## 🔧 Full Feature List

- **29 modules** providing comprehensive offline tactical planning
- **15+ map sources** including USGS, USFS, satellite imagery
- **Offline map download** by drawing regions
- **GPX/KML import/export**
- **Turn-by-turn navigation** with voice guidance
- **Logistics calculator** for fuel, water, and food
- **Radio frequency database** with comm planning
- **Weather integration** and terrain analysis
- **Encrypted plan sharing**
- **Print/PDF export**

See the [README](README.md) for complete documentation.

---

## 📊 Stats

- 29 JavaScript modules
- ~40,000 lines of code
- Fully offline-capable PWA
- Zero external dependencies at runtime

---

## 🔄 Upgrading

If you have a previous version:
1. Replace all files with this release
2. Hard refresh browser (Ctrl+Shift+R)
3. Clear service worker cache if needed (Settings → Clear Tile Cache)

---

**Full Changelog**: [CHANGELOG.md](CHANGELOG.md)
