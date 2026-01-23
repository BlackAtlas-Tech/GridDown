/**
 * GridDown Sun/Moon Calculator Module
 * Calculates sunrise, sunset, twilight times, moon phases, and moonrise/moonset
 * Based on NOAA solar calculator algorithms and astronomical formulas
 */
const SunMoonModule = (function() {
    'use strict';

    // Constants
    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;
    
    // Sun altitude angles for different twilight types
    const TWILIGHT_ANGLES = {
        sunrise: -0.833,      // Standard sunrise/sunset (accounting for refraction)
        civil: -6,            // Civil twilight
        nautical: -12,        // Nautical twilight
        astronomical: -18     // Astronomical twilight
    };

    // Current location (default to Sierra Nevada area)
    let currentLat = 37.4215;
    let currentLon = -119.1892;
    let currentTimezone = null; // Auto-detect

    /**
     * Initialize the module
     */
    function init() {
        // Try to get current location from map
        if (typeof MapModule !== 'undefined') {
            const state = MapModule.getMapState();
            if (state) {
                currentLat = state.lat;
                currentLon = state.lon;
            }
        }
        
        // Auto-detect timezone from browser
        currentTimezone = -new Date().getTimezoneOffset() / 60;
    }

    /**
     * Set the location for calculations
     */
    function setLocation(lat, lon, timezone = null) {
        currentLat = lat;
        currentLon = lon;
        if (timezone !== null) {
            currentTimezone = timezone;
        }
    }

    /**
     * Get current location
     */
    function getLocation() {
        return { 
            lat: currentLat, 
            lon: currentLon, 
            timezone: currentTimezone !== null ? currentTimezone : -new Date().getTimezoneOffset() / 60 
        };
    }

    // ==================== Julian Date Calculations ====================

    /**
     * Calculate Julian Day from date
     */
    function dateToJulianDay(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
        
        let y = year;
        let m = month;
        
        if (m <= 2) {
            y -= 1;
            m += 12;
        }
        
        const A = Math.floor(y / 100);
        const B = 2 - A + Math.floor(A / 4);
        
        return Math.floor(365.25 * (y + 4716)) + 
               Math.floor(30.6001 * (m + 1)) + 
               day + hour / 24 + B - 1524.5;
    }

    /**
     * Calculate Julian Century from Julian Day
     */
    function julianCentury(jd) {
        return (jd - 2451545.0) / 36525.0;
    }

    // ==================== Solar Calculations ====================

    /**
     * Calculate solar mean longitude (degrees)
     */
    function solarMeanLongitude(T) {
        let L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
        while (L0 > 360) L0 -= 360;
        while (L0 < 0) L0 += 360;
        return L0;
    }

    /**
     * Calculate solar mean anomaly (degrees)
     */
    function solarMeanAnomaly(T) {
        return 357.52911 + T * (35999.0502909 - 0.0001537 * T);
    }

    /**
     * Calculate eccentricity of Earth's orbit
     */
    function eccentricityEarthOrbit(T) {
        return 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    }

    /**
     * Calculate solar equation of center (degrees)
     */
    function solarEquationOfCenter(T) {
        const M = solarMeanAnomaly(T);
        const mrad = M * DEG_TO_RAD;
        const sinm = Math.sin(mrad);
        const sin2m = Math.sin(2 * mrad);
        const sin3m = Math.sin(3 * mrad);
        
        return sinm * (1.914602 - T * (0.004817 + 0.000014 * T)) +
               sin2m * (0.019993 - 0.000101 * T) +
               sin3m * 0.000289;
    }

    /**
     * Calculate solar true longitude (degrees)
     */
    function solarTrueLongitude(T) {
        return solarMeanLongitude(T) + solarEquationOfCenter(T);
    }

    /**
     * Calculate solar apparent longitude (degrees)
     */
    function solarApparentLongitude(T) {
        const O = solarTrueLongitude(T);
        const omega = 125.04 - 1934.136 * T;
        return O - 0.00569 - 0.00478 * Math.sin(omega * DEG_TO_RAD);
    }

    /**
     * Calculate mean obliquity of ecliptic (degrees)
     */
    function meanObliquityOfEcliptic(T) {
        const seconds = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813));
        return 23 + (26 + seconds / 60) / 60;
    }

    /**
     * Calculate corrected obliquity (degrees)
     */
    function obliquityCorrection(T) {
        const e0 = meanObliquityOfEcliptic(T);
        const omega = 125.04 - 1934.136 * T;
        return e0 + 0.00256 * Math.cos(omega * DEG_TO_RAD);
    }

    /**
     * Calculate solar declination (degrees)
     */
    function solarDeclination(T) {
        const e = obliquityCorrection(T);
        const lambda = solarApparentLongitude(T);
        const sint = Math.sin(e * DEG_TO_RAD) * Math.sin(lambda * DEG_TO_RAD);
        return Math.asin(sint) * RAD_TO_DEG;
    }

    /**
     * Calculate equation of time (minutes)
     */
    function equationOfTime(T) {
        const e = obliquityCorrection(T);
        const L0 = solarMeanLongitude(T);
        const ecc = eccentricityEarthOrbit(T);
        const M = solarMeanAnomaly(T);
        
        let y = Math.tan((e / 2) * DEG_TO_RAD);
        y *= y;
        
        const sin2l0 = Math.sin(2 * L0 * DEG_TO_RAD);
        const sinm = Math.sin(M * DEG_TO_RAD);
        const cos2l0 = Math.cos(2 * L0 * DEG_TO_RAD);
        const sin4l0 = Math.sin(4 * L0 * DEG_TO_RAD);
        const sin2m = Math.sin(2 * M * DEG_TO_RAD);
        
        const Etime = y * sin2l0 - 2 * ecc * sinm + 4 * ecc * y * sinm * cos2l0 -
                      0.5 * y * y * sin4l0 - 1.25 * ecc * ecc * sin2m;
        
        return 4 * Etime * RAD_TO_DEG;
    }

    /**
     * Calculate hour angle for given sun altitude (degrees)
     */
    function hourAngleSunrise(lat, decl, altitude) {
        const latRad = lat * DEG_TO_RAD;
        const declRad = decl * DEG_TO_RAD;
        const altRad = altitude * DEG_TO_RAD;
        
        const cosHA = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(declRad)) /
                      (Math.cos(latRad) * Math.cos(declRad));
        
        // Check if sun never rises or never sets
        if (cosHA > 1) return null;  // Sun never rises
        if (cosHA < -1) return null; // Sun never sets
        
        return Math.acos(cosHA) * RAD_TO_DEG;
    }

    /**
     * Calculate solar noon time (in minutes from midnight UTC)
     */
    function calcSolarNoon(jd, lon, timezone) {
        const T = julianCentury(jd);
        const eqTime = equationOfTime(T);
        const solNoon = 720 - 4 * lon - eqTime; // In minutes UTC
        return solNoon + timezone * 60; // Adjust to local time
    }

    /**
     * Calculate sunrise or sunset time
     * Returns time in minutes from midnight (local time)
     */
    function calcSunriseSet(date, lat, lon, timezone, altitude, isRising) {
        const jd = dateToJulianDay(date);
        const T = julianCentury(jd);
        
        const eqTime = equationOfTime(T);
        const decl = solarDeclination(T);
        const ha = hourAngleSunrise(lat, decl, altitude);
        
        if (ha === null) return null;
        
        let timeOffset;
        if (isRising) {
            timeOffset = 720 - 4 * (lon + ha) - eqTime;
        } else {
            timeOffset = 720 - 4 * (lon - ha) - eqTime;
        }
        
        return timeOffset + timezone * 60;
    }

    /**
     * Get all sun times for a given date
     */
    function getSunTimes(date, lat = currentLat, lon = currentLon, timezone = null) {
        if (timezone === null) {
            timezone = -date.getTimezoneOffset() / 60;
        }
        
        const times = {};
        
        // Convert minutes to hours for consistency
        const toHours = (minutes) => minutes !== null ? minutes / 60 : null;
        
        // Sunrise and sunset
        times.sunrise = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.sunrise, true));
        times.sunset = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.sunrise, false));
        
        // Solar noon
        const jd = dateToJulianDay(date);
        times.solarNoon = toHours(calcSolarNoon(jd, lon, timezone));
        
        // Civil twilight
        times.civilDawn = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.civil, true));
        times.civilDusk = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.civil, false));
        
        // Nautical twilight
        times.nauticalDawn = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.nautical, true));
        times.nauticalDusk = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.nautical, false));
        
        // Astronomical twilight
        times.astronomicalDawn = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.astronomical, true));
        times.astronomicalDusk = toHours(calcSunriseSet(date, lat, lon, timezone, TWILIGHT_ANGLES.astronomical, false));
        
        // Day length
        if (times.sunrise !== null && times.sunset !== null) {
            times.dayLength = times.sunset - times.sunrise;
        } else {
            times.dayLength = null;
        }
        
        // Golden hour (sun at 6° above horizon)
        times.goldenHourStart = toHours(calcSunriseSet(date, lat, lon, timezone, 6, false));
        times.goldenHourEnd = times.sunset;
        times.goldenHourMorningStart = times.sunrise;
        times.goldenHourMorningEnd = toHours(calcSunriseSet(date, lat, lon, timezone, 6, true));
        
        return times;
    }

    // ==================== Moon Calculations ====================

    /**
     * Calculate moon phase (0-1, where 0 = new moon, 0.5 = full moon)
     * Using a simplified but accurate algorithm
     */
    function getMoonPhase(date) {
        // Known new moon reference: January 6, 2000 at 18:14 UTC
        const newMoon2000 = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
        const lunarCycle = 29.530588853; // Synodic month in days
        
        const daysSinceRef = (date.getTime() - newMoon2000.getTime()) / (1000 * 60 * 60 * 24);
        let phase = (daysSinceRef % lunarCycle) / lunarCycle;
        if (phase < 0) phase += 1;
        
        // Calculate illumination using phase angle
        const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
        
        // Age in days since new moon
        const age = phase * lunarCycle;
        
        return {
            phase: phase,
            illumination: illumination,
            age: age
        };
    }

    /**
     * Get moon phase name
     */
    function getMoonPhaseName(phase) {
        if (phase < 0.025 || phase >= 0.975) return 'New Moon';
        if (phase < 0.225) return 'Waxing Crescent';
        if (phase < 0.275) return 'First Quarter';
        if (phase < 0.475) return 'Waxing Gibbous';
        if (phase < 0.525) return 'Full Moon';
        if (phase < 0.725) return 'Waning Gibbous';
        if (phase < 0.775) return 'Last Quarter';
        return 'Waning Crescent';
    }

    /**
     * Get moon phase emoji
     */
    function getMoonPhaseEmoji(phase) {
        if (phase < 0.025 || phase >= 0.975) return '🌑';
        if (phase < 0.225) return '🌒';
        if (phase < 0.275) return '🌓';
        if (phase < 0.475) return '🌔';
        if (phase < 0.525) return '🌕';
        if (phase < 0.725) return '🌖';
        if (phase < 0.775) return '🌗';
        return '🌘';
    }

    /**
     * Calculate moonrise/moonset times (approximation)
     * Moon rise/set times shift by ~50 minutes each day
     */
    function getMoonTimes(date, lat = currentLat, lon = currentLon, timezone = null) {
        if (timezone === null) {
            timezone = -date.getTimezoneOffset() / 60;
        }
        
        const jd = dateToJulianDay(date);
        const T = julianCentury(jd);
        
        // Moon's mean longitude
        const L = (218.32 + 481267.883 * T) % 360;
        // Moon's mean anomaly
        const M = (134.9 + 477198.85 * T) % 360;
        // Moon's mean distance
        const F = (93.27 + 483202.02 * T) % 360;
        
        // Simplified moon position
        const moonLon = L + 6.29 * Math.sin(M * DEG_TO_RAD);
        
        // Moon's declination (simplified)
        const obliq = 23.439 - 0.00000036 * (jd - 2451545);
        const moonDec = Math.asin(Math.sin(obliq * DEG_TO_RAD) * Math.sin((moonLon % 360) * DEG_TO_RAD)) * RAD_TO_DEG;
        
        // Hour angle for moon (horizon angle accounting for parallax)
        const moonHA = hourAngleSunrise(lat, moonDec, -0.583);
        
        if (moonHA === null) {
            return { 
                moonrise: null, 
                moonset: null, 
                alwaysUp: lat * moonDec > 0 && Math.abs(moonDec) > (90 - Math.abs(lat)),
                alwaysDown: lat * moonDec < 0 && Math.abs(moonDec) > (90 - Math.abs(lat))
            };
        }
        
        // Moon's right ascension
        const moonRA = Math.atan2(
            Math.sin(moonLon * DEG_TO_RAD) * Math.cos(obliq * DEG_TO_RAD),
            Math.cos(moonLon * DEG_TO_RAD)
        ) * RAD_TO_DEG;
        
        // Local sidereal time at midnight
        const jd0 = Math.floor(jd - 0.5) + 0.5;
        const T0 = (jd0 - 2451545.0) / 36525.0;
        let LST = 100.46061837 + 36000.770053608 * T0 + lon;
        LST = ((LST % 360) + 360) % 360;
        
        // Transit time
        let transitHA = moonRA - LST;
        while (transitHA < -180) transitHA += 360;
        while (transitHA > 180) transitHA -= 360;
        const transit = 12 + transitHA / 15 + timezone - lon / 15;
        
        // Rise and set times
        const rise = transit - moonHA / 15;
        const set = transit + moonHA / 15;
        
        return {
            moonrise: ((rise % 24) + 24) % 24,
            moonset: ((set % 24) + 24) % 24,
            transit: ((transit % 24) + 24) % 24
        };
    }

    /**
     * Get all moon data for a date
     */
    function getMoonData(date, lat = currentLat, lon = currentLon, timezone = null) {
        const phase = getMoonPhase(date);
        const times = getMoonTimes(date, lat, lon, timezone);
        
        return {
            phase: phase.phase,
            illumination: phase.illumination,
            age: phase.age,
            name: getMoonPhaseName(phase.phase),
            emoji: getMoonPhaseEmoji(phase.phase),
            moonrise: times.moonrise,
            moonset: times.moonset,
            alwaysUp: times.alwaysUp,
            alwaysDown: times.alwaysDown
        };
    }

    // ==================== Utility Functions ====================

    /**
     * Format decimal hours to HH:MM string (24h format)
     */
    function formatTime(hours) {
        if (hours === null || hours === undefined || isNaN(hours)) {
            return '--:--';
        }
        
        hours = ((hours % 24) + 24) % 24;
        
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        
        if (m === 60) {
            return `${String((h + 1) % 24).padStart(2, '0')}:00`;
        }
        
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    /**
     * Format decimal hours to 12-hour format with AM/PM
     */
    function formatTime12(hours) {
        if (hours === null || hours === undefined || isNaN(hours)) {
            return '--:-- --';
        }
        
        hours = ((hours % 24) + 24) % 24;
        
        const h24 = Math.floor(hours);
        const m = Math.round((hours - h24) * 60);
        const ampm = h24 >= 12 ? 'PM' : 'AM';
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        
        if (m === 60) {
            h12 = (h12 % 12) + 1;
            if (h12 === 12) {
                return `12:00 ${h24 >= 11 ? 'PM' : 'AM'}`;
            }
            return `${h12}:00 ${ampm}`;
        }
        
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    /**
     * Format duration in hours to readable string
     */
    function formatDuration(hours) {
        if (hours === null || hours === undefined || isNaN(hours)) {
            return '--h --m';
        }
        
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        
        return `${h}h ${m}m`;
    }

    /**
     * Get next major lunar event
     */
    function getNextLunarEvent(date) {
        const phase = getMoonPhase(date);
        const currentAge = phase.age;
        const synodicMonth = 29.530588853;
        
        // Ages of major phases (in days from new moon)
        const phases = [
            { name: 'New Moon', age: 0, emoji: '🌑' },
            { name: 'First Quarter', age: 7.38265, emoji: '🌓' },
            { name: 'Full Moon', age: 14.7653, emoji: '🌕' },
            { name: 'Last Quarter', age: 22.14795, emoji: '🌗' }
        ];
        
        let nextEvent = null;
        let minDays = synodicMonth;
        
        for (const p of phases) {
            let daysUntil = p.age - currentAge;
            if (daysUntil <= 0) daysUntil += synodicMonth;
            
            if (daysUntil < minDays) {
                minDays = daysUntil;
                const eventDate = new Date(date);
                eventDate.setDate(eventDate.getDate() + Math.round(daysUntil));
                nextEvent = { 
                    name: p.name, 
                    emoji: p.emoji, 
                    daysUntil: daysUntil,
                    date: eventDate
                };
            }
        }
        
        return nextEvent;
    }

    /**
     * Get complete almanac data for a date and location
     */
    function getAlmanac(date = new Date(), lat = currentLat, lon = currentLon, timezone = null) {
        const sunTimes = getSunTimes(date, lat, lon, timezone);
        const moonData = getMoonData(date, lat, lon, timezone);
        const nextLunar = getNextLunarEvent(date);
        
        return {
            date: date,
            location: { lat, lon, timezone: timezone || -date.getTimezoneOffset() / 60 },
            sun: {
                ...sunTimes,
                formattedSunrise: formatTime12(sunTimes.sunrise),
                formattedSunset: formatTime12(sunTimes.sunset),
                formattedNoon: formatTime12(sunTimes.solarNoon),
                formattedDayLength: formatDuration(sunTimes.dayLength),
                formattedCivilDawn: formatTime12(sunTimes.civilDawn),
                formattedCivilDusk: formatTime12(sunTimes.civilDusk),
                formattedNauticalDawn: formatTime12(sunTimes.nauticalDawn),
                formattedNauticalDusk: formatTime12(sunTimes.nauticalDusk),
                formattedAstronomicalDawn: formatTime12(sunTimes.astronomicalDawn),
                formattedAstronomicalDusk: formatTime12(sunTimes.astronomicalDusk),
                formattedGoldenHourStart: formatTime12(sunTimes.goldenHourStart),
                formattedGoldenHourEnd: formatTime12(sunTimes.goldenHourEnd)
            },
            moon: {
                ...moonData,
                formattedMoonrise: formatTime12(moonData.moonrise),
                formattedMoonset: formatTime12(moonData.moonset),
                illuminationPercent: Math.round(moonData.illumination * 100)
            },
            nextLunarEvent: nextLunar
        };
    }

    /**
     * Render the sun/moon panel HTML
     */
    function renderPanel(date = new Date()) {
        const almanac = getAlmanac(date);
        const sun = almanac.sun;
        const moon = almanac.moon;
        const nextLunar = almanac.nextLunarEvent;
        
        const dateStr = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        return `
            <div style="padding:12px">
                <!-- Date Selector -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding:10px;background:rgba(255,255,255,0.03);border-radius:10px">
                    <button class="btn btn--secondary" id="sunmoon-prev" style="padding:8px 12px;min-width:40px">◀</button>
                    <div style="text-align:center;flex:1">
                        <div style="font-size:14px;font-weight:600">${dateStr}</div>
                        <input type="date" id="sunmoon-date" value="${date.toISOString().split('T')[0]}" 
                            style="background:transparent;border:none;color:rgba(255,255,255,0.5);font-size:11px;text-align:center;cursor:pointer;width:100%">
                    </div>
                    <button class="btn btn--secondary" id="sunmoon-next" style="padding:8px 12px;min-width:40px">▶</button>
                </div>
                
                <!-- Sun Section -->
                <div style="margin-bottom:20px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                        <span style="font-size:24px">☀️</span>
                        <span style="font-size:16px;font-weight:600">Sun</span>
                    </div>
                    
                    <!-- Sunrise/Sunset -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                        <div style="padding:14px;background:linear-gradient(135deg,rgba(251,191,36,0.15),rgba(251,191,36,0.05));border:1px solid rgba(251,191,36,0.2);border-radius:10px">
                            <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px">Sunrise</div>
                            <div style="font-size:22px;font-weight:700;color:#fbbf24;margin-top:4px">${sun.formattedSunrise}</div>
                        </div>
                        <div style="padding:14px;background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05));border:1px solid rgba(249,115,22,0.2);border-radius:10px">
                            <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px">Sunset</div>
                            <div style="font-size:22px;font-weight:700;color:#f97316;margin-top:4px">${sun.formattedSunset}</div>
                        </div>
                    </div>
                    
                    <!-- Day Length & Solar Noon -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                        <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px">
                            <div style="font-size:10px;color:rgba(255,255,255,0.4)">Day Length</div>
                            <div style="font-size:16px;font-weight:600">${sun.formattedDayLength}</div>
                        </div>
                        <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px">
                            <div style="font-size:10px;color:rgba(255,255,255,0.4)">Solar Noon</div>
                            <div style="font-size:16px;font-weight:600">${sun.formattedNoon}</div>
                        </div>
                    </div>
                    
                    <!-- Twilight Times (Expandable) -->
                    <details style="margin-bottom:8px">
                        <summary style="cursor:pointer;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:12px;color:rgba(255,255,255,0.6);list-style:none;display:flex;align-items:center;gap:8px">
                            <span style="transition:transform 0.2s">▶</span>
                            <span>Twilight & Golden Hour</span>
                        </summary>
                        <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:0 0 8px 8px;margin-top:2px">
                            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                                <span style="font-size:12px;color:rgba(255,255,255,0.5)">🌅 Civil Twilight</span>
                                <span style="font-size:12px">${sun.formattedCivilDawn} → ${sun.formattedCivilDusk}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                                <span style="font-size:12px;color:rgba(255,255,255,0.5)">🚢 Nautical Twilight</span>
                                <span style="font-size:12px">${sun.formattedNauticalDawn} → ${sun.formattedNauticalDusk}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                                <span style="font-size:12px;color:rgba(255,255,255,0.5)">🌌 Astronomical Twilight</span>
                                <span style="font-size:12px">${sun.formattedAstronomicalDawn} → ${sun.formattedAstronomicalDusk}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;padding:8px 0">
                                <span style="font-size:12px;color:#f97316">📸 Golden Hour (PM)</span>
                                <span style="font-size:12px;color:#f97316">${sun.formattedGoldenHourStart} → ${sun.formattedGoldenHourEnd}</span>
                            </div>
                        </div>
                    </details>
                </div>
                
                <!-- Moon Section -->
                <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                        <span style="font-size:24px">${moon.emoji}</span>
                        <span style="font-size:16px;font-weight:600">Moon</span>
                    </div>
                    
                    <!-- Moon Phase -->
                    <div style="padding:16px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border:1px solid rgba(139,92,246,0.2);border-radius:12px;margin-bottom:12px">
                        <div style="display:flex;align-items:center;justify-content:space-between">
                            <div>
                                <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px">Phase</div>
                                <div style="font-size:18px;font-weight:600;color:#a78bfa;margin-top:2px">${moon.name}</div>
                                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px">Age: ${moon.age.toFixed(1)} days</div>
                            </div>
                            <div style="text-align:right">
                                <div style="font-size:36px">${moon.emoji}</div>
                                <div style="font-size:14px;font-weight:700;color:#a78bfa">${moon.illuminationPercent}%</div>
                            </div>
                        </div>
                        <!-- Phase Progress Bar -->
                        <div style="margin-top:12px">
                            <div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.3);margin-bottom:4px">
                                <span>🌑 New</span>
                                <span>🌓</span>
                                <span>🌕 Full</span>
                                <span>🌗</span>
                                <span>🌑</span>
                            </div>
                            <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;position:relative">
                                <div style="position:absolute;left:${moon.phase * 100}%;width:8px;height:100%;background:#8b5cf6;border-radius:3px;transform:translateX(-50%);box-shadow:0 0 8px #8b5cf6"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Moonrise/Moonset -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                        <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px">
                            <div style="font-size:10px;color:rgba(255,255,255,0.4)">Moonrise</div>
                            <div style="font-size:16px;font-weight:600">${moon.formattedMoonrise}</div>
                        </div>
                        <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px">
                            <div style="font-size:10px;color:rgba(255,255,255,0.4)">Moonset</div>
                            <div style="font-size:16px;font-weight:600">${moon.formattedMoonset}</div>
                        </div>
                    </div>
                    
                    <!-- Next Lunar Event -->
                    ${nextLunar ? `
                        <div style="padding:12px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.15);border-radius:8px">
                            <div style="display:flex;align-items:center;justify-content:space-between">
                                <div>
                                    <div style="font-size:10px;color:rgba(255,255,255,0.4)">Next Phase</div>
                                    <div style="font-size:14px;color:#a78bfa;font-weight:500">${nextLunar.emoji} ${nextLunar.name}</div>
                                </div>
                                <div style="text-align:right">
                                    <div style="font-size:14px;font-weight:600">${Math.ceil(nextLunar.daysUntil)} days</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.4)">
                                        ${nextLunar.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Location Info -->
                <div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:6px">
                        <span>📍</span>
                        <span>
                            ${Math.abs(currentLat).toFixed(4)}°${currentLat >= 0 ? 'N' : 'S'}, 
                            ${Math.abs(currentLon).toFixed(4)}°${currentLon >= 0 ? 'E' : 'W'}
                        </span>
                    </div>
                    <button class="btn btn--secondary" id="sunmoon-use-map" style="width:100%;margin-top:8px;padding:8px;font-size:11px">
                        📍 Use Map Center Location
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Bind panel event handlers
     */
    function bindPanelEvents(container, currentDate, onDateChange, onLocationChange) {
        const prevBtn = container.querySelector('#sunmoon-prev');
        const nextBtn = container.querySelector('#sunmoon-next');
        const dateInput = container.querySelector('#sunmoon-date');
        const useMapBtn = container.querySelector('#sunmoon-use-map');
        
        if (prevBtn) {
            prevBtn.onclick = () => {
                const newDate = new Date(currentDate);
                newDate.setDate(newDate.getDate() - 1);
                onDateChange(newDate);
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => {
                const newDate = new Date(currentDate);
                newDate.setDate(newDate.getDate() + 1);
                onDateChange(newDate);
            };
        }
        
        if (dateInput) {
            dateInput.onchange = (e) => {
                const newDate = new Date(e.target.value + 'T12:00:00');
                onDateChange(newDate);
            };
        }
        
        if (useMapBtn && onLocationChange) {
            useMapBtn.onclick = () => {
                if (typeof MapModule !== 'undefined') {
                    const state = MapModule.getMapState();
                    if (state) {
                        setLocation(state.lat, state.lon);
                        onLocationChange(state.lat, state.lon);
                    }
                }
            };
        }
    }

    // Public API
    return {
        init,
        setLocation,
        getLocation,
        getSunTimes,
        getMoonPhase,
        getMoonPhaseName,
        getMoonPhaseEmoji,
        getMoonTimes,
        getMoonData,
        getNextLunarEvent,
        getAlmanac,
        formatTime,
        formatTime12,
        formatDuration,
        renderPanel,
        bindPanelEvents
    };
})();

window.SunMoonModule = SunMoonModule;
