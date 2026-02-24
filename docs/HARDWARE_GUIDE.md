# GridDown Hardware Compatibility Guide

This guide covers hardware integrations, recommended equipment, and cable configurations for GridDown's various modules.

---

## Table of Contents

1. [Recommended Devices](#recommended-devices)
2. [SSTV (Slow Scan Television)](#sstv-slow-scan-television)
3. [Meshtastic Integration](#meshtastic-integration)
4. [RadiaCode Radiation Detection](#radiacode-radiation-detection)
5. [AtlasRF](#atlasrf)
6. [WiFi Sentinel (Passive Drone Detection)](#wifi-sentinel-passive-drone-detection)
7. [APRS Integration](#aprs-integration)
8. [External GPS](#external-gps)
9. [Audio Interfaces](#audio-interfaces)
10. [Power Solutions](#power-solutions)
11. [Complete Field Kits](#complete-field-kits)

---

## Recommended Devices

### Tablets (Primary Recommendation)

| Device | Price | Why It's Good | Considerations |
|--------|-------|---------------|----------------|
| **Samsung Galaxy Tab Active4 Pro** | ~$650 | MIL-STD-810H, IP68, replaceable battery, S Pen, glove mode | Best overall for field use |
| **Samsung Galaxy Tab Active3** | ~$400 | Previous gen, still rugged, good value | Limited availability |
| **Samsung Galaxy Tab S9 FE** | ~$450 | IP68, good display, S Pen | Not MIL-STD rated |
| **iPad (10th gen)** | ~$350 | Excellent display, smooth performance | No expandable storage, fragile |
| **Oukitel RT6** | ~$350 | Rugged, huge battery (20,000mAh), budget | Slower processor |

### Phones (Backup/Lightweight Option)

| Device | Price | Why It's Good |
|--------|-------|---------------|
| **Samsung Galaxy XCover6 Pro** | ~$500 | Rugged, removable battery, Samsung DeX |
| **Kyocera DuraForce Ultra 5G** | ~$400 | MIL-STD, Sapphire display |
| **Google Pixel 7a** | ~$350 | Great camera for documentation, good GPS |

### Key Device Requirements

- **Web Bluetooth support** (Chrome/Edge) for RadiaCode, Meshtastic
- **Web Audio API** for SSTV encode/decode
- **3.5mm headphone jack** or USB-C audio adapter for radio interface
- **Minimum 4GB RAM** for smooth map tile caching
- **64GB+ storage** for offline map regions

---

## SSTV (Slow Scan Television)

SSTV allows transmission and reception of images over amateur radio. GridDown supports Robot, Martin, Scottie, and PD modes.

### Frequencies

| Band | Frequency | Mode | Activity Level |
|------|-----------|------|----------------|
| 20m HF | **14.230 MHz** | USB | High (primary worldwide) |
| 15m HF | 21.340 MHz | USB | Moderate |
| 10m HF | 28.680 MHz | USB | Variable (solar dependent) |
| 2m VHF | **145.500 MHz** | FM | Regional activity |
| 2m VHF | **145.800 MHz** | FM | ISS SSTV events |
| 70cm UHF | 433.400 MHz | FM | Limited activity |

### Receive-Only Setup (Simplest)

**What you need:**
- Any radio with speaker/headphone output
- Audio cable to device microphone input
- GridDown SSTV module

**Cable configurations by radio connector:**

| Radio Type | Connector | Cable Needed | Cost |
|------------|-----------|--------------|------|
| Most HTs | 3.5mm speaker jack | 3.5mm TRS male-to-male | $5 |
| Icom HTs (IC-52A, IC-V86, etc.) | 2.5mm speaker jack | 2.5mm to 3.5mm adapter + cable | $8 |
| Mobile/Base (RCA) | RCA jack | RCA to 3.5mm cable | $6 |
| Modern HF (USB) | USB audio | USB cable (direct digital) | $10 |

### Transmit + Receive Setup

**Option 1: VOX Mode (No PTT control)**
- Radio's VOX triggers transmit from audio
- Simple but may have delays
- Cable: Bidirectional audio cable to radio's mic/speaker

**Option 2: Audio Interface with PTT**
- Dedicated interface handles PTT
- More reliable, cleaner audio
- Recommended for serious use

### Recommended Audio Interfaces

| Interface | Price | Features | Best For |
|-----------|-------|----------|----------|
| **Digirig Mobile** | $45 | Compact, isolated audio, CAT/PTT | Portable ops, HTs |
| **SignaLink USB** | $130 | Hardware PTT, excellent isolation | Base station, HF |
| **BTECH APRS-K1** | $15 | Basic, no isolation | Budget, testing |
| **Easy Digi** | $40 | USB sound card + isolation | Mid-range option |

### Radio-Specific Cable Guide

#### Icom HTs (IC-52A Plus, IC-V86, IC-T70, IC-W32A)

**Connector:** 2-pin Icom (2.5mm speaker + 3.5mm mic)

| Purpose | Cable | Notes |
|---------|-------|-------|
| RX only | 2.5mm to 3.5mm adapter | Speaker jack to device mic |
| TX+RX | Digirig Icom HT cable | ~$15, works with Digirig Mobile |
| TX+RX | RT Systems USB cable | ~$30, includes USB audio |

**Pinout:**
- 2.5mm jack: Speaker/Ear output
- 3.5mm jack: Mic input, PTT on sleeve (ground to transmit)

#### Yaesu HTs (FT-65R, FT-60R, FT-4X)

**Connector:** 2-pin Yaesu (3.5mm speaker + 2.5mm mic)

| Purpose | Cable |
|---------|-------|
| RX only | 3.5mm TRS male-to-male |
| TX+RX | Digirig Yaesu HT cable (~$15) |

#### Kenwood/Baofeng HTs (TH-D75, UV-5R, etc.)

**Connector:** 2-pin Kenwood (3.5mm speaker + 2.5mm mic)

| Purpose | Cable |
|---------|-------|
| RX only | 3.5mm TRS male-to-male |
| TX+RX | Digirig Kenwood HT cable (~$15) |
| TX+RX | APRS-K1 cable (~$15, budget) |

#### HF Transceivers with USB Audio

These radios have built-in USB audio codecs - **no external interface needed**:

| Radio | Connection | Notes |
|-------|------------|-------|
| **Icom IC-7300** | USB-B | Excellent, just works |
| **Icom IC-705** | USB-C | Portable, highly recommended |
| **Yaesu FT-991A** | USB-B | All-band, great performer |
| **Yaesu FTDX10** | USB-B | Premium HF |
| **Kenwood TS-890S** | USB-B | High-end HF |

#### HF Transceivers Requiring Interface

| Radio | Recommended Interface |
|-------|----------------------|
| Icom IC-718 | SignaLink USB + Icom cable |
| Yaesu FT-450D | SignaLink USB + Yaesu 8-pin cable |
| Kenwood TS-480 | SignaLink USB + Kenwood cable |
| Xiegu G90 | Digirig + Xiegu cable |

### SSTV Radio Recommendations

**Best for HF SSTV:**

| Radio | Price | Why |
|-------|-------|-----|
| **Icom IC-705** | $1,300 | Portable, USB-C audio, HF/VHF/UHF, perfect for field |
| **Icom IC-7300** | $1,100 | Best value HF, built-in USB, waterfall |
| **Xiegu G90** | $450 | Budget HF, needs interface but very capable |

**Best for VHF SSTV & ISS:**

| Radio | Price | Why |
|-------|-------|-----|
| **Kenwood TH-D75A** | $650 | Built-in USB audio, APRS, premium |
| **Yaesu FT-65R** | $80 | Excellent value, reliable |
| **Icom IC-52A Plus** | ~$200 used | Solid dual-band, your current radio |
| **Baofeng UV-5R** | $25 | ISS reception on a budget |

---

## Meshtastic Integration

Meshtastic provides off-grid mesh networking for text, GPS, and telemetry. GridDown integrates via Web Bluetooth for position sharing and messaging.

### Recommended Meshtastic Devices

| Device | Price | Range | Battery | Best For |
|--------|-------|-------|---------|----------|
| **Heltec V3** | $20 | 2-5 km | External | Budget, tinkering |
| **LILYGO T-Beam** | $35 | 5-10 km | 18650 slot | Best value, GPS built-in |
| **RAK WisBlock** | $40 | 5-15 km | Modular | Customization, solar |
| **Heltec Capsule** | $25 | 2-5 km | Built-in | Ultralight, wearable |
| **Station G2** | $80 | 10-20 km | Large | Base station, high power |

### Frequency Bands

| Region | Band | Notes |
|--------|------|-------|
| Americas | 915 MHz | Default for US/Canada |
| Europe | 868 MHz | EU regulations |
| Australia | 915 MHz | Similar to Americas |
| Asia | 923 MHz | Check local regulations |

### Antennas (Significant Impact on Range)

| Antenna | Gain | Best For |
|---------|------|----------|
| Stock stubby | 0-2 dBi | Compact carry |
| Whip 6" | 2-3 dBi | Balanced portable |
| **Nagoya NA-771** | 3-5 dBi | Recommended upgrade |
| Yagi directional | 8-12 dBi | Point-to-point links |
| Collinear base | 6-8 dBi | Fixed station |

### Cases

| Case | Device | Features |
|------|--------|----------|
| RAK Unify Enclosure | RAK WisBlock | IP67, solar-ready |
| 3D printed (Thingiverse) | T-Beam, Heltec | Custom, cheap |
| Pelican 1010 | Any | Waterproof, durable |

---

## RadiaCode Radiation Detection

GridDown integrates with RadiaCode devices via Web Bluetooth for radiation monitoring and mapping.

### Supported Devices

| Device | Price | Detector | Sensitivity | Features |
|--------|-------|----------|-------------|----------|
| **RadiaCode 103** | $350 | CsI(Tl) 10×10mm | High | GPS, spectrum analysis, logging |
| **RadiaCode 102** | $300 | CsI(Tl) | Medium | Previous gen, still excellent |
| **RadiaCode 101** | $250 | CsI(Tl) | Medium | Entry-level, basic features |

### Connection

1. Enable Bluetooth on RadiaCode
2. In GridDown, go to RadiaCode panel
3. Click "Connect" - browser will show pairing dialog
4. Select your RadiaCode device
5. Real-time readings appear on map

### Use Cases

- Background radiation mapping
- Contamination surveys
- HAZMAT response
- Nuclear facility monitoring
- Geological surveys (radon)

---

## AtlasRF

AtlasRF provides multi-protocol RF detection and monitoring. *Hardware integration coming in future updates.*

### Planned Supported Hardware

| Device | Protocols | Connection |
|--------|-----------|------------|
| RTL-SDR Blog V4 | ADS-B, AIS, APRS | USB (requires adapter) |
| AirSpy Mini | Wide spectrum | USB |
| HackRF One | TX/RX capable | USB |
| Flipper Zero | Sub-GHz, NFC | Bluetooth |
| TinySA Ultra | Spectrum analysis | USB |

### Current Data Sources (No Hardware)

AtlasRF can pull from network APIs when online:
- ADS-B Exchange (aircraft)
- MarineTraffic (ships via AIS)
- APRS.fi (amateur radio positions)
- Radiosondy.info (weather balloons)

---

## WiFi Sentinel (Passive Drone Detection)

WiFi Sentinel uses ESP32-C5 hardware for passive drone detection via 802.11 WiFi fingerprinting. Two units provide simultaneous dual-band monitoring.

### ESP32-C5 Hardware

| Component | Specification | Notes |
|-----------|--------------|-------|
| **ESP32-C5 (×2)** | RISC-V, WiFi 6, BLE 5.4 | One per band (2.4 GHz + 5 GHz) |
| **USB-C cables (×2)** | Data-capable, not charge-only | Connect to tablet via USB hub |
| **USB OTG hub** | Multi-port, powered recommended | For connecting both units + other peripherals |

### Firmware

Firmware v4.0.0 is included in the GridDown release. Flash via PlatformIO:

```bash
# Flash both units
./tools/flash_multi_esp32.sh

# Or flash individually
pio run --target upload --upload-port /dev/ttyACM0
```

After flashing, create persistent device symlinks:
```bash
sudo ./tools/setup_udev.sh
# Creates /dev/atlasrf/wifi24 and /dev/atlasrf/wifi5g
```

### Band Configuration

| Unit | Band | Channels | Dwell Time | Full Cycle |
|------|------|----------|-----------|------------|
| wifi_2g | 2.4 GHz | 1, 6, 11 | 500ms | 1.5s |
| wifi_5g | 5 GHz (UNII-1+3) | 36, 40, 44, 48, 149, 153, 157, 161, 165 | 300ms | 2.7s |

DFS channels (52–144) are excluded to avoid regulatory issues with passive monitoring on radar-shared spectrum.

### Termux Bridge Setup

WiFi Sentinel connects to the ESP32 units via WebSocket bridges running in Termux:

```bash
# Install dependencies
pkg install websocat

# Serial bridge for ESP32 hardware (Tier 1)
./scripts/serial-ws-bridge.sh
# Exposes ports 8766 (2.4 GHz) and 8767 (5 GHz)

# WiFi scan bridge for built-in WiFi (Tier 0)
pkg install termux-api
./scripts/wifi-scan-bridge.sh
# Exposes port 8765
```

### Connection Methods

| Method | How | Best For |
|--------|-----|----------|
| **Termux WebSocket** | Bridge scripts relay serial data over WebSocket | Primary method on Android tablets |
| **Web Serial API** | Direct USB serial from browser | Desktop/laptop debugging |

### Power Consumption

Each ESP32-C5 unit draws approximately 120–180 mA during active scanning. With a powered USB hub, both units and the tablet can be sustained from a single power bank. Expect ~8 hours runtime from a 10,000 mAh battery powering two ESP32-C5 units.

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Termux bridge not reachable" | Verify `websocat` is installed: `which websocat`. Check bridge script is running. |
| No detections appearing | Confirm ESP32 units are connected: `ls /dev/ttyACM*`. Check udev rules applied. |
| Only 2.4 GHz detections | Second ESP32 (5 GHz) may not be connected. Check USB hub and cable. |
| High heap warning (red) | ESP32 memory pressure — restart the unit. May indicate firmware issue. |
| Permission denied on serial | Run `sudo chmod 666 /dev/ttyACM*` or ensure udev rules are installed. |

---

## APRS Integration

GridDown displays APRS (Automatic Packet Reporting System) stations from APRS-IS network.

### Hardware for TX/RX APRS

| Option | Price | Notes |
|--------|-------|-------|
| **Kenwood TH-D75A** | $650 | Built-in TNC, GPS, excellent |
| **Mobilinkd TNC4** | $130 | Bluetooth TNC, works with any radio |
| **Direwolf + RTL-SDR** | $30 | RX only, software TNC |
| **Baofeng + APRS-K1 + APRSDroid** | $50 | Budget TX/RX solution |

### APRS Frequencies

| Region | Frequency |
|--------|-----------|
| North America | 144.390 MHz |
| Europe | 144.800 MHz |
| Australia | 145.175 MHz |
| Japan | 144.640 MHz |

---

## External GPS

GridDown uses the device's built-in GPS by default, but external GPS can improve accuracy.

### Recommended External GPS

| Device | Price | Accuracy | Connection |
|--------|-------|----------|------------|
| **Garmin GLO 2** | $100 | 2-3m | Bluetooth |
| **Bad Elf GPS Pro+** | $150 | 1-2m | Bluetooth |
| **Dual XGPS160** | $100 | 2-3m | Bluetooth |
| **u-blox USB** | $30 | 2-5m | USB OTG |

### When External GPS Helps

- Dense urban canyons (tall buildings)
- Heavy tree canopy
- Vehicle-mounted operations (roof antenna)
- When device GPS is weak/slow

---

## Audio Interfaces

### Comparison Table

| Interface | Price | Isolation | PTT | USB Audio | Best For |
|-----------|-------|-----------|-----|-----------|----------|
| **Digirig Mobile** | $45 | Yes | VOX/CAT | Yes | Portable, all-around |
| **SignaLink USB** | $130 | Excellent | Hardware | Yes | Base station |
| **BTECH APRS-K1** | $15 | No | VOX only | No | Budget testing |
| **Easy Digi** | $40 | Yes | VOX | Yes | Mid-range |
| **RigBlaster Adv** | $200 | Excellent | Hardware | Yes | Professional |

### Why Isolation Matters

- Prevents ground loops (audio hum/buzz)
- Protects devices from RF interference
- Cleaner audio = better SSTV decode
- Essential for HF operations

---

## Power Solutions

### Portable Power

| Solution | Capacity | Output | Weight | Best For |
|----------|----------|--------|--------|----------|
| **Anker 737** | 24,000mAh | 140W USB-C | 650g | Multi-device charging |
| **Jackery 300** | 293Wh | AC + USB | 3.2kg | Extended field ops |
| **Goal Zero Yeti 200X** | 187Wh | AC + USB | 2.3kg | Compact base |
| **BioLite BaseCharge** | 600Wh | AC + USB | 5.5kg | Team operations |

### Solar Charging

| Panel | Output | Weight | Notes |
|-------|--------|--------|-------|
| **Anker 625** | 100W | 4.5kg | Foldable, efficient |
| **BigBlue 28W** | 28W | 600g | Ultra-portable |
| **Goal Zero Nomad 50** | 50W | 1.4kg | Rugged, chainable |

### Radio Power

| Radio Type | Power Source | Runtime |
|------------|--------------|---------|
| HT (5W) | 2000mAh battery | 8-12 hours |
| HT (5W) | AA battery pack | 6-8 hours |
| Mobile (50W) | 12V 7Ah SLA | 2-3 hours TX |
| HF Portable | Bioenno 12Ah LiFePO4 | 4-6 hours |

---

## Complete Field Kits

### Minimal Kit (~$150)
*SSTV receive + Meshtastic*

| Item | Price |
|------|-------|
| Baofeng UV-5R | $25 |
| 3.5mm audio cable | $5 |
| Heltec V3 Meshtastic | $20 |
| Phone/tablet (existing) | $0 |
| Anker 10K power bank | $25 |
| **Total** | **~$75** |

### Standard Kit (~$500)
*Full SSTV TX/RX + Meshtastic + RadiaCode*

| Item | Price |
|------|-------|
| Yaesu FT-65R | $80 |
| Digirig Mobile + cable | $60 |
| LILYGO T-Beam | $35 |
| RadiaCode 101 | $250 |
| Samsung Tab Active3 | (varies) |
| Anker 737 power bank | $90 |
| **Total** | **~$515** |

### Professional Kit (~$2,000)
*HF capability + premium hardware + drone detection*

| Item | Price |
|------|-------|
| Icom IC-705 | $1,300 |
| Kenwood TH-D75A | $650 |
| RAK WisBlock Meshtastic | $50 |
| RadiaCode 103 | $350 |
| ESP32-C5 (×2) for WiFi Sentinel | $20 |
| SignaLink USB | $130 |
| Samsung Galaxy Tab Active5 Pro | $650 |
| Goal Zero Yeti 200X | $300 |
| USB-C OTG Hub (powered) | $25 |
| Pelican case | $100 |
| **Total** | **~$3,575** |

---

## Troubleshooting

### SSTV Issues

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| No audio input | Permission denied | Allow microphone in browser |
| Garbled decode | Wrong mode | Let VIS code auto-detect |
| Slanted image | Sample rate mismatch | Check audio settings |
| Weak signal | Cable issue | Check connections, use isolation |
| Hum/buzz | Ground loop | Use isolated interface |

### Meshtastic Issues

| Problem | Solution |
|---------|----------|
| Can't connect | Enable Web Bluetooth in chrome://flags |
| Disconnects | Move closer, check battery |
| No other nodes | Check frequency band for region |

### RadiaCode Issues

| Problem | Solution |
|---------|----------|
| Won't pair | Restart RadiaCode Bluetooth |
| Readings erratic | Calibration needed, check battery |
| No spectrum | Enable spectrum mode in device |

---

## Resources

### Manufacturer Links

- **Digirig:** https://digirig.net
- **SignaLink:** https://tigertronics.com
- **Meshtastic:** https://meshtastic.org
- **RadiaCode:** https://radiacode.com
- **Icom:** https://icomamerica.com
- **Yaesu:** https://yaesu.com
- **Kenwood:** https://kenwoodusa.com

### Community Resources

- **AMSAT** (ISS SSTV schedules): https://amsat.org
- **ARRL** (licensing): https://arrl.org
- **SSTV Handbook:** https://sstv-handbook.com
- **Meshtastic Discord:** https://discord.gg/meshtastic

---

*Document version: 1.0*  
*Last updated: January 2025*  
*GridDown version: 6.19.3+*
