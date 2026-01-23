/**
 * GridDown Communication Plan Module
 * Manages radio frequencies, call signs, check-in schedules, and emergency protocols
 */
const CommPlanModule = (function() {
    'use strict';

    // ==================== Radio Band Definitions ====================
    
    const RADIO_BANDS = {
        frs: {
            name: 'FRS',
            fullName: 'Family Radio Service',
            license: 'None (US)',
            power: '2W max',
            channels: [
                { ch: 1, freq: '462.5625', notes: 'Shared with GMRS' },
                { ch: 2, freq: '462.5875', notes: 'Shared with GMRS' },
                { ch: 3, freq: '462.6125', notes: 'Shared with GMRS' },
                { ch: 4, freq: '462.6375', notes: 'Shared with GMRS' },
                { ch: 5, freq: '462.6625', notes: 'Shared with GMRS' },
                { ch: 6, freq: '462.6875', notes: 'Shared with GMRS' },
                { ch: 7, freq: '462.7125', notes: 'Shared with GMRS' },
                { ch: 8, freq: '467.5625', notes: 'FRS only, 0.5W' },
                { ch: 9, freq: '467.5875', notes: 'FRS only, 0.5W' },
                { ch: 10, freq: '467.6125', notes: 'FRS only, 0.5W' },
                { ch: 11, freq: '467.6375', notes: 'FRS only, 0.5W' },
                { ch: 12, freq: '467.6625', notes: 'FRS only, 0.5W' },
                { ch: 13, freq: '467.6875', notes: 'FRS only, 0.5W' },
                { ch: 14, freq: '467.7125', notes: 'FRS only, 0.5W' },
                { ch: 15, freq: '462.5500', notes: 'Shared with GMRS' },
                { ch: 16, freq: '462.5750', notes: 'Shared with GMRS' },
                { ch: 17, freq: '462.6000', notes: 'Shared with GMRS' },
                { ch: 18, freq: '462.6250', notes: 'Shared with GMRS' },
                { ch: 19, freq: '462.6500', notes: 'Shared with GMRS' },
                { ch: 20, freq: '462.6750', notes: 'Shared with GMRS' },
                { ch: 21, freq: '462.7000', notes: 'Shared with GMRS' },
                { ch: 22, freq: '462.7250', notes: 'Shared with GMRS' }
            ]
        },
        gmrs: {
            name: 'GMRS',
            fullName: 'General Mobile Radio Service',
            license: 'FCC License Required (US)',
            power: '50W max',
            channels: [
                { ch: 1, freq: '462.5625', notes: 'Shared with FRS' },
                { ch: 2, freq: '462.5875', notes: 'Shared with FRS' },
                { ch: 3, freq: '462.6125', notes: 'Shared with FRS' },
                { ch: 4, freq: '462.6375', notes: 'Shared with FRS' },
                { ch: 5, freq: '462.6625', notes: 'Shared with FRS' },
                { ch: 6, freq: '462.6875', notes: 'Shared with FRS' },
                { ch: 7, freq: '462.7125', notes: 'Shared with FRS' },
                { ch: 8, freq: '462.5500', notes: 'GMRS repeater input' },
                { ch: 9, freq: '462.5750', notes: 'GMRS repeater input' },
                { ch: 10, freq: '462.6000', notes: 'GMRS repeater input' },
                { ch: 11, freq: '462.6250', notes: 'GMRS repeater input' },
                { ch: 12, freq: '462.6500', notes: 'GMRS repeater input' },
                { ch: 13, freq: '462.6750', notes: 'GMRS repeater input' },
                { ch: 14, freq: '462.7000', notes: 'GMRS repeater input' },
                { ch: 15, freq: '462.7250', notes: 'GMRS repeater input' },
                { ch: 'RP1', freq: '467.5500', notes: 'Repeater output' },
                { ch: 'RP2', freq: '467.5750', notes: 'Repeater output' },
                { ch: 'RP3', freq: '467.6000', notes: 'Repeater output' },
                { ch: 'RP4', freq: '467.6250', notes: 'Repeater output' },
                { ch: 'RP5', freq: '467.6500', notes: 'Repeater output' },
                { ch: 'RP6', freq: '467.6750', notes: 'Repeater output' },
                { ch: 'RP7', freq: '467.7000', notes: 'Repeater output' },
                { ch: 'RP8', freq: '467.7250', notes: 'Repeater output' }
            ]
        },
        murs: {
            name: 'MURS',
            fullName: 'Multi-Use Radio Service',
            license: 'None (US)',
            power: '2W max',
            channels: [
                { ch: 1, freq: '151.820', notes: '11.25 kHz bandwidth' },
                { ch: 2, freq: '151.880', notes: '11.25 kHz bandwidth' },
                { ch: 3, freq: '151.940', notes: '11.25 kHz bandwidth' },
                { ch: 4, freq: '154.570', notes: '20 kHz bandwidth, "Blue Dot"' },
                { ch: 5, freq: '154.600', notes: '20 kHz bandwidth, "Green Dot"' }
            ]
        },
        ham_2m: {
            name: '2m HAM',
            fullName: '2 Meter Amateur Band',
            license: 'Amateur License Required',
            power: '1500W max',
            channels: [
                { ch: 'Call', freq: '146.520', notes: 'National Simplex Calling' },
                { ch: 'Alt1', freq: '146.550', notes: 'Simplex' },
                { ch: 'Alt2', freq: '146.580', notes: 'Simplex' },
                { ch: 'Emrg', freq: '146.460', notes: 'Emergency/ARES' },
                { ch: 'APRS', freq: '144.390', notes: 'APRS (North America)' }
            ]
        },
        ham_70cm: {
            name: '70cm HAM',
            fullName: '70 Centimeter Amateur Band',
            license: 'Amateur License Required',
            power: '1500W max',
            channels: [
                { ch: 'Call', freq: '446.000', notes: 'National Simplex Calling' },
                { ch: 'Alt1', freq: '446.500', notes: 'Simplex' },
                { ch: 'Alt2', freq: '447.000', notes: 'Simplex' }
            ]
        },
        cb: {
            name: 'CB',
            fullName: 'Citizens Band Radio',
            license: 'None (US)',
            power: '4W AM, 12W SSB',
            channels: [
                { ch: 1, freq: '26.965', notes: '' },
                { ch: 9, freq: '27.065', notes: 'Emergency channel' },
                { ch: 19, freq: '27.185', notes: 'Truckers/Highway' },
                { ch: 40, freq: '27.405', notes: '' }
            ]
        },
        marine: {
            name: 'Marine VHF',
            fullName: 'Marine VHF Radio',
            license: 'Ship Station License (commercial)',
            power: '25W max',
            channels: [
                { ch: 16, freq: '156.800', notes: 'Distress, Safety, Calling' },
                { ch: 9, freq: '156.450', notes: 'Boater Calling (US)' },
                { ch: '22A', freq: '157.100', notes: 'Coast Guard Liaison' },
                { ch: 68, freq: '156.425', notes: 'Non-commercial' },
                { ch: 69, freq: '156.475', notes: 'Non-commercial' },
                { ch: 71, freq: '156.575', notes: 'Non-commercial' },
                { ch: 72, freq: '156.625', notes: 'Non-commercial (Ship to Ship)' }
            ]
        }
    };

    // CTCSS/PL Tones
    const CTCSS_TONES = [
        '67.0', '69.3', '71.9', '74.4', '77.0', '79.7', '82.5', '85.4', '88.5', '91.5',
        '94.8', '97.4', '100.0', '103.5', '107.2', '110.9', '114.8', '118.8', '123.0', '127.3',
        '131.8', '136.5', '141.3', '146.2', '151.4', '156.7', '159.8', '162.2', '165.5', '167.9',
        '171.3', '173.8', '177.3', '179.9', '183.5', '186.2', '189.9', '192.8', '196.6', '199.5',
        '203.5', '206.5', '210.7', '218.1', '225.7', '229.1', '233.6', '241.8', '250.3', '254.1'
    ];

    // ==================== State Management ====================

    let commPlan = {
        id: null,
        name: 'Default Comm Plan',
        created: null,
        modified: null,
        
        // Team members with call signs
        team: [],
        
        // Channel assignments
        channels: {
            primary: null,
            secondary: null,
            emergency: null,
            tactical: []
        },
        
        // Check-in schedule
        checkIns: {
            enabled: false,
            interval: 60, // minutes
            windows: [], // specific check-in times
            missedProtocol: ''
        },
        
        // Protocols
        protocols: {
            lostComms: '',
            emergency: '',
            duress: '',
            codeWords: []
        },
        
        // Notes
        notes: ''
    };

    let savedPlans = [];

    // ==================== Initialization ====================

    async function init() {
        await loadPlans();
        console.log('CommPlan module initialized');
    }

    // ==================== Storage ====================

    async function loadPlans() {
        try {
            if (typeof Storage !== 'undefined') {
                const saved = await Storage.Settings.get('commPlans');
                if (saved && Array.isArray(saved)) {
                    savedPlans = saved;
                }
                
                const activeId = await Storage.Settings.get('activeCommPlan');
                if (activeId) {
                    const active = savedPlans.find(p => p.id === activeId);
                    if (active) {
                        commPlan = { ...active };
                    }
                }
            }
        } catch (e) {
            console.warn('Could not load comm plans:', e);
        }
    }

    async function savePlans() {
        try {
            if (typeof Storage !== 'undefined') {
                await Storage.Settings.set('commPlans', savedPlans);
                if (commPlan.id) {
                    await Storage.Settings.set('activeCommPlan', commPlan.id);
                }
            }
        } catch (e) {
            console.warn('Could not save comm plans:', e);
        }
    }

    function saveCurrentPlan() {
        if (!commPlan.id) {
            commPlan.id = Helpers.generateId();
            commPlan.created = new Date().toISOString();
        }
        commPlan.modified = new Date().toISOString();
        
        const existingIndex = savedPlans.findIndex(p => p.id === commPlan.id);
        if (existingIndex >= 0) {
            savedPlans[existingIndex] = { ...commPlan };
        } else {
            savedPlans.push({ ...commPlan });
        }
        
        savePlans();
    }

    // ==================== Plan Management ====================

    function createNewPlan(name = 'New Comm Plan') {
        commPlan = {
            id: Helpers.generateId(),
            name: name,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            team: [],
            channels: {
                primary: null,
                secondary: null,
                emergency: null,
                tactical: []
            },
            checkIns: {
                enabled: false,
                interval: 60,
                windows: [],
                missedProtocol: 'Attempt contact on secondary channel. After 15 min, initiate search protocol.'
            },
            protocols: {
                lostComms: 'Return to last known rally point. Wait 30 minutes. If no contact, proceed to extraction point.',
                emergency: 'Break squelch 3 times, then transmit "MAYDAY MAYDAY MAYDAY" followed by call sign and situation.',
                duress: 'Use duress code word in transmission to indicate you are under duress.',
                codeWords: [
                    { word: 'SUNSHINE', meaning: 'All clear / Situation normal' },
                    { word: 'OVERCAST', meaning: 'Minor issue / Proceed with caution' },
                    { word: 'THUNDERSTORM', meaning: 'Emergency / Need immediate assistance' }
                ]
            },
            notes: ''
        };
        
        saveCurrentPlan();
        return commPlan;
    }

    function loadPlan(planId) {
        const plan = savedPlans.find(p => p.id === planId);
        if (plan) {
            commPlan = { ...plan };
            savePlans(); // Save active plan reference
            return true;
        }
        return false;
    }

    function deletePlan(planId) {
        const index = savedPlans.findIndex(p => p.id === planId);
        if (index >= 0) {
            savedPlans.splice(index, 1);
            if (commPlan.id === planId) {
                if (savedPlans.length > 0) {
                    commPlan = { ...savedPlans[0] };
                } else {
                    createNewPlan();
                }
            }
            savePlans();
            return true;
        }
        return false;
    }

    function duplicatePlan(planId) {
        const plan = savedPlans.find(p => p.id === planId);
        if (plan) {
            const newPlan = {
                ...JSON.parse(JSON.stringify(plan)),
                id: Helpers.generateId(),
                name: plan.name + ' (Copy)',
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };
            savedPlans.push(newPlan);
            savePlans();
            return newPlan;
        }
        return null;
    }

    // ==================== Team Management ====================

    function addTeamMember(member) {
        const newMember = {
            id: Helpers.generateId(),
            name: member.name || 'Unknown',
            callSign: member.callSign || '',
            role: member.role || '',
            radio: member.radio || '',
            notes: member.notes || ''
        };
        commPlan.team.push(newMember);
        saveCurrentPlan();
        return newMember;
    }

    function updateTeamMember(memberId, updates) {
        const index = commPlan.team.findIndex(m => m.id === memberId);
        if (index >= 0) {
            commPlan.team[index] = { ...commPlan.team[index], ...updates };
            saveCurrentPlan();
            return true;
        }
        return false;
    }

    function removeTeamMember(memberId) {
        const index = commPlan.team.findIndex(m => m.id === memberId);
        if (index >= 0) {
            commPlan.team.splice(index, 1);
            saveCurrentPlan();
            return true;
        }
        return false;
    }

    // ==================== Channel Management ====================

    function setChannel(type, channel) {
        if (type === 'tactical') {
            if (!commPlan.channels.tactical.find(c => c.id === channel.id)) {
                channel.id = channel.id || Helpers.generateId();
                commPlan.channels.tactical.push(channel);
            }
        } else if (['primary', 'secondary', 'emergency'].includes(type)) {
            channel.id = channel.id || Helpers.generateId();
            commPlan.channels[type] = channel;
        }
        saveCurrentPlan();
    }

    function removeChannel(type, channelId) {
        if (type === 'tactical') {
            const index = commPlan.channels.tactical.findIndex(c => c.id === channelId);
            if (index >= 0) {
                commPlan.channels.tactical.splice(index, 1);
            }
        } else if (['primary', 'secondary', 'emergency'].includes(type)) {
            if (commPlan.channels[type]?.id === channelId) {
                commPlan.channels[type] = null;
            }
        }
        saveCurrentPlan();
    }

    function createChannel(data) {
        return {
            id: Helpers.generateId(),
            name: data.name || 'Unnamed Channel',
            frequency: data.frequency || '',
            band: data.band || 'custom',
            channelNum: data.channelNum || '',
            ctcssTone: data.ctcssTone || '',
            dcscode: data.dcscode || '',
            offset: data.offset || '',
            power: data.power || '',
            notes: data.notes || ''
        };
    }

    // ==================== Check-in Management ====================

    function updateCheckInSettings(settings) {
        commPlan.checkIns = { ...commPlan.checkIns, ...settings };
        saveCurrentPlan();
    }

    function addCheckInWindow(time, notes = '') {
        commPlan.checkIns.windows.push({
            id: Helpers.generateId(),
            time: time,
            notes: notes
        });
        saveCurrentPlan();
    }

    function removeCheckInWindow(windowId) {
        const index = commPlan.checkIns.windows.findIndex(w => w.id === windowId);
        if (index >= 0) {
            commPlan.checkIns.windows.splice(index, 1);
            saveCurrentPlan();
        }
    }

    // ==================== Protocol Management ====================

    function updateProtocol(type, text) {
        if (commPlan.protocols.hasOwnProperty(type)) {
            commPlan.protocols[type] = text;
            saveCurrentPlan();
        }
    }

    function addCodeWord(word, meaning) {
        commPlan.protocols.codeWords.push({
            id: Helpers.generateId(),
            word: word.toUpperCase(),
            meaning: meaning
        });
        saveCurrentPlan();
    }

    function removeCodeWord(wordId) {
        const index = commPlan.protocols.codeWords.findIndex(c => c.id === wordId);
        if (index >= 0) {
            commPlan.protocols.codeWords.splice(index, 1);
            saveCurrentPlan();
        }
    }

    // ==================== Utility Functions ====================

    function updatePlanName(name) {
        commPlan.name = name;
        saveCurrentPlan();
    }

    function updateNotes(notes) {
        commPlan.notes = notes;
        saveCurrentPlan();
    }

    function getPlan() {
        return { ...commPlan };
    }

    function getAllPlans() {
        return [...savedPlans];
    }

    function getRadioBands() {
        return RADIO_BANDS;
    }

    function getCTCSSTones() {
        return CTCSS_TONES;
    }

    function getBandChannels(bandKey) {
        return RADIO_BANDS[bandKey]?.channels || [];
    }

    // ==================== Export Functions ====================

    /**
     * Generate a printable/shareable summary of the comm plan
     */
    function generateSummary() {
        const plan = commPlan;
        let summary = '';
        
        summary += `═══════════════════════════════════════════\n`;
        summary += `  COMMUNICATION PLAN: ${plan.name}\n`;
        summary += `  Generated: ${new Date().toLocaleString()}\n`;
        summary += `═══════════════════════════════════════════\n\n`;
        
        // Channels
        summary += `▶ CHANNEL ASSIGNMENTS\n`;
        summary += `─────────────────────\n`;
        if (plan.channels.primary) {
            summary += `PRIMARY:   ${formatChannelSummary(plan.channels.primary)}\n`;
        }
        if (plan.channels.secondary) {
            summary += `SECONDARY: ${formatChannelSummary(plan.channels.secondary)}\n`;
        }
        if (plan.channels.emergency) {
            summary += `EMERGENCY: ${formatChannelSummary(plan.channels.emergency)}\n`;
        }
        if (plan.channels.tactical.length > 0) {
            summary += `TACTICAL:\n`;
            plan.channels.tactical.forEach((ch, i) => {
                summary += `  TAC-${i + 1}: ${formatChannelSummary(ch)}\n`;
            });
        }
        summary += `\n`;
        
        // Team
        if (plan.team.length > 0) {
            summary += `▶ TEAM ROSTER\n`;
            summary += `─────────────────────\n`;
            plan.team.forEach(member => {
                summary += `${member.callSign || '???'} - ${member.name}`;
                if (member.role) summary += ` (${member.role})`;
                summary += `\n`;
            });
            summary += `\n`;
        }
        
        // Check-ins
        if (plan.checkIns.enabled) {
            summary += `▶ CHECK-IN SCHEDULE\n`;
            summary += `─────────────────────\n`;
            if (plan.checkIns.interval) {
                summary += `Interval: Every ${plan.checkIns.interval} minutes\n`;
            }
            if (plan.checkIns.windows.length > 0) {
                summary += `Scheduled Times:\n`;
                plan.checkIns.windows.forEach(w => {
                    summary += `  • ${w.time}${w.notes ? ' - ' + w.notes : ''}\n`;
                });
            }
            if (plan.checkIns.missedProtocol) {
                summary += `\nMissed Check-in Protocol:\n${plan.checkIns.missedProtocol}\n`;
            }
            summary += `\n`;
        }
        
        // Protocols
        summary += `▶ EMERGENCY PROTOCOLS\n`;
        summary += `─────────────────────\n`;
        if (plan.protocols.emergency) {
            summary += `Emergency: ${plan.protocols.emergency}\n\n`;
        }
        if (plan.protocols.lostComms) {
            summary += `Lost Comms: ${plan.protocols.lostComms}\n\n`;
        }
        if (plan.protocols.duress) {
            summary += `Duress: ${plan.protocols.duress}\n\n`;
        }
        
        // Code Words
        if (plan.protocols.codeWords.length > 0) {
            summary += `▶ CODE WORDS\n`;
            summary += `─────────────────────\n`;
            plan.protocols.codeWords.forEach(cw => {
                summary += `${cw.word}: ${cw.meaning}\n`;
            });
            summary += `\n`;
        }
        
        // Notes
        if (plan.notes) {
            summary += `▶ NOTES\n`;
            summary += `─────────────────────\n`;
            summary += `${plan.notes}\n`;
        }
        
        return summary;
    }

    function formatChannelSummary(channel) {
        let str = channel.name;
        if (channel.frequency) {
            str += ` - ${channel.frequency} MHz`;
        }
        if (channel.ctcssTone) {
            str += ` (CTCSS ${channel.ctcssTone})`;
        }
        return str;
    }

    /**
     * Export plan as JSON
     */
    function exportPlanJSON() {
        return JSON.stringify(commPlan, null, 2);
    }

    /**
     * Import plan from JSON
     */
    function importPlanJSON(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (imported.name && imported.channels) {
                imported.id = Helpers.generateId();
                imported.created = new Date().toISOString();
                imported.modified = new Date().toISOString();
                savedPlans.push(imported);
                savePlans();
                return imported;
            }
        } catch (e) {
            console.error('Failed to import comm plan:', e);
        }
        return null;
    }

    /**
     * Download summary as text file
     */
    function downloadSummary() {
        const summary = generateSummary();
        const blob = new Blob([summary], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comm-plan-${commPlan.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==================== Public API ====================

    return {
        init,
        
        // Plan management
        getPlan,
        getAllPlans,
        createNewPlan,
        loadPlan,
        deletePlan,
        duplicatePlan,
        updatePlanName,
        updateNotes,
        saveCurrentPlan,
        
        // Team
        addTeamMember,
        updateTeamMember,
        removeTeamMember,
        
        // Channels
        setChannel,
        removeChannel,
        createChannel,
        
        // Check-ins
        updateCheckInSettings,
        addCheckInWindow,
        removeCheckInWindow,
        
        // Protocols
        updateProtocol,
        addCodeWord,
        removeCodeWord,
        
        // Reference data
        getRadioBands,
        getCTCSSTones,
        getBandChannels,
        
        // Export
        generateSummary,
        exportPlanJSON,
        importPlanJSON,
        downloadSummary,
        
        // Constants
        RADIO_BANDS,
        CTCSS_TONES
    };
})();

window.CommPlanModule = CommPlanModule;
